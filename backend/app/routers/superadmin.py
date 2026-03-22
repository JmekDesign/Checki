from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..core.security import hash_password, require_user
from ..db.conn import db_conn, db_release

router = APIRouter()


def _require_super(authorization: str | None) -> None:
    user = require_user(authorization)
    if user["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="superadmin only")


@router.get("/api/super/venues")
def super_venues(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _require_super(authorization)

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                v.id,
                v.name,
                v.slug,
                v.email,
                v.phone,
                v.is_active,
                v.created_at,
                -- manager
                (SELECT login FROM users
                 WHERE venue_id = v.id AND role = 'manager'
                 ORDER BY created_at ASC LIMIT 1) AS manager_login,
                -- staff count
                (SELECT COUNT(*) FROM users
                 WHERE venue_id = v.id AND role = 'staff') AS staff_count,
                -- total checks
                (SELECT COUNT(*) FROM checks
                 WHERE venue_id = v.id) AS check_count,
                -- checks last 30 days
                (SELECT COUNT(*) FROM checks
                 WHERE venue_id = v.id
                   AND opened_at >= now() - INTERVAL '30 days') AS checks_30d,
                -- revenue last 30 days
                (SELECT COALESCE(SUM(total), 0) FROM checks
                 WHERE venue_id = v.id
                   AND closed_at >= now() - INTERVAL '30 days'
                   AND status = 'closed') AS revenue_30d
            FROM venues v
            ORDER BY v.created_at DESC;
            """
        )
        items = []
        for row in cur.fetchall():
            (
                vid,
                name,
                slug,
                email,
                phone,
                is_active,
                created_at,
                manager_login,
                staff_count,
                check_count,
                checks_30d,
                revenue_30d,
            ) = row
            items.append(
                {
                    "id": str(vid),
                    "name": name,
                    "slug": slug,
                    "email": email,
                    "phone": phone,
                    "is_active": bool(is_active),
                    "created_at": created_at.isoformat() if created_at else None,
                    "manager_login": manager_login,
                    "staff_count": int(staff_count or 0),
                    "check_count": int(check_count or 0),
                    "checks_30d": int(checks_30d or 0),
                    "revenue_30d": float(revenue_30d or 0),
                }
            )
        return {"ok": True, "items": items, "total": len(items)}
    finally:
        db_release(conn)


class ResetPasswordIn(BaseModel):
    password: str


@router.post("/api/super/venues/{venue_id}/reset-password")
def super_reset_password(
    venue_id: str,
    payload: ResetPasswordIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _require_super(authorization)
    if len(payload.password) < 4:
        raise HTTPException(status_code=400, detail="password too short")

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE users SET password_hash = %s
            WHERE venue_id = %s AND role = 'manager'
            RETURNING login;
            """,
            (hash_password(payload.password), venue_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="manager not found")
        conn.commit()
        return {"ok": True, "login": row[0]}
    finally:
        db_release(conn)


@router.patch("/api/super/venues/{venue_id}")
def super_venue_toggle(
    venue_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _require_super(authorization)

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT is_active FROM venues WHERE id = %s;",
            (venue_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="venue not found")
        new_state = not bool(row[0])
        cur.execute(
            "UPDATE venues SET is_active = %s WHERE id = %s;",
            (new_state, venue_id),
        )
        # Also toggle all users of this venue
        cur.execute(
            "UPDATE users SET is_active = %s WHERE venue_id = %s;",
            (new_state, venue_id),
        )
        conn.commit()
        return {"ok": True, "is_active": new_state}
    finally:
        db_release(conn)
