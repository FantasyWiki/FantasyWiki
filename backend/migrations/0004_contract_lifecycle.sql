-- Migration: Add contract lifecycle fields (settled, renewalCount, renewalElected)
-- Date: 2026-07-03

ALTER TABLE contracts ADD COLUMN settled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contracts ADD COLUMN renewalCount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contracts ADD COLUMN renewalElected INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_contracts_settled_expire ON contracts(settled, expireDate);
