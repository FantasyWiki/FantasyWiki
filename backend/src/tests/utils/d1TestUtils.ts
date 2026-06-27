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
