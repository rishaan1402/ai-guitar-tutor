"""Transactional email (password reset).

Uses Resend's HTTP API when RESEND_API_KEY is set. Without it, outside
production (local dev, tests), the message is logged so the reset flow can be
tried by hand. In production nothing is ever logged: a reset link is a
password, and logs are readable by far more people than the mailbox is.
Production without RESEND_API_KEY and FRONTEND_URL reports email as
unavailable (see ``email_configured``) instead of pretending to send.
"""
from __future__ import annotations

import logging
import os

import httpx

from auth.security import _is_production

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
MAIL_FROM = os.environ.get("MAIL_FROM", "Open Strings <no-reply@example.com>")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "" if _is_production() else "http://localhost:3000").rstrip("/")


def email_configured() -> bool:
    """True when reset emails can really be delivered (always true outside production)."""
    if not _is_production():
        return True
    return bool(RESEND_API_KEY and FRONTEND_URL)


async def send_email(to: str, subject: str, text: str) -> None:
    if not RESEND_API_KEY:
        if _is_production():
            # Never log the message: it carries a live reset link.
            logger.error("Email not sent: RESEND_API_KEY is not set (subject=%s)", subject)
        else:
            logger.info("Email (dev, not sent) to=%s subject=%s\n%s", to, subject, text)
        return
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={"from": MAIL_FROM, "to": [to], "subject": subject, "text": text},
        )
    if resp.status_code >= 400:
        # Never surface provider errors to the requester (it would leak whether the email exists)
        logger.error("Resend failed (%s): %s", resp.status_code, resp.text[:300])


async def send_password_reset(to: str, token: str, minutes_valid: int) -> None:
    link = f"{FRONTEND_URL}/reset-password?token={token}"
    await send_email(
        to,
        "Reset your Open Strings password",
        (
            "Someone asked to reset the password for this account.\n\n"
            f"Reset it here (valid for {minutes_valid} minutes):\n{link}\n\n"
            "If this wasn't you, ignore this email; your password won't change."
        ),
    )
