from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter

from ..db.conn import db_ok

router = APIRouter()


@router.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "db": db_ok(), "ts": int(time.time())}
