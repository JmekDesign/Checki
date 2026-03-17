from __future__ import annotations

import psycopg2
from psycopg2.extensions import connection

from ..core.config import get_settings


def db_conn() -> connection:
    s = get_settings()
    return psycopg2.connect(
        host=s.db_host,
        port=s.db_port,
        dbname=s.db_name,
        user=s.db_user,
        password=s.db_password,
        connect_timeout=3,
    )


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
