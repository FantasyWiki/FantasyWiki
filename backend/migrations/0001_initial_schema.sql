-- Migration: Create initial schema for players, google_accounts, teams, and leagues tables
-- Date: 2026-04-21
-- Updated: 2026-05-05 - players uses accountId as foreign key to google_accounts

-- Create google_accounts table first (no reference to players yet)
CREATE TABLE IF NOT EXISTS google_accounts (
  id TEXT PRIMARY KEY,
  googleId TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create players table with foreign key to google_accounts (1:1 relationship)
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  accountId TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (accountId) REFERENCES google_accounts(id) ON DELETE CASCADE
);

-- Create leagues table
CREATE TABLE IF NOT EXISTS leagues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  adminId TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  domain TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (adminId) REFERENCES players(id)
);

-- Create teams table (junction table for player-league association)
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  playerId TEXT NOT NULL,
  leagueId TEXT NOT NULL,
  credits REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (leagueId) REFERENCES leagues(id) ON DELETE CASCADE
);

-- Create contracts table
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  teamId TEXT NOT NULL,
  articleId TEXT NOT NULL,
  purchaseDate TEXT NOT NULL,
  expireDate TEXT NOT NULL,
  purchasePrice REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  contractId TEXT NOT NULL,
  message TEXT NOT NULL,
  date TEXT NOT NULL,
  isRead BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contractId) REFERENCES contracts(id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_players_accountId ON players(accountId);
CREATE INDEX IF NOT EXISTS idx_google_accounts_googleId ON google_accounts(googleId);
CREATE INDEX IF NOT EXISTS idx_teams_playerId ON teams(playerId);
CREATE INDEX IF NOT EXISTS idx_teams_leagueId ON teams(leagueId);
CREATE INDEX IF NOT EXISTS idx_contracts_teamId ON contracts(teamId);
CREATE INDEX IF NOT EXISTS idx_notifications_contractId ON notifications(contractId);
CREATE INDEX IF NOT EXISTS idx_leagues_adminId ON leagues(adminId);
