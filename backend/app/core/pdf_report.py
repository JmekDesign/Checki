from __future__ import annotations

import contextlib
import os
from datetime import datetime
from typing import Any

from fpdf import FPDF

_FONT_DIR = "/usr/share/fonts/truetype/dejavu"
_FONT_REG = os.path.join(_FONT_DIR, "DejaVuSans.ttf")
_FONT_BOLD = os.path.join(_FONT_DIR, "DejaVuSans-Bold.ttf")
_LARI = "\u20be"  # ₾
_TIMES = "\xd7"   # ×


def _m(x: float) -> str:
    return f"{x:.2f}"


def _label_date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso).strftime("%d %B %Y")
    except Exception:
        return iso


def _period_label(date_from: str | None, date_to: str | None) -> str:
    if date_from and date_to:
        return _label_date(date_from) if date_from == date_to else f"{_label_date(date_from)} — {_label_date(date_to)}"
    if date_from:
        return f"From {_label_date(date_from)}"
    if date_to:
        return f"Up to {_label_date(date_to)}"
    return "All time"


def generate_report(
    *,
    venue_name: str,
    date_from: str | None,
    date_to: str | None,
    check_count: int,
    total_revenue: float,
    avg_check: float,
    payments: list[dict[str, Any]],
    top_products: list[dict[str, Any]],
    checks: list[dict[str, Any]],
) -> bytes:
    pdf = FPDF()
    pdf.set_margins(15, 15, 15)
    pdf.add_page()

    has_dv = os.path.exists(_FONT_REG) and os.path.exists(_FONT_BOLD)
    if has_dv:
        pdf.add_font("dv", "", _FONT_REG)
        pdf.add_font("dv", "B", _FONT_BOLD)
        fam = "dv"
    else:
        fam = "Helvetica"

    def reg(sz: int) -> None:
        pdf.set_font(fam, "", sz)

    def bold(sz: int) -> None:
        pdf.set_font(fam, "B", sz)

    def grey() -> None:
        pdf.set_text_color(120, 120, 120)

    def black() -> None:
        pdf.set_text_color(0, 0, 0)

    def rule() -> None:
        pdf.set_draw_color(210, 210, 210)
        pdf.line(15, pdf.get_y(), 195, pdf.get_y())
        pdf.ln(5)

    W = pdf.epw

    # ── Header ──────────────────────────────────────────────────────
    bold(20)
    pdf.cell(W * 0.5, 10, "CHECKI", new_x="RIGHT", new_y="TOP")
    bold(13)
    pdf.cell(W * 0.5, 10, venue_name, align="R", new_x="LMARGIN", new_y="NEXT")
    reg(9)
    grey()
    pdf.cell(W, 5, _period_label(date_from, date_to), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(W, 5, datetime.now().strftime("Generated: %d %b %Y, %H:%M"),
             new_x="LMARGIN", new_y="NEXT")
    black()
    pdf.ln(3)
    rule()

    # ── Summary ─────────────────────────────────────────────────────
    bold(9)
    grey()
    pdf.cell(W, 5, "SUMMARY", new_x="LMARGIN", new_y="NEXT")
    black()
    col = W / 3
    bold(16)
    pdf.cell(col, 9, str(check_count), align="C")
    pdf.cell(col, 9, f"{_m(total_revenue)} {_LARI}", align="C")
    pdf.cell(col, 9, f"{_m(avg_check)} {_LARI}", align="C", new_x="LMARGIN", new_y="NEXT")
    reg(8)
    grey()
    pdf.cell(col, 5, "Checks", align="C")
    pdf.cell(col, 5, "Revenue", align="C")
    pdf.cell(col, 5, "Avg check", align="C", new_x="LMARGIN", new_y="NEXT")
    black()
    pdf.ln(5)

    # ── Payments ────────────────────────────────────────────────────
    if payments:
        bold(9)
        grey()
        pdf.cell(W, 5, "PAYMENTS", new_x="LMARGIN", new_y="NEXT")
        black()
        for p in payments:
            method = str(p.get("method") or "Other").title()
            t = float(p.get("total") or 0)
            cnt = int(p.get("count") or 0)
            pct = round(t / total_revenue * 100) if total_revenue else 0
            reg(10)
            pdf.cell(W * 0.30, 6, method)
            pdf.cell(W * 0.32, 6, f"{_m(t)} {_LARI}", align="R")
            pdf.cell(W * 0.15, 6, f"({pct}%)", align="R")
            grey()
            reg(9)
            pdf.cell(W * 0.23, 6, f"{cnt} checks", align="R",
                     new_x="LMARGIN", new_y="NEXT")
            black()
        pdf.ln(5)

    # ── Top products ─────────────────────────────────────────────────
    if top_products:
        bold(9)
        grey()
        pdf.cell(W, 5, "TOP PRODUCTS", new_x="LMARGIN", new_y="NEXT")
        black()
        for i, p in enumerate(top_products[:7], 1):
            name = str(p.get("name") or "—")
            qty = int(p.get("qty") or 0)
            rev = float(p.get("revenue") or 0)
            grey()
            reg(9)
            pdf.cell(W * 0.06, 6, f"{i}.")
            black()
            reg(9)
            pdf.cell(W * 0.62, 6, name)
            grey()
            pdf.cell(W * 0.12, 6, f"{_TIMES}{qty}", align="R")
            black()
            pdf.cell(W * 0.20, 6, f"{_m(rev)} {_LARI}", align="R",
                     new_x="LMARGIN", new_y="NEXT")
        pdf.ln(5)

    rule()

    # ── Checks grouped by day ─────────────────────────────────────────
    cur_day: str | None = None
    for c in checks:
        closed = str(c.get("closed_at") or "")
        day = closed[:10]
        if day != cur_day:
            cur_day = day
            bold(9)
            grey()
            pdf.cell(W, 7, _label_date(day) if day else "Unknown date",
                     new_x="LMARGIN", new_y="NEXT")
            black()
        num = str(c.get("number") or "")
        guest = str(c.get("guest") or "—")
        pay = str(c.get("payment_method") or "").title()
        total = float(c.get("total") or 0)
        time_ = ""
        if closed:
            with contextlib.suppress(Exception):
                time_ = datetime.fromisoformat(closed).strftime("%H:%M")
        reg(9)
        pdf.cell(W * 0.09, 6, f"#{num}")
        pdf.cell(W * 0.44, 6, guest)
        pdf.cell(W * 0.12, 6, time_)
        grey()
        pdf.cell(W * 0.15, 6, pay)
        black()
        pdf.cell(W * 0.20, 6, f"{_m(total)} {_LARI}", align="R",
                 new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())
