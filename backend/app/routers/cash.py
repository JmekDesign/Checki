from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

from ..core.security import require_user
from ..db.conn import db_conn, db_release

router = APIRouter()


@router.get("/api/cash/shift")
def cash_shift(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    today = date.today().isoformat()
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT cm.id, cm.type, cm.amount, cm.note, cm.check_id, cm.created_at,
                   c.shift_number
            FROM cash_movements cm
            LEFT JOIN checks c ON c.id = cm.check_id
            WHERE cm.venue_id = %s AND cm.shift_date = %s
            ORDER BY cm.created_at
            """,
            (venue_id, today),
        )
        rows = cur.fetchall()
        movements: list[dict[str, Any]] = []
        opening = 0.0
        cash_in = 0.0
        cash_out = 0.0
        is_opened = False
        for row in rows:
            mid, mtype, amount, note, check_id, created_at, shift_number = row
            amount = float(amount)
            movements.append({
                "id": mid,
                "type": mtype,
                "amount": amount,
                "note": note,
                "check_id": str(check_id) if check_id else None,
                "check_number": shift_number,
                "created_at": created_at.isoformat(),
            })
            if mtype == "open":
                opening += amount
                is_opened = True
            elif mtype == "in":
                cash_in += amount
            elif mtype == "out":
                cash_out += amount
        return {
            "shift_date": today,
            "is_opened": is_opened,
            "opening": opening,
            "cash_in": cash_in,
            "cash_out": cash_out,
            "balance": opening + cash_in - cash_out,
            "movements": movements,
        }
    finally:
        db_release(conn)


@router.post("/api/cash/movement")
async def cash_add_movement(
    request: Request,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    user_id = user["user_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    data: dict[str, Any] = await request.json()
    mtype = data.get("type")
    note: str | None = data.get("note") or None
    if mtype not in ("open", "in", "out"):
        raise HTTPException(status_code=400, detail="invalid type")
    try:
        amount = float(data.get("amount", 0))
        if amount <= 0:
            raise ValueError
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="invalid amount")

    today = date.today().isoformat()
    conn = db_conn()
    try:
        cur = conn.cursor()
        if mtype == "open":
            cur.execute(
                "SELECT 1 FROM cash_movements WHERE venue_id=%s AND shift_date=%s AND type='open'",
                (venue_id, today),
            )
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="shift already opened today")
        cur.execute(
            """INSERT INTO cash_movements (venue_id, shift_date, type, amount, note, created_by)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (venue_id, today, mtype, amount, note, user_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        db_release(conn)
