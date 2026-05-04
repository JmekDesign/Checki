from __future__ import annotations

import os
from dataclasses import dataclass, field


def _split_csv(v: str) -> list[str]:
    return [x.strip() for x in (v or "").split(",") if x.strip()]


@dataclass(frozen=True)
class Settings:
    # API
    app_title: str = "Checki API"
    app_version: str = "0.0.5"

    # CORS
    cors_origins: list[str] = field(default_factory=list)

    # DB
    db_host: str = "checki-db"
    db_port: int = 5432
    db_name: str = "checki"
    db_user: str = "checki"
    db_password: str = "checki"

    # Auth
    auth_salt: str = "change-me"
    session_ttl_hours: int = 72

    # Referral
    referral_rate_pct: int = 30  # percent of plan amount credited to referrer

    # AI normalization
    openai_api_key: str = ""

    # Email / SMTP
    smtp_host: str = "smtp.beget.com"
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = "hello@checki.ge"
    app_url: str = "https://admin.checki.ge"

    def __post_init__(self) -> None:
        if not self.cors_origins:
            default_origins = "https://admin.checki.ge,https://checki.ge,https://super.checki.ge"
            origins = _split_csv(os.getenv("CORS_ORIGINS", default_origins))
            object.__setattr__(self, "cors_origins", origins)


def get_settings() -> Settings:
    return Settings(
        db_host=os.getenv("DB_HOST", "checki-db"),
        db_port=int(os.getenv("DB_PORT", "5432")),
        db_name=os.getenv("DB_NAME", "checki"),
        db_user=os.getenv("DB_USER", "checki"),
        db_password=os.getenv("DB_PASSWORD", "checki"),
        auth_salt=os.getenv("AUTH_SALT", "change-me"),
        session_ttl_hours=int(os.getenv("SESSION_TTL_HOURS", "72")),
        referral_rate_pct=int(os.getenv("REFERRAL_RATE_PCT", "30")),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        smtp_host=os.getenv("SMTP_HOST", "smtp.beget.com"),
        smtp_port=int(os.getenv("SMTP_PORT", "465")),
        smtp_user=os.getenv("SMTP_USER", ""),
        smtp_pass=os.getenv("SMTP_PASS", ""),
        smtp_from=os.getenv("SMTP_FROM", "hello@checki.ge"),
        app_url=os.getenv("APP_URL", "https://admin.checki.ge"),
    )


# ---- Backward-compatible module-level exports (legacy code expects these) ----
_settings = get_settings()

APP_TITLE = _settings.app_title
APP_VERSION = _settings.app_version

CORS_ORIGINS = _settings.cors_origins

DB_HOST = _settings.db_host
DB_PORT = _settings.db_port
DB_NAME = _settings.db_name
DB_USER = _settings.db_user
DB_PASSWORD = _settings.db_password

AUTH_SALT = _settings.auth_salt
SESSION_TTL_HOURS = _settings.session_ttl_hours
REFERRAL_RATE_PCT = _settings.referral_rate_pct
OPENAI_API_KEY = _settings.openai_api_key

SMTP_HOST = _settings.smtp_host
SMTP_PORT = _settings.smtp_port
SMTP_USER = _settings.smtp_user
SMTP_PASS = _settings.smtp_pass
SMTP_FROM = _settings.smtp_from
APP_URL = _settings.app_url
