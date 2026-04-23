-- Migration: Add google_account foreign key to players (change from 1:N to 1:1)
-- Date: 2026-04-27
-- Description: Modify schema so each player must have exactly one google account

-- Drop the old foreign key constraint on google_accounts table
-- Note: SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we need to recreate the table

-- Temporarily rename the old google_accounts table
ALTER TABLE google_accounts RENAME TO google_accounts_old;

-- Create new google_accounts table without the playerId column
CREATE TABLE IF NOT EXISTS google_accounts (
  id TEXT PRIMARY KEY,
  googleId TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Migrate data from old table
INSERT INTO google_accounts (id, googleId, email, created_at)
SELECT id, googleId, email, created_at FROM google_accounts_old;

-- Drop the old table
DROP TABLE google_accounts_old;

-- Recreate players table with googleAccountId foreign key
ALTER TABLE players RENAME TO players_old;

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  googleAccountId TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (googleAccountId) REFERENCES google_accounts(id) ON DELETE CASCADE
);

-- Migrate data from old players table (googleAccountId will need to be populated separately)
-- This migration assumes data will be populated by application logic
INSERT INTO players (id, username, created_at)
SELECT id, username, created_at FROM players_old;

-- Drop the old players table
DROP TABLE players_old;

-- Update indexes
DROP INDEX IF EXISTS idx_google_accounts_playerId;
CREATE INDEX IF NOT EXISTS idx_players_googleAccountId ON players(googleAccountId);
CREATE INDEX IF NOT EXISTS idx_google_accounts_googleId ON google_accounts(googleId);
