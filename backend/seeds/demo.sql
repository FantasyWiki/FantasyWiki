-- Demo data for local development. NOT a migration: nothing here is applied
-- automatically, and no deployed database should ever see it.
--
--   cd backend && npm run db:seed:demo
--   docker compose exec backend npm run db:seed:demo
--
-- A fresh database starts empty on purpose, which is honest but leaves nothing
-- to look at. This fills it with one public league of three rival teams, each
-- with a full 4-3-3 of contracts and four scored days, so the market shows
-- owned articles, the standings rank somebody, and the podium has a reason to
-- appear. Sign in with "Continue as demo player" and join it.
--
-- Re-runnable: it deletes its own rows first, so editing the numbers below and
-- running it again replaces the league rather than skipping it. Every timestamp
-- is relative to `now`, so the season never ages out from under the data.
--
-- Generated, and worth regenerating rather than hand-editing: two pairs of
-- columns look alike and are not interchangeable.
--
-- Time:
--   * leagues.startDate/endDate and lineups.updatedAt are ISO instants
--     ('...T..:..:..Z'), matching what `new Date().toISOString()` writes;
--   * contracts.purchaseDate/expireDate and performances.date are plain
--     calendar days, read with Temporal.PlainDate, which refuses a Z.
--
-- Formation:
--   * lineups.formation maps a position to a *contract id* — that is what
--     LineupService.saveLineup stores and what it looks contracts up by, so
--     article titles here yield a silently empty pitch;
--   * performances.historical_formation maps a position to an *article id*,
--     the immutable snapshot of what was fielded that day (migration 0003).
--
-- See docs/development/docker-local-dev.md.

-- ── Start from nothing ───────────────────────────────────────────────────────
-- Explicit rather than relying on ON DELETE CASCADE, so this behaves the same
-- whether or not the connection has foreign keys enforced.
DELETE FROM performances WHERE teamId LIKE 'demo-team-%';
DELETE FROM lineups      WHERE teamId LIKE 'demo-team-%';
DELETE FROM contracts    WHERE teamId LIKE 'demo-team-%';
DELETE FROM teams        WHERE id     LIKE 'demo-team-%';
DELETE FROM leagues      WHERE id      = 'demo-league';
DELETE FROM players      WHERE id     LIKE 'demo-player-%';
DELETE FROM google_accounts WHERE id  LIKE 'demo-acct-%';

-- ── The league ───────────────────────────────────────────────────────────────
-- Public, so it is joinable from /leagues without an invitation code, and
-- admined by the seeded `system` player (migration 0002) that nobody logs in as.
INSERT INTO leagues
  (id, name, adminId, startDate, endDate, domain, icon, visibility, invitePolicy, languageScale)
VALUES
  ('demo-league', 'Wikipedia Premier', 'system',
   strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 days'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '+60 days'),
   'en', '🏆', 'public', 'members', 1.0);


-- ── Aurora Borealis FC ────────────────────────────────────────
INSERT INTO google_accounts (id, googleId, email)
VALUES ('demo-acct-aurora', 'demo-acct-aurora', 'aurora@fantasywiki.local');

INSERT INTO players (id, username, accountId)
VALUES ('demo-player-aurora', 'AuroraBorealis', 'demo-acct-aurora');

INSERT INTO teams (id, name, playerId, leagueId)
VALUES ('demo-team-aurora', '🌌 Aurora Borealis FC', 'demo-player-aurora', 'demo-league');

INSERT INTO contracts
  (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, settled, renewalCount, renewalElected)
VALUES
  ('demo-contract-aurora-0', 'demo-team-aurora', 'Photosynthesis', date('now', '-20 days'), date('now', '+10 days'), 78.0, 0, 0, 0),
  ('demo-contract-aurora-1', 'demo-team-aurora', 'Black hole', date('now', '-19 days'), date('now', '+11 days'), 91.0, 0, 0, 0),
  ('demo-contract-aurora-2', 'demo-team-aurora', 'Mount Everest', date('now', '-18 days'), date('now', '+12 days'), 64.0, 0, 0, 0),
  ('demo-contract-aurora-3', 'demo-team-aurora', 'Antarctica', date('now', '-17 days'), date('now', '+13 days'), 55.0, 0, 0, 0),
  ('demo-contract-aurora-4', 'demo-team-aurora', 'Coral reef', date('now', '-16 days'), date('now', '+14 days'), 48.0, 0, 0, 0),
  ('demo-contract-aurora-5', 'demo-team-aurora', 'Aurora', date('now', '-15 days'), date('now', '+15 days'), 42.0, 0, 0, 0),
  ('demo-contract-aurora-6', 'demo-team-aurora', 'Volcano', date('now', '-14 days'), date('now', '+16 days'), 61.0, 0, 0, 0),
  ('demo-contract-aurora-7', 'demo-team-aurora', 'Great Barrier Reef', date('now', '-13 days'), date('now', '+17 days'), 53.0, 0, 0, 0),
  ('demo-contract-aurora-8', 'demo-team-aurora', 'Amazon rainforest', date('now', '-12 days'), date('now', '+18 days'), 69.0, 0, 0, 0),
  ('demo-contract-aurora-9', 'demo-team-aurora', 'Glacier', date('now', '-11 days'), date('now', '+19 days'), 44.0, 0, 0, 0),
  ('demo-contract-aurora-10', 'demo-team-aurora', 'Northern Lights', date('now', '-10 days'), date('now', '+20 days'), 39.0, 0, 0, 0);


