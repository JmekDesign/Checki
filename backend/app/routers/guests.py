from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query

from ..core.security import require_user
from ..core.utils import normalize_key
from ..db.conn import db_conn, db_release
from ..schemas.guests import GuestUpsertIn

router = APIRouter()


@router.get("/api/guests")
def guest_search(
    q: str = Query(default=""),
    limit: int = Query(default=8, ge=1, le=30),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    conn = db_conn()
    try:
        cur = conn.cursor()
        if q.strip():
            cur.execute(
                "SELECT name FROM guests WHERE venue_id = %s AND name ILIKE %s"
                " ORDER BY times_seen DESC, last_seen_at DESC LIMIT %s;",
                (venue_id, f"%{q.strip()}%", limit),
            )
        else:
            cur.execute(
                "SELECT name FROM guests WHERE venue_id = %s ORDER BY last_seen_at DESC LIMIT %s;",
                (venue_id, limit),
            )
        rows = cur.fetchall()
        return {"ok": True, "items": [r[0] for r in rows]}
    finally:
        db_release(conn)


@router.post("/api/guests/upsert")
def guest_upsert(
    payload: GuestUpsertIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name required")
    key = normalize_key(name)

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "select id, times_seen from guests where venue_id=%s and search_key=%s;",
            (venue_id, key),
        )
        row = cur.fetchone()
        if row:
            guest_id, times_seen = row
            cur.execute(
                "update guests set last_seen_at=now(), times_seen=%s where id=%s;",
                (int(times_seen) + 1, guest_id),
            )
        else:
            cur.execute(
                "insert into guests (venue_id, name, search_key, last_seen_at, times_seen) values (%s,%s,%s,now(),1) returning id;",
                (venue_id, name, key),
            )
            row_ins = cur.fetchone()
            assert row_ins is not None
            guest_id = row_ins[0]

        conn.commit()
        return {"ok": True, "guest_id": str(guest_id), "name": name}
    finally:
        db_release(conn)
