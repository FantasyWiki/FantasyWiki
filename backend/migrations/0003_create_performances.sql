-- Migration: Create performances table (daily lineup snapshot per team) and lineups table (live mutable lineup)
-- Date: 2026-06-27

CREATE TABLE IF NOT EXISTS performances (
    teamId TEXT NOT NULL,
    date TEXT NOT NULL,          -- calendar day, e.g. '2026-06-27'
    points REAL NOT NULL,
    historical_formation TEXT NOT NULL,  -- immutable JSON snapshot { "LW": "articleId", ... }
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (teamId, date),
    FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lineups (
  teamId    TEXT PRIMARY KEY,
  schema    TEXT NOT NULL,
  formation TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
);
