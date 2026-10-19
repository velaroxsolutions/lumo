from datetime import datetime, timedelta, timezone

from conftest import signup


def ts(minutes=0):
    t = datetime.now(timezone.utc) - timedelta(hours=1) + timedelta(minutes=minutes)
    return t.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def up(tbl, id, t, **fields):
    return {"tbl": tbl, "id": id, "op": "upsert", "ts": t, "fields": fields}


def pull_all(client, h, since=0):
    r = client.get(f"/sync/pull?since={since}", headers=h).json()
    return {(c["tbl"], c["id"]): c for c in r["changes"]}, r["cursor"]


def test_push_then_pull_round_trip(client):
    h = signup(client)
    r = client.post("/sync/push", headers=h, json={"changes": [
        up("areas", "a1", ts(), name="Academics", color="#FFC53D", sort_order=0, archived=0),
        up("tasks", "t1", ts(), area_id="a1", title="Lab report", estimated_minutes=60, status="backlog"),
    ]}).json()
    assert r["applied"] == 2
    rows, cursor = pull_all(client, h)
    assert rows[("tasks", "t1")]["data"]["title"] == "Lab report"
    assert cursor == r["cursor"]
    rows2, _ = pull_all(client, h, since=cursor)
    assert rows2 == {}  # nothing new since the cursor


def test_last_write_wins_per_field(client):
    h = signup(client)
    client.post("/sync/push", headers=h, json={"changes": [up("tasks", "t1", ts(0), title="Old", status="backlog")]})
    # Device B renames at minute 5; device A (offline) completes at minute 3 but pushes later.
    client.post("/sync/push", headers=h, json={"changes": [up("tasks", "t1", ts(5), title="New title")]})
    client.post("/sync/push", headers=h, json={"changes": [up("tasks", "t1", ts(3), status="done", title="Stale")]})
    data = pull_all(client, h)[0][("tasks", "t1")]["data"]
    assert data["title"] == "New title"  # newer rename kept
    assert data["status"] == "done"  # independent field still lands


def test_future_clock_is_clamped(client):
    h = signup(client)
    future = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat().replace("+00:00", "Z")
    client.post("/sync/push", headers=h, json={"changes": [up("tasks", "t1", future, title="From the future")]})
    later = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat().replace("+00:00", "Z")
    client.post("/sync/push", headers=h, json={"changes": [up("tasks", "t1", later, title="Honest edit")]})
    assert pull_all(client, h)[0][("tasks", "t1")]["data"]["title"] == "Honest edit"


def delete(tbl, id, t):
    return {"tbl": tbl, "id": id, "op": "delete", "ts": t}


def full(tbl, id, t, **fields):
    return {**up(tbl, id, t, **fields), "full": True}


def test_delete_pulls_as_tombstone_and_partial_edits_cannot_revive(client):
    h = signup(client)
    client.post("/sync/push", headers=h, json={"changes": [full("plan_items", "p1", ts(0), outcome="pending")]})
    _, cursor = pull_all(client, h)
    client.post("/sync/push", headers=h, json={"changes": [delete("plan_items", "p1", ts(1))]})
    client.post("/sync/push", headers=h, json={"changes": [up("plan_items", "p1", ts(2), outcome="done")]})
    rows, _ = pull_all(client, h, since=cursor)
    assert rows[("plan_items", "p1")]["deleted"] is True
    assert rows[("plan_items", "p1")]["data"] == {}


def test_newer_full_insert_revives_a_tombstone(client):
    h = signup(client)
    client.post("/sync/push", headers=h, json={"changes": [full("plan_items", "pi-x", ts(0), outcome="pending", sort_order=0)]})
    client.post("/sync/push", headers=h, json={"changes": [delete("plan_items", "pi-x", ts(1))]})
    client.post("/sync/push", headers=h, json={"changes": [full("plan_items", "pi-x", ts(0.5), outcome="stale")]})
    assert pull_all(client, h)[0][("plan_items", "pi-x")]["deleted"] is True  # older insert can't revive
    client.post("/sync/push", headers=h, json={"changes": [full("plan_items", "pi-x", ts(2), outcome="pending", sort_order=3)]})
    row = pull_all(client, h)[0][("plan_items", "pi-x")]
    assert row["deleted"] is False and row["data"] == {"outcome": "pending", "sort_order": 3}