-- Positions to contract ids.
INSERT INTO lineups (teamId, schema, formation, updatedAt)
VALUES ('demo-team-aurora', '4-3-3', '{"LW": "demo-contract-aurora-0", "ST": "demo-contract-aurora-1", "RW": "demo-contract-aurora-2", "CLM": "demo-contract-aurora-3", "CM": "demo-contract-aurora-4", "CRM": "demo-contract-aurora-5", "LB": "demo-contract-aurora-6", "CLB": "demo-contract-aurora-7", "CRB": "demo-contract-aurora-8", "RB": "demo-contract-aurora-9", "GK": "demo-contract-aurora-10"}', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

-- Positions to article ids: what was fielded, frozen.
INSERT INTO performances (teamId, date, points, historical_formation)
VALUES
  ('demo-team-aurora', date('now', '-4 days'), 61.5, '{"LW": "Photosynthesis", "ST": "Black hole", "RW": "Mount Everest", "CLM": "Antarctica", "CM": "Coral reef", "CRM": "Aurora", "LB": "Volcano", "CLB": "Great Barrier Reef", "CRB": "Amazon rainforest", "RB": "Glacier", "GK": "Northern Lights"}'),
  ('demo-team-aurora', date('now', '-3 days'), 48.0, '{"LW": "Photosynthesis", "ST": "Black hole", "RW": "Mount Everest", "CLM": "Antarctica", "CM": "Coral reef", "CRM": "Aurora", "LB": "Volcano", "CLB": "Great Barrier Reef", "CRB": "Amazon rainforest", "RB": "Glacier", "GK": "Northern Lights"}'),
  ('demo-team-aurora', date('now', '-2 days'), 72.5, '{"LW": "Photosynthesis", "ST": "Black hole", "RW": "Mount Everest", "CLM": "Antarctica", "CM": "Coral reef", "CRM": "Aurora", "LB": "Volcano", "CLB": "Great Barrier Reef", "CRB": "Amazon rainforest", "RB": "Glacier", "GK": "Northern Lights"}'),
  ('demo-team-aurora', date('now', '-1 days'), 55.0, '{"LW": "Photosynthesis", "ST": "Black hole", "RW": "Mount Everest", "CLM": "Antarctica", "CM": "Coral reef", "CRM": "Aurora", "LB": "Volcano", "CLB": "Great Barrier Reef", "CRB": "Amazon rainforest", "RB": "Glacier", "GK": "Northern Lights"}');


-- ── Mercury Rising ────────────────────────────────────────────
INSERT INTO google_accounts (id, googleId, email)
VALUES ('demo-acct-mercuri', 'demo-acct-mercuri', 'mercuri@fantasywiki.local');

INSERT INTO players (id, username, accountId)
VALUES ('demo-player-mercuri', 'MercuryRising', 'demo-acct-mercuri');

INSERT INTO teams (id, name, playerId, leagueId)
VALUES ('demo-team-mercuri', '☄️ Mercury Rising', 'demo-player-mercuri', 'demo-league');

INSERT INTO contracts
  (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, settled, renewalCount, renewalElected)
VALUES
  ('demo-contract-mercuri-0', 'demo-team-mercuri', 'Apollo 11', date('now', '-20 days'), date('now', '+10 days'), 83.0, 0, 0, 0),
  ('demo-contract-mercuri-1', 'demo-team-mercuri', 'International Space Station', date('now', '-19 days'), date('now', '+11 days'), 72.0, 0, 0, 0),
  ('demo-contract-mercuri-2', 'demo-team-mercuri', 'Voyager 1', date('now', '-18 days'), date('now', '+12 days'), 58.0, 0, 0, 0),
  ('demo-contract-mercuri-3', 'demo-team-mercuri', 'Hubble Space Telescope', date('now', '-17 days'), date('now', '+13 days'), 66.0, 0, 0, 0),
  ('demo-contract-mercuri-4', 'demo-team-mercuri', 'Mars', date('now', '-16 days'), date('now', '+14 days'), 95.0, 0, 0, 0),
  ('demo-contract-mercuri-5', 'demo-team-mercuri', 'Saturn', date('now', '-15 days'), date('now', '+15 days'), 61.0, 0, 0, 0),
  ('demo-contract-mercuri-6', 'demo-team-mercuri', 'Halley''s Comet', date('now', '-14 days'), date('now', '+16 days'), 47.0, 0, 0, 0),
  ('demo-contract-mercuri-7', 'demo-team-mercuri', 'Milky Way', date('now', '-13 days'), date('now', '+17 days'), 74.0, 0, 0, 0),
  ('demo-contract-mercuri-8', 'demo-team-mercuri', 'Neil Armstrong', date('now', '-12 days'), date('now', '+18 days'), 52.0, 0, 0, 0),
  ('demo-contract-mercuri-9', 'demo-team-mercuri', 'Rocket', date('now', '-11 days'), date('now', '+19 days'), 38.0, 0, 0, 0),
  ('demo-contract-mercuri-10', 'demo-team-mercuri', 'Telescope', date('now', '-10 days'), date('now', '+20 days'), 35.0, 0, 0, 0);


-- Positions to contract ids.
INSERT INTO lineups (teamId, schema, formation, updatedAt)
VALUES ('demo-team-mercuri', '4-3-3', '{"LW": "demo-contract-mercuri-0", "ST": "demo-contract-mercuri-1", "RW": "demo-contract-mercuri-2", "CLM": "demo-contract-mercuri-3", "CM": "demo-contract-mercuri-4", "CRM": "demo-contract-mercuri-5", "LB": "demo-contract-mercuri-6", "CLB": "demo-contract-mercuri-7", "CRB": "demo-contract-mercuri-8", "RB": "demo-contract-mercuri-9", "GK": "demo-contract-mercuri-10"}', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

-- Positions to article ids: what was fielded, frozen.
INSERT INTO performances (teamId, date, points, historical_formation)
VALUES
  ('demo-team-mercuri', date('now', '-4 days'), 58.0, '{"LW": "Apollo 11", "ST": "International Space Station", "RW": "Voyager 1", "CLM": "Hubble Space Telescope", "CM": "Mars", "CRM": "Saturn", "LB": "Halley''s Comet", "CLB": "Milky Way", "CRB": "Neil Armstrong", "RB": "Rocket", "GK": "Telescope"}'),
  ('demo-team-mercuri', date('now', '-3 days'), 66.5, '{"LW": "Apollo 11", "ST": "International Space Station", "RW": "Voyager 1", "CLM": "Hubble Space Telescope", "CM": "Mars", "CRM": "Saturn", "LB": "Halley''s Comet", "CLB": "Milky Way", "CRB": "Neil Armstrong", "RB": "Rocket", "GK": "Telescope"}'),
  ('demo-team-mercuri', date('now', '-2 days'), 51.0, '{"LW": "Apollo 11", "ST": "International Space Station", "RW": "Voyager 1", "CLM": "Hubble Space Telescope", "CM": "Mars", "CRM": "Saturn", "LB": "Halley''s Comet", "CLB": "Milky Way", "CRB": "Neil Armstrong", "RB": "Rocket", "GK": "Telescope"}'),
  ('demo-team-mercuri', date('now', '-1 days'), 70.0, '{"LW": "Apollo 11", "ST": "International Space Station", "RW": "Voyager 1", "CLM": "Hubble Space Telescope", "CM": "Mars", "CRM": "Saturn", "LB": "Halley''s Comet", "CLB": "Milky Way", "CRB": "Neil Armstrong", "RB": "Rocket", "GK": "Telescope"}');


-- ── Scriptorium United ────────────────────────────────────────
INSERT INTO google_accounts (id, googleId, email)
VALUES ('demo-acct-scriptor', 'demo-acct-scriptor', 'scriptor@fantasywiki.local');

INSERT INTO players (id, username, accountId)
VALUES ('demo-player-scriptor', 'Scriptorium', 'demo-acct-scriptor');

INSERT INTO teams (id, name, playerId, leagueId)
VALUES ('demo-team-scriptor', '📜 Scriptorium United', 'demo-player-scriptor', 'demo-league');

INSERT INTO contracts
  (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, settled, renewalCount, renewalElected)
VALUES
  ('demo-contract-scriptor-0', 'demo-team-scriptor', 'Printing press', date('now', '-20 days'), date('now', '+10 days'), 69.0, 0, 0, 0),
  ('demo-contract-scriptor-1', 'demo-team-scriptor', 'Library of Alexandria', date('now', '-19 days'), date('now', '+11 days'), 57.0, 0, 0, 0),
  ('demo-contract-scriptor-2', 'demo-team-scriptor', 'Rosetta Stone', date('now', '-18 days'), date('now', '+12 days'), 88.0, 0, 0, 0),
  ('demo-contract-scriptor-3', 'demo-team-scriptor', 'Gutenberg Bible', date('now', '-17 days'), date('now', '+13 days'), 51.0, 0, 0, 0),
  ('demo-contract-scriptor-4', 'demo-team-scriptor', 'Papyrus', date('now', '-16 days'), date('now', '+14 days'), 43.0, 0, 0, 0),
  ('demo-contract-scriptor-5', 'demo-team-scriptor', 'Cuneiform', date('now', '-15 days'), date('now', '+15 days'), 46.0, 0, 0, 0),
  ('demo-contract-scriptor-6', 'demo-team-scriptor', 'Dead Sea Scrolls', date('now', '-14 days'), date('now', '+16 days'), 62.0, 0, 0, 0),
  ('demo-contract-scriptor-7', 'demo-team-scriptor', 'Illuminated manuscript', date('now', '-13 days'), date('now', '+17 days'), 49.0, 0, 0, 0),
  ('demo-contract-scriptor-8', 'demo-team-scriptor', 'Codex', date('now', '-12 days'), date('now', '+18 days'), 41.0, 0, 0, 0),
  ('demo-contract-scriptor-9', 'demo-team-scriptor', 'Hieroglyph', date('now', '-11 days'), date('now', '+19 days'), 54.0, 0, 0, 0),
  ('demo-contract-scriptor-10', 'demo-team-scriptor', 'Alphabet', date('now', '-10 days'), date('now', '+20 days'), 37.0, 0, 0, 0);


-- Positions to contract ids.
INSERT INTO lineups (teamId, schema, formation, updatedAt)
VALUES ('demo-team-scriptor', '4-3-3', '{"LW": "demo-contract-scriptor-0", "ST": "demo-contract-scriptor-1", "RW": "demo-contract-scriptor-2", "CLM": "demo-contract-scriptor-3", "CM": "demo-contract-scriptor-4", "CRM": "demo-contract-scriptor-5", "LB": "demo-contract-scriptor-6", "CLB": "demo-contract-scriptor-7", "CRB": "demo-contract-scriptor-8", "RB": "demo-contract-scriptor-9", "GK": "demo-contract-scriptor-10"}', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

-- Positions to article ids: what was fielded, frozen.
INSERT INTO performances (teamId, date, points, historical_formation)
VALUES
  ('demo-team-scriptor', date('now', '-4 days'), 44.5, '{"LW": "Printing press", "ST": "Library of Alexandria", "RW": "Rosetta Stone", "CLM": "Gutenberg Bible", "CM": "Papyrus", "CRM": "Cuneiform", "LB": "Dead Sea Scrolls", "CLB": "Illuminated manuscript", "CRB": "Codex", "RB": "Hieroglyph", "GK": "Alphabet"}'),
  ('demo-team-scriptor', date('now', '-3 days'), 71.0, '{"LW": "Printing press", "ST": "Library of Alexandria", "RW": "Rosetta Stone", "CLM": "Gutenberg Bible", "CM": "Papyrus", "CRM": "Cuneiform", "LB": "Dead Sea Scrolls", "CLB": "Illuminated manuscript", "CRB": "Codex", "RB": "Hieroglyph", "GK": "Alphabet"}'),
  ('demo-team-scriptor', date('now', '-2 days'), 63.5, '{"LW": "Printing press", "ST": "Library of Alexandria", "RW": "Rosetta Stone", "CLM": "Gutenberg Bible", "CM": "Papyrus", "CRM": "Cuneiform", "LB": "Dead Sea Scrolls", "CLB": "Illuminated manuscript", "CRB": "Codex", "RB": "Hieroglyph", "GK": "Alphabet"}'),
  ('demo-team-scriptor', date('now', '-1 days'), 49.5, '{"LW": "Printing press", "ST": "Library of Alexandria", "RW": "Rosetta Stone", "CLM": "Gutenberg Bible", "CM": "Papyrus", "CRM": "Cuneiform", "LB": "Dead Sea Scrolls", "CLB": "Illuminated manuscript", "CRB": "Codex", "RB": "Hieroglyph", "GK": "Alphabet"}');
