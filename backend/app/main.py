from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .core.errors import (
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from .routers.auth import router as auth_router
from .routers.bootstrap import router as bootstrap_router
from .routers.checks_archive import router as checks_archive_router
from .routers.checks_close import router as checks_close_router
from .routers.checks_items import router as checks_items_router
from .routers.checks_open import router as checks_open_router
from .routers.guests import router as guests_router
from .routers.health import router as health_router
from .routers.products import router as products_router
from .routers.staff import router as staff_router
from .routers.venue import router as venue_router

log = logging.getLogger("checki")

settings = get_settings()

if settings.auth_salt == "change-me":
    log.warning("AUTH_SALT is set to default 'change-me' — change it in production!")

app = FastAPI(title=settings.app_title, version=settings.app_version)

# Exception handlers
app.add_exception_handler(HTTPException, http_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(Exception, unhandled_exception_handler)

# CORS (admin.checki.ge -> api.checki.ge)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(bootstrap_router)
app.include_router(guests_router)
app.include_router(products_router)
app.include_router(checks_open_router)
app.include_router(checks_archive_router)
app.include_router(checks_items_router)
app.include_router(checks_close_router)
app.include_router(staff_router)
app.include_router(venue_router)
