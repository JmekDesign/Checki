from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from typing import Any

from ..db.conn import db_conn, db_release
from .config import OPENAI_API_KEY
from .utils import normalize_key

logger = logging.getLogger(__name__)

_CATEGORIES = frozenset(
    {"Beer", "Wine", "Cocktails", "Spirits", "Soft Drinks", "Food", "Other"}
)

_SYSTEM = """You are a bar product catalog normalizer. Your job: given a raw product name
typed by bar staff (may have typos, be abbreviated, or be in any language), return the
canonical English name and category.

Output ONLY a JSON object with two fields: "name" and "category".

CATEGORY must be exactly one of:
  Beer, Wine, Cocktails, Spirits, Soft Drinks, Food, Other

COCKTAIL examples (very important — staff often abbreviate or misspell):
  "negroni" / "negron" / "нeгрони"     → {"name":"Negroni","category":"Cocktails"}
  "mojito" / "mohito" / "мохито"       → {"name":"Mojito","category":"Cocktails"}
  "long island" / "lang island" / "LI" → {"name":"Long Island Iced Tea","category":"Cocktails"}
  "aperol spritz" / "aperol sp"        → {"name":"Aperol Spritz","category":"Cocktails"}
  "espresso martini" / "esp mart"      → {"name":"Espresso Martini","category":"Cocktails"}
  "old fashioned" / "old fash"         → {"name":"Old Fashioned","category":"Cocktails"}
  "margarita" / "margarit"             → {"name":"Margarita","category":"Cocktails"}
  "b52" / "B-52"                       → {"name":"B-52","category":"Cocktails"}
  "sex on the beach" / "sex beach"     → {"name":"Sex on the Beach","category":"Cocktails"}
  "pina colada" / "pina col"           → {"name":"Piña Colada","category":"Cocktails"}
  "gin tonic" / "g&t" / "gin & tonic" → {"name":"Gin & Tonic","category":"Cocktails"}

BEER examples:
  "heiniken" / "хайнекен"  → {"name":"Heineken","category":"Beer"}
  "hoegaarden" / "hoeg"    → {"name":"Hoegaarden","category":"Beer"}
  "budweiser" / "bud"      → {"name":"Budweiser","category":"Beer"}
  "guinness" / "gines"     → {"name":"Guinness","category":"Beer"}

SPIRITS examples:
  "jack daniels" / "jack d" → {"name":"Jack Daniel's","category":"Spirits"}
  "jameson" / "jameso"      → {"name":"Jameson","category":"Spirits"}
  "grey goose" / "grey g"   → {"name":"Grey Goose","category":"Spirits"}
  "baileys" / "бейлис"      → {"name":"Baileys","category":"Spirits"}
  "jagermeister" / "jager"  → {"name":"Jägermeister","category":"Spirits"}

SOFT DRINKS:
  "red bull" / "ред бул" / "redbull" → {"name":"Red Bull","category":"Soft Drinks"}
  "coca cola" / "cola" / "coke"      → {"name":"Coca-Cola","category":"Soft Drinks"}

Rules:
- Fix typos and expand bar abbreviations as shown above
- Translate non-English names to canonical English brand names
- For local untranslatable food items, capitalize properly and keep original
- Return ONLY valid JSON, nothing else"""


def _call_openai(raw_name: str) -> tuple[str, str]:
    """Call OpenAI and return (canonical_name, category). Raises on any error."""
    body = json.dumps(
        {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": _SYSTEM},
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
    if cat not in _CATEGORIES:
        cat = "Other"
    return canonical, cat


def _save_normalized(
    product_id: str, venue_id: str, canonical: str, category: str
) -> None:
    conn = db_conn()
    try:
        cur = conn.cursor()
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


def normalize_product_bg(product_id: str, raw_name: str, venue_id: str) -> None:
    """Background task: normalize a single product via OpenAI."""
    if not OPENAI_API_KEY:
        return
    try:
        canonical, category = _call_openai(raw_name)
        if not canonical:
            _mark_done(product_id)
            return
        _save_normalized(product_id, venue_id, canonical, category)
        logger.info("normalized %r → %r (%s)", raw_name, canonical, category)
    except Exception as exc:
        logger.warning("normalization failed for %r: %s", raw_name, exc)
        _mark_done(product_id)


def normalize_all_bg(venue_id: str) -> None:
    """Background task: normalize every product in the venue catalog."""
    if not OPENAI_API_KEY:
        return

    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name FROM products WHERE venue_id = %s AND needs_normalization = TRUE"
            " ORDER BY created_at ASC;",
            (venue_id,),
        )
        rows: list[tuple[Any, Any]] = cur.fetchall()
    finally:
        db_release(conn)

    logger.info("batch normalization: %d products for venue %s", len(rows), venue_id)
    for product_id, raw_name in rows:
        normalize_product_bg(str(product_id), raw_name, venue_id)
        time.sleep(0.15)  # stay well within OpenAI rate limits
