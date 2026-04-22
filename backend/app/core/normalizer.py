from __future__ import annotations

import json
import logging
import time
import urllib.request
from typing import Any

from ..db.conn import db_conn, db_release
from .config import OPENAI_API_KEY
from .normalizer_prompt import _build_system_prompt
from .utils import normalize_key

logger = logging.getLogger(__name__)


def _call_openai(
    raw_name: str,
    category_hint: str | None = None,
    existing_categories: list[str] | None = None,
) -> tuple[str, str]:
    """Call OpenAI and return (canonical_name, category). Raises on any error."""
    system = _build_system_prompt(category_hint, existing_categories)
    body = json.dumps(
        {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": raw_name},
            ],
            "response_format": {"type": "json_object"},
            "max_tokens": 60,
            "temperature": 0.2,
        }
    ).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        result: dict[str, Any] = json.loads(resp.read())

    content = result["choices"][0]["message"]["content"]
    data: dict[str, Any] = json.loads(content)

    canonical = str(data.get("name", "")).strip()
    cat = str(data.get("category", "")).strip()
    # Accept any non-empty category string (allows venue-specific cats like "Khinkali")
    if not cat or len(cat) > 60:
        cat = "Other"
    return canonical, cat


def _save_normalized(product_id: str, venue_id: str, canonical: str, category: str) -> None:
    """Save normalized name. If canonical name already exists → merge duplicate into it."""
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id FROM products
            WHERE venue_id = %s AND lower(name) = lower(%s) AND id != %s AND active = TRUE
            LIMIT 1;
            """,
            (venue_id, canonical, product_id),
        )
        existing = cur.fetchone()

        if existing:
            keep_id = str(existing[0])
            cur.execute(
                "UPDATE check_items SET product_id = %s WHERE product_id = %s;",
                (keep_id, product_id),
            )
            cur.execute(
                "UPDATE products SET active = FALSE, needs_normalization = FALSE WHERE id = %s;",
                (product_id,),
            )
            cur.execute(
                "UPDATE products SET category = %s, needs_normalization = FALSE WHERE id = %s;",
                (category, keep_id),
            )
            logger.info("merged duplicate %r (id=%s) → existing id=%s", canonical, product_id, keep_id)
        else:
            cur.execute(
                """
                UPDATE products
                   SET name = %s, category = %s, search_key = %s, needs_normalization = FALSE
                 WHERE id = %s AND venue_id = %s;
                """,
                (canonical, category, normalize_key(canonical), product_id, venue_id),
            )
        conn.commit()
    finally:
        db_release(conn)


def _mark_done(product_id: str) -> None:
    try:
        conn = db_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                "UPDATE products SET needs_normalization = FALSE WHERE id = %s;",
                (product_id,),
            )
            conn.commit()
        finally:
            db_release(conn)
    except Exception:
        pass


def _fetch_existing_categories(venue_id: str) -> list[str]:
    """Return distinct non-null categories already used in this venue's catalog."""
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT DISTINCT category FROM products
            WHERE venue_id = %s AND category IS NOT NULL AND category != 'Other' AND active = TRUE
            ORDER BY category;
            """,
            (venue_id,),
        )
        return [r[0] for r in cur.fetchall() if r[0]]
    finally:
        db_release(conn)


def normalize_product_bg(
    product_id: str,
    raw_name: str,
    venue_id: str,
    category_hint: str | None = None,
    existing_categories: list[str] | None = None,
) -> None:
    """Background task: normalize a single product via OpenAI."""
    if not OPENAI_API_KEY:
        return
    try:
        canonical, category = _call_openai(raw_name, category_hint, existing_categories)
        if not canonical:
            _mark_done(product_id)
            return
        _save_normalized(product_id, venue_id, canonical, category)
        logger.info("normalized %r → %r (%s)", raw_name, canonical, category)
    except Exception as exc:
        logger.warning("normalization failed for %r: %s", raw_name, exc)
        _mark_done(product_id)


def normalize_all_bg(venue_id: str) -> None:
    """Background task: normalize every pending product in the venue catalog."""
    if not OPENAI_API_KEY:
        return

    existing_categories = _fetch_existing_categories(venue_id)

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, name, category FROM products
            WHERE venue_id = %s AND needs_normalization = TRUE AND locked = FALSE
            ORDER BY created_at ASC;
            """,
            (venue_id,),
        )
        rows: list[tuple[Any, Any, Any]] = cur.fetchall()
    finally:
        db_release(conn)

    logger.info("batch normalization: %d products for venue %s", len(rows), venue_id)
    for product_id, raw_name, current_cat in rows:
        # Pass current category as hint — menu-scanned items already have good category set
        hint = current_cat if current_cat and current_cat != "Other" else None
        normalize_product_bg(str(product_id), raw_name, venue_id, hint, existing_categories)
        time.sleep(0.15)
