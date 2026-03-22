-- Migration 005: locked flag — products manually edited by manager are skipped by AI normalization
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;
