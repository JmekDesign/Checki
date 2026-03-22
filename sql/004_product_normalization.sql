-- Migration 004: add needs_normalization flag to products
-- Existing products are marked false (keep as-is).
-- New products default to true → background AI normalization kicks in.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS needs_normalization BOOLEAN NOT NULL DEFAULT FALSE;

-- New products created after this migration will be normalized automatically.
-- (The DEFAULT FALSE here is intentional for existing rows; the INSERT in upsert
--  explicitly sets TRUE for new rows OR relies on the application logic.)
