from __future__ import annotations


def normalize_key(s: str) -> str:
    return " ".join((s or "").strip().lower().split())


def short_check_number(check_id: str) -> str:
    # MVP: human-friendly short number (stable, derived from uuid)
    return (check_id or "")[:8]
