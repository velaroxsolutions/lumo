"""lumo sync server. The app is local-first: this is a backup and a bridge
between devices, never a blocker for the UI.

Run: uvicorn main:app --port 8000   (from server/)
"""

from contextlib import asynccontextmanager
import hmac

from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import BaseModel, Field

import authn
import config
import db
import metrics
import sync


@asynccontextmanager
async def lifespan(_app):
    db.init_db()
    yield


app = FastAPI(title="lumo", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Admin-Token"],
)


@app.exception_handler(authn.AuthError)
async def _auth_error(_req, exc: authn.AuthError):
    return JSONResponse({"detail": exc.message}, status_code=exc.status)


@app.exception_handler(sync.SyncError)
async def _sync_error(_req, exc: sync.SyncError):
    return JSONResponse({"detail": str(exc)}, status_code=400)


def bearer(authorization: str | None = Header(default=None)) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


def current_user(token: str | None = Depends(bearer)):
    return authn.user_for_token(token)


# ---- models -----------------------------------------------------------------

class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=256)
    device_id: str | None = Field(default=None, max_length=64)


class PushBody(BaseModel):
    device_id: str | None = Field(default=None, max_length=64)
    changes: list[dict]


class ResetRequestBody(BaseModel):
    email: str = Field(max_length=254)


class ResetConfirmBody(BaseModel):
    email: str = Field(max_length=254)
    code: str = Field(max_length=12)
    password: str = Field(max_length=256)
    device_id: str | None = Field(default=None, max_length=64)


class DeleteBody(BaseModel):
    password: str = Field(max_length=256)


# ---- routes -----------------------------------------------------------------

@app.get("/health")
def health():
    return {"ok": True}


@app.post("/auth/signup")
def signup(body: Credentials):
    return authn.signup(body.email, body.password, body.device_id)


@app.post("/auth/login")
def login(body: Credentials, request: Request):
    client = request.client.host if request.client else "?"
    return authn.login(body.email, body.password, body.device_id, client)


@app.post("/auth/reset/request")
def reset_request(body: ResetRequestBody):
    authn.request_reset(body.email)
    # Same answer whether or not the account exists.
    return {"ok": True}


@app.post("/auth/reset/confirm")
def reset_confirm(body: ResetConfirmBody):
    return authn.confirm_reset(body.email, body.code, body.password, body.device_id)


@app.post("/auth/logout")
def logout(token: str | None = Depends(bearer), _user=Depends(current_user)):
    authn.logout(token)
    return {"ok": True}


@app.get("/auth/me")
def me(user=Depends(current_user)):
    return {"id": user["id"], "email": user["email"]}


@app.post("/sync/push")
def push(body: PushBody, user=Depends(current_user)):
    return sync.push(user["id"], body.changes)


@app.get("/sync/pull")
def pull(since: int = Query(default=0, ge=0), limit: int = Query(default=500, ge=1), user=Depends(current_user)):
    return sync.pull(user["id"], since, limit)


# F12.9 — your data is yours: export it, or delete the account and everything in it.
@app.get("/account/export")
def export(user=Depends(current_user)):
    return {"account": {"email": user["email"], "created_at": user["created_at"]}, "data": sync.export(user["id"])}


@app.post("/account/delete")
def delete_account(body: DeleteBody, user=Depends(current_user)):
    authn.delete_account(user["id"], body.password)
    return {"ok": True}


@app.get("/admin/metrics")
def admin_metrics(x_admin_token: str | None = Header(default=None)):
    if not config.ADMIN_TOKEN:
        raise HTTPException(status_code=404)
    if not x_admin_token or not hmac.compare_digest(x_admin_token, config.ADMIN_TOKEN):
        raise HTTPException(status_code=403)
    return metrics.week4_planning()


# ---- the web app, same origin (optional) -------------------------------------
# expo-sqlite on the web needs cross-origin isolation (SharedArrayBuffer), so
# the app's pages carry COOP/COEP. API responses are left alone.

API_PREFIXES = ("/health", "/auth", "/sync", "/account", "/admin", "/docs", "/openapi.json", "/redoc")


@app.middleware("http")
async def isolation_headers(request: Request, call_next):
    response = await call_next(request)
    if config.FRONTEND_DIST and not request.url.path.startswith(API_PREFIXES):
        response.headers["Cross-Origin-Embedder-Policy"] = "credentialless"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    return response


class AppFiles(StaticFiles):
    """Static files with a single-page-app fallback: /goals or /ritual on a
    hard refresh gets index.html, and the client router takes it from there."""

    async def get_response(self, path, scope):
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as e:  # FastAPI's HTTPException is a subclass; catch the base
            if e.status_code != 404 or Path(path).suffix:
                raise
            return await super().get_response("index.html", scope)
        if response.status_code == 404 and not Path(path).suffix:  # html mode served a 404.html
            return await super().get_response("index.html", scope)
        return response


if config.FRONTEND_DIST and Path(config.FRONTEND_DIST, "index.html").exists():
    app.mount("/", AppFiles(directory=config.FRONTEND_DIST, html=True), name="web")
