"""Pydantic models — the wire contract.

This module IS the contract. `BACKEND.md` §13 describes it in prose and
`src/features/agent/types/commands.ts` mirrors it in TypeScript; this file is the
one both sides are checked against. Change it here first, then mirror.

Two rules that are not stylistic:

1. **No `tenant_id` on anything a client sends or receives.** Tenant identity is
   derived server-side from the bearer token (`ADR-001` D4a). A field here would
   be a field a client could set.
2. **`reachable` and `last_seen_at` are not optional.** They are what lets the
   console render "we cannot reach the agent" instead of "no calls", which is the
   failure that makes an operator stand down during an outage.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

# ── Enums ───────────────────────────────────────────────────────────────────


class CallChannel(StrEnum):
    VOICE = "voice"
    WHATSAPP = "whatsapp"


class CallOutcome(StrEnum):
    CONTAINED = "contained"
    TRANSFERRED = "transferred"
    VOICEMAIL = "voicemail"
    ABANDONED = "abandoned"


class CallState(StrEnum):
    """`CALL-FLOW.md` §1. The order here is the call's lifecycle order."""

    IDLE = "idle"
    CONNECTING = "connecting"
    GREETING = "greeting"
    LISTENING = "listening"
    THINKING = "thinking"
    SPEAKING = "speaking"
    CLOSING = "closing"
    WRAPUP = "wrapup"


