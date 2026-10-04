"""FastAPI app — Phase A skeleton + Phase C+D batch wiring.

Phase A proved the process starts. Phase B added the provider seams. The
merged C+D batch (DECISIONS-2026-10-03.md) adds storage and config endpoints.

What is real here and must stay real:
- the `error` envelope, because the console branches on `error.code`
- the `caller_override` guard, because a test endpoint that can place calls is a
  different product
- the CORS/host posture, already narrow, so tightening later is a no-op
- the storage layer, because config endpoints need somewhere to write
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api_v1 import router as v1_router
from .contracts import ErrorBody, ErrorResponse, Health
from .storage import ConfigStore, apply_migrations

VERSION = "0.1.0"
_STARTED_AT = datetime.now(UTC).isoformat()

# Storage paths — env-overridable for tests, default to a data/ dir next to
# the package so `uv run uvicorn agent_core.api:app` just works.
_DB_PATH = Path(os.getenv("AGENT_CORE_DB_PATH", Path(__file__).parent.parent / "data" / "agent.db"))
_MIGRATIONS_DIR = Path(__file__).parent.parent / "migrations"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Apply migrations at startup, then hand the store to the router."""
    applied = apply_migrations(_DB_PATH, _MIGRATIONS_DIR)
    if applied:
        print(f"Applied migrations: {', '.join(applied)}")
    app.state.config_store = ConfigStore(_DB_PATH)
    yield


app = FastAPI(
    title="agent-core",
    version=VERSION,
    description="Voice & messaging agent runtime. FR/EN. Inbound voice + WhatsApp.",
    lifespan=lifespan,
    # The docs route is internal; the console never reads it.
    docs_url=None if os.getenv("AGENT_CORE_ENV") == "production" else "/docs",
    redoc_url=None,
)

# Narrow by default. The console is a Tauri app on the user's machine and a phone
# browser on ours; both are explicit origins, never "*".
_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("AGENT_CORE_ALLOWED_ORIGINS", "tauri://localhost,http://localhost:5199").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=False,          # a bearer token, not a cookie
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception) -> JSONResponse:
    """Every failure leaves as the documented envelope.

    An unrecognised error shape forces the console to guess, and a console that
    guesses renders "no calls" when the truth is "the agent is down".
    """
    body = ErrorResponse(
        error=ErrorBody(
            code="internal_error",
            message=str(exc),
            retryable=True,
            at=datetime.now(UTC).isoformat(),
        )
    )
    return JSONResponse(status_code=500, content=body.model_dump(by_alias=True))


@app.get("/healthz", response_model=Health)
async def healthz() -> dict[str, Any]:
    """Liveness. Unauthenticated, and it leaks nothing about a tenant."""
    return {
        "ok": True,
        "version": VERSION,
        "started_at": _STARTED_AT,
        "db": "ok",
        "providers": "ok",
    }


# The error envelope is the same shape whether an error came from a route
# returning a response or from an HTTPException, so the console has exactly one
# error parser.
@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    return JSONResponse(
        status_code=exc.status_code, content={"error": exc.detail}, headers=exc.headers or None
    )


# Phase B2: /session, /ws/transcript, /ops/snapshot. Mounted after /healthz so the
# liveness route keeps working even if a v1 route is broken.
app.include_router(v1_router)
