from __future__ import annotations

import os
import psycopg2
import psycopg2.extras
from contextlib import suppress
from typing import Any

DSN = (
    f"host={os.environ['DB_HOST']} port={os.environ.get('DB_PORT','5432')} "
    f"dbname={os.environ['DB_NAME']} user={os.environ['DB_USER']} "
    f"password={os.environ['DB_PASSWORD']}"
)


def _conn() -> psycopg2.extensions.connection:
    return psycopg2.connect(DSN, cursor_factory=psycopg2.extras.RealDictCursor)


# ── threads ──────────────────────────────────────────────────────────────────

def get_or_create_thread(tg_user_id: int, first_name: str, username: str | None, lang: str) -> dict[str, Any]:
    conn = _conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM support_threads WHERE tg_user_id = %s", (tg_user_id,))
        row = cur.fetchone()
        if row:
            cur.execute(
                "UPDATE support_threads SET tg_first_name=%s, tg_username=%s, language_code=%s, updated_at=NOW() WHERE tg_user_id=%s",
                (first_name, username, lang, tg_user_id),
            )
            conn.commit()
            return dict(row)
        cur.execute(
            "INSERT INTO support_threads (tg_user_id, tg_first_name, tg_username, language_code) VALUES (%s,%s,%s,%s) RETURNING *",
            (tg_user_id, first_name, username, lang),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    finally:
        with suppress(Exception):
            conn.close()


def update_thread(thread_id: int, **kwargs: Any) -> None:
    if not kwargs:
        return
    cols = ", ".join(f"{k}=%s" for k in kwargs)
    vals = list(kwargs.values()) + [thread_id]
    conn = _conn()
    try:
        cur = conn.cursor()
        cur.execute(f"UPDATE support_threads SET {cols}, updated_at=NOW() WHERE id=%s", vals)
        conn.commit()
    finally:
        with suppress(Exception):
            conn.close()


# ── messages ─────────────────────────────────────────────────────────────────

def save_message(thread_id: int, role: str, text: str) -> None:
    conn = _conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO support_messages (thread_id, role, text) VALUES (%s,%s,%s)",
            (thread_id, role, text),
        )
        conn.commit()
    finally:
        with suppress(Exception):
            conn.close()


def get_history(thread_id: int, limit: int = 10) -> list[dict[str, Any]]:
    conn = _conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT role, text FROM support_messages WHERE thread_id=%s ORDER BY created_at DESC LIMIT %s",
            (thread_id, limit),
        )
        rows = cur.fetchall()
        return list(reversed([dict(r) for r in rows]))
    finally:
        with suppress(Exception):
            conn.close()


# ── venue lookup ──────────────────────────────────────────────────────────────

def find_venue(query: str) -> dict[str, Any] | None:
    """Find venue by manager login, email, or venue name (case-insensitive)."""
    conn = _conn()
    try:
        cur = conn.cursor()
        q = query.strip().lower()
        cur.execute(
            """SELECT v.id, v.name, v.subscription_expires_at, v.is_free,
                      u.login, u.role
               FROM users u JOIN venues v ON v.id = u.venue_id
               WHERE u.role IN ('manager','superadmin')
                 AND (
                   lower(u.login) = %s
                   OR lower(u.email) = %s
                   OR lower(v.name) LIKE %s
                 )
               ORDER BY
                 CASE WHEN lower(u.login) = %s THEN 0
                      WHEN lower(u.email) = %s THEN 1
                      ELSE 2 END
               LIMIT 1""",
            (q, q, f"%{q}%", q, q),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        with suppress(Exception):
            conn.close()


REFERRAL_RATE_PCT: int = int(os.environ.get("REFERRAL_RATE_PCT", "30"))
_PLAN_AMOUNTS: dict[int, float] = {30: 49.0, 365: 490.0}


def get_threads_to_nudge(no_reply_minutes: int = 15) -> list[dict[str, Any]]:
    """Escalated threads with no agent reply and no nudge sent yet."""
    conn = _conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT t.* FROM support_threads t
               WHERE t.escalated = TRUE
                 AND t.nudged_at IS NULL
                 AND t.updated_at < NOW() - make_interval(mins => %s)
                 AND NOT EXISTS (
                   SELECT 1 FROM support_messages m
                   WHERE m.thread_id = t.id AND m.role = 'agent'
                     AND m.created_at > t.updated_at - make_interval(mins => %s)
                 )""",
            (no_reply_minutes, no_reply_minutes),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        with suppress(Exception):
            conn.close()


def get_threads_to_close(idle_hours: int = 2) -> list[dict[str, Any]]:
    """Escalated threads with no activity for idle_hours."""
    conn = _conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT * FROM support_threads
               WHERE escalated = TRUE
                 AND updated_at < NOW() - make_interval(hours => %s)""",
            (idle_hours,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        with suppress(Exception):
            conn.close()


def close_thread(thread_id: int) -> None:
    conn = _conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE support_threads SET escalated=FALSE, group_msg_id=NULL, nudged_at=NULL WHERE id=%s",
            (thread_id,),
        )
        conn.commit()
    finally:
        with suppress(Exception):
            conn.close()


def extend_subscription(venue_id: str, days: int = 30) -> float:
    """Extend subscription and credit referral commission. Returns commission amount."""
    conn = _conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """UPDATE venues
               SET subscription_expires_at = GREATEST(NOW(), COALESCE(subscription_expires_at, NOW()))
                   + make_interval(days => %s)
               WHERE id = %s""",
            (days, venue_id),
        )
        plan_amount = _PLAN_AMOUNTS.get(days, 49.0)
        commission = round(plan_amount * REFERRAL_RATE_PCT / 100, 2)
        cur.execute(
            """UPDATE venues
                  SET balance = balance + %s
                WHERE referral_code = (
                    SELECT referred_by_code FROM venues WHERE id = %s
                )
                  AND (SELECT referred_by_code FROM venues WHERE id = %s) IS NOT NULL""",
            (commission, venue_id, venue_id),
        )
        conn.commit()
        return commission
    finally:
        with suppress(Exception):
            conn.close()
