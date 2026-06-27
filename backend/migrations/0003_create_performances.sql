-- Migration: Create performances table (daily lineup snapshot per team)
-- Date: 2026-06-27

CREATE TABLE IF NOT EXISTS performances (
    teamId TEXT NOT NULL,
    date TEXT NOT NULL,          -- calendar day, e.g. '2026-06-27'
    points REAL NOT NULL,
    formation TEXT NOT NULL,     -- JSON lineup snapshot
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (teamId, date),
    FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
);
