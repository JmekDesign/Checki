-- Interface language preference per venue (en / ka)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS lang VARCHAR(2) NOT NULL DEFAULT 'en';
