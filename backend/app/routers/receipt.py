from __future__ import annotations

import contextlib
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException

from ..core.security import require_user
from ..db.conn import db_conn, db_release

router = APIRouter()


@router.post("/api/checks/{check_id}/receipt-token")
def get_receipt_token(
    check_id: UUID,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    """Return (or create) the receipt token for a check. Auth required."""
    user = require_user(authorization)
    venue_id = user["venue_id"]

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT receipt_token, venue_id FROM checks WHERE id = %s",
            (str(check_id),),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="check not found")
        token, check_venue_id = row
        if str(check_venue_id) != str(venue_id):
            raise HTTPException(status_code=403, detail="forbidden")
        if token is None:
            token = uuid4()
            cur.execute(
                "UPDATE checks SET receipt_token = %s WHERE id = %s",
                (str(token), str(check_id)),
            )
            conn.commit()
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)

    token_str = str(token)
    return {
        "token": token_str,
        "url": f"https://checki.ge/r/?t={token_str}",
    }


@router.get("/api/receipt/{token}")
def get_receipt(token: str) -> dict[str, Any]:
    """Public endpoint — no auth. Returns check data for guest receipt page."""
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT c.shift_number, c.guest_name_snapshot, c.total, c.closed_at,
                   c.status, v.name
            FROM checks c
            JOIN venues v ON v.id = c.venue_id
            WHERE c.receipt_token = %s
            """,
            (token,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="receipt not found")
        number, guest, total, closed_at, status, venue_name = row

        cur.execute(
            """
            SELECT name_snapshot, qty, price_snapshot, line_total
            FROM check_items
            WHERE check_id = (
                SELECT id FROM checks WHERE receipt_token = %s
            )
            ORDER BY created_at ASC
            """,
            (token,),
        )
        items = [
            {
                "name": r[0],
                "qty": r[1],
                "price": float(r[2]) if r[2] is not None else 0.0,
                "line_total": float(r[3]) if r[3] is not None else 0.0,
            }
            for r in cur.fetchall()
        ]
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)

    return {
        "number": number,
        "guest": guest,
        "total": float(total) if total is not None else 0.0,
        "closed_at": closed_at.isoformat() if closed_at else None,
        "status": status,
        "venue": venue_name,
        "items": items,
    }
