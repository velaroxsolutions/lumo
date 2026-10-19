"""Push/pull sync with last-write-wins per field (F12.7).

A change is {tbl, id, op: 'upsert'|'delete', ts, fields, full}. For an
upsert, each field is kept only if its timestamp is at least as new as the
one the server already holds for that field — so two devices editing
different fields of the same task both win.

Deletes are last-write-wins too, at row level:
  • a delete older than the row's newest field edit loses (the row survives,
    and its seq is bumped so the deleting device pulls it back);
  • a tombstone is revived only by a newer *full* row (an insert), e.g. a task
    un-planned and then planned again under the same date-based id. A partial
    edit can't resurrect a half-empty row.

Every accepted write bumps the user's sequence number; a pull returns rows
whose seq is past the client's cursor, so each device only downloads what
changed since it last looked.
"""

import json
import re
from datetime import datetime, timedelta, timezone

import config
import db
from authn import now_iso

FIELD_RE = re.compile(r"^[a-z_]{1,40}$")
ID_RE = re.compile(r"^[A-Za-z0-9_\-:.]{1,64}$")


class SyncError(Exception):
    pass


def _clamp_ts(ts: str) -> str:
    """Parse an ISO timestamp and clamp it to server time + allowed skew."""
    try:
        t = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError as e:
        raise SyncError(f"bad timestamp {ts!r}") from e
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    ceiling = datetime.now(timezone.utc) + timedelta(seconds=config.CLOCK_SKEW_SECONDS)
    t = min(t.astimezone(timezone.utc), ceiling)
    return t.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _check_value(v):
    if v is None or isinstance(v, (bool, int, float)):
        return v
    if isinstance(v, str):
        if len(v) > config.MAX_TEXT_LEN:
            raise SyncError("value too long")
        return v
    raise SyncError("values must be text, numbers, booleans or null")


def validate(change: dict) -> dict:
    tbl = change.get("tbl")
    if tbl not in config.SYNC_TABLES:
        raise SyncError(f"unknown table {tbl!r}")
    rid = change.get("id")
    if not isinstance(rid, str) or not ID_RE.match(rid):
        raise SyncError("bad id")
    op = change.get("op")
    if op not in ("upsert", "delete"):
        raise SyncError("bad op")
    fields = change.get("fields") or {}
    if not isinstance(fields, dict) or len(fields) > config.MAX_FIELDS_PER_ROW:
        raise SyncError("bad fields")
    clean = {}
    for k, v in fields.items():
        if not FIELD_RE.match(k) or k == "id":
            raise SyncError(f"bad field {k!r}")
        clean[k] = _check_value(v)
    full = bool(change.get("full")) and op == "upsert"
    return {"tbl": tbl, "id": rid, "op": op, "ts": _clamp_ts(change.get("ts")), "fields": clean, "full": full}


def _next_seq(conn, user_id: str) -> int:
    conn.execute("INSERT OR IGNORE INTO counters (user_id, seq) VALUES (?, 0)", (user_id,))
    conn.execute("UPDATE counters SET seq = seq + 1 WHERE user_id = ?", (user_id,))
    return conn.execute("SELECT seq FROM counters WHERE user_id = ?", (user_id,)).fetchone()["seq"]


