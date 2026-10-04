"""The three endpoints the console actually calls (Phase B2).

`/healthz` already exists in `api.py`. These are the rest, returning the exact
`contracts.py` shapes with **fixture data**, so the console can be built and run
against a real server before a single provider or carrier exists.

Two things are deliberately absent from this file, and their absence is the
design rather than an omission:
- **No tenant id** on any request or response. Identity is derived from the token
  server-side (`ADR-001` D4a). The dev mode below has a single implicit tenant and
  still does not name it in a payload.
- **No client frame that acts on a call.** The WS handler accepts `ping` and
  nothing else, and it *closes* on anything else rather than ignoring it. A frame
  that could transfer or hang up is a barge-in control wearing a disguise.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Request, WebSocket
from fastapi.responses import JSONResponse

from .contracts import (
    DISCLOSURE_FR,
    AlertEvidence,
    AlertItem,
    AlertListResponse,
    CallDetail,
    CallListItem,
    CallListResponse,
    CallState,
    ConfigResponse,
    ConfigUpdate,
    ErrorBody,
    ErrorResponse,
    MetaFrame,
    OpsAlert,
    OpsSnapshot,
    ProviderHealth,
    ProviderTier,
    SessionRequest,
    SessionResponse,
    Severity,
    StagesFrame,
    StateFrame,
    TranscriptDelta,
    TurnItem,
    VoiceLocale,
)
from .providers import ChainResult, ProviderConfig, Seam, run_chain
from .providers.base import REGISTRY, ChatMessage

router = APIRouter()

# Single-tenant dev config. In production this is loaded per tenant from the
# `tenants` table, and the provider NAMES live there — which is what makes a tier
# change a config change rather than a deploy.
DEV_CONFIG = ProviderConfig(
    chain={
        Seam.LLM: ("alpha", "beta"),
        Seam.TTS: ("alpha", "beta"),
        Seam.STT: ("alpha", "beta"),
        Seam.EMBEDDING: ("alpha",),
    },
    options={},
)

_SESSIONS: dict[str, dict[str, Any]] = {}


def _now() -> str:
    return datetime.now(UTC).isoformat()


# ── POST /session ───────────────────────────────────────────────────────────


@router.post("/session", response_model=SessionResponse, status_code=201)
async def create_session(body: SessionRequest) -> SessionResponse:
    """Start a session.

    `callerOverride` is rejected for a live session. Without that guard a test
    endpoint is a call-placement primitive, so the check lives in the contract
    (`assert_caller_allowed`) and is re-asserted here at the boundary.
    """
    try:
        body.assert_caller_allowed()
    except PermissionError:
        err = ErrorResponse(
            error=ErrorBody(
                code="caller_override_not_allowed",
                message="caller_override is only valid for purpose=test_call",
                retryable=False,
                at=_now(),
            )
        )
        # A returned JSONResponse keeps FastAPI's route-level `status_code=201`
        # ONLY if it is raised as an HTTPException. Returning it directly with a
        # 201-declared route silently produces 201 with a 403 body — the guard
        # would look present and enforce nothing.
        raise HTTPException(
            status_code=403,
            detail=err.model_dump(by_alias=True)["error"],
        ) from None

    session_id = f"01J{uuid.uuid4().hex[:20].upper()}"
    locale = VoiceLocale(body.locale)
    _SESSIONS[session_id] = {
        "opened_at": _now(),
        "channel": body.channel,
        "locale": locale,
        "purpose": body.purpose,
    }

    return SessionResponse(
        session_id=session_id,
        state=CallState.GREETING,
        opened_at=_now(),
        ws_url=f"/ws/transcript?session={session_id}",
        # Same French disclosure for both locales in v1: the disclosure is a
        # legal statement about the agent, not a translation. Revisit with counsel.
        disclosure=DISCLOSURE_FR,
    )


# ── WS /ws/transcript ────────────────────────────────────────────────────────


@router.websocket("/ws/transcript")
async def ws_transcript(ws: WebSocket) -> None:
    """Streaming transcript + state + stage marks.

    Auth happens at the upgrade handshake (header or subprotocol), never in the
    query string — query strings land in access logs, and a token in an access log
    is a leaked token.
    """
    token = ws.headers.get("authorization") or ""
    if not token:
        # 4401 is a close code, not an HTTP status: the handshake already
        # succeeded, so the refusal has to happen in the close frame.
        await ws.close(code=4401, reason="missing bearer token")
        return

    await ws.accept()

    async for raw in ws.iter_text():
        try:
            frame = json.loads(raw)
        except json.JSONDecodeError:
            await ws.close(code=4400, reason="malformed frame")
            return

        if frame.get("type") != "ping":
            # Ping is the ONLY accepted client frame. Closing (rather than
            # ignoring) makes an attempted control an error the client cannot
            # mistake for success.
            await ws.close(code=4403, reason="only ping is accepted")
            return
        await ws.send_text(json.dumps({"type": "pong", "at": _now()}))


# ── GET /ops/snapshot ────────────────────────────────────────────────────────


def _fixture_snapshot() -> OpsSnapshot:
    """One round trip, so the digest needs no second fetch to be *understood*."""
    now = datetime.now(UTC)
    return OpsSnapshot(
        generated_at=now.isoformat(),
        since=(now - timedelta(hours=6)).isoformat(),
        p1=[
            OpsAlert(
                id="a_01",
                severity=Severity.P1,
                rule="transfer_failed",
                one_liner=(
                    "Transfer failures — 6 in 20 min, target unreachable since 14:32 →"
                ),
                decision="Take 3 of these back yourself",
                evidence=AlertEvidence(
                    count=6,
                    first_at="14:32",
                    last_at="14:51",
                    blast_radius="this tenant",
                ),
                acknowledged_at=None,
                acknowledged_by=None,
                threshold_is_provisional=True,
            )
        ],
        p2_grouped={
            "latency": [
                OpsAlert(
                    id="a_11",
                    severity=Severity.P2,
                    rule="latency_turn_gap",
                    one_liner="turn_gap p95 1.8s over 15 min — STT is the regressing stage →",
                    decision="Check Deepgram latency p95; the chain has not failed over",
                    evidence=AlertEvidence(
                        count=34,
                        first_at="14:36",
                        last_at="14:51",
                        blast_radius="all voice calls",
                    ),
                    acknowledged_at=None,
                    acknowledged_by=None,
                    threshold_is_provisional=True,
                )
            ]
        },
        p3_count=2,
        call_count=128,
        contained_pct=79,
        reachable=True,
        last_seen_at=now.isoformat(),
    )


@router.get("/ops/snapshot", response_model=OpsSnapshot)
async def ops_snapshot() -> OpsSnapshot:
    return _fixture_snapshot()


@router.get("/ops/snapshot/dev", response_model=OpsSnapshot)
async def ops_snapshot_dev() -> JSONResponse:
    """Same payload including provider health, which the TS type carries.

    Kept separate so the production route stays the exact `OpsSnapshot` contract
    with no extra fields the console does not model.
    """
    snap = _fixture_snapshot()
    body = snap.model_dump(by_alias=True)
    body["providerHealth"] = [
        ProviderHealth(
            provider="Deepgram Nova",
            role="STT",
            error_rate=0.004,
            latency_p95_ms=410,
            fallback_active=False,
            state="ok",
        ).model_dump(by_alias=True),
        ProviderHealth(
            provider="Telnyx",
            role="telephony",
            error_rate=0.0,
            latency_p95_ms=None,
            fallback_active=False,
            state="degraded",
        ).model_dump(by_alias=True),
    ]
    return JSONResponse(content=body)


# ── The turn loop, exercised end-to-end through the chain ────────────────────


async def demo_turn(session_id: str) -> AsyncIterator[dict[str, Any]]:
    """One caller turn, rendered as the frames the console consumes.

    This is the shape the live view will subscribe to, produced from the real
    provider chain rather than from literals, so the console can be built against
    something that genuinely streams.
    """
    state = StateFrame(
        session_id=session_id, state=CallState.LISTENING, at=_now()
    )
    yield state.model_dump(by_alias=True)

    llm: ChainResult[str] = await run_chain(
        Seam.LLM,
        DEV_CONFIG,
        lambda p: p.complete(
            [ChatMessage(role="user", content="Je voudrais un rendez-vous.")]
        ),
    )
    answer: str = llm.value[0]

    yield TranscriptDelta(
        call_id=session_id,
        turn_id=1,
        seq=1,
        role="caller",
        text="Je voudrais un rendez-vous.",
        final=True,
        at=_now(),
    ).model_dump(by_alias=True)

    yield StagesFrame(
        call_id=session_id, turn_id=1, vad_ms=180, stt_ms=340, llm_ms=260,
        tts_ms=140, turn_gap_ms=1520, at=_now(),
    ).model_dump(by_alias=True)

    yield TranscriptDelta(
        call_id=session_id, turn_id=2, seq=2, role="agent",
        text=answer, final=True, at=_now(),
    ).model_dump(by_alias=True)

    yield MetaFrame(
        call_id=session_id, locale=VoiceLocale.FR,
        fallback_active=llm.fallback_active, chain_tier=ProviderTier.STANDARD,
    ).model_dump(by_alias=True)


@router.get("/session/{session_id}/demo-turn")
async def demo_turn_endpoint(session_id: str) -> list[dict[str, Any]]:
    """The frame list as JSON, for a client that is not a socket.

    The console's live view uses the WS; this exists so the same turn can be
    asserted in a test without a socket, and so a human can read one turn.
    """
    return [f async for f in demo_turn(session_id)]


@router.get("/providers/registry")
async def providers_registry() -> dict[str, Any]:
    """What is registered and which chain is configured.

    Read-only, and deliberately exposes names rather than any credential. The
    Settings > Providers screen is a view of this endpoint.
    """
    return {
        "registered": {seam.value: list(REGISTRY.names(seam)) for seam in Seam},
        "chain": {seam.value: list(DEV_CONFIG.chain_for(seam)) for seam in Seam},
        "fixture_data": True,
    }


# ── GET /config · PUT /config ────────────────────────────────────────────────
#
# First endpoint group in the merged C+D batch (DECISIONS-2026-10-03.md §1).
# Config is a singleton row (id=1) in agent_config. GET returns the current
# state; PUT replaces it wholesale. Only known fields are written; unknown keys
# are silently dropped.
#
# Never in this payload: credentials (they live in `.env` on the server) and
# persona data (§3.4). `configured` flags in `channels` are derived from .env
# at read time, never stored.


def _config_store(request: Request) -> Any:
    """Get the ConfigStore from app.state, or 500 if storage isn't wired."""
    store = getattr(request.app.state, "config_store", None)
    if store is None:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "storage_unavailable",
                "message": "config store not initialized",
                "retryable": True,
                "at": _now(),
            },
        )
    return store


