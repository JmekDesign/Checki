from __future__ import annotations

import contextlib
from typing import Any

from fastapi import APIRouter, Header, HTTPException

from ..core.security import require_user
from ..core.utils import short_check_number
from ..db.conn import db_conn
from ..schemas.checks import CheckCreateIn, CheckOpenIn

router = APIRouter()


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
                "select name from guests where id=%s and venue_id=%s;", (guest_id, venue_id)
            )
            r = cur.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail="guest not found")
            guest_name_snapshot = r[0]
        else:
            if payload.guest_name:
                guest_name_snapshot = payload.guest_name.strip() or None

        cur.execute(
            """
            insert into checks (venue_id, status, guest_id, guest_name_snapshot, opened_by)
            values (%s, 'open', %s, %s, %s)
            returning id;
            """,
            (venue_id, guest_id, guest_name_snapshot, user_id),
        )
        row_ins = cur.fetchone()
        assert row_ins is not None
        check_id = str(row_ins[0])
        conn.commit()
        return {
            "ok": True,
            "check_id": check_id,
            "id": check_id,
            "number": short_check_number(check_id),
        }
    finally:
        with contextlib.suppress(Exception):
            conn.close()


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
            select id, opened_at, guest_name_snapshot, total
            from checks
            where venue_id=%s and status='open'
            order by opened_at desc
            limit 50;
            """,
            (venue_id,),
        )
        items = []
        for cid, opened_at, gname, total in cur.fetchall():
            cid_str = str(cid)
            items.append(
                {
                    "id": cid_str,
                    "check_id": cid_str,
                    "number": short_check_number(cid_str),
                    "opened_at": opened_at.isoformat(),
                    "guest_name_snapshot": gname,
                    "total": float(total or 0),
                }
            )
        return {"ok": True, "items": items, "checks": items}
    finally:
        with contextlib.suppress(Exception):
            conn.close()


# Staff UI compat: GET /api/checks -> same as /api/checks/open
@router.get("/api/checks")
def checks_open_alias(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    return checks_open(authorization)