class Severity(StrEnum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class ProviderTier(StrEnum):
    BUDGET = "budget"
    STANDARD = "standard"
    PREMIUM = "premium"
    SELFHOSTED = "selfhosted"


class AfterHoursMode(StrEnum):
    TAKE_MESSAGE = "take_message"
    TRANSFER = "transfer"
    ANNOUNCE_ONLY = "announce_only"


class VoiceLocale(StrEnum):
    """The agent speaks FR and EN.

    **Not** the app's locale list. The repo ships en/fr/ar/ja/it interfaces; that
    is a different fact from what the agent can speak. An enum rather than a
    string is the point: there is no third value to reach for, so "we'll add
    Darija next sprint" cannot happen by accident here — it needs a code change
    and a deliberate review (`UX.md` section 12, `WIREFRAMES.md` G10).
    """

    FR = "fr"
    EN = "en"


# ── Primitives ──────────────────────────────────────────────────────────────

E164 = Annotated[str, Field(pattern=r"^\+[1-9]\d{6,14}$", examples=["+33612345678"])]

DISCLOSURE_FR = (
    "Cet appel est pris en charge par un assistant IA. "
    "Dites « agent » à tout moment pour être transféré à un humain."
)
DISCLOSURE_EN = (
    "This call is handled by an AI assistant. "
    "Say “agent” at any time to be transferred to a human."
)

#: Emergency numbers are **copy, not locale**: a French tenant shows 15/17/112 in
#: every UI locale, including `ar`. `UX.md` §16 names this as a trap.
EMERGENCY_NUMBERS = "15 · 17 · 112"


class Camel(BaseModel):
    """Serialise to camelCase so the TS types need no mapping layer."""

    model_config = ConfigDict(alias_generator=lambda s: _camel(s), populate_by_name=True)


def _camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(w.capitalize() for w in rest)


# ── Health ──────────────────────────────────────────────────────────────────


class Health(Camel):
    """`GET /healthz` — unauthenticated, and returns no tenant data."""

    ok: bool
    version: str
    started_at: str
    db: Literal["ok", "degraded", "down"]
    providers: Literal["ok", "degraded", "down"]


# ── Session ─────────────────────────────────────────────────────────────────


class SessionPurpose(StrEnum):
    TEST_CALL = "test_call"
    LIVE = "live"


class SessionRequest(Camel):
    # NOT BaseModel. This class is INBOUND, so it must accept camelCase. Inheriting
    # BaseModel here meant `callerOverride` was silently dropped on the way in —
    # the field defaulted to None, `assert_caller_allowed` never fired, and a live
    # session accepted a caller override. A guard that parses as present and
    # enforces nothing is worse than no guard, and no unit test on the method
    # would have found it: the method was correct, the wiring was not.
    channel: CallChannel
    purpose: SessionPurpose
    locale: Literal["fr", "en"] = "fr"
    #: Accepted **only** when `purpose == "test_call"`. A live session takes its
    #: number from the carrier. Without this check, a test endpoint becomes a
    #: call-placement primitive.
    caller_override: E164 | None = None

    def assert_caller_allowed(self) -> None:
        if self.caller_override is not None and self.purpose is not SessionPurpose.TEST_CALL:
            raise PermissionError("caller_override is only valid for purpose=test_call")


class SessionResponse(Camel):
    session_id: str
    state: CallState
    opened_at: str
    ws_url: str
    disclosure: str


# ── Transcript ──────────────────────────────────────────────────────────────


class StageMarks(Camel):
    """The four per-turn marks. Without these a latency miss is an argument."""

    vad_ms: int | None = None
    stt_ms: int | None = None
    llm_ms: int | None = None
    tts_ms: int | None = None
    turn_gap_ms: int | None = None


class TranscriptDelta(Camel):
    type: Literal["delta"] = "delta"
    call_id: str
    turn_id: int
    seq: int
    role: Literal["caller", "agent"]
    text: str
    final: bool
    at: str


class StateFrame(Camel):
    type: Literal["state"] = "state"
    session_id: str
    state: CallState
    at: str


class StagesFrame(Camel):
    type: Literal["stages"] = "stages"
    call_id: str
    turn_id: int
    vad_ms: int | None = None
    stt_ms: int | None = None
    llm_ms: int | None = None
    tts_ms: int | None = None
    turn_gap_ms: int | None = None
    at: str


class MetaFrame(Camel):
    type: Literal["meta"] = "meta"
    call_id: str
    #: The SPOKEN locale. VoiceLocale, not the UI locale — the console ships 5
    #: UI languages and the agent speaks 2, and conflating them is how a French
    #: client ends up with an Arabic voice by accident.
    locale: VoiceLocale
    fallback_active: bool
    chain_tier: ProviderTier


class ClosedFrame(Camel):
    type: Literal["closed"] = "closed"
    call_id: str
    reason: str
    at: str


class ClientFrame(Camel):
    """Client → server.

    **There is no frame that acts on a call.** No transfer, no hangup, no
    barge-in. The absence is deliberate and reviewable: v1 has no mid-call
    operator action, and a frame that could do it would be a barge-in control
    wearing a disguise.
    """

    type: Literal["ping"] = "ping"


# ── Ops ─────────────────────────────────────────────────────────────────────


class AlertEvidence(Camel):
    count: int
    first_at: str
    last_at: str
    blast_radius: str


class OpsAlert(Camel):
    id: str
    severity: Severity
    rule: str
    one_liner: str
    decision: str
    evidence: AlertEvidence
    acknowledged_at: str | None = None
    acknowledged_by: str | None = None
    #: True while the rule's threshold is still a placeholder. The console renders
    #: the provenance rather than presenting a guess as a measurement (G3).
    threshold_is_provisional: bool = True


class ProviderHealth(Camel):
    provider: str
    role: Literal["STT", "TTS", "LLM", "EMBEDDING", "telephony", "whatsapp"]
    error_rate: float
    latency_p95_ms: int | None = None
    fallback_active: bool
    state: Literal["ok", "degraded", "down"]


class OpsSnapshot(Camel):
    generated_at: str
    since: str
    p1: list[OpsAlert]
    p2_grouped: dict[str, list[OpsAlert]]
    p3_count: int
    call_count: int
    contained_pct: int
    #: Not optional. False ⇒ render "cannot reach the agent · last seen HH:MM",
    #: never an empty list.
    reachable: bool
    last_seen_at: str | None


# ── Knowledge ───────────────────────────────────────────────────────────────


class IngestRequest(Camel):
    source: str
    scope: str
    expected_chunks: int | None = None


class IngestAccepted(Camel):
    job_id: str
    state: Literal["queued", "running", "done", "failed"] = "queued"
    #: A schema that can only say "done" makes a partial ingest unrepresentable,
    #: which is exactly the silent-consistency gap in `WIREFRAMES.md` G12.
    chunks: int | None = None
    error: str | None = None


class SearchRequest(Camel):
    query: str
    top_k: int = 5


class SearchHit(Camel):
    doc_id: str
    ordinal: int
    text: str
    score: float


class SearchResponse(Camel):
    chunks: list[SearchHit]
    embedder: str
    #: Reported so a client can detect a space mismatch. It is **config**, never a
    #: constant in code (`ADR-001` D2).
    dims: int


# ── Metering ────────────────────────────────────────────────────────────────


class CostRow(Camel):
    key: str
    label: str
    calls: int
    #: `None` for WhatsApp service conversations — they cost €0, which is a policy
    #: consequence and must be explained in the UI, not shown as missing data.
    minutes: float | None
    actual_eur: float
    model_eur: float
    over_model: bool


class CostTotals(Camel):
    minutes: float
    actual_eur: float
    model_eur: float


class MeteringRollup(Camel):
    from_: str
    to: str
    group_by: Literal["call_type", "day"]
    rows: list[CostRow]
    totals: CostTotals


# ── Errors ──────────────────────────────────────────────────────────────────


class ErrorBody(Camel):
    #: Stable. The console branches on `code`, never on `message`.
    code: str
    message: str
    retryable: bool
    provider: str | None = None
    at: str


class ErrorResponse(Camel):
    error: ErrorBody
