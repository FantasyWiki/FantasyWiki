-- Migration: Seed the Global League
-- Date: 2026-06-14
-- The Global League is the default league every player can join, regardless
-- of locale. It needs an admin player, so we also seed a system account.

INSERT OR IGNORE INTO google_accounts (id, googleId, email)
VALUES ('system', 'system', 'system@fantasywiki.local');

INSERT OR IGNORE INTO players (id, username, accountId)
VALUES ('system', 'system', 'system');

INSERT OR IGNORE INTO leagues (id, name, adminId, startDate, endDate, domain, icon)
VALUES ('global', 'Global League', 'system', '2024-01-01T00:00:00Z', '2124-01-01T00:00:00Z', 'en', '🌍');