def _derive_channel_flags(stored: dict[str, Any]) -> dict[str, Any]:
    """Overlay the SERVER's view of `configured` onto the stored channel flags.

    `enabled` is the client's intent (stored). `configured` is what the server
    can actually see in its environment (derived, never stored). The two are
    separate because a client enabling a channel it has no credentials for is a
    normal state the UI must show — and a stored `configured` would be a fake
    success the moment credentials were removed.
    """
    from .channels import ADAPTERS

    merged = {k: dict(v) for k, v in (stored or {}).items()}
    for kind, adapter_cls in ADAPTERS.items():
        cap = adapter_cls().capabilities()
        entry = merged.setdefault(kind.value, {})
        entry["enabled"] = bool(entry.get("enabled", False))
        entry["configured"] = cap.configured
        if not cap.configured and cap.reason:
            entry["reason"] = cap.reason
        else:
            entry.pop("reason", None)
    return merged


@router.get("/config", response_model=ConfigResponse)
async def get_config(request: Request) -> ConfigResponse:
    """Return the current agent configuration.

    `channels[*].configured` is DERIVED from the server's environment here, not
    read from storage — the stored value would go stale the moment a credential
    was removed, and a stale `configured: true` is exactly the fake success the
    design forbids.
    """
    store = _config_store(request)
    data = store.get()
    data["channels"] = _derive_channel_flags(data.get("channels", {}))
    return ConfigResponse.model_validate(data)


