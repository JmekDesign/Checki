from __future__ import annotations

import os
import subprocess
import uuid
from collections.abc import Generator
from typing import Any

import psycopg2
import pytest
from psycopg2.extensions import connection


def _get_db_host() -> str:
    """Get the IP address of the checki-db container."""
    result = subprocess.run(
        [
            "docker",
            "inspect",
            "--format",
            "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
            "checki-checki-db-1",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    # Fallback: try the service name via docker compose
    result2 = subprocess.run(
        ["docker", "compose", "exec", "-T", "checki-db", "hostname", "-i"],
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    )
    if result2.returncode == 0 and result2.stdout.strip():
        return result2.stdout.strip().split()[0]
    return "127.0.0.1"


# Set env vars BEFORE any app module is imported, because config.py reads
# env at import time via module-level `_settings = get_settings()`.
_DB_HOST = _get_db_host()
os.environ["DB_HOST"] = _DB_HOST
os.environ["DB_NAME"] = "checki_test"
os.environ["DB_PORT"] = "5432"
os.environ["DB_USER"] = "checki"
os.environ["DB_PASSWORD"] = "checki"


def _get_test_conn() -> connection:
    """Return a connection to the test database."""
    return psycopg2.connect(
        host=_DB_HOST,
        port=5432,
        dbname="checki_test",
        user="checki",
        password="checki",
        connect_timeout=5,
    )


def _truncate_all(conn: connection) -> None:
    """Delete all data from every table in dependency order."""
    cur = conn.cursor()
    cur.execute("DELETE FROM check_items;")
    cur.execute("DELETE FROM checks;")
    cur.execute("DELETE FROM sessions;")
    cur.execute("DELETE FROM products;")
    cur.execute("DELETE FROM guests;")
    cur.execute("DELETE FROM users;")
    cur.execute("DELETE FROM venues;")
    conn.commit()


@pytest.fixture
def db() -> Generator[connection, None, None]:
    """
    Provide a psycopg2 connection with autocommit=True so that data inserted
    by fixtures is immediately visible to the FastAPI TestClient (which opens
    its own connections via db_conn()).  Truncate all tables after the test.
    """
    conn = _get_test_conn()
    conn.autocommit = True
    yield conn
    _truncate_all(conn)
    conn.close()


@pytest.fixture
def venue(db: connection) -> dict[str, Any]:
    """Create a test venue."""
    cur = db.cursor()
    slug = f"test-{uuid.uuid4().hex[:8]}"
    cur.execute(
        "INSERT INTO venues (slug, name) VALUES (%s, %s) RETURNING id;",
        (slug, f"Test Venue {slug}"),
    )
    row = cur.fetchone()
    assert row is not None
    venue_id = str(row[0])
    return {"venue_id": venue_id, "slug": slug, "name": f"Test Venue {slug}"}


@pytest.fixture
def user(db: connection, venue: dict[str, Any]) -> dict[str, Any]:
    """Create a test manager user for the venue."""
    from app.core.security import hash_password

    cur = db.cursor()
    login = f"user-{uuid.uuid4().hex[:8]}"
    pw_hash = hash_password("testpass")
    cur.execute(
        "INSERT INTO users (venue_id, role, name, login, password_hash)"
        " VALUES (%s, 'manager', %s, %s, %s) RETURNING id;",
        (venue["venue_id"], "Test Manager", login, pw_hash),
    )
    row = cur.fetchone()
    assert row is not None
    user_id = str(row[0])
    return {
        "user_id": user_id,
        "login": login,
        "password": "testpass",
        "venue_id": venue["venue_id"],
    }


@pytest.fixture
def token(db: connection, user: dict[str, Any]) -> str:
    """Insert a live session token for the test user."""
    cur = db.cursor()
    tok = uuid.uuid4().hex
    cur.execute(
        "INSERT INTO sessions (token, user_id, venue_id, expires_at)"
        " VALUES (%s, %s, %s, now() + interval '1 hour');",
        (tok, user["user_id"], user["venue_id"]),
    )
    return tok


@pytest.fixture
def client() -> Any:
    """Return a FastAPI TestClient."""
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


@pytest.fixture
def another_venue(db: connection) -> dict[str, Any]:
    """Create a second venue for isolation tests."""
    cur = db.cursor()
    slug = f"other-{uuid.uuid4().hex[:8]}"
    cur.execute(
        "INSERT INTO venues (slug, name) VALUES (%s, %s) RETURNING id;",
        (slug, f"Other Venue {slug}"),
    )
    row = cur.fetchone()
    assert row is not None
    venue_id = str(row[0])
    return {"venue_id": venue_id, "slug": slug}


@pytest.fixture
def another_venue_token(db: connection, another_venue: dict[str, Any]) -> str:
    """Create a user + session token for the second venue."""
    from app.core.security import hash_password

    cur = db.cursor()
    login = f"other-{uuid.uuid4().hex[:8]}"
    pw_hash = hash_password("otherpass")
    cur.execute(
        "INSERT INTO users (venue_id, role, name, login, password_hash)"
        " VALUES (%s, 'manager', %s, %s, %s) RETURNING id;",
        (another_venue["venue_id"], "Other Manager", login, pw_hash),
    )
    row = cur.fetchone()
    assert row is not None
    other_user_id = str(row[0])

    tok = uuid.uuid4().hex
    cur.execute(
        "INSERT INTO sessions (token, user_id, venue_id, expires_at)"
        " VALUES (%s, %s, %s, now() + interval '1 hour');",
        (tok, other_user_id, another_venue["venue_id"]),
    )
    return tok
