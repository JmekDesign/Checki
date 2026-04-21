from __future__ import annotations

import base64
import contextlib
import json
import logging
import re
import urllib.error
import urllib.request
from typing import Any

from fastapi import APIRouter, Header, HTTPException, UploadFile

from ..core.config import get_settings
from ..core.security import require_user
from ..db.conn import db_conn, db_release

router = APIRouter()
logger = logging.getLogger(__name__)

_MAX_BYTES = 20 * 1024 * 1024  # 20 MB

_PROMPT_BASE = """Read this handwritten bar/restaurant check photo and extract the items.
Return ONLY a JSON object (no markdown, no explanation).

Think like an experienced waiter or bartender reading their own check. You know food
and drinks — use that knowledge. Staff write quickly: abbreviations, first names only,
size letters (S=Small, M=Medium, L=Large, XL=Extra Large), local slang.
Handwriting quirks: S can look like 5, B like 8, G like 9.

For each row on the check:
1. Understand what was meant — not just what letters are there.
   "Morgan" at a bar = Captain Morgan. "Hoe S" = Hoegaarden Small.
   "негрони" = Negroni. Use your knowledge of food & drink.
2. If a catalog is provided: find the best semantic match by meaning + price.
   When confident it's the same product, use the catalog name exactly.
   If not sure — write the name as you read it.
3. Set confidence="low" when handwriting is ambiguous or no confident catalog match.

Return one item per row. Never merge or drop rows.

{
  "guest": "table or guest identifier at the top, or null",
  "items": [
    {"name": "product name", "qty": 1, "unit_price": 8.0, "confidence": "high"}
  ]
}

- guest: null if not present
- qty: integer
- unit_price: numeric if clearly visible, null otherwise
- confidence: "high" only if certain, "low" when in any doubt"""


def _build_prompt(catalog: list[dict[str, Any]]) -> str:  # noqa: ANN401
    if not catalog:
        return _PROMPT_BASE
    lines = "\n".join(
        "- " + p["name"] + (f" ({p['price']:.2f} \u20be)" if p["price"] is not None else "")
        for p in catalog
    )
    return _PROMPT_BASE + "\n\nVenue catalog:\n" + lines


def _load_catalog(venue_id: str, cur: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    cur.execute(
        """
        SELECT name, last_price
        FROM products
        WHERE venue_id = %s AND active = TRUE
        ORDER BY name
        LIMIT 150
        """,
        (venue_id,),
    )
    return [
        {"name": row[0], "price": float(row[1]) if row[1] is not None else None}
        for row in cur.fetchall()
    ]


def _call_vision(image_bytes: bytes, mime: str, api_key: str, prompt: str) -> dict[str, Any]:
    b64 = base64.b64encode(image_bytes).decode()
    payload = json.dumps({
        "model": "gpt-4o",
        "max_tokens": 800,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {
                    "url": f"data:{mime};base64,{b64}",
                    "detail": "high",
                }},
            ],
        }],
    }).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {exc.code}") from exc

    text = body["choices"][0]["message"]["content"].strip()
    if text.startswith("```"):
        text = "\n".join(text.split("\n")[1:]).rstrip("`").strip()
    return dict(json.loads(text))


_SUSPICIOUS_SUFFIX = re.compile(r"\s[5-9]\s*$")  # lone digit at end → likely misread S/B/G


def _is_suspicious(name: str) -> bool:
    return bool(_SUSPICIOUS_SUFFIX.search(name))


def _find_product(name: str, venue_id: str, cur: Any) -> tuple[str | None, float | None]:  # noqa: ANN401
    """Exact case-insensitive match only. Keeps variants (e.g. Hoegaarden vs Hoegaarden S)
    as separate catalog entries — prevents merging distinct items in check_items."""
    cur.execute(
        """
        SELECT id, last_price
        FROM products
        WHERE venue_id = %s AND active = TRUE AND lower(name) = lower(%s)
        LIMIT 1
        """,
        (venue_id, name),
    )
    row = cur.fetchone()
    if row:
        return str(row[0]), float(row[1]) if row[1] is not None else None
    return None, None


@router.post("/api/checks/scan")
async def scan_check(
    image: UploadFile,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="Scan not available: OPENAI_API_KEY not set")

    content = await image.read()
    if len(content) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 20 MB)")

    mime = image.content_type or "image/jpeg"

    # Load catalog and build prompt before calling vision
    conn0 = db_conn()
    try:
        cur0 = conn0.cursor()
        catalog = _load_catalog(venue_id, cur0)
    finally:
        with contextlib.suppress(Exception):
            db_release(conn0)

    prompt = _build_prompt(catalog)

    try:
        parsed = _call_vision(content, mime, settings.openai_api_key, prompt)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("scan vision error")
        raise HTTPException(status_code=502, detail="Could not parse image") from exc

    raw_items: list[Any] = parsed.get("items") or []
    guest: str | None = (parsed.get("guest") or None)

    conn = db_conn()
    try:
        cur = conn.cursor()
        result_items: list[dict[str, Any]] = []

        for item in raw_items:
            try:
                name = str(item.get("name") or "").strip()
                if not name:
                    continue
                try:
                    qty = max(1, int(float(item.get("qty") or 1)))
                except (TypeError, ValueError):
                    qty = 1
                unit_price = item.get("unit_price")
                scan_conf = str(item.get("confidence") or "high")

                product_id, catalog_price = _find_product(name, venue_id, cur)

                if _is_suspicious(name) or product_id is None:
                    scan_conf = "low"

                if catalog_price is not None:
                    price: float = catalog_price
                    confidence = scan_conf
                elif unit_price is not None:
                    try:
                        price = float(unit_price)
                    except (TypeError, ValueError):
                        price = 0.0
                        scan_conf = "low"
                    confidence = scan_conf
                else:
                    price = 0.0
                    confidence = "low"

                result_items.append({
                    "name": name,
                    "qty": qty,
                    "price": price,
                    "product_id": product_id,
                    "confidence": confidence,
                })
            except Exception as exc:
                logger.warning("scan: skip item %r: %s", item, exc)
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)

    return {"guest": guest, "items": result_items}
