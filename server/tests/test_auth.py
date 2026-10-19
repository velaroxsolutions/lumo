from conftest import signup


def test_signup_login_me_logout(client):
    h = signup(client)
    assert client.get("/auth/me", headers=h).json()["email"] == "maya@example.com"
    r = client.post("/auth/login", json={"email": " MAYA@example.com ", "password": "correct horse"})
    assert r.status_code == 200
    h2 = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.post("/auth/logout", headers=h2).status_code == 200
    assert client.get("/auth/me", headers=h2).status_code == 401
    assert client.get("/auth/me", headers=h).status_code == 200  # other session untouched


def test_validation_and_duplicates(client):
    assert client.post("/auth/signup", json={"email": "nope", "password": "longenough"}).status_code == 400
    assert client.post("/auth/signup", json={"email": "a@b.co", "password": "short"}).status_code == 400
    signup(client, "a@b.co")
    assert client.post("/auth/signup", json={"email": "A@b.co", "password": "longenough"}).status_code == 409


def test_wrong_password_and_throttle(client):
    signup(client)
    for _ in range(10):
        r = client.post("/auth/login", json={"email": "maya@example.com", "password": "wrong-wrong"})
        assert r.status_code == 401
    r = client.post("/auth/login", json={"email": "maya@example.com", "password": "correct horse"})
    assert r.status_code == 429


def test_password_is_hashed(client):
    import db

    signup(client)
    with db.read() as conn:
        stored = conn.execute("SELECT password_hash FROM users").fetchone()[0]
    assert "correct horse" not in stored and stored.startswith("pbkdf2_sha256$")


def test_no_token(client):
    assert client.get("/sync/pull").status_code == 401
    assert client.get("/sync/pull", headers={"Authorization": "Bearer junk"}).status_code == 401
