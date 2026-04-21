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
            f"SELECT c.id, c.shift_number, c.guest_name_snapshot, c.closed_at,"
            f" c.total, c.payment_method"
            f" FROM checks c WHERE {wsql} ORDER BY c.closed_at ASC LIMIT 500;",
            tuple(params),
        )
        checks: list[dict[str, Any]] = [
            {
                "id": str(r[0]),
                "number": str(r[1]) if r[1] is not None else "",
                "guest": r[2] or "—",
                "closed_at": r[3].isoformat() if r[3] else "",
                "total": float(r[4] or 0),
                "payment_method": r[5] or "",
            }
            for r in cur.fetchall()
        ]

        check_ids = [c["id"] for c in checks]
        items_by_check: dict[str, list[dict[str, Any]]] = {}
        if check_ids:
            placeholders = ",".join(["%s"] * len(check_ids))
            cur.execute(  # noqa: S608
                f"SELECT ci.check_id, ci.name_snapshot, ci.qty, ci.line_total"
                f" FROM check_items ci"
                f" WHERE ci.check_id IN ({placeholders})"
                f" ORDER BY ci.check_id, ci.id;",
                tuple(check_ids),
            )
            for row in cur.fetchall():
                cid = str(row[0])
                items_by_check.setdefault(cid, []).append(
                    {
                        "name": row[1] or "—",
                        "qty": float(row[2] or 0),
                        "line_total": float(row[3] or 0),
                    }
                )
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
        items_by_check=items_by_check,
        checks=checks,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="checki-report.pdf"'},
    )
