from __future__ import annotations

import contextlib
import json
import logging
import urllib.error
import urllib.request
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, UploadFile

from ..core.config import get_settings
from ..core.security import require_user
from ..core.utils import normalize_key
from ..db.conn import db_conn, db_release

router = APIRouter()
logger = logging.getLogger(__name__)

_MAX_BYTES = 25 * 1024 * 1024  # 25 MB (Whisper limit)

D2 = Decimal("0.01")

_VOICE_SYSTEM_PROMPT = """You are a smart bartender assistant parsing a voice command to add items to a bar check.
The voice may be in ANY language (Russian, Georgian, English, mixed, slang, abbreviations).

Catalog matching (CRITICAL — read carefully):
- A brand/variety name is NOT the same as a generic category.
  "Белуга" (Beluga vodka) ≠ "Водка" (generic vodka). Never collapse a specific item into a generic one.
  "Jameson" ≠ "Whisky". "Hoegaarden S" ≠ "Hoegaarden L".
- Match ONLY when you are certain it is exactly the same product. Use catalog name EXACTLY when matched.
  Example: "два хинкали" → catalog "Khinkali Classic" (only khinkali) → name="Khinkali Classic", confidence="high"
  Example: "виски" → catalog has only "Jameson" → name="Jameson", confidence="high"
  Example: "Белуга 12 лари" → catalog has "Водка" (generic) → NOT a match → name="Beluga", confidence="low"
- If not a clear match → output a short English transliteration/translation, set confidence="low".

Price: include "price" ONLY when explicitly stated in speech (e.g. "за 12 лари", "12 gel"). Omit otherwise.
Confidence: "high" when certain of catalog match, "low" when guessing or no catalog match.

Return ONLY valid JSON:
{"items": [{"name": "Khinkali Classic", "qty": 2, "confidence": "high"}, {"name": "Beluga", "qty": 1, "price": 12.0, "confidence": "low"}]}"""


def _multipart(
    fields: list[tuple[str, bytes, str | None, str | None]], boundary: str
) -> bytes:
    body = b""
    for name, value, filename, ctype in fields:
        body += f"--{boundary}\r\n".encode()
        if filename:
            body += (
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
            )
            body += f"Content-Type: {ctype}\r\n".encode()
        else:
            body += f'Content-Disposition: form-data; name="{name}"\r\n'.encode()
        body += b"\r\n"
        body += value
        body += b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    return body


def _transcribe(audio_bytes: bytes, content_type: str, api_key: str) -> str:
    boundary = "----VoiceBoundary7a2f9b3d"
    filename = "audio.webm" if "webm" in content_type else "audio.mp4"
    body = _multipart(
        [
            (
                "file",
                audio_bytes,
                filename,
                content_type,
            ),
            ("model", b"whisper-1", None, None),
        ],
        boundary,
    )
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/transcriptions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result: dict[str, Any] = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode(errors="replace")
        logger.error("Whisper HTTP error %s: %s", exc.code, err_body)
        raise HTTPException(status_code=502, detail=f"Whisper error: {exc.code}") from exc
    return str(result.get("text", "")).strip()


