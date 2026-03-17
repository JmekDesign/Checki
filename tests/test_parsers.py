from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core.parsers import parse_smart_line


def test_simple_name_price() -> None:
    result = parse_smart_line("Beer 8")
    assert result["name"] == "Beer"
    assert result["price"] == 8.0
    assert result["qty"] == 1


def test_name_price_with_currency() -> None:
    result = parse_smart_line("Jerky 12₾")
    assert result["name"] == "Jerky"
    assert result["price"] == 12.0
    assert result["qty"] == 1


def test_qty_suffix_x() -> None:
    result = parse_smart_line("Jameson x2 15")
    assert result["name"] == "Jameson"
    assert result["qty"] == 2
    assert result["price"] == 15.0


def test_qty_prefix() -> None:
    result = parse_smart_line("2 Beer 8")
    assert result["name"] == "Beer"
    assert result["qty"] == 2
    assert result["price"] == 8.0


def test_decimal_price() -> None:
    result = parse_smart_line("Wine 12.5")
    assert result["name"] == "Wine"
    assert result["price"] == 12.5


def test_decimal_price_comma() -> None:
    result = parse_smart_line("Wine 12,5")
    assert result["name"] == "Wine"
    assert result["price"] == 12.5


def test_empty_line_raises() -> None:
    with pytest.raises(HTTPException) as exc_info:
        parse_smart_line("")
    assert exc_info.value.status_code == 400


def test_no_price_raises() -> None:
    with pytest.raises(HTTPException) as exc_info:
        parse_smart_line("JustAName")
    assert exc_info.value.status_code == 400


def test_multiply_syntax() -> None:
    result = parse_smart_line("Shot *3 5")
    assert result["qty"] == 3
    assert result["price"] == 5.0
