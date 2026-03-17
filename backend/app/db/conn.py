from __future__ import annotations

import contextlib
import logging

import psycopg2
from psycopg2.extensions import connection
from psycopg2.pool import SimpleConnectionPool

from ..core.config import get_settings

log = logging.getLogger("checki")

_pool: SimpleConnectionPool | None = None


def _get_pool() -> SimpleConnectionPool:
    global _pool  # noqa: PLW0603
    if _pool is None or _pool.closed:
        s = get_settings()
        _pool = SimpleConnectionPool(
            minconn=2,
            maxconn=10,
            host=s.db_host,
            port=s.db_port,
            dbname=s.db_name,
            user=s.db_user,
            password=s.db_password,
            connect_timeout=3,
        )
        log.info("DB connection pool created (%s:%s/%s)", s.db_host, s.db_port, s.db_name)
    return _pool


def db_conn() -> connection:
    return _get_pool().getconn()


def db_release(conn: connection) -> None:
    """Return a connection to the pool instead of closing it."""
    try:
        _get_pool().putconn(conn)
    except Exception:
        with contextlib.suppress(Exception):
            conn.close()


def db_ok(timeout_sec: int = 2) -> bool:
    s = get_settings()
    try:
        conn = psycopg2.connect(
            host=s.db_host,
            port=s.db_port,
            dbname=s.db_name,
            user=s.db_user,
            password=s.db_password,
            connect_timeout=timeout_sec,
        )
        cur = conn.cursor()
        cur.execute("select 1;")
        cur.fetchone()
        cur.close()
        conn.close()
        return True
    except Exception:
        return False
