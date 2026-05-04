-- Billing: subscription, balance, referral codes
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS balance                 NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_free                 BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS referral_code           VARCHAR(16)   UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_code        VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_venues_referral_code ON venues(referral_code);
