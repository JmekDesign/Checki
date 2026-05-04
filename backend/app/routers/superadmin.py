from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..core.billing import credit_referral_commission
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
                v.id, v.name, v.slug, v.email, v.phone,
                v.is_active, v.is_free, v.created_at,
                v.subscription_expires_at, v.referral_code, v.referred_by_code, v.balance,
                (SELECT login FROM users WHERE venue_id = v.id AND role = 'manager'
                 ORDER BY created_at ASC LIMIT 1) AS manager_login,
                (SELECT email FROM users WHERE venue_id = v.id AND role = 'manager'
                 ORDER BY created_at ASC LIMIT 1) AS manager_email,
                (SELECT COUNT(*) FROM users WHERE venue_id = v.id) AS staff_count,
                (SELECT COUNT(*) FROM checks WHERE venue_id = v.id) AS check_count,
                (SELECT COUNT(*) FROM checks WHERE venue_id = v.id
                   AND opened_at >= now() - INTERVAL '30 days') AS checks_30d,
                (SELECT COALESCE(SUM(total), 0) FROM checks WHERE venue_id = v.id
                   AND closed_at >= now() - INTERVAL '30 days'
                   AND status = 'closed') AS revenue_30d
            FROM venues v
            ORDER BY v.created_at DESC;
            """
        )
        now = datetime.now(UTC)
        items = []
        for row in cur.fetchall():
            (
                vid, name, slug, email, phone,
                is_active, is_free, created_at,
                sub_expires, referral_code, referred_by_code, balance,
                manager_login, manager_email,
                staff_count, check_count, checks_30d, revenue_30d,
            ) = row

            trial_end = created_at.astimezone(UTC) + timedelta(days=14)
            if is_free:
                sub_status = "free"
            elif sub_expires and sub_expires.astimezone(UTC) > now:
                sub_status = "active"
            elif sub_expires is None and now <= trial_end:
                sub_status = "trial"
            else:
                sub_status = "expired"

            items.append({
                "id": str(vid),
                "name": name,
                "slug": slug,
                "email": email,
                "phone": phone,
                "is_active": bool(is_active),
                "is_free": bool(is_free),
                "created_at": created_at.isoformat() if created_at else None,
                "subscription_expires_at": sub_expires.isoformat() if sub_expires else None,
                "sub_status": sub_status,
                "trial_ends_at": trial_end.isoformat(),
                "referral_code": referral_code or "",
                "referred_by_code": referred_by_code or "",
                "balance": float(balance or 0),
                "manager_login": manager_login,
                "manager_email": manager_email or "",
                "staff_count": int(staff_count or 0),
                "check_count": int(check_count or 0),
                "checks_30d": int(checks_30d or 0),
                "revenue_30d": float(revenue_30d or 0),
            })
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
            "UPDATE users SET password_hash = %s WHERE venue_id = %s AND role = 'manager' RETURNING login;",
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
        cur.execute("SELECT is_active FROM venues WHERE id = %s;", (venue_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="venue not found")
        new_state = not bool(row[0])
        cur.execute("UPDATE venues SET is_active = %s WHERE id = %s;", (new_state, venue_id))
        cur.execute("UPDATE users SET is_active = %s WHERE venue_id = %s;", (new_state, venue_id))
        conn.commit()
        return {"ok": True, "is_active": new_state}
    finally:
        db_release(conn)


class ExtendIn(BaseModel):
    period: str  # "month" | "year"


@router.post("/api/super/venues/{venue_id}/extend")
def super_extend(
    venue_id: str,
    payload: ExtendIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _require_super(authorization)
    if payload.period not in ("month", "year"):
        raise HTTPException(status_code=400, detail="period must be 'month' or 'year'")

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT subscription_expires_at FROM venues WHERE id = %s;", (venue_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="venue not found")

        now = datetime.now(UTC)
        current = row[0]
        base = max(current.astimezone(UTC), now) if current else now
        delta = timedelta(days=365) if payload.period == "year" else timedelta(days=30)
        new_expiry = base + delta

        cur.execute(
            "UPDATE venues SET subscription_expires_at = %s WHERE id = %s;",
            (new_expiry, venue_id),
        )
        commission = credit_referral_commission(cur, venue_id, payload.period)
        conn.commit()
        return {
            "ok": True,
            "subscription_expires_at": new_expiry.isoformat(),
            "commission_credited": float(commission),
        }
    finally:
        db_release(conn)


@router.post("/api/super/venues/{venue_id}/toggle-free")
def super_toggle_free(
    venue_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _require_super(authorization)

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT is_free FROM venues WHERE id = %s;", (venue_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="venue not found")
        new_state = not bool(row[0])
        cur.execute("UPDATE venues SET is_free = %s WHERE id = %s;", (new_state, venue_id))
        conn.commit()
        return {"ok": True, "is_free": new_state}
    finally:
        db_release(conn)
