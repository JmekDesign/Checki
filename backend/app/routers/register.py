from __future__ import annotations

import logging
import re
import secrets
import string
import threading
import unicodedata
from typing import Any

from fastapi import APIRouter, HTTPException

from ..core.config import APP_URL
from ..core.mailer import send_welcome_email
from ..core.security import hash_password
from ..db.conn import db_conn, db_release
from ..schemas.register import RegisterIn

logger = logging.getLogger(__name__)

router = APIRouter()

_SLUG_RE = re.compile(r"[^a-z0-9]+")
_REF_ALPHABET = string.ascii_uppercase + string.digits


def _slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return _SLUG_RE.sub("-", text.lower()).strip("-")[:48] or "venue"


def _gen_referral_code(cur: Any) -> str:  # noqa: ANN401
    for length in (6, 8):
        for _ in range(20):
            code = "".join(secrets.choice(_REF_ALPHABET) for _ in range(length))
            cur.execute("SELECT 1 FROM venues WHERE referral_code = %s;", (code,))
            if not cur.fetchone():
                return code
    return secrets.token_hex(5).upper()


@router.post("/api/register")
def register(payload: RegisterIn) -> dict[str, Any]:
    venue_name = payload.venue_name.strip()
    manager_name = payload.manager_name.strip()
    login = payload.login.strip()
    password = payload.password

    if not venue_name:
        raise HTTPException(status_code=400, detail="venue_name required")
    if not manager_name:
        raise HTTPException(status_code=400, detail="manager_name required")
    if not login or len(login) < 3:
        raise HTTPException(status_code=400, detail="login must be at least 3 characters")
    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="password must be at least 6 characters")

    slug_base = _slugify(venue_name)
    ref_code = (payload.ref_code or "").strip().upper() or None

    conn = db_conn()
    try:
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM users WHERE login = %s;", (login,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="login already taken")

        # Validate ref_code if provided
        if ref_code:
            cur.execute("SELECT 1 FROM venues WHERE referral_code = %s;", (ref_code,))
            if not cur.fetchone():
                ref_code = None  # invalid code — silently ignore

        # Ensure unique slug
        slug = slug_base
        cur.execute("SELECT 1 FROM venues WHERE slug = %s;", (slug,))
        if cur.fetchone():
            cur.execute("SELECT COUNT(*) FROM venues WHERE slug LIKE %s;", (slug_base + "%",))
            row = cur.fetchone()
            n = int(row[0]) if row else 0
            slug = f"{slug_base}-{n + 1}"

        referral_code = _gen_referral_code(cur)
        lang = payload.lang if payload.lang in ("en", "ka") else "en"

        cur.execute(
            """INSERT INTO venues (slug, name, email, phone, lang, referral_code, referred_by_code)
               VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id;""",
            (slug, venue_name, payload.email or None, payload.phone or None, lang,
             referral_code, ref_code),
        )
        venue_row = cur.fetchone()
        assert venue_row is not None
        venue_id = venue_row[0]

        pw_hash = hash_password(password)
        cur.execute(
            """INSERT INTO users (venue_id, role, name, login, password_hash, email)
               VALUES (%s, 'manager', %s, %s, %s, %s) RETURNING id;""",
            (venue_id, manager_name, login, pw_hash, payload.email or None),
        )
        conn.commit()

        if payload.email:
            email_to = payload.email

            def _send() -> None:
                try:
                    send_welcome_email(
                        to_email=email_to,
                        manager_name=manager_name,
                        venue_name=venue_name,
                        login=login,
                        password=password,
                        app_url=APP_URL,
                    )
                except Exception as exc:
                    logger.warning("welcome email failed: %s", exc)

            threading.Thread(target=_send, daemon=True).start()

        return {"ok": True, "venue_id": str(venue_id)}
    finally:
        db_release(conn)