def merge(conn, user_id: str, c: dict) -> bool:
    """Apply one validated change. Returns True if anything was stored."""
    row = conn.execute(
        "SELECT * FROM records WHERE user_id = ? AND tbl = ? AND id = ?", (user_id, c["tbl"], c["id"])
    ).fetchone()

    if c["op"] == "delete":
        if row and row["deleted"]:
            return False
        if row:
            newest = max(json.loads(row["field_ts"]).values(), default="")
            if c["ts"] < newest:
                # A newer edit wins. Bump seq so the deleting device gets the row back.
                conn.execute(
                    "UPDATE records SET seq = ?, updated_at = ? WHERE user_id = ? AND tbl = ? AND id = ?",
                    (_next_seq(conn, user_id), now_iso(), user_id, c["tbl"], c["id"]),
                )
                return True
        seq = _next_seq(conn, user_id)
        if row:
            conn.execute(
                "UPDATE records SET deleted = 1, deleted_ts = ?, data = '{}', field_ts = '{}', seq = ?, updated_at = ? "
                "WHERE user_id = ? AND tbl = ? AND id = ?",
                (c["ts"], seq, now_iso(), user_id, c["tbl"], c["id"]),
            )
        else:
            conn.execute(
                "INSERT INTO records (user_id, tbl, id, data, field_ts, deleted, deleted_ts, seq, updated_at) "
                "VALUES (?, ?, ?, '{}', '{}', 1, ?, ?, ?)",
                (user_id, c["tbl"], c["id"], c["ts"], seq, now_iso()),
            )
        return True

    revive = False
    if row and row["deleted"]:
        if not (c["full"] and c["ts"] > (row["deleted_ts"] or "")):
            return False
        revive = True
    data = json.loads(row["data"]) if row and not revive else {}
    field_ts = json.loads(row["field_ts"]) if row and not revive else {}
    changed = False
    for k, v in c["fields"].items():
        if k not in field_ts or c["ts"] >= field_ts[k]:
            if k not in data or data[k] != v or field_ts.get(k) != c["ts"]:
                changed = True
            data[k] = v
            field_ts[k] = c["ts"]
    if not changed:
        return False
    seq = _next_seq(conn, user_id)
    if row:
        conn.execute(
            "UPDATE records SET data = ?, field_ts = ?, deleted = 0, deleted_ts = NULL, seq = ?, updated_at = ? "
            "WHERE user_id = ? AND tbl = ? AND id = ?",
            (json.dumps(data), json.dumps(field_ts), seq, now_iso(), user_id, c["tbl"], c["id"]),
        )
    else:
        conn.execute(
            "INSERT INTO records (user_id, tbl, id, data, field_ts, deleted, seq, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
            (user_id, c["tbl"], c["id"], json.dumps(data), json.dumps(field_ts), seq, now_iso()),
        )
    return True


def push(user_id: str, changes: list) -> dict:
    if not isinstance(changes, list) or len(changes) > config.MAX_CHANGES_PER_PUSH:
        raise SyncError(f"send at most {config.MAX_CHANGES_PER_PUSH} changes per push")
    valid = [validate(c) for c in changes]  # all-or-nothing: validate before writing
    applied = 0
    with db.tx() as conn:
        for c in valid:
            applied += 1 if merge(conn, user_id, c) else 0
        cursor = conn.execute("SELECT seq FROM counters WHERE user_id = ?", (user_id,)).fetchone()
    return {"accepted": len(valid), "applied": applied, "cursor": cursor["seq"] if cursor else 0}


def pull(user_id: str, since: int, limit: int) -> dict:
    limit = max(1, min(limit, config.MAX_PULL_PAGE))
    with db.read() as conn:
        rows = conn.execute(
            "SELECT tbl, id, data, deleted, seq FROM records WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?",
            (user_id, since, limit + 1),
        ).fetchall()
    more = len(rows) > limit
    rows = rows[:limit]
    return {
        "changes": [
            {"tbl": r["tbl"], "id": r["id"], "deleted": bool(r["deleted"]), "data": json.loads(r["data"])}
            for r in rows
        ],
        "cursor": rows[-1]["seq"] if rows else since,
        "more": more,
    }


def export(user_id: str) -> dict:
    out = {t: [] for t in config.SYNC_TABLES}
    with db.read() as conn:
        for r in conn.execute(
            "SELECT tbl, id, data FROM records WHERE user_id = ? AND deleted = 0 ORDER BY tbl, id", (user_id,)
        ):
            out[r["tbl"]].append({"id": r["id"], **json.loads(r["data"])})
    return out
