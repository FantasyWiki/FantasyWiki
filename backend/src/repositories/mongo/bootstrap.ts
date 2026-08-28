import type { Db } from "mongodb";
import { GLOBAL_LEAGUE_ID } from "../../../../model/league";
import { LeagueInvitePolicy, LeagueVisibility } from "../../../../model/enums";
import {
  REFERENCE_DOMAIN,
  REFERENCE_SCALE,
} from "../../../../model/languageScale";
import { collections } from "./schema";

/**
 * What `backend/migrations/` is to D1: the indexes that hold the schema's
 * uniqueness rules, and the baseline every deployment starts from.
 *
 * There is no migration *runner* here, and deliberately so. Mongo has no schema
 * to migrate — a new field is written by whichever repository writes it — so the
 * only things a fresh database needs are the constraints that cannot be
 * expressed in a document and the rows the product assumes exist. Both are
 * idempotent, so this runs on the first use of a connection and again on every
 * test reset without anything to undo.
 */
export async function ensureSchema(db: Db): Promise<void> {
  await ensureIndexes(db);
  await seedBaseline(db);
}

/**
 * The uniqueness the D1 schema declares as constraints. Each one is load-bearing
 * somewhere a caller can see: a repeated username is the failure `LoginService`
 * retries on, and a repeated invitation code is the one `withUniqueInvitationCode`
 * redraws on.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  const {
    googleAccounts,
    passwordCredentials,
    players,
    leagues,
    teams,
    contracts,
    notifications,
    performances,
  } = collections(db);

  await Promise.all([
    googleAccounts.createIndex({ googleId: 1 }, { unique: true }),
    // A credential belongs to exactly one account, and the username it is keyed
    // by is already unique as the primary key.
    passwordCredentials.createIndex({ accountId: 1 }, { unique: true }),
    players.createIndex({ username: 1 }, { unique: true }),
    players.createIndex({ accountId: 1 }, { unique: true }),
    // Partial, so every league without a code shares the absence of one while
    // no two private leagues can share the same code — the same arrangement
    // SQLite gets from treating NULLs in a unique index as distinct.
    leagues.createIndex(
      { invitationCode: 1 },
      {
        unique: true,
        partialFilterExpression: { invitationCode: { $type: "string" } },
      },
    ),
    teams.createIndex({ playerId: 1, leagueId: 1 }, { unique: true }),
    teams.createIndex({ leagueId: 1 }),
    contracts.createIndex({ teamId: 1 }),
    contracts.createIndex({ settled: 1, expireDate: 1 }),
    notifications.createIndex({ contractId: 1 }),
    performances.createIndex({ teamId: 1, date: 1 }, { unique: true }),
  ]);
}

/**
 * The Global League, its `system` admin, and the reference edition's measured
 * scale — migrations 0002 and 0009, which every D1 database also starts with.
 *
 * Insert-if-absent throughout, so a deployment that has been running for a year
 * comes through this untouched.
 */
export async function seedBaseline(db: Db): Promise<void> {
  const { googleAccounts, players, leagues, languageScales } = collections(db);

  await googleAccounts.updateOne(
    { _id: "system" },
    {
      $setOnInsert: {
        googleId: "system",
        email: "system@fantasywiki.local",
      },
    },
    { upsert: true },
  );
  await players.updateOne(
    { _id: "system" },
    { $setOnInsert: { username: "system", accountId: "system" } },
    { upsert: true },
  );
  await languageScales.updateOne(
    { _id: REFERENCE_DOMAIN },
    {
      $setOnInsert: {
        scale: REFERENCE_SCALE,
        measuredAt: "2026-07-06T00:00:00Z",
        qualifyingRanks: 985,
        sampleSize: 500,
        referenceDomain: REFERENCE_DOMAIN,
      },
    },
    { upsert: true },
  );
  await leagues.updateOne(
    { _id: GLOBAL_LEAGUE_ID },
    {
      $setOnInsert: {
        name: "Global League",
        adminId: "system",
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2124-01-01T00:00:00Z",
        domain: REFERENCE_DOMAIN,
        languageScale: REFERENCE_SCALE,
        // Public and members-invitable for the reasons migration 0007 gives:
        // it is the one league every player is enrolled in, and its admin is a
        // seeded account nobody logs in as.
        visibility: LeagueVisibility.PUBLIC,
        invitePolicy: LeagueInvitePolicy.MEMBERS,
        icon: "🌍",
        closedAt: null,
        invitationCode: null,
        revision: 0,
      },
    },
    { upsert: true },
  );
}
