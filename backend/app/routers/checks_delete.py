from __future__ import annotations

import contextlib
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException

from ..core.security import require_user
from ..db.conn import db_conn, db_release

router = APIRouter()


@router.delete("/api/checks/{check_id}")
def check_delete(
    check_id: UUID,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")
    if user.get("role") != "manager":
        raise HTTPException(status_code=403, detail="managers only")

    check_id_s = str(check_id)
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT status FROM checks WHERE id = %s AND venue_id = %s",
            (check_id_s, venue_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="check not found")

        # CASCADE deletes check_items automatically
        cur.execute(
            "DELETE FROM checks WHERE id = %s AND venue_id = %s",
            (check_id_s, venue_id),
        )
        conn.commit()
        return {"ok": True, "deleted": check_id_s, "was_status": row[0]}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)
