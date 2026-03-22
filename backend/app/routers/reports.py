from __future__ import annotations

import contextlib
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import Response

from ..core.pdf_report import generate_report
from ..core.security import require_user
from ..db.conn import db_conn, db_release
from .checks_archive import _build_where

router = APIRouter()


@router.get("/api/checks/archive/report")
def archive_report(
    authorization: str | None = Header(default=None, alias="Authorization"),
    date_from: str | None = Query(default=None, alias="from"),
    date_to: str | None = Query(default=None, alias="to"),
    q: str | None = Query(default=None),
) -> Response:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    where, params = _build_where(venue_id, date_from, date_to, q)
    wsql = " AND ".join(where)

    conn = db_conn()
    try:
        cur = conn.cursor()

        cur.execute("SELECT name FROM venues WHERE id = %s;", (venue_id,))
        vrow = cur.fetchone()
        venue_name = str(vrow[0]) if vrow else "Venue"

        cur.execute(  # noqa: S608
            f"SELECT count(*), coalesce(sum(c.total),0), coalesce(avg(c.total),0)"
            f" FROM checks c WHERE {wsql};",
            tuple(params),
        )
        srow = cur.fetchone()
        assert srow is not None
        check_count, total_revenue, avg_check = int(srow[0]), float(srow[1]), float(srow[2])

        cur.execute(  # noqa: S608
            f"SELECT c.payment_method, count(*), coalesce(sum(c.total),0)"
            f" FROM checks c WHERE {wsql}"
            f" GROUP BY c.payment_method ORDER BY sum(c.total) DESC;",
            tuple(params),
        )
        payments: list[dict[str, Any]] = [
            {"method": r[0] or "Other", "count": int(r[1]), "total": float(r[2])}
            for r in cur.fetchall()
        ]

        cur.execute(  # noqa: S608
            f"SELECT ci.name_snapshot, sum(ci.qty), sum(ci.line_total)"
            f" FROM check_items ci JOIN checks c ON ci.check_id = c.id"
            f" WHERE {wsql} GROUP BY ci.name_snapshot ORDER BY sum(ci.qty) DESC LIMIT 7;",
            tuple(params),
        )
        top_products: list[dict[str, Any]] = [
            {"name": r[0], "qty": float(r[1]), "revenue": float(r[2])}
            for r in cur.fetchall()
        ]

        cur.execute(  # noqa: S608
            f"SELECT c.shift_number, c.guest_name_snapshot, c.closed_at,"
            f" c.total, c.payment_method"
            f" FROM checks c WHERE {wsql} ORDER BY c.closed_at ASC LIMIT 500;",
            tuple(params),
        )
        checks: list[dict[str, Any]] = [
            {
                "number": str(r[0]) if r[0] is not None else "",
                "guest": r[1] or "—",
                "closed_at": r[2].isoformat() if r[2] else "",
                "total": float(r[3] or 0),
                "payment_method": r[4] or "",
            }
            for r in cur.fetchall()
        ]
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)

    pdf_bytes = generate_report(
        venue_name=venue_name,
        date_from=date_from,
        date_to=date_to,
        check_count=check_count,
        total_revenue=total_revenue,
        avg_check=avg_check,
        payments=payments,
        top_products=top_products,
        checks=checks,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="checki-report.pdf"'},
    )
