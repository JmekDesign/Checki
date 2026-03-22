-- Migration 003: shift-based check numbering
-- Adds shift_date (date of the shift) and shift_number (per-shift sequential number)

ALTER TABLE checks
    ADD COLUMN IF NOT EXISTS shift_date DATE NULL,
    ADD COLUMN IF NOT EXISTS shift_number INT NULL;

CREATE INDEX IF NOT EXISTS idx_checks_venue_shift ON checks(venue_id, shift_date);

-- Backfill existing checks:
-- shift_date = calendar date of closed_at (or created_at for open/no closed_at)
-- shift_number = order within that venue+date group
WITH numbered AS (
    SELECT
        id,
        date(coalesce(closed_at, created_at) AT TIME ZONE 'UTC') AS sdate,
        ROW_NUMBER() OVER (
            PARTITION BY venue_id, date(coalesce(closed_at, created_at) AT TIME ZONE 'UTC')
            ORDER BY created_at
        ) AS snum
    FROM checks
)
UPDATE checks
SET shift_date   = numbered.sdate,
    shift_number = numbered.snum
FROM numbered
WHERE checks.id = numbered.id;
