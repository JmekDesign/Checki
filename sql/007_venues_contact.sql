-- Migration 007: contact fields for registration
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS email TEXT NULL,
  ADD COLUMN IF NOT EXISTS phone TEXT NULL;
