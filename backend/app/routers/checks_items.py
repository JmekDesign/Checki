from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query

from ..core.parsers import parse_smart_line
from ..core.security import require_user
from ..core.utils import normalize_key, short_check_number
from ..db.conn import db_conn, db_release
from ..schemas.checks import AddLineIn, ItemAddIn

router = APIRouter()

D2 = Decimal("0.01")


def _dec2(x: float) -> Decimal:
    return Decimal(str(x)).quantize(D2, rounding=ROUND_HALF_UP)


@router.post("/api/checks/{check_id}/items/add")
def check_item_add(
    check_id: UUID,
    payload: ItemAddIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    if payload.qty <= 0:
        raise HTTPException(status_code=400, detail="qty must be > 0")
    if payload.price is not None and payload.price < 0:
        raise HTTPException(status_code=400, detail="price must be >= 0")

    conn = db_conn()
    try:
        cur = conn.cursor()

        cur.execute("select status, venue_id from checks where id=%s;", (str(check_id),))
        r = cur.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="check not found")
        status, check_venue_id = r
        if str(check_venue_id) != str(venue_id):
            raise HTTPException(status_code=403, detail="forbidden")
        if status != "open":
            raise HTTPException(status_code=409, detail="check is not open")

        qty = int(payload.qty)

        name_snapshot: str | None = None
        product_last_price = None

        if payload.product_id:
            cur.execute(
                "select name, last_price from products where id=%s and venue_id=%s;",
                (payload.product_id, venue_id),
            )
            pr = cur.fetchone()
            if not pr:
                raise HTTPException(status_code=404, detail="product not found")
            name_snapshot = pr[0]
            product_last_price = pr[1]

            if payload.price is None:
                if product_last_price is None:
                    raise HTTPException(
                        status_code=400, detail="price required for product without last_price"
                    )
                price = Decimal(product_last_price).quantize(D2, rounding=ROUND_HALF_UP)
            else:
                price = _dec2(payload.price)
        else:
            name_snapshot = (payload.name or "").strip()
            if not name_snapshot:
                raise HTTPException(status_code=400, detail="name required if product_id is null")
            if payload.price is None:
                raise HTTPException(status_code=400, detail="price required for manual item")
            price = _dec2(payload.price)

        line_total = (price * qty).quantize(D2, rounding=ROUND_HALF_UP)

        item_id = None
        check_id_s = str(check_id)

        if payload.product_id:
            cur.execute(
                """
                update check_items
                set qty = qty + %s,
                    line_total = line_total + %s
                where id = (
                    select id
                    from check_items
                    where check_id=%s
                      and product_id=%s
                      and price_snapshot=%s
                    order by created_at asc
                    limit 1
                )
                returning id;
                """,
                (qty, line_total, check_id_s, payload.product_id, price),
            )
            rr = cur.fetchone()
            if rr:
                item_id = rr[0]
            else:
                cur.execute(
                    """
                    update check_items
                    set qty = qty + %s,
                        line_total = line_total + %s,
                        product_id = %s,
                        name_snapshot = %s
                    where id = (
                        select id
                        from check_items
                        where check_id=%s
                          and product_id is null
                          and lower(trim(name_snapshot)) = lower(trim(%s))
                          and price_snapshot=%s
                        order by created_at asc
                        limit 1
                    )
                    returning id;
                    """,
                    (
                        qty,
                        line_total,
                        payload.product_id,
                        name_snapshot,
                        check_id_s,
                        name_snapshot,
                        price,
                    ),
                )
                rr2 = cur.fetchone()
                if rr2:
                    item_id = rr2[0]
                else:
                    cur.execute(
                        """
                        insert into check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total)
                        values (%s,%s,%s,%s,%s,%s)
                        returning id;
                        """,
                        (check_id_s, payload.product_id, name_snapshot, price, qty, line_total),
                    )
                    row_ins = cur.fetchone()
                    assert row_ins is not None
                    item_id = row_ins[0]
        else:
            cur.execute(
                """
                update check_items
                set qty = qty + %s,
                    line_total = line_total + %s
                where id = (
                    select id
                    from check_items
                    where check_id=%s
                      and product_id is null
                      and lower(trim(name_snapshot)) = lower(trim(%s))
                      and price_snapshot=%s
                    order by created_at asc
                    limit 1
                )
                returning id;
                """,
                (qty, line_total, check_id_s, name_snapshot, price),
            )
            rr = cur.fetchone()
            if rr:
                item_id = rr[0]
            else:
                cur.execute(
                    """
                    insert into check_items (check_id, product_id, name_snapshot, price_snapshot, qty, line_total)
                    values (%s,null,%s,%s,%s,%s)
                    returning id;
                    """,
                    (check_id_s, name_snapshot, price, qty, line_total),
                )
                row_ins2 = cur.fetchone()
                assert row_ins2 is not None
                item_id = row_ins2[0]

        cur.execute("update checks set total = total + %s where id=%s;", (line_total, check_id_s))

        if payload.product_id:
            if payload.price is not None:
                cur.execute(
                    "update products set last_price=%s where id=%s and venue_id=%s;",
                    (price, payload.product_id, venue_id),
                )
        else:
            assert name_snapshot is not None
            key = normalize_key(name_snapshot)
            cur.execute(
                "select id from products where venue_id=%s and search_key=%s;",
                (venue_id, key),
            )
            ex = cur.fetchone()
            if ex:
                cur.execute(
                    "update products set name=%s, last_price=%s where id=%s;",
                    (name_snapshot, price, ex[0]),
                )
            else:
                cur.execute(
                    "insert into products (venue_id, name, search_key, last_price, category) values (%s,%s,%s,%s,%s);",
                    (venue_id, name_snapshot, key, price, "Other"),
                )

        conn.commit()
        return {"ok": True, "item_id": str(item_id), "line_total": float(line_total)}
    finally:
        db_release(conn)


