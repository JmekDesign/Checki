from __future__ import annotations

import contextlib
from datetime import UTC, date, datetime
from typing import Any

from fastapi import APIRouter, Header, HTTPException

from ..core.security import require_user
from ..db.conn import db_conn, db_release
from ..schemas.checks import CheckCreateIn, CheckOpenIn

router = APIRouter()

SHIFT_GAP_HOURS = 6


def _resolve_shift_date(venue_id: str, cur: Any) -> date:  # noqa: ANN401
    """Return the shift date for a new check (same shift or new one)."""
    cur.execute(
        """
        SELECT closed_at, shift_date
        FROM checks
        WHERE venue_id = %s AND status = 'closed' AND shift_date IS NOT NULL
        ORDER BY closed_at DESC NULLS LAST
        LIMIT 1
        """,
        (venue_id,),
    )
    row = cur.fetchone()
    now_utc = datetime.now(UTC)

    if row is None:
        return now_utc.date()

    last_closed_at, last_shift_date = row
    if last_closed_at is None:
        return now_utc.date()

    gap_seconds = (now_utc - last_closed_at).total_seconds()
    if gap_seconds > SHIFT_GAP_HOURS * 3600:
        return now_utc.date()
    return date.fromisoformat(str(last_shift_date))


def _next_shift_number(venue_id: str, shift_date: date, cur: Any) -> int:  # noqa: ANN401
    """Return the next sequential number within the given shift."""
    cur.execute(
        "SELECT COUNT(*) FROM checks WHERE venue_id = %s AND shift_date = %s",
        (venue_id, shift_date),
    )
    row = cur.fetchone()
    assert row is not None
    return int(row[0]) + 1


def _fmt_number(shift_number: int | None, shift_date: date | str | None) -> str:
    """Format check number for API response."""
    if shift_number is None:
        return "?"
    if shift_date:
        d = date.fromisoformat(str(shift_date))
        return f"{shift_number} · {d.strftime('%-d %b')}"
    return str(shift_number)


@router.post("/api/checks/open")
def check_open(
    payload: CheckOpenIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    user_id = user["user_id"]
    if not venue_id or not user_id:
        raise HTTPException(status_code=400, detail="invalid user context")

    conn = db_conn()
    try:
        cur = conn.cursor()

        guest_id = payload.guest_id
        guest_name_snapshot = None

        if guest_id:
            cur.execute(
                "SELECT name FROM guests WHERE id=%s AND venue_id=%s;",
                (guest_id, venue_id),
            )
            r = cur.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail="guest not found")
            guest_name_snapshot = r[0]
        else:
            if payload.guest_name:
                guest_name_snapshot = payload.guest_name.strip() or None

        shift_date = _resolve_shift_date(venue_id, cur)
        shift_number = _next_shift_number(venue_id, shift_date, cur)

        cur.execute(
            """
            INSERT INTO checks
                (venue_id, status, guest_id, guest_name_snapshot, opened_by,
                 shift_date, shift_number)
            VALUES (%s, 'open', %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (venue_id, guest_id, guest_name_snapshot, user_id, shift_date, shift_number),
        )
        row_ins = cur.fetchone()
        assert row_ins is not None
        check_id = str(row_ins[0])
        conn.commit()
        return {
            "ok": True,
            "check_id": check_id,
            "id": check_id,
            "shift_number": shift_number,
            "shift_date": shift_date.isoformat(),
            "number": str(shift_number),
        }
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


# Staff UI compat: POST /api/checks {guest:"..."}
@router.post("/api/checks")
def check_create(
    payload: CheckCreateIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    guest = (payload.guest or "").strip()
    if not guest:
        raise HTTPException(status_code=400, detail="guest required")
    return check_open(CheckOpenIn(guest_name=guest), authorization)


@router.get("/api/checks/open")
def checks_open(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, opened_at, guest_name_snapshot, total, shift_number, shift_date
            FROM checks
            WHERE venue_id=%s AND status='open'
            ORDER BY opened_at DESC
            LIMIT 50;
            """,
            (venue_id,),
        )
        items = []
        for cid, opened_at, gname, total, shift_num, shift_dt in cur.fetchall():
            cid_str = str(cid)
            items.append(
                {
                    "id": cid_str,
                    "check_id": cid_str,
                    "shift_number": shift_num,
                    "shift_date": shift_dt.isoformat() if shift_dt else None,
                    "number": str(shift_num) if shift_num is not None else cid_str[:6],
                    "opened_at": opened_at.isoformat(),
                    "guest_name_snapshot": gname,
                    "total": float(total or 0),
                }
            )
        return {"ok": True, "items": items, "checks": items}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


# Staff UI compat: GET /api/checks -> same as /api/checks/open
@router.get("/api/checks")
def checks_open_alias(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    return checks_open(authorization)
