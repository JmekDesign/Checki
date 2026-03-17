---
description: Rules for API router files
globs: backend/app/routers/*.py
---

- Every endpoint MUST call `require_user(authorization)` and extract `venue_id = user["venue_id"]`
- All SQL MUST use parameterized queries (`%s` placeholders, tuple params)
- Every query on `checks`, `check_items`, `products`, `guests` MUST filter by `venue_id`
- Use `db_conn()` from `..db.conn`, close in `finally` with `contextlib.suppress(Exception)`
- Return type: `dict[str, Any]` for all endpoints
- Always `from __future__ import annotations` at top of file
- mypy --strict: full type hints on all functions
