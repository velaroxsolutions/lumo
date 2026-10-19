"""The honest metric (spec §0, principle 5): % of users who plan a day in
week 4. A user counts when they closed a day (completed the evening ritual)
during days 21–27 after signing up. Only users at least 28 days old are in
the cohort, so a young user can't drag the rate down for not having a week 4
yet. Computed from synced data — no tracking beyond what sync already holds.
"""

import json
from datetime import date, datetime, timedelta, timezone

import db


def _to_date(iso: str) -> date:
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).date()


def week4_planning(today: date | None = None) -> dict:
    today = today or datetime.now(timezone.utc).date()
    cohort = 0
    retained = 0
    with db.read() as conn:
        users = conn.execute("SELECT id, created_at FROM users").fetchall()
        for u in users:
            start = _to_date(u["created_at"])
            if (today - start).days < 28:
                continue
            cohort += 1
            lo, hi = (start + timedelta(days=21)).isoformat(), (start + timedelta(days=27)).isoformat()
            for r in conn.execute(
                "SELECT data FROM records WHERE user_id = ? AND tbl = 'day_plans' AND deleted = 0", (u["id"],)
            ):
                d = json.loads(r["data"])
                if d.get("closed_at") and lo <= (d.get("date") or "") <= hi:
                    retained += 1
                    break
    return {
        "metric": "planned_a_day_in_week_4",
        "cohort": cohort,
        "retained": retained,
        "rate": round(retained / cohort, 4) if cohort else None,
        "users_total": len(users),
    }
