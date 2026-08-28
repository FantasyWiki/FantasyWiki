import { Temporal } from "@js-temporal/polyfill";
import type { Filter } from "mongodb";
import { GLOBAL_LEAGUE_ID, Team } from "../../../../model";
import { LeagueVisibility } from "../../../../model/enums";
import { STARTING_CREDITS } from "../../../../model/team";
import {
  LeaveOutcome,
  TEAM_ERRORS,
  TeamMembership,
  TeamRepository,
} from "../teamRepository";
import { Result, success, failure } from "../result";
import { errorMessage } from "./connection";
import { teamCreditsStages, type LeagueDoc } from "./schema";
import type { MongoStore } from "./store";

/**
 * A league's own entry rules, as a filter: it is open, and either anyone may
 * walk in, or this is its admin, or the code presented is its code.
 *
 * Three ways in and no others, matching the `OR` inside the D1 insert. The
 * admin is one of them so the founder of a private league is never locked out
 * of it.
 */
function admits(
  playerId: string,
  invitationCode: string | undefined,
): Filter<LeagueDoc> {
  return {
    closedAt: null,
    $or: [
      { visibility: LeagueVisibility.PUBLIC },
      { adminId: playerId },
      // A join offering no code can never match: the comparison is against a
      // sentinel that is not a legal code, rather than against `null`, which
      // every codeless league carries.
      { invitationCode: invitationCode ?? "" },
    ],
  };
}

/**
 * Lowercase the way Mongo's `$toLower` does — the ASCII letters and nothing
 * else.
 *
 * `String.prototype.toLowerCase` folds the whole Unicode range, and `$toLower`
 * is documented as well-defined for ASCII only: it turns `CAFÉ` into `cafÉ`,
 * not `café`. Folding the two sides differently would make a name check
 * order-dependent — with `café` stored, `CAFÉ` would collide, but with `CAFÉ`
 * stored, `café` would not. This matches D1's `LOWER()`, which is ASCII-only on
 * both sides of its comparison.
 */
function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

/**
 * Only the fields a `Team` has, with the id where the domain expects it.
 *
 * Run after {@link teamCreditsStages}, so `credits` is the derived balance and
 * not a stored one — there is no such column, and there must not be (ADR 0007).
 */
const TEAM_PROJECTION = {
  $project: {
    _id: 0,
    id: "$_id",
    name: 1,
    playerId: 1,
    leagueId: 1,
    credits: 1,
  },
};

export class TeamRepositoryMongo implements TeamRepository {
  constructor(private readonly store: MongoStore) {}

  async create(team: {
    name: string;
    playerId: string;
    leagueId: string;
    invitationCode?: string;
  }): Promise<Result<Team>> {
    const id = crypto.randomUUID();
    try {
      return await this.store.transaction(async (session, of) => {
        // One row per player per league, ever — which is also what the unique
        // index says, but as a condition of the write it comes back through the
        // sentinel protocol rather than as driver text, and it covers the row of
        // a player who has left.
        const held = await of.teams.findOne(
          { playerId: team.playerId, leagueId: team.leagueId },
          { session },
        );
        if (held) return failure(TEAM_ERRORS.JOIN_CONFLICT);

        // The league's entry rules ride in a write on the league itself, not in
        // a read before the insert: two joins racing an admin's close would
        // both pass a read, and only a write puts them in each other's way. The
        // revision it bumps is the joiner's place in the queue — see
        // `LeagueDoc.revision`.
        const admitted = await of.leagues.findOneAndUpdate(
          { _id: team.leagueId, ...admits(team.playerId, team.invitationCode) },
          { $inc: { revision: 1 } },
          { session, returnDocument: "after" },
        );
        // Matched nothing: the league is gone, or its rules turned the join
        // down. Which one is not this layer's to guess — the service re-reads.
        if (!admitted) return failure(TEAM_ERRORS.JOIN_CONFLICT);

        await of.teams.insertOne(
          {
            _id: id,
            name: team.name,
            playerId: team.playerId,
            leagueId: team.leagueId,
            leftAt: null,
            seq: admitted.revision,
          },
          { session },
        );

        // A brand-new team has zero contracts, so its derived credits is
        // trivially the starting budget — no read needed.
        return success({
          id,
          name: team.name,
          playerId: team.playerId,
          leagueId: team.leagueId,
          credits: STARTING_CREDITS,
        });
      });
    } catch (error) {
      return failure(`Error creating team: ${errorMessage(error)}`);
    }
  }

