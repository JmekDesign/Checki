from __future__ import annotations

from pydantic import BaseModel


class RegisterIn(BaseModel):
    venue_name: str
    manager_name: str
    login: str
    password: str
    email: str | None = None
    phone: str | None = None
