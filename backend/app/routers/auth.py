from __future__ import annotations

import contextlib
import time
import uuid
from typing import Any

from fastapi import APIRouter, Header, HTTPException

from ..core.config import SESSION_TTL_HOURS
from ..core.security import hash_password, require_user
from ..db.conn import db_conn
from ..schemas.auth import LoginIn

router = APIRouter()


@router.post("/api/auth/login")
def login(payload: LoginIn) -> dict[str, Any]:
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "select id, venue_id, role, name, password_hash, is_active from users where login=%s;",
            (payload.login,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="invalid credentials")
        user_id, venue_id, role, name, password_hash_db, is_active = row
        if not is_active:
            raise HTTPException(status_code=403, detail="user inactive")
        if hash_password(payload.password) != password_hash_db:
            raise HTTPException(status_code=401, detail="invalid credentials")

        token = uuid.uuid4().hex
        cur.execute(
            """
            insert into sessions (token, user_id, venue_id, expires_at)
            values (%s, %s, %s, now() + (%s || ' hours')::interval)
            """,
            (token, user_id, venue_id, SESSION_TTL_HOURS),
        )
        conn.commit()

        return {
            "ok": True,
            "token": token,
            "user": {
                "user_id": str(user_id),
                "venue_id": str(venue_id) if venue_id else None,
                "role": role,
                "name": name,
                "issued_at": int(time.time()),
                "ttl_hours": SESSION_TTL_HOURS,
            },
        }
    finally:
        with contextlib.suppress(Exception):
            conn.close()


@router.post("/api/auth/logout")
def logout(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.split(" ", 1)[1].strip()

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "update sessions set revoked_at = now() where token=%s and revoked_at is null;",
            (token,),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=401, detail="invalid token")
        conn.commit()
        return {"ok": True}
    finally:
        with contextlib.suppress(Exception):
            conn.close()


@router.get("/api/auth/me")
def me(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    return {"ok": True, "user": user}
