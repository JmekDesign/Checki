from __future__ import annotations

import contextlib
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query

from ..core.security import UserContext, require_user
from ..core.utils import normalize_key
from ..db.conn import db_conn, db_release
from ..schemas.products import ProductUpdateIn, ProductUpsertIn

router = APIRouter()


def _require_manager(authorization: str | None) -> UserContext:
    user = require_user(authorization)
    if user["role"] not in ("manager", "superadmin"):
        raise HTTPException(status_code=403, detail="manager role required")
    return user


@router.post("/api/products/upsert")
def product_upsert(
    payload: ProductUpsertIn,
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
    category = (payload.category or "Other").strip() or "Other"

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "select id from products where venue_id=%s and search_key=%s;",
            (venue_id, key),
        )
        row = cur.fetchone()
        if row:
            product_id = row[0]
            if payload.price is not None:
                cur.execute(
                    "update products set name=%s, last_price=%s, category=%s where id=%s;",
                    (name, payload.price, category, product_id),
                )
            else:
                cur.execute(
                    "update products set name=%s, category=%s where id=%s;",
                    (name, category, product_id),
                )
        else:
            cur.execute(
                "insert into products (venue_id, name, search_key, last_price, category)"
                " values (%s,%s,%s,%s,%s) returning id;",
                (venue_id, name, key, payload.price, category),
            )
            row_ins = cur.fetchone()
            assert row_ins is not None
            product_id = row_ins[0]

        conn.commit()
        return {
            "ok": True,
            "product_id": str(product_id),
            "name": name,
            "last_price": payload.price,
            "category": category,
        }
    finally:
        db_release(conn)


@router.get("/api/products")
def products_list(
    authorization: str | None = Header(default=None, alias="Authorization"),
    q: str | None = Query(default=None, description="Search by name (substring)"),
    category: str | None = Query(default=None, description="Filter by category"),
    active_only: bool = Query(default=True, description="Only return active products"),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    q_norm = (q or "").strip()
    cat = (category or "").strip()

    conn = db_conn()
    try:
        cur = conn.cursor()

        where: list[str] = ["venue_id=%s"]
        params: list[Any] = [venue_id]

        if active_only:
            where.append("active = TRUE")

        if cat:
            where.append("category=%s")
            params.append(cat)

        if q_norm:
            where.append("name ILIKE %s")
            params.append(f"%{q_norm}%")

        sql = f"""
            select id, name, last_price, category, active
            from products
            where {" and ".join(where)}
            order by category asc, name asc
            limit %s;
        """  # noqa: S608
        params.append(limit)

        cur.execute(sql, tuple(params))
        items = []
        for pid, pname, last_price, pcat, pactive in cur.fetchall():
            items.append(
                {
                    "id": str(pid),
                    "name": pname,
                    "last_price": float(last_price) if last_price is not None else None,
                    "category": pcat or "Other",
                    "active": bool(pactive),
                }
            )

        return {"ok": True, "items": items}
    finally:
        db_release(conn)


@router.patch("/api/products/{product_id}")
def product_update(
    product_id: UUID,
    payload: ProductUpdateIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = _require_manager(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM products WHERE id = %s AND venue_id = %s;",
            (str(product_id), venue_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="product not found")

        col_map: list[tuple[str, Any]] = []
        if payload.name is not None:
            name = payload.name.strip()
            if name:
                col_map.append(("name", name))
                col_map.append(("search_key", normalize_key(name)))
        if payload.price is not None:
            col_map.append(("last_price", payload.price))
        if payload.category is not None:
            col_map.append(("category", payload.category.strip() or "Other"))
        if payload.active is not None:
            col_map.append(("active", payload.active))

        if not col_map:
            return {"ok": True}

        set_clause = ", ".join(f"{col} = %s" for col, _ in col_map)
        params: list[Any] = [val for _, val in col_map] + [str(product_id)]
        cur.execute(
            f"UPDATE products SET {set_clause} WHERE id = %s;",  # noqa: S608
            tuple(params),
        )
        conn.commit()
        return {"ok": True}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)