@router.put("/config", response_model=ConfigResponse)
async def put_config(body: ConfigUpdate, request: Request) -> ConfigResponse:
    """Replace the config. Only known fields are written.

    Unknown keys are silently dropped — a PUT that accepts arbitrary keys is a
    PUT that can corrupt state.
    """
    store = _config_store(request)
    updates = body.model_dump(exclude_unset=True, by_alias=True)
    # Convert camelCase keys to snake_case for the store
    snake = {_camel_to_snake(k): v for k, v in updates.items()}
    result = store.put(snake)
    # Same derivation as GET: the client never writes `configured`.
    result["channels"] = _derive_channel_flags(result.get("channels", {}))
    return ConfigResponse.model_validate(result)


def _camel_to_snake(name: str) -> str:
    """Convert camelCase to snake_case for DB column names."""
    out = []
    for i, ch in enumerate(name):
        if ch.isupper() and i > 0:
            out.append("_")
        out.append(ch.lower())
    return "".join(out)


# ── GET /calls · GET /calls/{id} · GET /alerts ───────────────────────────────
#
# Batch step 3: the endpoints the Calls / Live / Ops tabs read. Migrations
# landed with them (0006_turns_alerts.sql). Real rows from the real schema —
# the console builds against a server, not against fixtures.
#
# There is no `POST /calls` and no write route: calls are created by channels
# (batch step 4), not by a client. A client that could create a call could
# fabricate a contained call, which is the pilot's headline metric.


