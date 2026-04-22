"""Menu scan — upload 1-5 photos, extract items via GPT-4o Vision."""
from __future__ import annotations

import base64
import json
import logging
import urllib.request
from typing import Any

from fastapi import APIRouter, Header, HTTPException, UploadFile

from ..core.config import OPENAI_API_KEY
from ..core.security import require_user
from ..db.conn import db_conn, db_release

router = APIRouter()
logger = logging.getLogger(__name__)

_MAX_BYTES = 20 * 1024 * 1024  # 20 MB per image
_MAX_IMAGES = 5

_MENU_PROMPT = """You are reading a restaurant or bar menu photo.
Extract ALL menu items that are visible. Return ONLY a JSON object — no markdown.

{
  "items": [
    {"name": "Saperavi", "price": 8.0, "category_hint": "Wine", "confidence": "high"}
  ]
}

Rules:
- Extract every product item (skip venue name, address, legal text, decorative headers)
- "name": the item name in English when clearly English; transliterate/translate if Georgian/Russian
- "price": numeric GEL price. If a range like "15/25", use the first value. null if not clearly visible.
- "category_hint": the menu section header this item falls under — preserve the menu's exact
  section names (e.g. "Beer", "Cocktails", "Gin", "Khinkali", "Soups", "Soft Drinks").
  Use null only if no section heading is visible.
- "confidence": "high" if text is clearly readable, "low" if blurry, obscured, or ambiguous
- List each size variant as a separate item (e.g. "Beer Small", "Beer Large")
- Return ONLY valid JSON"""


def _vision_extract(image_bytes: bytes, content_type: str) -> list[dict[str, Any]]:
    """Call GPT-4o Vision on one image, return list of raw items."""
    b64 = base64.b64encode(image_bytes).decode()
    data_url = f"data:{content_type};base64,{b64}"

    body = json.dumps({
        "model": "gpt-4o",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": _MENU_PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
                ],
            }
        ],
        "response_format": {"type": "json_object"},
        "max_tokens": 2000,
        "temperature": 0.1,
    }).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        result: dict[str, Any] = json.loads(resp.read())

    content = result["choices"][0]["message"]["content"]
    data: dict[str, Any] = json.loads(content)
    items = data.get("items") if isinstance(data.get("items"), list) else []
    return items  # type: ignore[return-value]


def _fetch_catalog_names(venue_id: str) -> set[str]:
    """Return lowercased product names already in catalog for duplicate detection."""
    conn = db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT lower(name) FROM products WHERE venue_id = %s AND active = TRUE;",
            (venue_id,),
        )
        return {r[0] for r in cur.fetchall()}
    finally:
        db_release(conn)


@router.post("/api/catalog/scan-menu")
async def scan_menu(
    files: list[UploadFile],
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    """Accept 1-5 menu images, extract items via GPT-4o Vision.

    Returns merged list with duplicate flags. Auth required (manager+).
    """
    user = require_user(authorization)
    if user["role"] not in ("manager", "admin", "superadmin"):
        raise HTTPException(status_code=403, detail="manager role required")
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="AI not configured")

    if not files:
        raise HTTPException(status_code=400, detail="no images provided")
    if len(files) > _MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"max {_MAX_IMAGES} images per request")

    catalog_names = _fetch_catalog_names(venue_id)

    # Merge items across all pages; deduplicate by lowercased name
    seen_names: dict[str, dict[str, Any]] = {}
    errors: list[str] = []

    for idx, upload in enumerate(files):
        raw = await upload.read()
        if len(raw) > _MAX_BYTES:
            errors.append(f"image {idx + 1} too large (max 20 MB)")
            continue

        ct = (upload.content_type or "image/jpeg").split(";")[0].strip()
        if not ct.startswith("image/"):
            ct = "image/jpeg"

        try:
            page_items = _vision_extract(raw, ct)
        except Exception as exc:
            logger.warning("menu scan failed for image %d: %s", idx + 1, exc)
            errors.append(f"image {idx + 1}: could not process ({exc})")
            continue

        for it in page_items:
            name = str(it.get("name") or "").strip()
            if not name:
                continue
            key = name.lower()
            if key in seen_names:
                continue  # already collected from earlier page

            raw_price = it.get("price")
            try:
                price: float | None = float(raw_price) if raw_price is not None else None
            except (TypeError, ValueError):
                price = None

            seen_names[key] = {
                "name": name,
                "price": price,
                "category_hint": str(it.get("category_hint") or "").strip() or None,
                "confidence": "low" if str(it.get("confidence", "high")) == "low" else "high",
                "exists_in_catalog": key in catalog_names,
            }

    items = list(seen_names.values())
    return {"ok": True, "total_pages": len(files), "items": items, "errors": errors}
