-- Support bot: threads and messages
CREATE TABLE IF NOT EXISTS support_threads (
    id              SERIAL PRIMARY KEY,
    tg_user_id      BIGINT UNIQUE NOT NULL,
    tg_username     TEXT,
    tg_first_name   TEXT,
    language_code   TEXT NOT NULL DEFAULT 'en',
    venue_id        INTEGER REFERENCES venues(id) ON DELETE SET NULL,
    group_msg_id    INTEGER,   -- last escalation message id in support group
    escalated       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_messages (
    id          SERIAL PRIMARY KEY,
    thread_id   INTEGER NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user', 'bot', 'agent')),
    text        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_messages_thread_idx ON support_messages(thread_id);
