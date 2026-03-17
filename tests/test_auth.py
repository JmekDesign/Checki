from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from psycopg2.extensions import connection


def test_login_success(client: TestClient, user: dict[str, Any], db: connection) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"login": user["login"], "password": user["password"]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "token" in data
    assert data["user"]["venue_id"] == user["venue_id"]


def test_login_invalid_password(
    client: TestClient, user: dict[str, Any], db: connection
) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"login": user["login"], "password": "wrong"},
    )
    assert resp.status_code == 401


def test_login_unknown_user(
    client: TestClient, db: connection, venue: dict[str, Any]
) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"login": "nobody", "password": "x"},
    )
    assert resp.status_code == 401


def test_me_with_valid_token(
    client: TestClient, token: str, db: connection
) -> None:
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_me_without_token(
    client: TestClient, db: connection, venue: dict[str, Any]
) -> None:
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_logout(client: TestClient, token: str, db: connection) -> None:
    resp = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    # Token must be invalidated after logout
    resp2 = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 401
