-- Migration 008: active flag for venues
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
