import { Temporal } from "@js-temporal/polyfill";
import { Contract } from "../../../../model";
import { MAX_TEAM_CONTRACTS } from "../../../../model/team";
import {
  ContractRepository,
  CONTRACT_WRITE_ERRORS,
  DueContract,
  LeagueContractRow,
  NewContract,
} from "../contractRepository";
import { Result, success, failure } from "../result";
import { errorMessage } from "./connection";
import { COLLECTIONS, teamCreditsStages, type ContractDoc } from "./schema";
import type { MongoStore } from "./store";

function toContract(doc: ContractDoc): Contract {
  return {
    id: doc._id,
    teamId: doc.teamId,
    articleId: doc.articleId,
    purchaseDate: Temporal.PlainDate.from(doc.purchaseDate),
    expireDate: Temporal.PlainDate.from(doc.expireDate),
    purchasePrice: doc.purchasePrice,
    settled: doc.settled,
    renewalCount: doc.renewalCount,
    renewalElected: doc.renewalElected,
  };
}

export class ContractRepositoryMongo implements ContractRepository {
  constructor(private readonly store: MongoStore) {}

  async getByTeamId(teamId: string): Promise<Result<Contract[]>> {
    try {
      const { contracts } = await this.store.collections();
      const docs = await contracts.find({ teamId }).toArray();
      return success(docs.map(toContract));
    } catch (error) {
      return failure(`Error fetching contracts: ${errorMessage(error)}`);
    }
  }

  async getById(id: string): Promise<Result<Contract | null>> {
    try {
      const { contracts } = await this.store.collections();
      const doc = await contracts.findOne({ _id: id });
      return success(doc ? toContract(doc) : null);
    } catch (error) {
      return failure(`Error fetching contract: ${errorMessage(error)}`);
    }
  }

  async getByLeagueId(leagueId: string): Promise<Result<LeagueContractRow[]>> {
    try {
      const { teams } = await this.store.collections();
      // Anchored on teams rather than contracts, so the balance each row
      // carries is derived once per team by the shared stages.
      const rows = await teams
        .aggregate<{
          contract: ContractDoc;
          teamName: string;
          teamCredits: number;
          playerId: string;
          playerName: string;
        }>([
          { $match: { leagueId } },
          ...teamCreditsStages("_id", "teamCredits"),
          {
            $lookup: {
              from: COLLECTIONS.players,
              localField: "playerId",
              foreignField: "_id",
              as: "player",
            },
          },
          { $unwind: "$player" },
          {
            $lookup: {
              from: COLLECTIONS.contracts,
              localField: "_id",
              foreignField: "teamId",
              as: "contract",
            },
          },
          { $unwind: "$contract" },
          { $match: { "contract.settled": false } },
          {
            $project: {
              _id: 0,
              contract: 1,
              teamName: "$name",
              teamCredits: 1,
              playerId: "$player._id",
              playerName: "$player.username",
            },
          },
        ])
        .toArray();

      return success(
        rows.map((row) => ({
          ...toContract(row.contract),
          teamName: row.teamName,
          teamCredits: row.teamCredits,
          playerId: row.playerId,
          playerName: row.playerName,
        })),
      );
    } catch (error) {
      return failure(`Error fetching league contracts: ${errorMessage(error)}`);
    }
  }

  async create(newContract: NewContract): Promise<Result<Contract>> {
    const id = crypto.randomUUID();
    try {
      return await this.store.transaction(async (session, of) => {
        const team = await of.teams.findOne(
          { _id: newContract.teamId },
          { session },
        );
        if (!team) return failure(CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT);

        // Every purchase condition, decided here rather than by the caller: a
        // service-side pre-check leaves a read-then-write race open, and two
        // concurrent buys could both pass it (ADR 0007).
        const [balance] = await of.teams
          .aggregate<{ credits: number }>(
            [
              { $match: { _id: newContract.teamId } },
              ...teamCreditsStages("_id"),
              { $project: { _id: 0, credits: 1 } },
            ],
            { session },
          )
          .toArray();
        if (!balance || balance.credits < newContract.purchasePrice) {
          return failure(CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT);
        }

        // Article Availability: no team in *this* league may hold the article
        // on an unsettled contract. Another league's holding is no obstacle.
        const [clash] = await of.contracts
          .aggregate<{ _id: string }>(
            [
              { $match: { articleId: newContract.articleId, settled: false } },
              {
                $lookup: {
                  from: COLLECTIONS.teams,
                  localField: "teamId",
                  foreignField: "_id",
                  as: "team",
                },
              },
              { $unwind: "$team" },
              { $match: { "team.leagueId": team.leagueId } },
              { $limit: 1 },
              { $project: { _id: 1 } },
            ],
            { session },
          )
          .toArray();
        if (clash) return failure(CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT);

        const held = await of.contracts.countDocuments(
          { teamId: newContract.teamId, settled: false },
          { session },
        );
        if (held >= MAX_TEAM_CONTRACTS) {
          return failure(CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT);
        }

        // The serialisation point. Every purchase in a league writes the
        // league's revision, so two that raced are in each other's write set
        // and the loser is retried against the state the winner left — which is
        // what makes the three conditions above hold at write time rather than
        // at read time. See `LeagueDoc.revision`.
        const admitted = await of.leagues.findOneAndUpdate(
          { _id: team.leagueId },
          { $inc: { revision: 1 } },
          { session },
        );
        if (!admitted) return failure(CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT);

        const doc: ContractDoc = {
          _id: id,
          teamId: newContract.teamId,
          articleId: newContract.articleId,
          purchaseDate: newContract.purchaseDate.toString(),
          expireDate: newContract.expireDate.toString(),
          purchasePrice: newContract.purchasePrice,
          settled: false,
          renewalCount: 0,
          renewalElected: false,
          salePayout: null,
        };
        await of.contracts.insertOne(doc, { session });
        return success(toContract(doc));
      });
    } catch (error) {
      return failure(`Error creating contract: ${errorMessage(error)}`);
    }
  }

