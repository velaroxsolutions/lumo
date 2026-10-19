import json
from datetime import date, timedelta

import db
import metrics


def add_user(uid, created: date, closed_days=()):
    with db.tx() as conn:
        conn.execute("INSERT INTO users VALUES (?, ?, 'x', ?)", (uid, f"{uid}@x.co", f"{created.isoformat()}T12:00:00.000Z"))
        for i, d in enumerate(closed_days):
            conn.execute(
                "INSERT INTO records (user_id, tbl, id, data, field_ts, deleted, seq, updated_at) VALUES (?, 'day_plans', ?, ?, '{}', 0, ?, 'x')",
                (uid, f"{uid}-p{i}", json.dumps({"date": d.isoformat(), "closed_at": "x"}), i + 1),
            )


def test_week4_planning_rate():
    today = date(2026, 10, 19)
    start = today - timedelta(days=40)
    add_user("kept", start, [start + timedelta(days=1), start + timedelta(days=23)])
    add_user("lapsed", start, [start + timedelta(days=1), start + timedelta(days=2)])
    add_user("fresh", today - timedelta(days=5), [today - timedelta(days=1)])  # not in cohort yet
    m = metrics.week4_planning(today)
    assert (m["cohort"], m["retained"], m["rate"]) == (2, 1, 0.5)


def test_admin_endpoint_is_hidden_without_token(client, monkeypatch):
    import config

    assert client.get("/admin/metrics").status_code == 404
    monkeypatch.setattr(config, "ADMIN_TOKEN", "s3cret")
    assert client.get("/admin/metrics", headers={"X-Admin-Token": "nope"}).status_code == 403
    assert client.get("/admin/metrics", headers={"X-Admin-Token": "s3cret"}).json()["cohort"] == 0
