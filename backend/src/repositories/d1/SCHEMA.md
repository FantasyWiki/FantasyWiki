# D1 Database Schema

## Overview

The PlayerRepositoryD1 requires the following tables to be created in the Cloudflare D1 database.

## Table Definitions

### players

Stores player information.

```sql
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE
);
```

### google_accounts

Stores Google OAuth account information linked to players (1:N relationship - one player can have multiple Google accounts).

```sql
CREATE TABLE IF NOT EXISTS google_accounts (
  id TEXT PRIMARY KEY,
  googleId TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  playerId TEXT NOT NULL,
  FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE
);
```

### teams

Stores team information and player-league associations.

```sql
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  playerId TEXT NOT NULL,
  leagueId TEXT NOT NULL,
  credits REAL NOT NULL,
  FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (leagueId) REFERENCES leagues(id) ON DELETE CASCADE
);
```

### leagues

Stores league information.

```sql
CREATE TABLE IF NOT EXISTS leagues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  adminId TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  domain TEXT NOT NULL,
  icon TEXT NOT NULL,
  FOREIGN KEY (adminId) REFERENCES players(id)
);
```

## Migration Steps

1. Apply the schema DDL statements above in your D1 database
2. Verify the tables are created: `wrangler d1 execute db --command "SELECT name FROM sqlite_master WHERE type='table';"`
3. Test the connection from the application

## Notes

- UUIDs are generated client-side using `crypto.randomUUID()`
- Temporal.Instant and Temporal.PlainDate values are stored as ISO 8601 strings (e.g., "2024-04-21T17:54:32Z")
- The `google_accounts.id` field refers to the Google account ID as mentioned in the repository method `getPlayerByAccountId(accountId)`
