from __future__ import annotations

import contextlib
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException

from ..core.normalizer import normalize_all_bg
from ..core.security import require_user
from ..db.conn import db_conn, db_release
from ..schemas.products import ProductUpdateIn

router = APIRouter()


def _require_manager(authorization: str | None) -> dict[str, Any]:
    user = require_user(authorization)
    if user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="manager role required")
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")
    return {"venue_id": venue_id, "role": user["role"]}


@router.get("/api/products/quickpicks")
def quickpicks(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    """Return up to 15 quick-pick chips: favorites first (alphabetical),
    then top sellers in the last 30 days to fill remaining slots."""
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    conn = db_conn()
    try:
        cur = conn.cursor()

        # 1. Favorites (starred by manager), alphabetical
        cur.execute(
            """
            SELECT id, name, last_price
            FROM products
            WHERE venue_id = %s AND is_favorite = TRUE AND active = TRUE
            ORDER BY name ASC
            LIMIT 15;
            """,
            (venue_id,),
        )
        favs: list[dict[str, Any]] = [
            {"id": str(r[0]), "name": r[1], "last_price": float(r[2]) if r[2] is not None else None}
            for r in cur.fetchall()
        ]
        fav_ids = {f["id"] for f in favs}

        items = list(favs)

        # 2. Fill remaining slots with top sellers in last 30 days
        remaining = 15 - len(items)
        if remaining > 0:
            cur.execute(
                """
                SELECT p.id, p.name, p.last_price
                FROM check_items ci
                JOIN products p ON p.id = ci.product_id
                JOIN checks c ON c.id = ci.check_id
                WHERE p.venue_id = %s
                  AND p.active = TRUE
                  AND c.closed_at >= now() - INTERVAL '30 days'
                GROUP BY p.id, p.name, p.last_price
                ORDER BY SUM(ci.qty) DESC
                LIMIT %s;
                """,
                (venue_id, remaining + len(fav_ids)),
            )
            for row in cur.fetchall():
                pid = str(row[0])
                if pid not in fav_ids and len(items) < 15:
                    items.append({
                        "id": pid,
                        "name": row[1],
                        "last_price": float(row[2]) if row[2] is not None else None,
                    })

        return {"ok": True, "items": items}
    finally:
        db_release(conn)


@router.post("/api/products/normalize-all")
def normalize_all(
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    ctx = _require_manager(authorization)
    venue_id: str = ctx["venue_id"]

    conn = db_conn()
    try:
        cur = conn.cursor()
        # Re-flag all unlocked products so they get (re-)normalized
        cur.execute(
            "UPDATE products SET needs_normalization = TRUE"
            " WHERE venue_id = %s AND locked = FALSE;",
            (venue_id,),
        )
        cur.execute(
            "SELECT COUNT(*) FROM products"
            " WHERE venue_id = %s AND needs_normalization = TRUE AND locked = FALSE;",
            (venue_id,),
        )
        row = cur.fetchone()
        queued = int(row[0]) if row else 0
        conn.commit()
    finally:
        db_release(conn)

    if queued:
        background_tasks.add_task(normalize_all_bg, venue_id)

    return {"ok": True, "queued": queued}


@router.patch("/api/products/{product_id}")
def product_update(
    product_id: str,
    payload: ProductUpdateIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    ctx = _require_manager(authorization)
    venue_id: str = ctx["venue_id"]

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM products WHERE id = %s AND venue_id = %s;",
            (product_id, venue_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="product not found")

        sets: list[str] = []
        params: list[Any] = []

        if payload.name is not None:
            name = payload.name.strip()
            if not name:
                raise HTTPException(status_code=400, detail="name cannot be empty")
            sets.append("name = %s")
            params.append(name)
            # Manager-edited name is locked so normalizer won't rename it
            sets.append("locked = TRUE")
            sets.append("needs_normalization = FALSE")

        if payload.price is not None:
            sets.append("last_price = %s")
            params.append(payload.price)

        if payload.category is not None:
            sets.append("category = %s")
            params.append(payload.category.strip() or "Other")

        if payload.active is not None:
            sets.append("active = %s")
            params.append(payload.active)

        if payload.is_favorite is not None:
            sets.append("is_favorite = %s")
            params.append(payload.is_favorite)

        if sets:
            params.append(product_id)
            params.append(venue_id)
            with contextlib.suppress(Exception):
                cur.execute(
                    f"UPDATE products SET {', '.join(sets)} WHERE id = %s AND venue_id = %s;",  # noqa: S608
                    tuple(params),
                )
            conn.commit()

        cur.execute(
            "SELECT id, name, last_price, category, active, is_favorite"
            " FROM products WHERE id = %s AND venue_id = %s;",
            (product_id, venue_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="product not found")
        pid, pname, last_price, pcat, pactive, pfav = row
        return {
            "ok": True,
            "product": {
                "id": str(pid),
                "name": pname,
                "last_price": float(last_price) if last_price is not None else None,
                "category": pcat or "Other",
                "active": bool(pactive),
                "is_favorite": bool(pfav),
            },
        }
    finally:
        db_release(conn)


@router.delete("/api/products/{product_id}")
def product_delete(
    product_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    ctx = _require_manager(authorization)
    venue_id: str = ctx["venue_id"]

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM products WHERE id = %s AND venue_id = %s;",
            (product_id, venue_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="product not found")
        cur.execute(
            "DELETE FROM products WHERE id = %s AND venue_id = %s;",
            (product_id, venue_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        db_release(conn)
