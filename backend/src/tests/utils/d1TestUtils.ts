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
