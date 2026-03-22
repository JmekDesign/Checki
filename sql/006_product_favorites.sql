-- Migration 006: is_favorite flag for quick-pick chips
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_venue_fav ON products(venue_id, is_favorite)
  WHERE is_favorite = TRUE;
