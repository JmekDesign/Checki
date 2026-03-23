from __future__ import annotations

import contextlib
from typing import Any
from uuid import UUID

import psycopg2.extensions
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..core.security import UserContext, require_user
from ..db.conn import db_conn, db_release

router = APIRouter()


def _require_manager(authorization: str | None) -> UserContext:
    user = require_user(authorization)
    if user["role"] not in ("manager", "superadmin"):
        raise HTTPException(status_code=403, detail="manager role required")
    return user


def _venue(authorization: str | None) -> tuple[UserContext, str]:
    user = _require_manager(authorization)
    if not user["venue_id"]:
        raise HTTPException(status_code=400, detail="user has no venue")
    return user, user["venue_id"]


def _order_rows(
    cur: psycopg2.extensions.cursor, venue_id: str, status: str
) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT id, title, status, created_at, closed_at
        FROM procurement_orders
        WHERE venue_id = %s AND status = %s
        ORDER BY created_at DESC;
        """,
        (venue_id, status),
    )
    orders = []
    for oid, title, ostatus, created_at, closed_at in cur.fetchall():
        cur.execute(
            """
            SELECT id, text, qty, is_checked
            FROM procurement_items
            WHERE order_id = %s
            ORDER BY created_at ASC;
            """,
            (str(oid),),
        )
        items = [
            {"id": str(iid), "text": text, "qty": qty, "is_checked": bool(chk)}
            for iid, text, qty, chk in cur.fetchall()
        ]
        orders.append(
            {
                "id": str(oid),
                "title": title,
                "status": ostatus,
                "created_at": created_at.isoformat() if created_at else None,
                "closed_at": closed_at.isoformat() if closed_at else None,
                "items": items,
            }
        )
    return orders


# ── Orders ────────────────────────────────────────────────────────────────────

class OrderIn(BaseModel):
    title: str


@router.get("/api/procurement")
def procurement_list(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _, venue_id = _venue(authorization)
    conn = db_conn()
    try:
        cur = conn.cursor()
        return {"ok": True, "items": _order_rows(cur, venue_id, "open")}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


@router.post("/api/procurement")
def procurement_create(
    payload: OrderIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _, venue_id = _venue(authorization)
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title required")
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO procurement_orders (venue_id, title) VALUES (%s, %s) RETURNING id;",
            (venue_id, title),
        )
        row = cur.fetchone()
        assert row is not None
        conn.commit()
        return {"ok": True, "id": str(row[0])}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


@router.delete("/api/procurement/{order_id}")
def procurement_delete(
    order_id: UUID,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _, venue_id = _venue(authorization)
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT status FROM procurement_orders WHERE id = %s AND venue_id = %s;",
            (str(order_id), venue_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="order not found")
        if row[0] == "closed":
            raise HTTPException(status_code=400, detail="cannot delete closed order")
        cur.execute(
            "DELETE FROM procurement_orders WHERE id = %s;",
            (str(order_id),),
        )
        conn.commit()
        return {"ok": True}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


@router.post("/api/procurement/{order_id}/close")
def procurement_close(
    order_id: UUID,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _, venue_id = _venue(authorization)
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT status FROM procurement_orders WHERE id = %s AND venue_id = %s;",
            (str(order_id), venue_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="order not found")
        if row[0] == "closed":
            raise HTTPException(status_code=400, detail="already closed")
        cur.execute(
            "UPDATE procurement_orders SET status = 'closed', closed_at = now() WHERE id = %s;",
            (str(order_id),),
        )
        conn.commit()
        return {"ok": True}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


# ── Items ─────────────────────────────────────────────────────────────────────

class ItemIn(BaseModel):
    text: str
    qty: str = "1"


@router.post("/api/procurement/{order_id}/items")
def item_add(
    order_id: UUID,
    payload: ItemIn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _, venue_id = _venue(authorization)
    text = payload.text.strip()
    qty = payload.qty.strip() or "1"
    if not text:
        raise HTTPException(status_code=400, detail="text required")
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT status FROM procurement_orders WHERE id = %s AND venue_id = %s;",
            (str(order_id), venue_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="order not found")
        if row[0] == "closed":
            raise HTTPException(status_code=400, detail="order is closed")
        cur.execute(
            """
            INSERT INTO procurement_items (order_id, venue_id, text, qty)
            VALUES (%s, %s, %s, %s) RETURNING id;
            """,
            (str(order_id), venue_id, text, qty),
        )
        item_row = cur.fetchone()
        assert item_row is not None
        conn.commit()
        return {"ok": True, "id": str(item_row[0])}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


@router.patch("/api/procurement/{order_id}/items/{item_id}")
def item_toggle(
    order_id: UUID,
    item_id: UUID,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _, venue_id = _venue(authorization)
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT pi.is_checked FROM procurement_items pi
            JOIN procurement_orders po ON po.id = pi.order_id
            WHERE pi.id = %s AND pi.order_id = %s AND po.venue_id = %s;
            """,
            (str(item_id), str(order_id), venue_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="item not found")
        cur.execute(
            "UPDATE procurement_items SET is_checked = %s WHERE id = %s;",
            (not bool(row[0]), str(item_id)),
        )
        conn.commit()
        return {"ok": True, "is_checked": not bool(row[0])}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


@router.delete("/api/procurement/{order_id}/items/{item_id}")
def item_delete(
    order_id: UUID,
    item_id: UUID,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _, venue_id = _venue(authorization)
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT pi.id FROM procurement_items pi
            JOIN procurement_orders po ON po.id = pi.order_id
            WHERE pi.id = %s AND pi.order_id = %s AND po.venue_id = %s AND po.status = 'open';
            """,
            (str(item_id), str(order_id), venue_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="item not found")
        cur.execute("DELETE FROM procurement_items WHERE id = %s;", (str(item_id),))
        conn.commit()
        return {"ok": True}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)


# ── Archive ───────────────────────────────────────────────────────────────────

@router.get("/api/procurement/archive")
def procurement_archive(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    _, venue_id = _venue(authorization)
    conn = db_conn()
    try:
        cur = conn.cursor()
        return {"ok": True, "items": _order_rows(cur, venue_id, "closed")}
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)
