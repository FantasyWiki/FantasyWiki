import { Temporal } from "@js-temporal/polyfill";
import { League, Team } from "../../../../model";
import {
  LeagueInvitePolicy,
  LeagueVisibility,
  isLeagueInvitePolicy,
  isLeagueVisibility,
} from "../../../../model/enums";
import { DEFAULT_SCHEMA } from "../../../../model/lineup";
import { STARTING_CREDITS } from "../../../../model/team";
import {
  LEAGUE_ERRORS,
  LeagueRepository,
  NewLeague,
} from "../leagueRepository";
import { Result, success, failure } from "../result";
import { errorMessage, isDuplicateKey } from "./connection";
import type { LeagueDoc } from "./schema";
import type { MongoStore } from "./store";

/**
 * A stored league as the domain sees it: instants rather than text, and the two
 * enum fields read back defensively.
 *
 * `invitationCode` is dropped here rather than filtered by each caller. It is a
 * credential, and the shape every service passes around must not be able to
 * carry it — the same reason `LEAGUE_COLUMNS` leaves it out of the D1 reads.
 */
export function toLeague(doc: LeagueDoc): League {
  return {
    id: doc._id,
    name: doc.name,
    adminId: doc.adminId,
    startDate: Temporal.Instant.from(doc.startDate),
    endDate: Temporal.Instant.from(doc.endDate),
    domain: doc.domain,
    languageScale: doc.languageScale,
    // Fail closed, as the D1 reader does: a visibility we cannot read is not a
    // league to throw open.
    visibility: isLeagueVisibility(doc.visibility)
      ? doc.visibility
      : LeagueVisibility.PRIVATE,
    invitePolicy: isLeagueInvitePolicy(doc.invitePolicy)
      ? doc.invitePolicy
      : LeagueInvitePolicy.ADMIN,
    closedAt:
      doc.closedAt === null ? null : Temporal.Instant.from(doc.closedAt),
    icon: doc.icon,
  };
}

export class LeagueRepositoryMongo implements LeagueRepository {
  constructor(private readonly store: MongoStore) {}

  async getById(id: string): Promise<Result<League>> {
    try {
      const { leagues } = await this.store.collections();
      const doc = await leagues.findOne({ _id: id });
      if (!doc) return failure(LEAGUE_ERRORS.NOT_FOUND);
      return success(toLeague(doc));
    } catch (error) {
      return failure(`Error retrieving league: ${errorMessage(error)}`);
    }
  }

  async listPublic(limit: number): Promise<Result<League[]>> {
    try {
      const { leagues } = await this.store.collections();
      // Both halves of `isLeagueInactive`, spelled here for the reason the D1
      // query spells them: this endpoint answers "somewhere to go", and an
      // ended league on the shelf sends a player to a join that can only
      // refuse. The dates are ISO-8601 UTC text, so `$gt` orders them.
      const docs = await leagues
        .find({
          visibility: LeagueVisibility.PUBLIC,
          closedAt: null,
          endDate: { $gt: Temporal.Now.instant().toString() },
        })
        .sort({ startDate: -1 })
        .limit(limit)
        .toArray();
      return success(docs.map(toLeague));
    } catch (error) {
      return failure(`Error listing public leagues: ${errorMessage(error)}`);
    }
  }

