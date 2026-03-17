from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from psycopg2.extensions import connection


def test_product_upsert_create(
    client: TestClient, token: str, db: connection
) -> None:
    resp = client.post(
        "/api/products/upsert",
        json={"name": "Test Beer", "price": 8.0, "category": "Drinks"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["name"] == "Test Beer"
    assert data["last_price"] == 8.0


def test_product_upsert_update(
    client: TestClient, token: str, db: connection
) -> None:
    client.post(
        "/api/products/upsert",
        json={"name": "Update Beer", "price": 5.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = client.post(
        "/api/products/upsert",
        json={"name": "Update Beer", "price": 7.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["last_price"] == 7.0


def test_products_list(
    client: TestClient, token: str, db: connection
) -> None:
    client.post(
        "/api/products/upsert",
        json={"name": "List Beer", "price": 6.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = client.get(
        "/api/products",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert len(resp.json()["items"]) > 0


def test_products_search(
    client: TestClient, token: str, db: connection
) -> None:
    client.post(
        "/api/products/upsert",
        json={"name": "Unique Whiskey", "price": 15.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = client.get(
        "/api/products?q=Unique",
        headers={"Authorization": f"Bearer {token}"},
    )
    items = resp.json()["items"]
    assert any(i["name"] == "Unique Whiskey" for i in items)


def test_product_upsert_requires_auth(client: TestClient, db: connection) -> None:
    resp = client.post(
        "/api/products/upsert",
        json={"name": "NoAuth", "price": 1.0},
    )
    assert resp.status_code == 401


def test_product_venue_isolation(
    client: TestClient,
    token: str,
    another_venue_token: str,
    db: connection,
    another_venue: dict[str, Any],
) -> None:
    client.post(
        "/api/products/upsert",
        json={"name": "Secret Beer", "price": 10.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Venue 2 must not see the product created by venue 1
    resp = client.get(
        "/api/products?q=Secret",
        headers={"Authorization": f"Bearer {another_venue_token}"},
    )
    assert len(resp.json()["items"]) == 0
