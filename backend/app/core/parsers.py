from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException


def parse_smart_line(s: str) -> dict[str, Any]:
    """
    Very small MVP parser:
      - qty: "x2", "*2", "2x", or leading "2 Beer"
      - price: last number in string (supports "12", "12.5", "12,5") optionally with currency sign
      - name: remaining text
    Examples:
      "Jameson x2"
      "Jerky 12₾"
      "2 Beer 8"
    """
    raw = (s or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="line is empty")

    t = raw.replace("₾", " ").replace("gel", " ").replace("GEL", " ")
    t = re.sub(r"\s+", " ", t).strip()

    qty = 1

    m = re.search(r"(?:\bx\s*(\d+)\b)|(?:\b(\d+)\s*x\b)|(?:\*\s*(\d+)\b)", t, flags=re.I)
    if m:
        q = next((g for g in m.groups() if g), None)
        if q:
            qty = int(q)
            t = (t[: m.start()] + " " + t[m.end() :]).strip()
            t = re.sub(r"\s+", " ", t).strip()
    else:
        m2 = re.match(r"^\s*(\d+)\s+(.+)$", t)
        if m2:
            qty = int(m2.group(1))
            t = m2.group(2).strip()

    if qty <= 0:
        raise HTTPException(status_code=400, detail="qty must be > 0")

    # price: last numeric token
    pm = list(re.finditer(r"(\d+(?:[.,]\d+)?)", t))
    price = None
    if pm:
        last = pm[-1]
        price_str = last.group(1).replace(",", ".")
        try:
            price = float(price_str)
            t = (t[: last.start()] + " " + t[last.end() :]).strip()
            t = re.sub(r"\s+", " ", t).strip()
        except Exception:
            price = None

    name = t.strip()

    if not name:
        raise HTTPException(status_code=400, detail="name required")
    if price is None:
        raise HTTPException(
            status_code=400, detail="price required (example: 'Beer 8' or 'Jerky 12₾')"
        )

    return {"name": name, "price": price, "qty": qty}
