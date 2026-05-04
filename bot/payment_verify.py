from __future__ import annotations

import base64
import os
from datetime import datetime, timezone, timedelta
from openai import AsyncOpenAI

_client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

TBC_IBAN = "GE49TB7114236010100048"
VALID_AMOUNTS = {49, 490}


async def analyze_screenshot(photo_bytes: bytes) -> dict:
    """Analyze TBC payment screenshot via GPT-4o Vision.
    Returns: {valid: bool, amount: int|None, date: str|None, reason: str}
    """
    b64 = base64.b64encode(photo_bytes).decode()
    prompt = (
        "This is a screenshot from a banking app. "
        "Is it a completed TBC bank transfer? "
        "Extract: 1) transfer amount in GEL (integer), 2) transfer date (YYYY-MM-DD), "
        "3) recipient IBAN or name if visible. "
        "Reply ONLY as JSON: {\"is_transfer\": bool, \"amount\": int_or_null, "
        "\"date\": \"YYYY-MM-DD_or_null\", \"recipient\": \"string_or_null\"}"
    )
    resp = await _client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            ],
        }],
        max_tokens=150,
        temperature=0,
    )
    import json
    text = resp.choices[0].message.content or "{}"
    try:
        data = json.loads(text)
    except Exception:
        return {"valid": False, "reason": "parse_error"}

    if not data.get("is_transfer"):
        return {"valid": False, "reason": "not_a_transfer"}

    amount = data.get("amount")
    if amount not in VALID_AMOUNTS:
        return {"valid": False, "amount": amount, "reason": "wrong_amount"}

    date_str = data.get("date")
    if date_str:
        try:
            pay_date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - pay_date > timedelta(days=7):
                return {"valid": False, "amount": amount, "reason": "too_old"}
        except ValueError:
            pass  # date parse failed — still proceed

    plan = "year" if amount == 490 else "month"
    return {"valid": True, "amount": amount, "plan": plan, "date": date_str}