  async rejoin(team: {
    name: string;
    playerId: string;
    leagueId: string;
    invitationCode?: string;
  }): Promise<Result<Team>> {
    try {
      const rejoined = await this.store.transaction(async (session, of) => {
        // `leftAt` set is what makes this the returning player's path rather
        // than a way to rename a team you are already in.
        const departed = await of.teams.findOne(
          {
            playerId: team.playerId,
            leagueId: team.leagueId,
            leftAt: { $ne: null },
          },
          { session },
        );
        if (!departed) return false;

        const admitted = await of.leagues.findOneAndUpdate(
          { _id: team.leagueId, ...admits(team.playerId, team.invitationCode) },
          { $inc: { revision: 1 } },
          { session, returnDocument: "after" },
        );
        if (!admitted) return false;

        // Clearing `leftAt` is the whole of coming back: the row, its contracts
        // and its standing were never removed, so there is nothing to restore
        // (docs/domain/league-lifecycle.md). Only the name is rewritten, since
        // the player filled the join form in again.
        await of.teams.updateOne(
          { _id: departed._id },
          { $set: { leftAt: null, name: team.name } },
          { session },
        );
        return true;
      });

      if (!rejoined) return failure(TEAM_ERRORS.JOIN_CONFLICT);

      // Read back rather than assembling the team here: unlike a fresh join,
      // this one has a contracts ledger behind it, so its credits is whatever
      // the season left it with.
      const found = await this.getByPlayerAndLeague(
        team.playerId,
        team.leagueId,
      );
      if (found.ok && found.value === null) {
        return failure(`Rejoined team vanished: ${team.leagueId}`);
      }
      return found as Result<Team>;
    } catch (error) {
      return failure(`Error rejoining league: ${errorMessage(error)}`);
    }
  }

  async existsByNameInLeague(
    name: string,
    leagueId: string,
    exceptPlayerId?: string,
  ): Promise<Result<boolean>> {
    try {
      const { teams } = await this.store.collections();
      const found = await teams.findOne({
        leagueId,
        // A sentinel that is not a player id, so the ordinary call excludes
        // nobody. The exception is for the returning player who types the name
        // they had: their departed team is still here and would collide with
        // itself.
        playerId: { $ne: exceptPlayerId ?? "" },
        $expr: { $eq: [{ $toLower: "$name" }, asciiLower(name)] },
      });
      return success(found !== null);
    } catch (error) {
      return failure(`Error checking team name: ${errorMessage(error)}`);
    }
  }

  async getByPlayerAndLeague(
    playerId: string,
    leagueId: string,
  ): Promise<Result<Team | null>> {
    // `leftAt: null` is what turns leaving into something the rest of the
    // system feels: every self-scoped feature reaches the league through this
    // one read, so a departed player is told "you have no team here" by all of
    // them at once, without any of them checking for themselves.
    return this.oneTeam({ playerId, leagueId, leftAt: null }, "fetching team");
  }

  async getByIdAndLeague(
    teamId: string,
    leagueId: string,
  ): Promise<Result<Team | null>> {
    // The league is part of the key, not a redundant filter: a team belonging
    // to another league must be indistinguishable from one that does not exist.
    return this.oneTeam({ _id: teamId, leagueId }, "fetching team");
  }

  async getMembership(
    playerId: string,
    leagueId: string,
  ): Promise<Result<TeamMembership | null>> {
    try {
      const { teams } = await this.store.collections();
      // Unfiltered on purpose — this is the read that can see a departure, and
      // the only one that should.
      const doc = await teams.findOne({ playerId, leagueId });
      if (!doc) return success(null);
      return success({
        teamId: doc._id,
        leftAt: doc.leftAt === null ? null : Temporal.Instant.from(doc.leftAt),
      });
    } catch (error) {
      return failure(`Error fetching membership: ${errorMessage(error)}`);
    }
  }

