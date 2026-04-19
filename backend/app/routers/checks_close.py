from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

from ..core.security import require_user
from ..db.conn import db_conn, db_release

router = APIRouter()


@router.post("/api/checks/{check_id}/close")
async def check_close(
    check_id: str,
    request: Request,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    """
    UI sends POST without body but still may send Content-Type: application/json.
    That can cause JSON decode errors -> 422. So we parse JSON manually and tolerate empty body.
    """
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    try:
        data = await request.json()
        if not isinstance(data, dict):
            data = {}
    except Exception:
        data = {}

    payment_method: str | None = data.get("payment_method")
    if payment_method not in (None, "cash", "card"):
        raise HTTPException(status_code=400, detail="invalid payment_method")

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "select status from checks where id=%s and venue_id=%s;",
            (check_id, venue_id),
        )
        r = cur.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="check not found")
        if r[0] != "open":
            raise HTTPException(status_code=409, detail="check is not open")

        cur.execute(
            "update checks set status='closed', closed_at=now(), payment_method=%s"
            " where id=%s and venue_id=%s;",
            (payment_method, check_id, venue_id),
        )
        conn.commit()
        return {"ok": True, "check_id": check_id, "status": "closed"}
    finally:
        db_release(conn)
