import type { Collection, Db } from "mongodb";
import { STARTING_CREDITS } from "../../../../model/team";

/**
 * The shape of the Mongo target: what the collections are called, what a
 * document in each holds, and the one derivation (team credits) that more than
 * one repository needs.
 *
 * Field names deliberately match the D1 columns. Nothing forces them to — the
 * two targets share no code below `Repositories` — but a reader who knows one
 * schema can then read the other, and the migrations stay usable as the
 * description of what is stored.
 *
 * Ids are `_id`, so every lookup by id is the primary key lookup Mongo gives
 * for free and no document carries the same value twice.
 */
export const COLLECTIONS = {
  googleAccounts: "google_accounts",
  players: "players",
  leagues: "leagues",
  teams: "teams",
  contracts: "contracts",
  notifications: "notifications",
  performances: "performances",
  lineups: "lineups",
  languageScales: "language_scales",
} as const;

export interface GoogleAccountDoc {
  _id: string;
  googleId: string;
  email: string;
}

export interface PlayerDoc {
  _id: string;
  username: string;
  accountId: string;
}

export interface LeagueDoc {
  _id: string;
  name: string;
  adminId: string;
  /** ISO-8601 instants, as text, exactly as the D1 columns hold them. */
  startDate: string;
  endDate: string;
  domain: string;
  languageScale: number;
  visibility: string;
  invitePolicy: string;
  icon: string;
  closedAt: string | null;
  invitationCode: string | null;
  /**
   * Bumped by every write that has to be serialised against this league — a
   * join, a rejoin, a departure, a purchase.
   *
   * This is what stands in for D1's single-statement atomicity. Mongo
   * transactions are snapshot-isolated, not serializable, so two transactions
   * that only *read* the league would both commit against a snapshot taken
   * before a concurrent close. Making each of them *write* the league document
   * puts them in each other's write set, so the second one hits a write
   * conflict and `withTransaction` retries it against the new state — which is
   * the guarantee the repository contracts describe.
   *
   * It doubles as join order: the value a joiner bumps it to is the `seq` its
   * team keeps, which is the seniority `leave` hands the league on by. D1 reads
   * `rowid` for the same purpose.
   */
  revision: number;
}

export interface TeamDoc {
  _id: string;
  name: string;
  playerId: string;
  leagueId: string;
  leftAt: string | null;
  /** Join order within the league. See {@link LeagueDoc.revision}. */
  seq: number;
}

export interface ContractDoc {
  _id: string;
  teamId: string;
  articleId: string;
  /** 'YYYY-MM-DD', so a plain string comparison is a chronological one. */
  purchaseDate: string;
  expireDate: string;
  purchasePrice: number;
  settled: boolean;
  renewalCount: number;
  renewalElected: boolean;
  salePayout: number | null;
}

export interface NotificationDoc {
  _id: string;
  contractId: string;
  message: string;
  date: string;
  isRead: boolean;
}

export interface PerformanceDoc {
  /** `teamId:date` — the composite key, as the key. */
  _id: string;
  teamId: string;
  date: string;
  points: number;
  historical_formation: string;
}

export interface LineupDoc {
  /** The team's id: a team has at most one lineup. */
  _id: string;
  schema: string;
  formation: string;
  updatedAt: string;
}

export interface LanguageScaleDoc {
  /** The Wikipedia edition's language code. */
  _id: string;
  scale: number;
  measuredAt: string;
  qualifyingRanks: number;
  sampleSize: number;
  referenceDomain: string;
}

export interface MongoCollections {
  googleAccounts: Collection<GoogleAccountDoc>;
  players: Collection<PlayerDoc>;
  leagues: Collection<LeagueDoc>;
  teams: Collection<TeamDoc>;
  contracts: Collection<ContractDoc>;
  notifications: Collection<NotificationDoc>;
  performances: Collection<PerformanceDoc>;
  lineups: Collection<LineupDoc>;
  languageScales: Collection<LanguageScaleDoc>;
}

export function collections(db: Db): MongoCollections {
  return {
    googleAccounts: db.collection<GoogleAccountDoc>(COLLECTIONS.googleAccounts),
    players: db.collection<PlayerDoc>(COLLECTIONS.players),
    leagues: db.collection<LeagueDoc>(COLLECTIONS.leagues),
    teams: db.collection<TeamDoc>(COLLECTIONS.teams),
    contracts: db.collection<ContractDoc>(COLLECTIONS.contracts),
    notifications: db.collection<NotificationDoc>(COLLECTIONS.notifications),
    performances: db.collection<PerformanceDoc>(COLLECTIONS.performances),
    lineups: db.collection<LineupDoc>(COLLECTIONS.lineups),
    languageScales: db.collection<LanguageScaleDoc>(COLLECTIONS.languageScales),
  };
}

/** The composite key `performances` is keyed by, as one string. */
export const performanceId = (teamId: string, date: string): string =>
  `${teamId}:${date}`;

/** Where {@link teamCreditsStages} parks the joined ledger while it sums it. */
const LEDGER = "__ledger";

/**
 * ADR 0007's derived credits, as an aggregation expression over a team's
 * contracts: the same rule migration 0006 states as the `team_credits` view and
 * `deriveCredits` states as arithmetic.
 *
 * Stated once here for the reason the view exists — four hand-copied versions
 * of a balance rule become four different balance rules — and taken as a
 * parameter so the five reads that need a balance can each attach it to
 * whatever their pipeline calls the ledger.
 */
export function creditsExpression(ledger: string): object {
  return {
    $add: [
      { $subtract: [STARTING_CREDITS, { $sum: `${ledger}.purchasePrice` }] },
      {
        $sum: {
          $map: {
            input: ledger,
            as: "entry",
            in: {
              $cond: [
                "$$entry.settled",
                { $ifNull: ["$$entry.salePayout", 0] },
                0,
              ],
            },
          },
        },
      },
    ],
  };
}

/**
 * Stages that add a team's derived credits to a pipeline, under `as`.
 *
 * `teamIdField` is the path to the team's id in the documents flowing through —
 * `"_id"` in a pipeline over `teams`, `"team._id"` in one that has joined a
 * team in. The temporary ledger is projected away, so nothing downstream sees
 * it.
 */
export function teamCreditsStages(
  teamIdField: string,
  as = "credits",
): object[] {
  return [
    {
      $lookup: {
        from: COLLECTIONS.contracts,
        localField: teamIdField,
        foreignField: "teamId",
        as: LEDGER,
      },
    },
    { $addFields: { [as]: creditsExpression(`$${LEDGER}`) } },
    { $project: { [LEDGER]: 0 } },
  ];
}
