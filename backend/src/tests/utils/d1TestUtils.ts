const RESET_STATEMENTS = [
  "DELETE FROM notifications",
  "DELETE FROM contracts",
  "DELETE FROM teams",
  "DELETE FROM leagues",
  "DELETE FROM players",
  "DELETE FROM google_accounts",
];

export async function resetD1Database(db: D1Database): Promise<void> {
  for (const statement of RESET_STATEMENTS) {
    await db.prepare(statement).run();
  }
}
