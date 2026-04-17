from __future__ import annotations

import contextlib
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException

from ..core.security import require_user
from ..core.utils import normalize_key
from ..db.conn import db_conn, db_release
from ..schemas.checks import ItemPatchIn

router = APIRouter()

D2 = Decimal("0.01")


@router.patch("/api/checks/{check_id}/items/{item_id}")
def check_item_patch(
    check_id: UUID,
    item_id: UUID,
    payload: ItemPatchIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    conn = db_conn()
    try:
        cur = conn.cursor()

        cur.execute(
            "SELECT status, venue_id FROM checks WHERE id = %s;",
            (str(check_id),),
        )
        r = cur.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="check not found")
        status, check_venue_id = r
        if str(check_venue_id) != str(venue_id):
            raise HTTPException(status_code=403, detail="forbidden")
        if status != "open":
            raise HTTPException(status_code=409, detail="check is not open")

        cur.execute(
            """
            SELECT name_snapshot, price_snapshot, qty, line_total
            FROM check_items
            WHERE id = %s AND check_id = %s;
            """,
            (str(item_id), str(check_id)),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="item not found")

        old_name, old_price_raw, old_qty, old_line_total_raw = row
        old_price = Decimal(old_price_raw)
        old_line_total = Decimal(old_line_total_raw)

        new_name: str = payload.name.strip() if payload.name is not None else old_name
        if not new_name:
            raise HTTPException(status_code=400, detail="name cannot be empty")

        new_price: Decimal = (
            Decimal(str(payload.price)).quantize(D2, rounding=ROUND_HALF_UP)
            if payload.price is not None
            else old_price
        )
        if new_price < 0:
            raise HTTPException(status_code=400, detail="price must be >= 0")

        new_qty: int = int(payload.qty) if payload.qty is not None else int(old_qty)
        if new_qty <= 0:
            raise HTTPException(status_code=400, detail="qty must be > 0")

        new_line_total = (new_price * new_qty).quantize(D2, rounding=ROUND_HALF_UP)
        delta_total = new_line_total - old_line_total

        cur.execute(
            """
            UPDATE check_items
            SET name_snapshot = %s,
                price_snapshot = %s,
                qty = %s,
                line_total = %s
            WHERE id = %s AND check_id = %s;
            """,
            (new_name, new_price, new_qty, new_line_total, str(item_id), str(check_id)),
        )
        cur.execute(
            "UPDATE checks SET total = total + %s WHERE id = %s;",
            (delta_total, str(check_id)),
        )

        # Upsert corrected name+price into product catalog
        key = normalize_key(new_name)
        cur.execute(
            "SELECT id FROM products WHERE venue_id = %s AND search_key = %s;",
            (venue_id, key),
        )
        ex = cur.fetchone()
        if ex:
            cur.execute(
                "UPDATE products SET name = %s, last_price = %s WHERE id = %s;",
                (new_name, new_price, ex[0]),
            )
        else:
            cur.execute(
                "INSERT INTO products"
                " (venue_id, name, search_key, last_price, category, needs_normalization)"
                " VALUES (%s, %s, %s, %s, %s, TRUE);",
                (venue_id, new_name, key, new_price, "Other"),
            )

        conn.commit()
        return {
            "ok": True,
            "item_id": str(item_id),
            "name": new_name,
            "price": float(new_price),
            "qty": new_qty,
            "line_total": float(new_line_total),
        }
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)
