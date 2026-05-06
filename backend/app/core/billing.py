from __future__ import annotations

from decimal import Decimal
from typing import Any

from .config import REFERRAL_RATE_PCT, REFERRAL_L2_RATE_PCT

PLAN_AMOUNTS: dict[str, Decimal] = {
    "month": Decimal("49"),
    "year":  Decimal("490"),
}


def credit_referral_commission(cur: Any, venue_id: str, plan: str) -> Decimal:
    """Credit L1 (30%) and L2 (10%) referral commissions for a venue payment.

    L1 = direct referrer of the paying venue.
    L2 = referrer of the L1 venue.

    Returns total amount credited (sum of L1 + L2). Zero if no referrer.
    Must be called within an open transaction — caller commits.
    """
    amount = PLAN_AMOUNTS.get(plan, PLAN_AMOUNTS["month"])
    l1_commission = (amount * Decimal(REFERRAL_RATE_PCT) / 100).quantize(Decimal("0.01"))
    l2_commission = (amount * Decimal(REFERRAL_L2_RATE_PCT) / 100).quantize(Decimal("0.01"))

    # L1: credit the direct referrer
    cur.execute(
        """UPDATE venues
              SET balance = balance + %s
            WHERE referral_code = (SELECT referred_by_code FROM venues WHERE id = %s)
              AND (SELECT referred_by_code FROM venues WHERE id = %s) IS NOT NULL
        RETURNING id""",
        (l1_commission, venue_id, venue_id),
    )
    l1_credited = cur.fetchone() is not None

    # L2: credit the referrer's referrer
    cur.execute(
        """WITH l1 AS (
               SELECT referred_by_code
                 FROM venues
                WHERE referral_code = (SELECT referred_by_code FROM venues WHERE id = %s)
                  AND (SELECT referred_by_code FROM venues WHERE id = %s) IS NOT NULL
           )
           UPDATE venues
              SET balance = balance + %s
            WHERE referral_code = (SELECT referred_by_code FROM l1)
              AND (SELECT referred_by_code FROM l1) IS NOT NULL
        RETURNING id""",
        (venue_id, venue_id, l2_commission),
    )
    l2_credited = cur.fetchone() is not None

    total = Decimal("0")
    if l1_credited:
        total += l1_commission
    if l2_credited:
        total += l2_commission
    return total
