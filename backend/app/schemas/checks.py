from __future__ import annotations

from pydantic import BaseModel


class CheckOpenIn(BaseModel):
    guest_id: str | None = None
    guest_name: str | None = None


# Staff UI compat: POST /api/checks {guest:"..."}
class CheckCreateIn(BaseModel):
    guest: str


class ItemAddIn(BaseModel):
    product_id: str | None = None
    name: str | None = None
    # price is optional:
    # - if product_id is provided and product has last_price -> backend uses it
    # - otherwise price is required
    price: float | None = None
    qty: int = 1


# Staff UI compat: POST /api/checks/{id}/add_line
class AddLineIn(BaseModel):
    line: str | None = None
    text: str | None = None
    name: str | None = None
    price: float | None = None
    qty: int | None = None


class CheckCloseIn(BaseModel):
    payment_method: str | None = None
