from __future__ import annotations

from pydantic import BaseModel


class StaffCreateIn(BaseModel):
    name: str
    login: str
    password: str
    role: str = "staff"
    email: str | None = None


class StaffUpdateIn(BaseModel):
    name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None
    email: str | None = None
