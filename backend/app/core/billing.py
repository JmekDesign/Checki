from __future__ import annotations

from decimal import Decimal
from typing import Any

from .config import REFERRAL_RATE_PCT

PLAN_AMOUNTS: dict[str, Decimal] = {
    "month": Decimal("49"),
    "year":  Decimal("490"),
}


def credit_referral_commission(cur: Any, venue_id: str, plan: str) -> Decimal:
    """Credit L1 referral commission to the referrer of venue_id.

    Returns the commission amount credited (0 if no referrer found).
    Must be called within an open transaction — caller commits.
    """
    amount = PLAN_AMOUNTS.get(plan, PLAN_AMOUNTS["month"])
    commission = (amount * Decimal(REFERRAL_RATE_PCT) / 100).quantize(Decimal("0.01"))

    cur.execute(
        """UPDATE venues
              SET balance = balance + %s
            WHERE referral_code = (
                SELECT referred_by_code FROM venues WHERE id = %s
            )
              AND (SELECT referred_by_code FROM venues WHERE id = %s) IS NOT NULL
        RETURNING id""",
        (commission, venue_id, venue_id),
    )
    credited = cur.fetchone() is not None
    return commission if credited else Decimal("0")
