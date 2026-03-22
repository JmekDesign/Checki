from __future__ import annotations

from pydantic import BaseModel


class ProductUpsertIn(BaseModel):
    name: str
    price: float | None = None
    category: str | None = None


class ProductUpdateIn(BaseModel):
    name: str | None = None
    price: float | None = None
    category: str | None = None
    active: bool | None = None
    is_favorite: bool | None = None


class ProductOut(BaseModel):
    id: str
    name: str
    last_price: float | None = None
    category: str
    active: bool = True


class ProductListOut(BaseModel):
    ok: bool = True
    items: list[ProductOut]
