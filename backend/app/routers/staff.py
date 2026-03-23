from __future__ import annotations

import contextlib
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException

from ..core.security import UserContext, hash_password, require_user
from ..db.conn import db_conn, db_release
from ..schemas.staff import StaffCreateIn, StaffUpdateIn

router = APIRouter()

_ALLOWED_ROLES = ("manager", "staff")


def _require_manager(authorization: str | None) -> UserContext:
    user = require_user(authorization)
    if user["role"] not in ("manager", "superadmin"):
        raise HTTPException(status_code=403, detail="manager role required")
    return user


@router.get("/api/staff")
def staff_list(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = _require_manager(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, name, login, role, is_active, created_at, email
            FROM users
            WHERE venue_id = %s
            ORDER BY created_at ASC;
            """,
            (venue_id,),
        )
        items = []
        for uid, name, login, role, is_active, created_at, email in cur.fetchall():
            items.append(
                {
                    "id": str(uid),
                    "name": name,
                    "login": login,
                    "role": role,
                    "is_active": bool(is_active),
                    "created_at": created_at.isoformat() if created_at else None,
                    "email": email or "",
                }
            )
        return {"ok": True, "items": items}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


@router.post("/api/staff")
def staff_create(
    payload: StaffCreateIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = _require_manager(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    name = payload.name.strip()
    login_val = payload.login.strip().lower()
    if not name or not login_val or not payload.password:
        raise HTTPException(status_code=400, detail="name, login and password required")

    role = payload.role if payload.role in _ALLOWED_ROLES else "staff"
    email_val = (payload.email or "").strip().lower() or None

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM users WHERE login = %s;", (login_val,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="login already taken")

        cur.execute(
            """
            INSERT INTO users (venue_id, role, name, login, password_hash, email)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (venue_id, role, name, login_val, hash_password(payload.password), email_val),
        )
        row = cur.fetchone()
        assert row is not None
        conn.commit()
        return {"ok": True, "id": str(row[0])}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


@router.patch("/api/staff/{staff_id}")
def staff_update(
    staff_id: UUID,
    payload: StaffUpdateIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = _require_manager(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    if str(staff_id) == user["user_id"]:
        raise HTTPException(status_code=400, detail="cannot modify yourself")

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT role FROM users WHERE id = %s AND venue_id = %s;",
            (str(staff_id), venue_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="staff not found")
        if row[0] == "superadmin":
            raise HTTPException(status_code=403, detail="cannot modify superadmin")

        # Build parameterized SET using a whitelist of safe column names only
        col_map: list[tuple[str, Any]] = []
        if payload.name is not None:
            col_map.append(("name", payload.name.strip()))
        if payload.role is not None and payload.role in _ALLOWED_ROLES:
            col_map.append(("role", payload.role))
        if payload.is_active is not None:
            col_map.append(("is_active", payload.is_active))
        if payload.password:
            col_map.append(("password_hash", hash_password(payload.password)))
        if payload.email is not None:
            col_map.append(("email", (payload.email.strip().lower() or None)))

        if not col_map:
            return {"ok": True}

        # Column names come from our whitelist above — no user input in SQL structure
        set_clause = ", ".join(f"{col} = %s" for col, _ in col_map)
        params: list[Any] = [val for _, val in col_map] + [str(staff_id)]
        cur.execute(
            f"UPDATE users SET {set_clause} WHERE id = %s;",  # noqa: S608
            tuple(params),
        )
        conn.commit()
        return {"ok": True}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


@router.delete("/api/staff/{staff_id}")
def staff_delete(
    staff_id: UUID,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = _require_manager(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    if str(staff_id) == user["user_id"]:
        raise HTTPException(status_code=400, detail="cannot delete yourself")

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT role FROM users WHERE id = %s AND venue_id = %s;",
            (str(staff_id), venue_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="staff not found")
        if row[0] == "manager":
            raise HTTPException(status_code=403, detail="cannot delete manager account")

        # Delete sessions first, then user
        cur.execute("DELETE FROM sessions WHERE user_id = %s;", (str(staff_id),))
        cur.execute(
            "DELETE FROM users WHERE id = %s AND venue_id = %s;",
            (str(staff_id), venue_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)
