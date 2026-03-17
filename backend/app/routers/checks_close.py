from __future__ import annotations

import contextlib
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

from ..core.security import require_user
from ..db.conn import db_conn

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

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute("select status, venue_id from checks where id=%s;", (check_id,))
        r = cur.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="check not found")
        status, check_venue_id = r
        if str(check_venue_id) != str(venue_id):
            raise HTTPException(status_code=403, detail="forbidden")
        if status != "open":
            raise HTTPException(status_code=409, detail="check is not open")

        cur.execute(
            "update checks set status='closed', closed_at=now(), payment_method=%s where id=%s;",
            (payment_method, check_id),
        )
        conn.commit()
        return {"ok": True, "check_id": check_id, "status": "closed"}
    finally:
        with contextlib.suppress(Exception):
            conn.close()
