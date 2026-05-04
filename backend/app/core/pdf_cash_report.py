from __future__ import annotations

import os
from datetime import datetime
from typing import Any

from fpdf import FPDF

_FONT_DIR  = "/usr/share/fonts/truetype/dejavu"
_FONT_REG  = os.path.join(_FONT_DIR, "DejaVuSans.ttf")
_FONT_BOLD = os.path.join(_FONT_DIR, "DejaVuSans-Bold.ttf")
_LARI = "\u20be"


def _m(x: float) -> str:
    return f"{x:.2f}"


def _label_date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso).strftime("%d %B %Y")
    except Exception:
        return iso


def generate_cash_report(
    *,
    venue_name: str,
    date_from: str,
    date_to: str,
    movements: list[dict[str, Any]],
) -> bytes:
    pdf = FPDF()
    pdf.set_margins(15, 15, 15)
    pdf.add_page()

    has_dv = os.path.exists(_FONT_REG) and os.path.exists(_FONT_BOLD)
    if has_dv:
        pdf.add_font("dv", "",  _FONT_REG)
        pdf.add_font("dv", "B", _FONT_BOLD)
        fam = "dv"
    else:
        fam = "Helvetica"

    def reg(sz: int) -> None:  pdf.set_font(fam, "",  sz)
    def bold(sz: int) -> None: pdf.set_font(fam, "B", sz)
    def grey() -> None: pdf.set_text_color(120, 120, 120)
    def black() -> None: pdf.set_text_color(0, 0, 0)
    def rule() -> None:
        pdf.set_draw_color(210, 210, 210)
        pdf.line(15, pdf.get_y(), 195, pdf.get_y())
        pdf.ln(5)

    W = pdf.epw
    period = _label_date(date_from) if date_from == date_to else f"{_label_date(date_from)} — {_label_date(date_to)}"

    # Header
    bold(20)
    pdf.cell(W * 0.5, 10, "CHECKI", new_x="RIGHT", new_y="TOP")
    bold(13)
    pdf.cell(W * 0.5, 10, venue_name, align="R", new_x="LMARGIN", new_y="NEXT")
    reg(9)
    grey()
    pdf.cell(W, 5, period, new_x="LMARGIN", new_y="NEXT")
    pdf.cell(W, 5, datetime.now().strftime("Generated: %d %b %Y, %H:%M"), new_x="LMARGIN", new_y="NEXT")
    black()
    pdf.ln(3)
    rule()

    # Summary
    opening = sum(m["amount"] for m in movements if m["type"] == "open")
    cash_in = sum(m["amount"] for m in movements if m["type"] == "in")
    cash_out = sum(m["amount"] for m in movements if m["type"] == "out")
    balance = opening + cash_in - cash_out

    bold(9)
    grey()
    pdf.cell(W, 5, "SUMMARY", new_x="LMARGIN", new_y="NEXT")
    black()
    col = W / 4
    bold(14)
    for val in [f"{_m(opening)} {_LARI}", f"+{_m(cash_in)} {_LARI}", f"−{_m(cash_out)} {_LARI}", f"{_m(balance)} {_LARI}"]:
        pdf.cell(col, 9, val, align="C")
    pdf.ln(9)
    reg(8)
    grey()
    for lbl in ["Opening", "Income", "Withdrawal", "Balance"]:
        pdf.cell(col, 5, lbl, align="C")
    pdf.ln(5)
    black()
    pdf.ln(3)
    rule()

    # Movements grouped by shift_date
    cur_day: str | None = None
    for m in sorted(movements, key=lambda x: (x["shift_date"], x["created_at"])):
        sd = m["shift_date"]
        if sd != cur_day:
            cur_day = sd
            bold(9)
            grey()
            pdf.cell(W, 7, _label_date(sd), new_x="LMARGIN", new_y="NEXT")
            black()
        mtype   = str(m.get("type") or "")
        amount  = float(m.get("amount") or 0)
        note    = str(m.get("note") or "")
        check_n = m.get("check_number")
        label   = f"Check #{check_n}" if check_n and mtype == "in" else (note or mtype.title())
        sign    = "−" if mtype == "out" else "+"
        color   = (255, 90, 106) if mtype == "out" else (76, 175, 80) if mtype == "in" else (200, 200, 200)
        reg(9)
        pdf.cell(W * 0.7, 6, label[:60])
        pdf.set_text_color(*color)
        bold(9)
        pdf.cell(W * 0.3, 6, f"{sign}{_m(amount)} {_LARI}", align="R", new_x="LMARGIN", new_y="NEXT")
        black()

    return bytes(pdf.output())
