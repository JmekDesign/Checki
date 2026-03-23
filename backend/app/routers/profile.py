from __future__ import annotations

import contextlib
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..core.security import hash_password, require_user
from ..db.conn import db_conn, db_release

router = APIRouter()


class ProfileUpdateIn(BaseModel):
    email: str | None = None
    password: str | None = None


@router.get("/api/profile")
def profile_get(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT name, login, email, role FROM users WHERE id = %s;",
            (user["user_id"],),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="user not found")
        return {"ok": True, "name": row[0], "login": row[1], "email": row[2] or "", "role": row[3]}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


@router.patch("/api/profile")
def profile_update(
    payload: ProfileUpdateIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)

    col_map: list[tuple[str, Any]] = []
    if payload.email is not None:
        col_map.append(("email", payload.email.strip().lower() or None))
    if payload.password:
        if len(payload.password) < 4:
            raise HTTPException(status_code=400, detail="password too short")
        col_map.append(("password_hash", hash_password(payload.password)))

    if not col_map:
        return {"ok": True}

    set_clause = ", ".join(f"{col} = %s" for col, _ in col_map)
    params: list[Any] = [val for _, val in col_map] + [user["user_id"]]

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE users SET {set_clause} WHERE id = %s;",  # noqa: S608
            tuple(params),
        )
        conn.commit()
        return {"ok": True}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)
