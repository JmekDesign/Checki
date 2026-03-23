from __future__ import annotations

import contextlib
import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from ..core.config import APP_URL, SMTP_USER
from ..core.mailer import send_reset_email
from ..core.security import hash_password
from ..db.conn import db_conn, db_release

logger = logging.getLogger(__name__)
router = APIRouter()


class ForgotIn(BaseModel):
    email: str


class ResetIn(BaseModel):
    token: str
    password: str


@router.post("/api/auth/forgot-password")
def forgot_password(
    payload: ForgotIn,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    email = payload.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email required")

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM users WHERE email = %s AND is_active = TRUE;",
            (email,),
        )
        row = cur.fetchone()
        if not row:
            # Don't reveal whether email exists
            return {"ok": True}
        user_id = str(row[0])

        # Invalidate old tokens for this user
        cur.execute(
            "UPDATE password_resets SET used = TRUE WHERE user_id = %s AND used = FALSE;",
            (user_id,),
        )
        cur.execute(
            "INSERT INTO password_resets (user_id) VALUES (%s) RETURNING token;",
            (user_id,),
        )
        token_row = cur.fetchone()
        assert token_row is not None
        token = str(token_row[0])
        conn.commit()
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)

    if SMTP_USER:
        reset_url = f"{APP_URL}?reset={token}"
        background_tasks.add_task(_send_bg, email, reset_url)

    return {"ok": True}


@router.post("/api/auth/reset-password")
def reset_password(payload: ResetIn) -> dict[str, Any]:
    token = payload.token.strip()
    password = payload.password.strip()
    if not token or not password:
        raise HTTPException(status_code=400, detail="token and password required")
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="password too short")

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT user_id FROM password_resets
            WHERE token = %s
              AND used = FALSE
              AND expires_at > now();
            """,
            (token,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=400, detail="invalid or expired token")
        user_id = str(row[0])

        cur.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s;",
            (hash_password(password), user_id),
        )
        cur.execute(
            "UPDATE password_resets SET used = TRUE WHERE token = %s;",
            (token,),
        )
        # Invalidate all sessions so old sessions can't be reused
        cur.execute(
            "DELETE FROM sessions WHERE user_id = %s;",
            (user_id,),
        )
        conn.commit()
        return {"ok": True}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


def _send_bg(email: str, reset_url: str) -> None:
    try:
        send_reset_email(email, reset_url)
    except Exception as exc:
        logger.warning("failed to send reset email to %s: %s", email, exc)
