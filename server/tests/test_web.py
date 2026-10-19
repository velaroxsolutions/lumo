import importlib

import pytest


@pytest.fixture
def web_client(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    (dist / "_expo").mkdir(parents=True)
    (dist / "index.html").write_text("<html>lumo app</html>")
    (dist / "_expo" / "app.js").write_text("console.log('hi')")
    import config

    monkeypatch.setattr(config, "FRONTEND_DIST", str(dist))
    import main

    importlib.reload(main)
    from fastapi.testclient import TestClient

    with TestClient(main.app) as c:
        yield c
    monkeypatch.setattr(config, "FRONTEND_DIST", "")
    importlib.reload(main)


def test_serves_app_with_isolation_headers(web_client):
    r = web_client.get("/")
    assert r.status_code == 200 and "lumo app" in r.text
    assert r.headers["cross-origin-opener-policy"] == "same-origin"
    assert r.headers["cross-origin-embedder-policy"] == "credentialless"


def test_deep_links_fall_back_to_the_app(web_client):
    r = web_client.get("/goals")
    assert r.status_code == 200 and "lumo app" in r.text


def test_missing_assets_still_404(web_client):
    assert web_client.get("/_expo/missing.js").status_code == 404
    assert web_client.get("/_expo/app.js").status_code == 200


def test_api_routes_win_and_skip_page_headers(web_client):
    r = web_client.get("/health")
    assert r.json() == {"ok": True}
    assert "cross-origin-opener-policy" not in r.headers
    assert web_client.get("/sync/pull").status_code == 401  # API, not the SPA fallback
