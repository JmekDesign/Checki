from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query, Request
from fastapi.responses import Response

from ..core.pdf_cash_report import generate_cash_report
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
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="invalid amount") from exc

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


def _fetch_movements(
    venue_id: str, date_from: str, date_to: str
) -> list[dict[str, Any]]:
    """Return raw movement rows for a date range."""
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT cm.id, cm.type, cm.amount, cm.note, cm.check_id,
                   cm.created_at, cm.shift_date, c.shift_number
            FROM cash_movements cm
            LEFT JOIN checks c ON c.id = cm.check_id
            WHERE cm.venue_id = %s AND cm.shift_date BETWEEN %s AND %s
            ORDER BY cm.shift_date DESC, cm.created_at
            """,
            (venue_id, date_from, date_to),
        )
        return [
            {
                "id": r[0], "type": r[1], "amount": float(r[2]),
                "note": r[3], "check_id": str(r[4]) if r[4] else None,
                "created_at": r[5].isoformat(), "shift_date": r[6].isoformat(),
                "check_number": r[7],
            }
            for r in cur.fetchall()
        ]
    finally:
        db_release(conn)


@router.get("/api/cash/movements")
def cash_movements(
    authorization: str | None = Header(default=None, alias="Authorization"),
    date_from: str | None = Query(default=None, alias="from"),
    date_to: str | None = Query(default=None, alias="to"),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    today = date.today().isoformat()
    dfrom = date_from or today
    dto   = date_to   or today
    rows  = _fetch_movements(venue_id, dfrom, dto)

    # Group by shift_date
    shifts_map: dict[str, dict[str, Any]] = {}
    for m in rows:
        sd = m["shift_date"]
        if sd not in shifts_map:
            shifts_map[sd] = {"shift_date": sd, "is_today": sd == today,
                              "is_opened": False, "movements": []}
        shifts_map[sd]["movements"].append(m)
        if m["type"] == "open":
            shifts_map[sd]["is_opened"] = True

    summary = {"opening": 0.0, "cash_in": 0.0, "cash_out": 0.0, "balance": 0.0}
    for m in rows:
        if m["type"] == "open":
            summary["opening"] += m["amount"]
        elif m["type"] == "in":
            summary["cash_in"] += m["amount"]
        elif m["type"] == "out":
            summary["cash_out"] += m["amount"]
    summary["balance"] = summary["opening"] + summary["cash_in"] - summary["cash_out"]

    return {
        "date_from": dfrom, "date_to": dto,
        "summary": summary,
        "shifts": list(shifts_map.values()),
    }


@router.get("/api/cash/report")
def cash_report(
    authorization: str | None = Header(default=None, alias="Authorization"),
    date_from: str | None = Query(default=None, alias="from"),
    date_to: str | None = Query(default=None, alias="to"),
) -> Response:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    today = date.today().isoformat()
    dfrom = date_from or today
    dto   = date_to   or today
    rows  = _fetch_movements(venue_id, dfrom, dto)

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT name FROM venues WHERE id = %s", (venue_id,))
        vrow = cur.fetchone()
        venue_name = str(vrow[0]) if vrow else "Venue"
    finally:
        db_release(conn)

    pdf_bytes = generate_cash_report(
        venue_name=venue_name,
        date_from=dfrom,
        date_to=dto,
        movements=rows,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="cash-{dfrom}-{dto}.pdf"'},
    )
