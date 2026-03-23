from __future__ import annotations

import logging
import smtplib
import ssl
from email.mime.text import MIMEText

from .config import SMTP_FROM, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_USER

logger = logging.getLogger(__name__)


def send_reset_email(to_email: str, reset_url: str) -> None:
    """Send password reset link. Raises on failure."""
    subject = "Checki — password reset"
    body = (
        f"Hello,\n\n"
        f"You requested a password reset for your Checki account.\n\n"
        f"Click the link below to set a new password (valid for 1 hour):\n\n"
        f"{reset_url}\n\n"
        f"If you did not request this, ignore this email.\n\n"
        f"— Checki"
    )

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx) as smtp:
        smtp.login(SMTP_USER, SMTP_PASS)
        smtp.sendmail(SMTP_FROM, [to_email], msg.as_bytes())

    logger.info("reset email sent to %s", to_email)
