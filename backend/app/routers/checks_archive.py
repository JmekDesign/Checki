from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query

from ..core.security import require_user
from ..core.utils import short_check_number
from ..db.conn import db_conn, db_release

router = APIRouter()


@router.get("/api/checks/archive")
def checks_archive(
    authorization: str | None = Header(default=None, alias="Authorization"),
    date_from: str | None = Query(default=None, alias="from"),
    date_to: str | None = Query(default=None, alias="to"),
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=5000),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    where: list[str] = ["venue_id=%s", "status='closed'"]
    params: list[Any] = [venue_id]

    if date_from:
        where.append("closed_at >= (%s::date)")
        params.append(date_from)
    if date_to:
        where.append("closed_at < ((%s::date) + interval '1 day')")
        params.append(date_to)

    if q:
        qq = q.strip()
        if qq:
            where.append("(guest_name_snapshot ilike %s OR number::text ilike %s)")
            like = f"%{qq}%"
            params.extend([like, like])

    where_sql = " and ".join(where)

    list_sql = f"""
        select id, number, guest_name_snapshot, closed_at, total, payment_method
        from checks
        where {where_sql}
        order by closed_at desc nulls last
        limit %s offset %s;
    """

    count_sql = f"""
        select count(*)
        from checks
        where {where_sql};
    """

    conn = db_conn()
    try:
        cur = conn.cursor()

        cur.execute(count_sql, tuple(params))
        count_row = cur.fetchone()
        assert count_row is not None
        total_count = int(count_row[0])

        cur.execute(list_sql, tuple(params + [limit, offset]))
        items = []
        for cid, number, gname, closed_at, total, payment_method in cur.fetchall():
            cid_str = str(cid)
            items.append(
                {
                    "id": cid_str,
                    "check_id": cid_str,
                    "number": str(number) if number is not None else short_check_number(cid_str),
                    "guest_name_snapshot": gname,
                    "closed_at": closed_at.isoformat() if closed_at else None,
                    "total": float(total or 0),
                    "payment_method": payment_method,
                }
            )

        return {
            "ok": True,
            "items": items,
            "total": total_count,
            "limit": limit,
            "offset": offset,
        }
    finally:
        db_release(conn)
