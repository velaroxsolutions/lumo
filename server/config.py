"""Environment knobs. Everything has a working local default."""

import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent))
DB_PATH = Path(os.environ.get("LUMO_DB", DATA_DIR / "lumo.db"))

CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:8081,http://localhost:19006").split(",")
    if o.strip()
]

# GET /admin/metrics is disabled (404) unless this is set.
ADMIN_TOKEN = os.environ.get("LUMO_ADMIN_TOKEN", "")

SESSION_TTL_DAYS = int(os.environ.get("SESSION_TTL_DAYS", "180"))

# Sync limits — generous for one person's planner, tight enough to stop abuse.
MAX_CHANGES_PER_PUSH = 500
MAX_PULL_PAGE = 1000
MAX_FIELDS_PER_ROW = 40
MAX_TEXT_LEN = 10_000

# A device whose clock runs ahead can't win every future conflict: incoming
# timestamps are clamped to server time plus this much skew.
CLOCK_SKEW_SECONDS = 120

# The tables the app syncs. Anything else is rejected.
SYNC_TABLES = ("areas", "goals", "rituals", "tasks", "day_plans", "plan_items", "settings")
