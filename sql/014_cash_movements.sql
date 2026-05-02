-- Migration 014: cash register movements per shift
CREATE TABLE IF NOT EXISTS cash_movements (
    id          SERIAL PRIMARY KEY,
    venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    shift_date  DATE NOT NULL,
    type        VARCHAR(10) NOT NULL CHECK (type IN ('open', 'in', 'out')),
    amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    note        TEXT,
    check_id    UUID REFERENCES checks(id) ON DELETE SET NULL,
    created_by  UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_venue_shift ON cash_movements(venue_id, shift_date);
