from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from psycopg2.extensions import connection


def test_open_check(client: TestClient, token: str, db: connection) -> None:
    resp = client.post(
        "/api/checks/open",
        json={"guest_name": "John"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "check_id" in data


def test_list_open_checks(client: TestClient, token: str, db: connection) -> None:
    client.post(
        "/api/checks/open",
        json={"guest_name": "Alice"},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = client.get(
        "/api/checks/open",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert len(resp.json()["items"]) > 0


def test_add_item_to_check(client: TestClient, token: str, db: connection) -> None:
    open_resp = client.post(
        "/api/checks/open",
        json={"guest_name": "Bob"},
        headers={"Authorization": f"Bearer {token}"},
    )
    check_id = open_resp.json()["check_id"]

    resp = client.post(
        f"/api/checks/{check_id}/items/add",
        json={"name": "Beer", "price": 8.0, "qty": 2},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["line_total"] == 16.0


def test_close_check(client: TestClient, token: str, db: connection) -> None:
    open_resp = client.post(
        "/api/checks/open",
        json={"guest_name": "Carol"},
        headers={"Authorization": f"Bearer {token}"},
    )
    check_id = open_resp.json()["check_id"]

    resp = client.post(
        f"/api/checks/{check_id}/close",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "closed"


def test_close_already_closed_check(
    client: TestClient, token: str, db: connection
) -> None:
    open_resp = client.post(
        "/api/checks/open",
        json={"guest_name": "Dave"},
        headers={"Authorization": f"Bearer {token}"},
    )
    check_id = open_resp.json()["check_id"]
    client.post(
        f"/api/checks/{check_id}/close",
        headers={"Authorization": f"Bearer {token}"},
    )
    # Second close must fail with 409
    resp2 = client.post(
        f"/api/checks/{check_id}/close",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 409


def test_get_check_detail(client: TestClient, token: str, db: connection) -> None:
    open_resp = client.post(
        "/api/checks/open",
        json={"guest_name": "Eve"},
        headers={"Authorization": f"Bearer {token}"},
    )
    check_id = open_resp.json()["check_id"]
    client.post(
        f"/api/checks/{check_id}/items/add",
        json={"name": "Wine", "price": 12.0, "qty": 1},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = client.get(
        f"/api/checks/{check_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["check"]["total"] == 12.0
    assert len(data["check"]["items"]) == 1


def test_check_venue_isolation(
    client: TestClient,
    token: str,
    another_venue_token: str,
    db: connection,
    another_venue: dict[str, Any],
) -> None:
    open_resp = client.post(
        "/api/checks/open",
        json={"guest_name": "Isolated"},
        headers={"Authorization": f"Bearer {token}"},
    )
    check_id = open_resp.json()["check_id"]

    # Venue 2 must not see venue 1's check in the open list
    resp = client.get(
        "/api/checks/open",
        headers={"Authorization": f"Bearer {another_venue_token}"},
    )
    check_ids = [c["check_id"] for c in resp.json()["items"]]
    assert check_id not in check_ids

    # Venue 2 must get 403 when trying to access venue 1's check directly
    resp2 = client.get(
        f"/api/checks/{check_id}",
        headers={"Authorization": f"Bearer {another_venue_token}"},
    )
    assert resp2.status_code == 403
