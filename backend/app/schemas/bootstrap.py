from __future__ import annotations

from pydantic import BaseModel


class BootstrapIn(BaseModel):
    venue_slug: str
    venue_name: str
    manager_name: str
    manager_login: str
    manager_password: str