def _call_store(request: Request) -> Any:
    store = getattr(request.app.state, "call_store", None)
    if store is None:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "storage_unavailable",
                "message": "call store not initialized",
                "retryable": True,
                "at": _now(),
            },
        )
    return store


@router.get("/calls", response_model=CallListResponse)
async def list_calls(
    request: Request, limit: int = 50, offset: int = 0
) -> CallListResponse:
    """The call log, newest first. Masked numbers by default."""
    store = _call_store(request)
    items, total = store.list_calls(limit=limit, offset=offset)
    return CallListResponse(
        items=[CallListItem.model_validate(i) for i in items],
        total=total,
        reachable=True,
    )


@router.get("/calls/{call_id}", response_model=CallDetail)
async def get_call(call_id: str, request: Request) -> CallDetail:
    """One call plus its transcript — the replay surface.

    `provenance` on each turn is what answers "why did it say that?".
    """
    store = _call_store(request)
    call = store.get_call(call_id)
    if call is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "call_not_found",
                "message": f"no call with id {call_id}",
                "retryable": False,
                "at": _now(),
            },
        )
    turns = store.get_turns(call_id)
    return CallDetail(
        call=CallListItem.model_validate(call),
        turns=[TurnItem.model_validate(t) for t in turns],
        containment_reason=call.get("containmentReason"),
        summary=call.get("summary"),
    )


@router.get("/alerts", response_model=AlertListResponse)
async def list_alerts(
    request: Request, severity: str | None = None, limit: int = 50
) -> AlertListResponse:
    """The ops alert list. `severity` filters to P1/P2/P3."""
    store = _call_store(request)
    items, total = store.list_alerts(severity=severity, limit=limit)
    return AlertListResponse(
        items=[AlertItem.model_validate(i) for i in items],
        total=total,
        reachable=True,
    )
