# Checki — Claude Code Instructions

## Project

Mobile-first web app for bars. Staff manages checks (tabs): open, add items, close.
Multi-venue with strict `venue_id` isolation per row.

## Stack

Python 3.12, FastAPI, psycopg2 (raw SQL only), PostgreSQL 16, Docker Compose.
Admin UI: vanilla JS (CHK namespace). No ORM — ever.

## Structure

```
backend/app/
  main.py          — FastAPI app, middleware, router wiring
  core/
    config.py      — Settings dataclass, env vars
    security.py    — hash_password, require_user() → UserContext TypedDict
    errors.py      — Exception handlers
    parsers.py     — parse_smart_line (freeform text → name/price/qty)
    utils.py       — normalize_key, short_check_number
  db/conn.py       — db_conn() → psycopg2 connection, db_ok() (connection only)
  routers/         — checks_open, checks_items, checks_close, checks_archive,
                     auth, bootstrap, guests, products, health
  schemas/         — Pydantic models (auth, bootstrap, checks, guests, products)
admin/             — Static HTML/JS/CSS staff UI
  index.html       — single-page app shell
  main.js          — script loader (loads modules in order via await)
  ui.js            — show(), toast(), confirm(), paymentConfirm(), CHK._show/CHK.show
  api.js           — CHK.api(), token management
  nav.js           — CHK.nav stack-based navigator (go/back/replace/reset/current)
  auth.js          — login, logout, tab switching, session init
  open.js          — open checks list, new check, guest autocomplete
  check.js         — check detail: render, close, delete, readonly patch
  check-form.js    — add item form: product suggest, qty, quick chips
  voice.js         — voice recording, send to API, add items to check
  password-reset.js — forgot/reset password screens
  archive.js       — archive screen, filters, stats
  venue.js         — venue settings, staff management
  catalog.js       — product catalog
  supplies.js      — supplies / procurement
  scan.js          — paper receipt scanning + scan-edit modal
  help.js          — onboarding stories
  app.css          — all styles
sql/               — Migration scripts (001_init.sql, 002_sessions.sql, ...)
tests/             — pytest (real PostgreSQL, savepoint/rollback per test)
Makefile           — dev commands
pyproject.toml     — ruff, mypy, pytest config
```

## Absolute Rules

**venue_id isolation** — every query on venue-scoped tables (checks, check_items,
products, guests) MUST include `WHERE venue_id = %s`. No exceptions.

**Parameterized SQL only** — always `%s` placeholders. Never f-strings or `.format()`
in SQL.

**Financial integrity** — `price_snapshot` and `line_total` computed in a single
transaction. `checks.total` = `SUM(check_items.line_total)`, never stored independently.

**Auth** — `require_user()` from `core/security.py` is the only auth entry point.
Returns `UserContext` TypedDict. `AUTH_SALT` from env only — never hardcoded.

**No business logic in `db/conn.py`** — only connection helpers live there.

**Schema changes require a migration** — add a numbered file under `sql/` before
touching any table definition.

**File size** — files over 250 lines must be split into submodules. Applies to
both backend (`routers/`, `core/`) and frontend (`admin/*.js`). When a file
exceeds the limit, extract the new module immediately — do not defer it.

**Type hints** — all new code: `from __future__ import annotations` at top,
full type annotations, passes `mypy --strict`.

## Never Do

- Use an ORM (SQLAlchemy, Django ORM, etc.)
- String interpolation in SQL (`f"... {value}"`)
- Skip `venue_id` filter in any data endpoint
- Hardcode `AUTH_SALT` or any secret
- Write business logic in `db/conn.py`
- Modify DB schema without a `sql/` migration file

## Session Startup (ProjectGo Gateway)

Tasks arrive via Telegram → ProjectGo bot → stored centrally in ProjectGo.

Before starting work, run in this project:

```bash
make sync-inbox   # pull from server
make inbox        # list new items
```

Read each file listed. Inbox path: `../ProjectGo/data/inbox/checki/new/`

## Dev Commands

```
make test        # pytest against real checki_test DB
make lint        # ruff check
make typecheck   # mypy --strict
make lint-fix    # ruff auto-fix + format
```

## Testing

Real PostgreSQL (`checki_test` DB). No DB mocks. Each test uses savepoint/rollback
for isolation. See `tests/` for existing patterns before writing new tests.

## Agent Roles

| Agent               | Model  | Scope                          |
|---------------------|--------|--------------------------------|
| designer            | opus   | read-only, spec authoring      |
| implementer         | sonnet | coding tasks                   |
| implementer-senior  | opus   | complex / cross-cutting tasks  |
| reviewer            | sonnet | read-only, code review         |
| tester              | sonnet | test authoring                 |

## Implementation Checklist

Before returning any implementation:
1. `make lint` — zero errors
2. `make typecheck` — zero errors
3. `make test` — all tests pass
4. Every new endpoint: `venue_id` filter verified, `require_user()` called
5. Any DB schema change: migration file present in `sql/`