# Staff UI compat: POST /api/checks/{id}/add_line
@router.post("/api/checks/{check_id}/add_line")
def add_line(
    check_id: UUID,
    payload: AddLineIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    if payload.price is not None and (payload.name or "").strip():
        name = (payload.name or "").strip()
        qty = int(payload.qty or 1)
        if qty <= 0:
            raise HTTPException(status_code=400, detail="qty must be > 0")
        return check_item_add(
            check_id, ItemAddIn(name=name, price=float(payload.price), qty=qty), authorization
        )

    line = (payload.line or payload.text or "").strip()
    p = parse_smart_line(line)
    return check_item_add(
        check_id,
        ItemAddIn(name=p["name"], price=float(p["price"]), qty=int(p["qty"])),
        authorization,
    )


# Staff UI compat: GET /api/checks/{id}
@router.get("/api/checks/{check_id}")
def check_get(
    check_id: UUID,
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
            """
            select id, venue_id, status, opened_at, guest_name_snapshot, total
            from checks
            where id=%s;
            """,
            (str(check_id),),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="check not found")
        cid, check_venue_id, status, opened_at, guest_name_snapshot, total = row
        if str(check_venue_id) != str(venue_id):
            raise HTTPException(status_code=403, detail="forbidden")

        cur.execute(
            """
            select id, name_snapshot, price_snapshot, qty, line_total
            from check_items
            where check_id=%s
            order by created_at asc;
            """,
            (str(check_id),),
        )
        items = []
        for iid, name, price, qty, line_total in cur.fetchall():
            items.append(
                {
                    "id": str(iid),
                    "name": name,
                    "price": float(price),
                    "qty": int(qty),
                    "line_total": float(line_total),
                }
            )

        cid_str = str(cid)
        check_obj = {
            "id": cid_str,
            "check_id": cid_str,
            "number": short_check_number(cid_str),
            "status": status,
            "opened_at": opened_at.isoformat() if opened_at else None,
            "guest_name_snapshot": guest_name_snapshot,
            "total": float(total),
            "items": items,
        }
        return {"ok": True, "check": check_obj}
    finally:
        db_release(conn)


@router.post("/api/checks/{check_id}/items/{item_id}/qty")
def check_item_qty_change(
    check_id: UUID,
    item_id: UUID,
    delta: int = Query(..., ge=-99, le=99),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")
    if delta == 0:
        return {"ok": True}

    conn = db_conn()
    try:
        cur = conn.cursor()

        cur.execute("select status, venue_id from checks where id=%s;", (str(check_id),))
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
            select qty, price_snapshot, line_total
            from check_items
            where id=%s and check_id=%s
            limit 1;
            """,
            (str(item_id), str(check_id)),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="item not found")

        old_qty, price_raw, old_line_total_raw = row
        old_qty = int(old_qty)
        price = Decimal(price_raw)
        old_line_total = Decimal(old_line_total_raw)

        new_qty = old_qty + int(delta)

        if new_qty <= 0:
            cur.execute(
                "delete from check_items where id=%s and check_id=%s;",
                (str(item_id), str(check_id)),
            )
            delta_total = -old_line_total
            cur.execute(
                "update checks set total = total + %s where id=%s;", (delta_total, str(check_id))
            )
            conn.commit()
            return {
                "ok": True,
                "deleted": True,
                "item_id": str(item_id),
                "delta_total": float(delta_total),
            }
        else:
            new_line_total = price * Decimal(new_qty)
            delta_total = new_line_total - old_line_total

            cur.execute(
                "update check_items set qty=%s, line_total=%s where id=%s and check_id=%s;",
                (new_qty, new_line_total, str(item_id), str(check_id)),
            )
            cur.execute(
                "update checks set total = total + %s where id=%s;", (delta_total, str(check_id))
            )

            conn.commit()
            return {
                "ok": True,
                "item_id": str(item_id),
                "qty": new_qty,
                "delta_total": float(delta_total),
            }
    finally:
        db_release(conn)
