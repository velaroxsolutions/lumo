import re

import pytest

import notify
from conftest import signup

sent = []


@pytest.fixture(autouse=True)
def capture_mail(monkeypatch):
    sent.clear()
    monkeypatch.setattr(notify, "send", lambda to, subject, body: sent.append((to, body)) or True)


def code_from_mail():
    return re.search(r"\b(\d{6})\b", sent[-1][1]).group(1)


def test_reset_flow_changes_password_and_ends_other_sessions(client):
    old = signup(client)
    assert client.post("/auth/reset/request", json={"email": "Maya@Example.com"}).json() == {"ok": True}
    assert sent and sent[-1][0] == "maya@example.com"
    r = client.post("/auth/reset/confirm", json={"email": "maya@example.com", "code": code_from_mail(), "password": "brand new pass"})
    assert r.status_code == 200
    assert client.get("/auth/me", headers=old).status_code == 401  # old session gone
    new = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get("/auth/me", headers=new).status_code == 200
    assert client.post("/auth/login", json={"email": "maya@example.com", "password": "correct horse"}).status_code == 401
    assert client.post("/auth/login", json={"email": "maya@example.com", "password": "brand new pass"}).status_code == 200


def test_unknown_email_gets_the_same_answer_and_no_mail(client):
    assert client.post("/auth/reset/request", json={"email": "nobody@example.com"}).json() == {"ok": True}
    assert sent == []


def test_wrong_codes_are_counted_and_limited(client):
    signup(client)
    client.post("/auth/reset/request", json={"email": "maya@example.com"})
    good = code_from_mail()
    wrong = "000000" if good != "000000" else "111111"
    for _ in range(5):
        r = client.post("/auth/reset/confirm", json={"email": "maya@example.com", "code": wrong, "password": "brand new pass"})
        assert r.status_code == 400
    # The right code no longer works after five misses.
    r = client.post("/auth/reset/confirm", json={"email": "maya@example.com", "code": good, "password": "brand new pass"})
    assert r.status_code == 400 and "expired" in r.json()["detail"]


def test_codes_are_single_use_and_rate_limited(client):
    signup(client)
    client.post("/auth/reset/request", json={"email": "maya@example.com"})
    client.post("/auth/reset/request", json={"email": "maya@example.com"})  # within cooldown: ignored
    assert len(sent) == 1
    code = code_from_mail()
    assert client.post("/auth/reset/confirm", json={"email": "maya@example.com", "code": code, "password": "brand new pass"}).status_code == 200
    assert client.post("/auth/reset/confirm", json={"email": "maya@example.com", "code": code, "password": "another one!"}).status_code == 400


def test_short_new_password_rejected(client):
    signup(client)
    client.post("/auth/reset/request", json={"email": "maya@example.com"})
    r = client.post("/auth/reset/confirm", json={"email": "maya@example.com", "code": code_from_mail(), "password": "short"})
    assert r.status_code == 400
