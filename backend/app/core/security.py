from __future__ import annotations

import hashlib
from typing import TypedDict

from fastapi import HTTPException

from ..db.conn import db_conn, db_release
from .config import AUTH_SALT


class UserContext(TypedDict):
    user_id: str
    venue_id: str | None
    role: str
    name: str


def hash_password(pw: str) -> str:
    raw = (AUTH_SALT + pw).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def require_user(authorization: str | None) -> UserContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.split(" ", 1)[1].strip()

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute("delete from sessions where revoked_at is null and expires_at < now();")

        cur.execute(
            """
            select s.user_id, s.venue_id, u.role, u.name
            from sessions s
            join users u on u.id = s.user_id
            where s.token=%s and s.revoked_at is null and s.expires_at > now();
            """,
            (token,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="invalid token")

        user_id, venue_id, role, name = row
        conn.commit()
        return UserContext(
            user_id=str(user_id),
            venue_id=str(venue_id) if venue_id else None,
            role=role,
            name=name,
        )
    finally:
        db_release(conn)