def test_stale_delete_loses_to_newer_edit(client):
    h = signup(client)
    client.post("/sync/push", headers=h, json={"changes": [full("tasks", "t1", ts(0), title="Draft")]})
    client.post("/sync/push", headers=h, json={"changes": [up("tasks", "t1", ts(5), title="Edited on phone")]})
    _, cursor = pull_all(client, h)
    client.post("/sync/push", headers=h, json={"changes": [delete("tasks", "t1", ts(3))]})  # laptop, offline, older
    rows, _ = pull_all(client, h, since=cursor)
    assert rows[("tasks", "t1")]["deleted"] is False  # comes back to the laptop
    assert rows[("tasks", "t1")]["data"]["title"] == "Edited on phone"


def test_idempotent_push(client):
    h = signup(client)
    batch = {"changes": [up("goals", "g1", ts(), title="20 applications", target_value=20)]}
    assert client.post("/sync/push", headers=h, json=batch).json()["applied"] == 1
    assert client.post("/sync/push", headers=h, json=batch).json()["applied"] == 0


def test_pagination(client):
    h = signup(client)
    client.post("/sync/push", headers=h, json={"changes": [up("tasks", f"t{i}", ts(), title=str(i)) for i in range(25)]})
    seen, since, pages = set(), 0, 0
    while True:
        r = client.get(f"/sync/pull?since={since}&limit=10", headers=h).json()
        seen |= {c["id"] for c in r["changes"]}
        since, pages = r["cursor"], pages + 1
        if not r["more"]:
            break
    assert len(seen) == 25 and pages == 3


def test_users_are_isolated(client):
    a = signup(client, "a@x.co")
    b = signup(client, "b@x.co")
    client.post("/sync/push", headers=a, json={"changes": [up("tasks", "t1", ts(), title="A's secret")]})
    client.post("/sync/push", headers=b, json={"changes": [up("tasks", "t1", ts(), title="B's own")]})
    assert pull_all(client, a)[0][("tasks", "t1")]["data"]["title"] == "A's secret"
    assert pull_all(client, b)[0][("tasks", "t1")]["data"]["title"] == "B's own"


def test_rejects_bad_input(client):
    h = signup(client)
    bad = [
        up("users", "x", ts(), email="steal"),
        up("tasks", "x", ts(), **{"title; DROP": "x"}),
        up("tasks", "../x", ts(), title="x"),
        up("tasks", "x", "not-a-date", title="x"),
        up("tasks", "x", ts(), title={"nested": True}),
    ]
    for change in bad:
        assert client.post("/sync/push", headers=h, json={"changes": [change]}).status_code == 400
    # a bad change rejects the whole batch
    r = client.post("/sync/push", headers=h, json={"changes": [up("tasks", "ok", ts(), title="fine"), bad[0]]})
    assert r.status_code == 400
    assert pull_all(client, h)[0] == {}


def test_export_and_delete_account(client):
    h = signup(client)
    client.post("/sync/push", headers=h, json={"changes": [
        up("tasks", "t1", ts(), title="Keep"), up("tasks", "t2", ts(), title="Gone"),
        {"tbl": "tasks", "id": "t2", "op": "delete", "ts": ts(1)},
    ]})
    ex = client.get("/account/export", headers=h).json()
    assert [t["title"] for t in ex["data"]["tasks"]] == ["Keep"]
    assert client.post("/account/delete", headers=h, json={"password": "wrong"}).status_code == 401
    assert client.post("/account/delete", headers=h, json={"password": "correct horse"}).status_code == 200
    assert client.get("/auth/me", headers=h).status_code == 401
    h2 = signup(client)  # email is free again, and starts empty
    assert pull_all(client, h2)[0] == {}