  async settleSale(
    contractId: string,
    teamId: string,
    payout: number,
  ): Promise<Result<boolean>> {
    try {
      const { contracts } = await this.store.collections();
      // Flips settled and persists the payout together, guarded on the row
      // still being unsettled and owned by teamId — the sole gate against a
      // concurrent double-sell. No teams write at all: credits are derived from
      // this same ledger, never stored.
      const result = await contracts.updateOne(
        { _id: contractId, teamId, settled: false },
        { $set: { settled: true, salePayout: payout } },
      );
      return success(result.matchedCount > 0);
    } catch (error) {
      return failure(`Error selling contract: ${errorMessage(error)}`);
    }
  }

  async getDueForSettlement(
    today: Temporal.PlainDate,
  ): Promise<Result<DueContract[]>> {
    try {
      const { contracts } = await this.store.collections();
      const rows = await contracts
        .aggregate<
          ContractDoc & {
            league: { domain: string; languageScale: number };
            teamCredits: number;
          }
        >([
          {
            $match: { settled: false, expireDate: { $lte: today.toString() } },
          },
          {
            $lookup: {
              from: COLLECTIONS.teams,
              localField: "teamId",
              foreignField: "_id",
              as: "team",
            },
          },
          { $unwind: "$team" },
          {
            $lookup: {
              from: COLLECTIONS.leagues,
              localField: "team.leagueId",
              foreignField: "_id",
              as: "league",
            },
          },
          { $unwind: "$league" },
          // Resolved in the sweep query so the daily settlement needs no extra
          // read per contract.
          ...teamCreditsStages("team._id", "teamCredits"),
        ])
        .toArray();

      return success(
        rows.map((row) => ({
          ...toContract(row),
          domain: row.league.domain,
          // Settlement values a contract at the scale it was bought at, which a
          // lookup at settlement time could not promise (ADR 0002).
          languageScale: row.league.languageScale,
          teamCredits: row.teamCredits,
        })),
      );
    } catch (error) {
      return failure(`Error fetching due contracts: ${errorMessage(error)}`);
    }
  }

  async settleExpiry(
    contractId: string,
    payout: number,
  ): Promise<Result<boolean>> {
    try {
      const { contracts } = await this.store.collections();
      // Same shape as settleSale but system-driven, so no owner guard: still
      // guarded on being unsettled, which is what makes a re-run of the sweep a
      // no-op.
      const result = await contracts.updateOne(
        { _id: contractId, settled: false },
        { $set: { settled: true, salePayout: payout } },
      );
      return success(result.matchedCount > 0);
    } catch (error) {
      return failure(
        `Error settling contract at expiry: ${errorMessage(error)}`,
      );
    }
  }

  async renew(
    contractId: string,
    newPurchaseDate: Temporal.PlainDate,
    newExpireDate: Temporal.PlainDate,
    newPurchasePrice: number,
  ): Promise<Result<boolean>> {
    try {
      const { contracts } = await this.store.collections();
      // Guarded on unsettled AND elected: once this runs the election is spent
      // and the window has moved past today, so a re-run of the sweep can
      // neither pick the row up again nor double-apply the premium.
      const result = await contracts.updateOne(
        { _id: contractId, settled: false, renewalElected: true },
        {
          $set: {
            purchaseDate: newPurchaseDate.toString(),
            expireDate: newExpireDate.toString(),
            purchasePrice: newPurchasePrice,
            renewalElected: false,
          },
          $inc: { renewalCount: 1 },
        },
      );
      return success(result.matchedCount > 0);
    } catch (error) {
      return failure(`Error renewing contract: ${errorMessage(error)}`);
    }
  }

  async electRenewal(
    contractId: string,
    teamId: string,
  ): Promise<Result<boolean>> {
    try {
      const { contracts } = await this.store.collections();
      // Deliberately not guarded on the flag being clear: a stale client
      // re-electing is told the truth rather than having `false` turned into a
      // 404 for a contract that exists and is elected.
      const result = await contracts.updateOne(
        { _id: contractId, teamId, settled: false },
        { $set: { renewalElected: true } },
      );
      return success(result.matchedCount > 0);
    } catch (error) {
      return failure(`Error electing contract renewal: ${errorMessage(error)}`);
    }
  }

  async cancelRenewal(
    contractId: string,
    teamId: string,
  ): Promise<Result<boolean>> {
    try {
      const { contracts } = await this.store.collections();
      // The election has to still stand, which makes this lose the race against
      // the settlement sweep rather than silently un-electing an already-renewed
      // contract: the sweep clears the flag as it renews.
      const result = await contracts.updateOne(
        { _id: contractId, teamId, settled: false, renewalElected: true },
        { $set: { renewalElected: false } },
      );
      return success(result.matchedCount > 0);
    } catch (error) {
      return failure(
        `Error cancelling contract renewal: ${errorMessage(error)}`,
      );
    }
  }
}
