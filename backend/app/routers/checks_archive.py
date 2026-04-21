from __future__ import annotations

import contextlib
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query

from ..core.security import require_user
from ..db.conn import db_conn, db_release

router = APIRouter()


def _build_where(
    venue_id: str,
    date_from: str | None,
    date_to: str | None,
    q: str | None,
) -> tuple[list[str], list[Any]]:
    where: list[str] = ["c.venue_id=%s", "c.status='closed'"]
    params: list[Any] = [venue_id]

    if date_from:
        where.append("c.closed_at >= (%s::date)")
        params.append(date_from)
    if date_to:
        where.append("c.closed_at < ((%s::date) + interval '1 day')")
        params.append(date_to)

    if q:
        qq = q.strip()
        if qq:
            like = f"%{qq}%"
            where.append(
                "(c.guest_name_snapshot ilike %s"
                " OR c.number::text ilike %s"
                " OR c.total::text ilike %s"
                " OR EXISTS ("
                "   SELECT 1 FROM check_items ci"
                "   WHERE ci.check_id = c.id AND ci.name_snapshot ilike %s"
                " ))"
            )
            params.extend([like, like, like, like])

    return where, params


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

    where, params = _build_where(venue_id, date_from, date_to, q)
    where_sql = " AND ".join(where)

    list_sql = f"""
        SELECT c.id, c.guest_name_snapshot, c.closed_at, c.total, c.payment_method,
               c.shift_number, c.shift_date, c.number
        FROM checks c
        WHERE {where_sql}
        ORDER BY c.closed_at DESC NULLS LAST
        LIMIT %s OFFSET %s;
    """
    count_sql = f"SELECT count(*) FROM checks c WHERE {where_sql};"

    conn = db_conn()
    try:
        cur = conn.cursor()

        cur.execute(count_sql, tuple(params))
        count_row = cur.fetchone()
        assert count_row is not None
        total_count = int(count_row[0])

        cur.execute(list_sql, tuple(params + [limit, offset]))
        items = []
        for (
            cid,
            gname,
            closed_at,
            total,
            payment_method,
            shift_num,
            shift_dt,
            seq_num,
        ) in cur.fetchall():
            cid_str = str(cid)
            items.append(
                {
                    "id": cid_str,
                    "check_id": cid_str,
                    "shift_number": shift_num,
                    "shift_date": shift_dt.isoformat() if shift_dt else None,
                    "number": str(shift_num) if shift_num is not None else str(seq_num),
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
        with contextlib.suppress(Exception):
            db_release(conn)


@router.get("/api/checks/archive/stats")
def checks_archive_stats(
    authorization: str | None = Header(default=None, alias="Authorization"),
    date_from: str | None = Query(default=None, alias="from"),
    date_to: str | None = Query(default=None, alias="to"),
    q: str | None = Query(default=None),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    where, params = _build_where(venue_id, date_from, date_to, q)
    where_sql = " AND ".join(where)

    summary_sql = f"""
        SELECT count(*), coalesce(sum(c.total), 0), coalesce(avg(c.total), 0)
        FROM checks c
        WHERE {where_sql};
    """
    top_sql = f"""
        SELECT ci.name_snapshot, sum(ci.qty) AS qty, sum(ci.line_total) AS revenue
        FROM check_items ci
        JOIN checks c ON ci.check_id = c.id
        WHERE {where_sql}
        GROUP BY ci.name_snapshot
        ORDER BY qty DESC
        LIMIT 5;
    """

    conn = db_conn()
    try:
        cur = conn.cursor()

        cur.execute(summary_sql, tuple(params))
        row = cur.fetchone()
        assert row is not None
        check_count, total_revenue, avg_check = int(row[0]), float(row[1]), float(row[2])

        cur.execute(top_sql, tuple(params))
        top_products = [
            {"name": name, "qty": float(qty), "revenue": float(rev)}
            for name, qty, rev in cur.fetchall()
        ]

        return {
            "ok": True,
            "check_count": check_count,
            "total_revenue": total_revenue,
            "avg_check": avg_check,
            "top_products": top_products,
        }
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)
