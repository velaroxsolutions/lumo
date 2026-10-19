"""Email + password auth with stdlib only (hashlib PBKDF2, secrets).
Session tokens are random; only their SHA-256 is stored."""

import base64
import hashlib
import hmac
import re
import secrets
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import config
import db
import notify

ITERATIONS = 310_000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 8


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    b64 = lambda b: base64.b64encode(b).decode()
    return f"pbkdf2_sha256${ITERATIONS}${b64(salt)}${b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt_b64, hash_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt_b64), int(iters))
        return hmac.compare_digest(digest, base64.b64decode(hash_b64))
    except (ValueError, TypeError):
        return False


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class AuthError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


# ---- login throttling (in-memory; per email and per client address) -------

_WINDOW = 15 * 60
_MAX_FAILS = 10
_fails: dict[str, deque] = defaultdict(deque)


def _throttled(key: str) -> bool:
    q = _fails[key]
    cutoff = time.monotonic() - _WINDOW
    while q and q[0] < cutoff:
        q.popleft()
    return len(q) >= _MAX_FAILS


def _record_fail(*keys: str):
    for k in keys:
        _fails[k].append(time.monotonic())


def reset_throttle():
    _fails.clear()


# ---- accounts ---------------------------------------------------------------

def signup(email: str, password: str, device_id: str | None):
    email = normalize_email(email)
    if not EMAIL_RE.match(email):
        raise AuthError(400, "That email doesn't look right.")
    if len(password or "") < MIN_PASSWORD:
        raise AuthError(400, f"Use at least {MIN_PASSWORD} characters.")
    user_id = uuid.uuid4().hex
    with db.tx() as conn:
        if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
            raise AuthError(409, "There's already an account with that email. Sign in instead.")
        conn.execute(
            "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (user_id, email, hash_password(password), now_iso()),
        )
        token = _new_session(conn, user_id, device_id)
    return {"token": token, "user": {"id": user_id, "email": email}}


def login(email: str, password: str, device_id: str | None, client: str = "?"):
    email = normalize_email(email)
    if _throttled(f"e:{email}") or _throttled(f"c:{client}"):
        raise AuthError(429, "Too many attempts. Try again in a few minutes.")
    with db.tx() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not row or not verify_password(password or "", row["password_hash"]):
            _record_fail(f"e:{email}", f"c:{client}")
            raise AuthError(401, "Email or password is wrong.")
        token = _new_session(conn, row["id"], device_id)
    return {"token": token, "user": {"id": row["id"], "email": row["email"]}}


def _new_session(conn, user_id: str, device_id: str | None) -> str:
    token = secrets.token_urlsafe(32)
    ts = now_iso()
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, device_id, created_at, last_seen) VALUES (?, ?, ?, ?, ?)",
        (token_hash(token), user_id, (device_id or "")[:64], ts, ts),
    )
    return token


def user_for_token(token: str | None):
    if not token:
        raise AuthError(401, "Sign in to sync.")
    h = token_hash(token)
    with db.tx() as conn:
        row = conn.execute(
            "SELECT s.last_seen, u.id, u.email, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id "
            "WHERE s.token_hash = ?",
            (h,),
        ).fetchone()
        if not row:
            raise AuthError(401, "Your session ended. Sign in again.")
        last = datetime.fromisoformat(row["last_seen"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - last > timedelta(days=config.SESSION_TTL_DAYS):
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (h,))
            raise AuthError(401, "Your session ended. Sign in again.")
        conn.execute("UPDATE sessions SET last_seen = ? WHERE token_hash = ?", (now_iso(), h))
    return {"id": row["id"], "email": row["email"], "created_at": row["created_at"]}


def logout(token: str):
    with db.tx() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))


def delete_account(user_id: str, password: str):
    with db.tx() as conn:
        row = conn.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row or not verify_password(password or "", row["password_hash"]):
            raise AuthError(401, "Password is wrong.")
        for table in ("records", "counters", "sessions", "password_resets"):
            conn.execute(f"DELETE FROM {table} WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


# ---- password reset (email a 6-digit code) ---------------------------------

RESET_TTL_MINUTES = 15
RESET_MAX_ATTEMPTS = 5
RESET_COOLDOWN_SECONDS = 60


def _code_hash(user_id: str, code: str) -> str:
    return hashlib.sha256(f"{user_id}:{code}".encode()).hexdigest()


def request_reset(email: str) -> None:
    """Always succeeds from the caller's point of view, whether or not the
    email has an account — the response must not reveal that."""
    email = normalize_email(email)
    now = datetime.now(timezone.utc)
    code = f"{secrets.randbelow(1_000_000):06d}"
    with db.tx() as conn:
        user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if not user:
            return
        prev = conn.execute("SELECT requested_at FROM password_resets WHERE user_id = ?", (user["id"],)).fetchone()
        if prev:
            last = datetime.fromisoformat(prev["requested_at"].replace("Z", "+00:00"))
            if (now - last).total_seconds() < RESET_COOLDOWN_SECONDS:
                return  # quietly ignore rapid repeats
        expires = (now + timedelta(minutes=RESET_TTL_MINUTES)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        conn.execute(
            "INSERT INTO password_resets (user_id, code_hash, expires_at, attempts, requested_at) VALUES (?, ?, ?, 0, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, "
            "attempts = 0, requested_at = excluded.requested_at",
            (user["id"], _code_hash(user["id"], code), expires, now_iso()),
        )
    notify.send(
        email,
        "Your lumo reset code",
        f"Your lumo password reset code is {code}.\n\nIt works for {RESET_TTL_MINUTES} minutes. "
        "If you didn't ask for this, you can ignore this email — your password hasn't changed.",
    )


def confirm_reset(email: str, code: str, new_password: str, device_id: str | None):
    email = normalize_email(email)
    if len(new_password or "") < MIN_PASSWORD:
        raise AuthError(400, f"Use at least {MIN_PASSWORD} characters.")
    # Decide inside the transaction, raise after it commits — otherwise the
    # failed-attempt counter would roll back and the attempt limit would
    # never bite.
    outcome = "bad"
    result = None
    with db.tx() as conn:
        user = conn.execute("SELECT id, email FROM users WHERE email = ?", (email,)).fetchone()
        r = conn.execute("SELECT * FROM password_resets WHERE user_id = ?", (user["id"],)).fetchone() if user else None
        if r:
            expired = datetime.fromisoformat(r["expires_at"].replace("Z", "+00:00")) < datetime.now(timezone.utc)
            if expired or r["attempts"] >= RESET_MAX_ATTEMPTS:
                conn.execute("DELETE FROM password_resets WHERE user_id = ?", (user["id"],))
                outcome = "expired"
            elif not hmac.compare_digest(r["code_hash"], _code_hash(user["id"], (code or "").strip())):
                conn.execute("UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = ?", (user["id"],))
            else:
                conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(new_password), user["id"]))
                conn.execute("DELETE FROM password_resets WHERE user_id = ?", (user["id"],))
                # Every other device is signed out; this one gets a fresh session.
                conn.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
                token = _new_session(conn, user["id"], device_id)
                result = {"token": token, "user": {"id": user["id"], "email": user["email"]}}
                outcome = "ok"
    if outcome == "expired":
        raise AuthError(400, "That code has expired. Ask for a new one.")
    if outcome != "ok":
        raise AuthError(400, "That code didn't work. Check it, or ask for a new one.")
    return result