  async leave(departure: {
    teamId: string;
    playerId: string;
    leagueId: string;
    leftAt: Temporal.Instant;
  }): Promise<Result<LeaveOutcome>> {
    const { teamId, playerId, leagueId, leftAt } = departure;
    try {
      return await this.store.transaction(async (session, of) => {
        // Whether the leave is allowed at all: they still hold a team here,
        // they have not already left, and this is not the Global League —
        // leaving that one would strand them, since first run routes anyone
        // without a Global League team to create one and the join gate would
        // then refuse.
        const team = await of.teams.findOne(
          { _id: teamId, playerId, leagueId, leftAt: null },
          { session },
        );
        if (!team || leagueId === GLOBAL_LEAGUE_ID) {
          return failure(TEAM_ERRORS.LEAVE_CONFLICT);
        }

        // The league has to be open, and has to still be open when this
        // commits — hence a write rather than a read, the same gate the join
        // goes through.
        const league = await of.leagues.findOneAndUpdate(
          { _id: leagueId, closedAt: null },
          { $inc: { revision: 1 } },
          { session, returnDocument: "after" },
        );
        if (!league) return failure(TEAM_ERRORS.LEAVE_CONFLICT);

        // The row survives, contracts and all, so the season stays readable
        // exactly as it was played.
        await of.teams.updateOne(
          { _id: teamId },
          { $set: { leftAt: leftAt.toString() } },
          { session },
        );

        // The longest-standing member still in it, by join order. Nobody may be
        // left holding a league its admin walked out of, since only an admin
        // can close one.
        const heir = await of.teams.findOne(
          { leagueId, leftAt: null },
          { session, sort: { seq: 1 } },
        );

        if (heir) {
          if (league.adminId === playerId) {
            await of.leagues.updateOne(
              { _id: leagueId },
              { $set: { adminId: heir.playerId } },
              { session },
            );
          }
          return success({ leagueDeleted: false });
        }

        // They were the last member. The league goes, and everything reached
        // through it goes with it — the single exception to "nothing is ever
        // deleted", and the reason is that it is not one: an audit trail is
        // reached through a league, so a league nobody is in cannot be read
        // back by anyone. D1 gets this from ON DELETE CASCADE; here it is
        // spelled out, inside the same transaction.
        const teamIds = (
          await of.teams.find({ leagueId }, { session }).toArray()
        ).map((row) => row._id);
        const contractIds = (
          await of.contracts
            .find({ teamId: { $in: teamIds } }, { session })
            .toArray()
        ).map((row) => row._id);

        await of.notifications.deleteMany(
          { contractId: { $in: contractIds } },
          { session },
        );
        await of.contracts.deleteMany(
          { _id: { $in: contractIds } },
          { session },
        );
        await of.performances.deleteMany(
          { teamId: { $in: teamIds } },
          { session },
        );
        await of.lineups.deleteMany({ _id: { $in: teamIds } }, { session });
        await of.teams.deleteMany({ leagueId }, { session });
        await of.leagues.deleteOne({ _id: leagueId }, { session });

        return success({ leagueDeleted: true });
      });
    } catch (error) {
      return failure(`Error leaving league: ${errorMessage(error)}`);
    }
  }

  /** One team, with its derived credits, or null. */
  private async oneTeam(
    match: Record<string, unknown>,
    what: string,
  ): Promise<Result<Team | null>> {
    try {
      const { teams } = await this.store.collections();
      const [found] = await teams
        .aggregate<Team>([
          { $match: match },
          ...teamCreditsStages("_id"),
          TEAM_PROJECTION,
        ])
        .toArray();
      return success(found ?? null);
    } catch (error) {
      return failure(`Error ${what}: ${errorMessage(error)}`);
    }
  }
}
