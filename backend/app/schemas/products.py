from __future__ import annotations

from pydantic import BaseModel


class ProductUpsertIn(BaseModel):
    name: str
    price: float | None = None
    category: str | None = None


class ProductOut(BaseModel):
    id: str
    name: str
    last_price: float | None = None
    category: str


class ProductListOut(BaseModel):
    ok: bool = True
    items: list[ProductOut]