def _parse_items(
    transcription: str, catalog: list[dict[str, Any]], api_key: str
) -> list[dict[str, Any]]:
    catalog_lines = "\n".join(
        "- " + p["name"] + (f" ({p['price']:.2f} \u20be)" if p["price"] is not None else "")
        for p in catalog
    )
    user_msg = f'Voice: "{transcription}"\n\nVenue catalog:\n{catalog_lines}'

    payload = json.dumps(
        {
            "model": "gpt-4o-mini",
            "max_tokens": 600,
            "messages": [
                {"role": "system", "content": _VOICE_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
        }
    ).encode()

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
            body: dict[str, Any] = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {exc.code}") from exc

    text = body["choices"][0]["message"]["content"].strip()
    if text.startswith("```"):
        text = "\n".join(text.split("\n")[1:]).rstrip("`").strip()
    parsed: dict[str, Any] = json.loads(text)
    items: list[dict[str, Any]] = parsed.get("items") or []
    return items


def _find_product(name: str, venue_id: str, cur: Any) -> tuple[str | None, float | None]:  # noqa: ANN401
    """Exact case-insensitive match against active products."""
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


@router.post("/api/checks/{check_id}/voice-add")
async def voice_add(
    check_id: UUID,
    audio: UploadFile,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    user = require_user(authorization)
    venue_id = user["venue_id"]
    if not venue_id:
        raise HTTPException(status_code=400, detail="user has no venue")

    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503, detail="Voice not available: OPENAI_API_KEY not set"
        )

    audio_bytes = await audio.read()
    if len(audio_bytes) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Audio too large (max 25 MB)")

    content_type = audio.content_type or "audio/webm"

    check_id_s = str(check_id)

    # Load catalog
    conn0 = db_conn()
    try:
        cur0 = conn0.cursor()
        # Verify check exists, belongs to venue, is open
        cur0.execute(
            "SELECT status, venue_id FROM checks WHERE id = %s",
            (check_id_s,),
        )
        row = cur0.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="check not found")
        status, check_venue_id = row
        if str(check_venue_id) != str(venue_id):
            raise HTTPException(status_code=403, detail="forbidden")
        if status != "open":
            raise HTTPException(status_code=409, detail="check is not open")

        catalog = _load_catalog(venue_id, cur0)
    finally:
        with contextlib.suppress(Exception):
            db_release(conn0)

    # Step 1: Whisper transcription
    try:
        transcription = _transcribe(audio_bytes, content_type, settings.openai_api_key)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("voice transcription error")
        raise HTTPException(status_code=502, detail="Transcription failed") from exc

    if not transcription:
        return {
            "ok": True,
            "transcription": "",
            "items_added": [],
            "items_skipped": [],
        }

    # Step 2: GPT-4o-mini parsing
    try:
        parsed_items = _parse_items(transcription, catalog, settings.openai_api_key)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("voice parsing error")
        raise HTTPException(status_code=502, detail="Could not parse voice command") from exc

    # Step 3: Add items to check
    items_added: list[dict[str, Any]] = []
    needs_price: list[dict[str, Any]] = []

    conn = db_conn()
    try:
        cur = conn.cursor()

        for item in parsed_items:
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            qty = max(1, int(item.get("qty") or 1))
            item_price: float | None = item.get("price")
            gpt_confidence = str(item.get("confidence") or "high")

            product_id, catalog_price = _find_product(name, venue_id, cur)

            # Low-confidence items (GPT wasn't sure) → mark for review regardless of price
            if gpt_confidence == "low" and product_id is None:
                final_price_for_review: float = float(item_price) if item_price is not None else 0.0
                needs_price.append({"name": name, "qty": qty, "price": final_price_for_review})
                continue

            # Price priority: explicit spoken price wins; catalog price as fallback
            if item_price is not None:
                final_price = float(item_price)
            elif catalog_price is not None:
                final_price = catalog_price
            else:
                needs_price.append({"name": name, "qty": qty})
                continue

            price_dec = Decimal(str(final_price)).quantize(D2, rounding=ROUND_HALF_UP)
            line_total = (price_dec * qty).quantize(D2, rounding=ROUND_HALF_UP)

            item_id: Any = None

            if product_id:
                # Try upsert by product_id + price_snapshot
                cur.execute(
                    """
                    UPDATE check_items
                    SET qty = qty + %s,
                        line_total = line_total + %s
                    WHERE id = (
                        SELECT id FROM check_items
                        WHERE check_id = %s
                          AND product_id = %s
                          AND price_snapshot = %s
                        ORDER BY created_at ASC
                        LIMIT 1
                    )
                    RETURNING id
                    """,
                    (qty, line_total, check_id_s, product_id, price_dec),
                )
                rr = cur.fetchone()
                if rr:
                    item_id = rr[0]
                else:
                    cur.execute(
                        """
                        INSERT INTO check_items
                            (check_id, product_id, name_snapshot, price_snapshot, qty, line_total)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (check_id_s, product_id, name, price_dec, qty, line_total),
                    )
                    ins = cur.fetchone()
                    assert ins is not None
                    item_id = ins[0]
            else:
                # No product match — upsert by name + price
                cur.execute(
                    """
                    UPDATE check_items
                    SET qty = qty + %s,
                        line_total = line_total + %s
                    WHERE id = (
                        SELECT id FROM check_items
                        WHERE check_id = %s
                          AND product_id IS NULL
                          AND lower(trim(name_snapshot)) = lower(trim(%s))
                          AND price_snapshot = %s
                        ORDER BY created_at ASC
                        LIMIT 1
                    )
                    RETURNING id
                    """,
                    (qty, line_total, check_id_s, name, price_dec),
                )
                rr2 = cur.fetchone()
                if rr2:
                    item_id = rr2[0]
                else:
                    cur.execute(
                        """
                        INSERT INTO check_items
                            (check_id, product_id, name_snapshot, price_snapshot, qty, line_total)
                        VALUES (%s, NULL, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (check_id_s, name, price_dec, qty, line_total),
                    )
                    ins2 = cur.fetchone()
                    assert ins2 is not None
                    item_id = ins2[0]

            cur.execute(
                "UPDATE checks SET total = total + %s WHERE id = %s",
                (line_total, check_id_s),
            )

            # Mirror catalog upsert exactly like checks_items.py
            if product_id:
                cur.execute(
                    "UPDATE products SET last_price=%s WHERE id=%s AND venue_id=%s",
                    (price_dec, product_id, venue_id),
                )
            else:
                key = normalize_key(name)
                cur.execute(
                    "SELECT id FROM products WHERE venue_id=%s AND search_key=%s",
                    (venue_id, key),
                )
                ex = cur.fetchone()
                if ex:
                    cur.execute(
                        "UPDATE products SET name=%s, last_price=%s WHERE id=%s",
                        (name, price_dec, ex[0]),
                    )
                else:
                    cur.execute(
                        "INSERT INTO products"
                        " (venue_id, name, search_key, last_price, category, needs_normalization)"
                        " VALUES (%s,%s,%s,%s,%s,TRUE)",
                        (venue_id, name, key, price_dec, "Other"),
                    )

            items_added.append(
                {
                    "name": name,
                    "qty": qty,
                    "price": float(price_dec),
                    "item_id": str(item_id),
                }
            )

        conn.commit()
    finally:
        with contextlib.suppress(Exception):
            db_release(conn)

    return {
        "ok": True,
        "transcription": transcription,
        "items_added": items_added,
        "needs_price": needs_price,
    }
