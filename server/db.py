"""stdlib sqlite3, no ORM. Migrations are additive: tables are created if
missing and new columns are added via PRAGMA table_info + ALTER TABLE.
Never drop the database.

The server stores the app's rows generically in `records` — one row per
(user, table, id) holding the row's fields as JSON plus a per-field timestamp
map for last-write-wins. App schema changes therefore never need a server
migration. Every table carries user_id from creation, so nothing ever joins
across users by accident.
"""

import sqlite3
from contextlib import contextmanager

import config

TABLES = {
    "users": {
        "id": "TEXT PRIMARY KEY NOT NULL",
        "email": "TEXT NOT NULL UNIQUE",
        "password_hash": "TEXT NOT NULL",
        "created_at": "TEXT NOT NULL",
    },
    "sessions": {
        "token_hash": "TEXT PRIMARY KEY NOT NULL",
        "user_id": "TEXT NOT NULL",
        "device_id": "TEXT",
        "created_at": "TEXT NOT NULL",
        "last_seen": "TEXT NOT NULL",
    },
    "records": {
        "user_id": "TEXT NOT NULL",
        "tbl": "TEXT NOT NULL",
        "id": "TEXT NOT NULL",
        "data": "TEXT NOT NULL DEFAULT '{}'",
        "field_ts": "TEXT NOT NULL DEFAULT '{}'",
        "deleted": "INTEGER NOT NULL DEFAULT 0",
        "deleted_ts": "TEXT",
        "seq": "INTEGER NOT NULL DEFAULT 0",
        "updated_at": "TEXT NOT NULL",
    },
    # Per-user change counter; pull cursors are positions in this sequence.
    "counters": {
        "user_id": "TEXT PRIMARY KEY NOT NULL",
        "seq": "INTEGER NOT NULL DEFAULT 0",
    },
}

CONSTRAINTS = {"records": ", PRIMARY KEY (user_id, tbl, id)"}

INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_records_user_seq ON records(user_id, seq)",
    "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)",
]


def connect():
    conn = sqlite3.connect(config.DB_PATH, isolation_level=None, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = connect()
    try:
        for table, cols in TABLES.items():
            # Composite keys can't be added later, so the base CREATE carries them.
            body = ", ".join(f"{c} {d}" for c, d in cols.items())
            conn.execute(f"CREATE TABLE IF NOT EXISTS {table} ({body}{CONSTRAINTS.get(table, '')})")
            have = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
            for col, decl in cols.items():
                if col not in have:
                    # SQLite can't ALTER-ADD a NOT NULL column without a default.
                    safe = decl.replace(" NOT NULL", "") if "DEFAULT" not in decl else decl
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {safe}")
        for stmt in INDEXES:
            conn.execute(stmt)
    finally:
        conn.close()


@contextmanager
def tx():
    """One write transaction. BEGIN IMMEDIATE takes the write lock up front so
    the per-user sequence counter can't be read by two writers at once."""
    conn = connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


@contextmanager
def read():
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
