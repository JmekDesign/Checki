from __future__ import annotations

import base64
import contextlib
import json
import logging
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

_PROMPT = """Parse this handwritten bar/restaurant paper check photo.
Return ONLY a JSON object (no markdown, no explanation):

{
  "guest": "table or guest name at top of check, or null",
  "items": [
    {"name": "product name", "qty": 1, "unit_price": 8.0, "confidence": "high"}
  ]
}

Rules:
- guest: name or table number written at the top, null if absent
- items: only filled rows, skip blank lines
- qty: integer quantity, default 1 if unclear
- unit_price: unit price if clearly visible, null if missing or illegible
- confidence: "high" if name and qty are clearly readable, "low" if handwriting is hard to read"""


def _call_vision(image_bytes: bytes, mime: str, api_key: str) -> dict[str, Any]:
    b64 = base64.b64encode(image_bytes).decode()
    payload = json.dumps({
        "model": "gpt-4o",
        "max_tokens": 800,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": _PROMPT},
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


def _find_product(name: str, venue_id: str, cur: Any) -> tuple[str | None, float | None]:  # noqa: ANN401
    """Find product by exact name match only.

    Intentionally strict: fuzzy matching causes different variants (e.g. "Hoegaarden" vs
    "Hoegaarden S") to share the same product_id, which makes check_items merge them into
    one row. Exact match ensures separate items stay separate; unmatched names are added as
    manual items, which also upserts them into the catalog automatically.
    """
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

    try:
        parsed = _call_vision(content, mime, settings.openai_api_key)
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
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            qty = max(1, int(item.get("qty") or 1))
            unit_price = item.get("unit_price")
            scan_conf = str(item.get("confidence") or "high")

            product_id, catalog_price = _find_product(name, venue_id, cur)

            # Resolve price: catalog → scanned → 0 (0 = needs attention)
            if catalog_price is not None:
                price: float = catalog_price
                confidence = scan_conf
            elif unit_price is not None:
                price = float(unit_price)
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
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)

    return {"guest": guest, "items": result_items}
