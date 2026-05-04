from __future__ import annotations

import contextlib
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..core.security import UserContext, require_user
from ..db.conn import db_conn, db_release

router = APIRouter()


def _require_manager(authorization: str | None) -> UserContext:
    user = require_user(authorization)
    if user["role"] not in ("manager", "superadmin"):
        raise HTTPException(status_code=403, detail="manager role required")
    return user


@router.get("/api/venue")
def venue_get(
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
            "SELECT id, slug, name, lang, referral_code, is_free, subscription_expires_at, created_at FROM venues WHERE id = %s;",
            (venue_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="venue not found")

        cur.execute(
            """
            SELECT COUNT(*), COALESCE(SUM(total), 0)
            FROM checks
            WHERE venue_id = %s AND status = 'closed'
              AND closed_at >= (CURRENT_DATE AT TIME ZONE 'UTC');
            """,
            (venue_id,),
        )
        closed_row = cur.fetchone()
        assert closed_row is not None

        cur.execute(
            "SELECT COUNT(*) FROM checks WHERE venue_id = %s AND status = 'open';",
            (venue_id,),
        )
        open_row = cur.fetchone()
        assert open_row is not None

        vid, slug, name, lang, referral_code, is_free, sub_expires, created_at = row
        now = datetime.now(UTC)
        trial_end = created_at.astimezone(UTC) + timedelta(days=14)
        if is_free:
            sub_status = "free"
        elif sub_expires and sub_expires.astimezone(UTC) > now:
            sub_status = "active"
        elif sub_expires is None and now <= trial_end:
            sub_status = "trial"
        else:
            sub_status = "expired"

        return {
            "ok": True,
            "venue": {
                "id": str(vid),
                "slug": slug,
                "name": name,
                "lang": lang or "en",
                "referral_code": referral_code or "",
                "sub_status": sub_status,
                "subscription_expires_at": sub_expires.isoformat() if sub_expires else None,
                "trial_ends_at": trial_end.isoformat(),
                "is_free": bool(is_free),
            },
            "stats": {
                "closed_today": int(closed_row[0]),
                "revenue_today": float(closed_row[1]),
                "open_now": int(open_row[0]),
            },
        }
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


class VenueLangIn(BaseModel):
    lang: str


@router.patch("/api/venue/lang")
def venue_set_lang(
    payload: VenueLangIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    """Update venue interface language (en / ka). Manager only."""
    user = _require_manager(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    lang = payload.lang if payload.lang in ("en", "ka") else "en"
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE venues SET lang = %s WHERE id = %s;", (lang, venue_id))
        conn.commit()
        return {"ok": True, "lang": lang}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)
