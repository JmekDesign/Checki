---
description: Rules for test files
globs: tests/**/*.py
---

- Use real PostgreSQL via `db_conn` fixture (no mocks for DB)
- Each test uses savepoint/rollback — no data leaks between tests
- Fixtures: `db_conn`, `venue`, `user`, `token`, `client`, `another_venue`, `another_venue_token`
- Test venue_id isolation: operations from one venue MUST NOT see data from another
- Test file naming: `test_<module>.py`
- Use `pytest.raises(HTTPException)` for expected errors
- Mark DB tests with `@pytest.mark.db` if needed
