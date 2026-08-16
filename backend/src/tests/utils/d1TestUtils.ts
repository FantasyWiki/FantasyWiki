import { LeagueInvitePolicy, LeagueVisibility } from "../../../../model/enums";

// The Global League (and its system admin player/account) are seeded by
// migration 0002_seed_global_league.sql and must survive resets so tests see
// the same baseline as production.
const RESET_STATEMENTS = [
  "DELETE FROM notifications",
  "DELETE FROM contracts",
  "DELETE FROM performances",
  "DELETE FROM teams",
  "DELETE FROM leagues WHERE id != 'global'",
  "DELETE FROM players WHERE id != 'system'",
  "DELETE FROM google_accounts WHERE id != 'system'",
];

export async function resetD1Database(db: D1Database): Promise<void> {
  for (const statement of RESET_STATEMENTS) {
    await db.prepare(statement).run();
  }
}

/**
 * Inserts a league row for test setup.
 *
 * Defaults mirror what migration 0007 gives an existing league — public, with
 * `members` invite policy — so a test that says nothing about visibility gets
 * the same league it always had. Pass `visibility: "private"` to exercise the
 * join gate.
 *
 * `invitationCode` is left out by default rather than generated: SQLite treats
 * NULLs in a unique index as distinct, so any number of code-less leagues can
 * coexist, whereas a shared default would collide on the second insert.
 */
export async function insertLeague(
  db: D1Database,
  opts: {
    id: string;
    name?: string;
    adminId?: string;
    startDate?: string;
    endDate?: string;
    domain?: string;
    icon?: string;
    visibility?: LeagueVisibility;
    invitePolicy?: LeagueInvitePolicy;
    invitationCode?: string;
    /** An ISO instant to seed a league the admin already closed early. */
    closedAt?: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO leagues
         (id, name, adminId, startDate, endDate, domain, icon, visibility, invitePolicy, invitationCode, closedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      opts.id,
      opts.name ?? `League ${opts.id}`,
      opts.adminId ?? "system",
      opts.startDate ?? "2024-01-01T00:00:00Z",
      opts.endDate ?? "2124-01-01T00:00:00Z",
      opts.domain ?? "en",
      opts.icon ?? "🏆",
      opts.visibility ?? LeagueVisibility.PUBLIC,
      opts.invitePolicy ?? LeagueInvitePolicy.MEMBERS,
      opts.invitationCode ?? null,
      opts.closedAt ?? null,
    )
    .run();
}

/**
 * Inserts a team row for test setup. Credits are never a column here — they
 * are derived from the contracts ledger, so a freshly-inserted team with no
 * contracts naturally has STARTING_CREDITS with no need to write anything.
 */
export async function insertTeam(
  db: D1Database,
  opts: { id: string; name: string; playerId: string; leagueId: string },
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO teams (id, name, playerId, leagueId) VALUES (?, ?, ?, ?)",
    )
    .bind(opts.id, opts.name, opts.playerId, opts.leagueId)
    .run();
}

/** Inserts a lineup row (`formation` stored as a position->contractId JSON map). */
export async function insertLineup(
  db: D1Database,
  teamId: string,
  schema: string,
  formation: Record<string, string>,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO lineups (teamId, schema, formation, updatedAt) VALUES (?, ?, ?, ?)",
    )
    .bind(teamId, schema, JSON.stringify(formation), new Date().toISOString())
    .run();
}

/** Inserts a contract row for test setup (fixed price; `settled` defaults to 0). */
export async function insertContract(
  db: D1Database,
  opts: {
    id: string;
    teamId: string;
    articleId: string;
    purchaseDate: string;
    expireDate: string;
    settled?: number;
  },
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, settled) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      opts.id,
      opts.teamId,
      opts.articleId,
      opts.purchaseDate,
      opts.expireDate,
      10,
      opts.settled ?? 0,
    )
    .run();
}
