from __future__ import annotations

from pydantic import BaseModel


class StaffCreateIn(BaseModel):
    name: str
    login: str
    password: str
    role: str = "staff"


class StaffUpdateIn(BaseModel):
    name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None