  async createWithFoundingTeam(
    league: NewLeague,
    foundingTeamName: string,
  ): Promise<Result<{ league: League; team: Team }>> {
    const leagueId = crypto.randomUUID();
    const teamId = crypto.randomUUID();

    try {
      // One transaction, for the reason the D1 batch is one: a league whose
      // founder never got a team is invisible to everyone, and a team with no
      // lineup row is a state no screen knows how to show.
      await this.store.transaction(async (session, of) => {
        await of.leagues.insertOne(
          {
            _id: leagueId,
            name: league.name,
            adminId: league.adminId,
            startDate: league.startDate.toString(),
            endDate: league.endDate.toString(),
            domain: league.domain,
            // Frozen here and never read from `language_scales` again for this
            // league — see ADR 0002.
            languageScale: league.languageScale,
            visibility: league.visibility,
            invitePolicy: league.invitePolicy,
            icon: league.icon,
            closedAt: null,
            invitationCode: league.invitationCode,
            revision: 0,
          },
          { session },
        );
        // Not the gated insert `TeamRepositoryMongo.create` uses: the league
        // this joins is the one being written a line above, by this very
        // player. There is nothing to check that is not already known — so the
        // founding team is seniority 0, ahead of everyone who joins later.
        await of.teams.insertOne(
          {
            _id: teamId,
            name: foundingTeamName,
            playerId: league.adminId,
            leagueId,
            leftAt: null,
            seq: 0,
          },
          { session },
        );
        await of.lineups.insertOne(
          {
            _id: teamId,
            schema: DEFAULT_SCHEMA,
            formation: "{}",
            updatedAt: new Date().toISOString(),
          },
          { session },
        );
      });
    } catch (error) {
      if (isDuplicateKey(error, "invitationCode")) {
        return failure(LEAGUE_ERRORS.INVITATION_CODE_TAKEN);
      }
      return failure(`Error creating league: ${errorMessage(error)}`);
    }

    return success({
      league: {
        id: leagueId,
        name: league.name,
        adminId: league.adminId,
        startDate: league.startDate,
        endDate: league.endDate,
        domain: league.domain,
        languageScale: league.languageScale,
        visibility: league.visibility,
        invitePolicy: league.invitePolicy,
        icon: league.icon,
        closedAt: null,
      },
      // A brand-new team holds no contracts, so its derived credits is
      // trivially the starting budget — no read needed.
      team: {
        id: teamId,
        name: foundingTeamName,
        playerId: league.adminId,
        leagueId,
        credits: STARTING_CREDITS,
      },
    });
  }

  async getInvitationCode(leagueId: string): Promise<Result<string | null>> {
    try {
      const { leagues } = await this.store.collections();
      // Its own read, and the only one that returns the field: a credential
      // travels because a caller asked for it, never as a passenger.
      const doc = await leagues.findOne(
        { _id: leagueId },
        { projection: { invitationCode: 1 } },
      );
      if (!doc) return failure(LEAGUE_ERRORS.NOT_FOUND);
      return success(doc.invitationCode ?? null);
    } catch (error) {
      return failure(
        `Error retrieving invitation code: ${errorMessage(error)}`,
      );
    }
  }

  async findIdByInvitationCode(code: string): Promise<Result<string | null>> {
    try {
      const { leagues } = await this.store.collections();
      // Only the id, so the caller has to come back through `getById` to say
      // anything about the league a code opens.
      const doc = await leagues.findOne(
        { invitationCode: code },
        { projection: { _id: 1 } },
      );
      return success(doc?._id ?? null);
    } catch (error) {
      return failure(`Error resolving invitation code: ${errorMessage(error)}`);
    }
  }

  async countTeamsByLeague(
    leagueIds: readonly string[],
  ): Promise<Result<Record<string, number>>> {
    if (leagueIds.length === 0) return success({});
    try {
      const { teams } = await this.store.collections();
      // Teams still playing, not teams that ever played: a league's size is how
      // many are in it now (docs/domain/league-lifecycle.md).
      const rows = await teams
        .aggregate<{ _id: string; teamCount: number }>([
          { $match: { leagueId: { $in: [...leagueIds] }, leftAt: null } },
          { $group: { _id: "$leagueId", teamCount: { $sum: 1 } } },
        ])
        .toArray();

      // Seeded with zeros so a league nobody has joined answers 0 rather than
      // going missing: the caller indexes by id and a gap would render blank.
      const counts: Record<string, number> = Object.fromEntries(
        leagueIds.map((id) => [id, 0]),
      );
      for (const row of rows) counts[row._id] = row.teamCount;
      return success(counts);
    } catch (error) {
      return failure(`Error counting league teams: ${errorMessage(error)}`);
    }
  }

  async close(
    leagueId: string,
    adminId: string,
    closedAt: Temporal.Instant,
  ): Promise<Result<void>> {
    try {
      const { leagues } = await this.store.collections();
      // Who may close, and that a league closes once, are conditions of the
      // write rather than checks before it — a single document update, so no
      // second request can slip a close between reading `closedAt` and stamping
      // it. The revision bump is what makes a join or a departure running
      // concurrently see this closure rather than its own stale snapshot.
      const result = await leagues.updateOne(
        { _id: leagueId, adminId, closedAt: null },
        { $set: { closedAt: closedAt.toString() }, $inc: { revision: 1 } },
      );

      // Matched nothing: no such league, not this caller's to close, or closed
      // already. Which one is not knowable from here — the service re-reads.
      if (result.matchedCount === 0) {
        return failure(LEAGUE_ERRORS.CLOSE_CONFLICT);
      }
      return success(undefined);
    } catch (error) {
      return failure(`Error closing league: ${errorMessage(error)}`);
    }
  }
}
