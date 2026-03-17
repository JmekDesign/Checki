from __future__ import annotations

import contextlib
import os
from typing import Any

from fastapi import APIRouter, HTTPException

from ..core.security import hash_password
from ..db.conn import db_conn
from ..schemas.bootstrap import BootstrapIn

router = APIRouter()

BOOTSTRAP_ENABLED = os.getenv("BOOTSTRAP_ENABLED", "false").lower() in ("1", "true", "yes")


@router.post("/api/bootstrap")
def bootstrap(payload: BootstrapIn) -> dict[str, Any]:
    if not BOOTSTRAP_ENABLED:
        raise HTTPException(status_code=403, detail="bootstrap is disabled")
    conn = db_conn()
    try:
        cur = conn.cursor()

        cur.execute("select 1 from venues where slug=%s;", (payload.venue_slug,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="venue_slug already exists")

        cur.execute("select 1 from users where login=%s;", (payload.manager_login,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="manager_login already exists")

        cur.execute(
            "insert into venues (slug, name) values (%s, %s) returning id;",
            (payload.venue_slug, payload.venue_name),
        )
        venue_row = cur.fetchone()
        assert venue_row is not None
        venue_id = venue_row[0]

        pw_hash = hash_password(payload.manager_password)
        cur.execute(
            """
            insert into users (venue_id, role, name, login, password_hash)
            values (%s, 'manager', %s, %s, %s)
            returning id;
            """,
            (venue_id, payload.manager_name, payload.manager_login, pw_hash),
        )
        user_row = cur.fetchone()
        assert user_row is not None
        user_id = user_row[0]

        conn.commit()
        return {"ok": True, "venue_id": str(venue_id), "manager_user_id": str(user_id)}
    finally:
        with contextlib.suppress(Exception):
            conn.close()
