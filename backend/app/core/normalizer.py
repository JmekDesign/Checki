from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any

from ..db.conn import db_conn, db_release
from .config import OPENAI_API_KEY
from .utils import normalize_key

logger = logging.getLogger(__name__)

_CATEGORIES = frozenset({"Beer", "Wine", "Cocktails", "Spirits", "Soft Drinks", "Food", "Other"})

_SYSTEM = (
    "You are a product catalog normalizer for a bar/restaurant. "
    "Given a product name (possibly misspelled, abbreviated, or in any language), "
    "return a JSON object with exactly two fields:\n"
    '- "name": canonical English product name, properly capitalized '
    '(e.g. "Heineken", "Negroni", "Red Bull", "French Fries")\n'
    '- "category": exactly one of: Beer, Wine, Cocktails, Spirits, '
    "Soft Drinks, Food, Other\n"
    "Rules: fix typos; translate non-English brand names to English where known "
    "(e.g. 'хайнекен' → 'Heineken', 'ред бул' → 'Red Bull'); "
    "for untranslatable local items capitalize properly and keep original; "
    "be concise (prefer 'Heineken' over 'Heineken Beer'). "
    "Return ONLY valid JSON, no other text."
)


def normalize_product_bg(product_id: str, raw_name: str, venue_id: str) -> None:
    """Background task: call OpenAI to normalize product name + category.

    Runs after upsert response is sent — zero latency impact on the check flow.
    Silent on any failure; product keeps its original name if AI is unavailable.
    """
    if not OPENAI_API_KEY:
        return

    canonical = ""
    category = "Other"

    try:
        body = json.dumps(
            {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": raw_name},
                ],
                "response_format": {"type": "json_object"},
                "max_tokens": 60,
                "temperature": 0.1,
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
        if cat in _CATEGORIES:
            category = cat

    except Exception as exc:
        logger.warning("AI normalization failed for %r: %s", raw_name, exc)

    if not canonical:
        # AI unavailable or returned empty — mark done to avoid infinite retries
        _mark_done(product_id)
        return

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE products
               SET name = %s,
                   category = %s,
                   search_key = %s,
                   needs_normalization = FALSE
             WHERE id = %s
               AND venue_id = %s
               AND needs_normalization = TRUE;
            """,
            (canonical, category, normalize_key(canonical), product_id, venue_id),
        )
        conn.commit()
        logger.info("normalized %r → %r (%s)", raw_name, canonical, category)
    except Exception as exc:
        logger.warning("DB update failed after normalization: %s", exc)
    finally:
        db_release(conn)


def _mark_done(product_id: str) -> None:
    """Mark normalization as done without changes (AI unavailable)."""
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
