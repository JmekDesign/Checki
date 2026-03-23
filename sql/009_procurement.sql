-- Migration 009: procurement orders and items
CREATE TABLE procurement_orders (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id   UUID        NOT NULL REFERENCES venues(id),
    title      TEXT        NOT NULL,
    status     TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at  TIMESTAMPTZ
);

CREATE TABLE procurement_items (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id   UUID        NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
    venue_id   UUID        NOT NULL,
    text       TEXT        NOT NULL,
    qty        TEXT        NOT NULL DEFAULT '1',
    is_checked BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_procurement_orders_venue ON procurement_orders(venue_id, status);
CREATE INDEX idx_procurement_items_order  ON procurement_items(order_id);
