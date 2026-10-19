"""Outgoing email with stdlib smtplib (the Cadence convention). Only used
for password-reset codes.

Configure SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM.
For local development set LUMO_MAIL=log to print messages to the server
log instead of sending them. With neither, nothing is sent and a warning
is logged — the API still answers the same way so it can't be used to
probe which emails have accounts.
"""

import logging
import os
import smtplib
from email.message import EmailMessage

log = logging.getLogger("lumo.notify")


def configured() -> bool:
    return bool(os.environ.get("SMTP_HOST")) or os.environ.get("LUMO_MAIL") == "log"


def send(to: str, subject: str, body: str) -> bool:
    if os.environ.get("LUMO_MAIL") == "log":
        log.warning("LUMO_MAIL=log — email to %s: %s\n%s", to, subject, body)
        return True
    host = os.environ.get("SMTP_HOST")
    if not host:
        log.warning("No SMTP configured; dropped email to %s (%s)", to, subject)
        return False
    msg = EmailMessage()
    msg["From"] = os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "lumo@localhost"))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    port = int(os.environ.get("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=15) as s:
        if port != 25:
            s.starttls()
        user = os.environ.get("SMTP_USER")
        if user:
            s.login(user, os.environ.get("SMTP_PASS", ""))
        s.send_message(msg)
    return True
