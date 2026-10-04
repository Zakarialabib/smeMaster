"""The three channel adapters.

All three are REAL, on trial/free tiers (`DECISIONS-2026-10-03.md` §3.6). What
that means concretely:

- `BaileysAdapter` — unofficial WhatsApp, MIT. **Dedicated test number only.**
  Ban risk is contained by the allowlist, not by hoping.
- `TwilioAdapter` — trial ingress into FreeSWITCH for voice.
- `OfficialWaAdapter` — Meta's WhatsApp Business API, test app.

**None of them reports usable without credentials in the environment.** That is
the `configured` flag's whole job: a client may enable a channel; only the
server may claim it is configured. Reporting otherwise is the fake success the
design forbids.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from dataclasses import dataclass

from .base import (
    Capabilities,
    ChannelAdapter,
    ChannelKind,
    ChannelUnavailable,
    InboundEvent,
    TransferResult,
)
from .e164 import Allowlist


def _env_has(*names: str) -> bool:
    """True when every named environment variable is set and non-empty.

    The one place `configured` is decided, so all three adapters answer the
    same question the same way.
    """
    return all(bool(os.getenv(n, "").strip()) for n in names)


@dataclass(frozen=True, slots=True)
class _EnvSpec:
    """Which env vars a channel needs, and how to describe a missing one."""

    vars: tuple[str, ...]
    missing_reason: str

    def satisfied(self) -> bool:
        return _env_has(*self.vars)


class _EnvBackedAdapter(ChannelAdapter):
    """Shared capability logic. A channel with no credentials is not usable."""

    spec: _EnvSpec

    def capabilities(self) -> Capabilities:
        if self.spec.satisfied():
            return Capabilities(enabled=True, configured=True)
        return Capabilities(enabled=True, configured=False, reason=self.spec.missing_reason)

    def _require_configured(self) -> None:
        if not self.spec.satisfied():
            raise ChannelUnavailable(
                self.spec.missing_reason,
                channel=self.kind.value,
                retryable=False,
            )


class BaileysAdapter(_EnvBackedAdapter):
    """Unofficial WhatsApp (Baileys, MIT).

    **Dedicated test number only.** The session credentials are a device link,
    not a token; `BAILEYS_SESSION_DIR` points at the stored link. Running this
    against a client's or the company's main number is the ban risk the design
    explicitly contains.
    """

    kind = ChannelKind.BAILEYS
    spec = _EnvSpec(
        vars=("BAILEYS_SESSION_DIR",),
        missing_reason=(
            "No Baileys device session. Link a DEDICATED TEST number to enable "
            "this channel — never a client's or our main number."
        ),
    )

    async def inbound_events(self) -> AsyncIterator[InboundEvent]:  # pragma: no cover
        self._require_configured()
        raise ChannelUnavailable(
            "Baileys transport not wired in this build",
            channel=self.kind.value,
            retryable=True,
        )
        yield  # pragma: no cover — unreachable, keeps the return type honest

    async def send_text(self, text: str, *, to: str) -> None:  # pragma: no cover
        self._require_configured()
        number = self._admit(to)
        raise ChannelUnavailable(
            f"Baileys transport not wired; would send to {number}",
            channel=self.kind.value,
            retryable=True,
        )

    async def transfer(self, target: str, *, call_id: str) -> TransferResult:  # pragma: no cover
        # WhatsApp is a TEXT channel. There is no call to transfer.
        raise ChannelUnavailable(
            "Baileys is a text channel; there is no call to transfer",
            channel=self.kind.value,
            retryable=False,
        )


class TwilioAdapter(_EnvBackedAdapter):
    """Twilio trial ingress into FreeSWITCH for voice.

    Trial limits are real and accepted (`DECISIONS-2026-10-03.md` §8): no
    inbound from unverified numbers. FreeSWITCH loopback is the telephony
    acceptance test, not this adapter.
    """

    kind = ChannelKind.TWILIO
    spec = _EnvSpec(
        vars=("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"),
        missing_reason=(
            "No Twilio credentials. Trial SID + auth token enable voice ingress; "
            "trial numbers cannot receive inbound from unverified callers."
        ),
    )

    async def inbound_events(self) -> AsyncIterator[InboundEvent]:  # pragma: no cover
        self._require_configured()
        raise ChannelUnavailable(
            "Twilio transport not wired in this build",
            channel=self.kind.value,
            retryable=True,
        )
        yield  # pragma: no cover

    async def send_text(self, text: str, *, to: str) -> None:  # pragma: no cover
        self._require_configured()
        number = self._admit(to)
        raise ChannelUnavailable(
            f"Twilio transport not wired; would send to {number}",
            channel=self.kind.value,
            retryable=True,
        )

    async def transfer(self, target: str, *, call_id: str) -> TransferResult:  # pragma: no cover
        self._require_configured()
        number = self._admit(target)
        raise ChannelUnavailable(
            f"Twilio transport not wired; would transfer {call_id} to {number}",
            channel=self.kind.value,
            retryable=True,
        )


class OfficialWaAdapter(_EnvBackedAdapter):
    """Meta's official WhatsApp Business API.

    Test-mode caps apply: 24 h tokens, and only numbers added to the test app
    can be messaged.
    """

    kind = ChannelKind.OFFICIAL
    spec = _EnvSpec(
        vars=("META_WA_TOKEN", "META_WA_PHONE_ID"),
        missing_reason=(
            "No Meta WhatsApp credentials. A test app + phone id enables this "
            "channel; test-mode tokens expire after 24 h."
        ),
    )

    async def inbound_events(self) -> AsyncIterator[InboundEvent]:  # pragma: no cover
        self._require_configured()
        raise ChannelUnavailable(
            "Official WhatsApp transport not wired in this build",
            channel=self.kind.value,
            retryable=True,
        )
        yield  # pragma: no cover

    async def send_text(self, text: str, *, to: str) -> None:  # pragma: no cover
        self._require_configured()
        number = self._admit(to)
        raise ChannelUnavailable(
            f"Official WhatsApp transport not wired; would send to {number}",
            channel=self.kind.value,
            retryable=True,
        )

    async def transfer(self, target: str, *, call_id: str) -> TransferResult:  # pragma: no cover
        raise ChannelUnavailable(
            "Official WhatsApp is a text channel; there is no call to transfer",
            channel=self.kind.value,
            retryable=False,
        )


#: The registry. `none` is not an adapter — it is the absence of one.
ADAPTERS: dict[ChannelKind, type[ChannelAdapter]] = {
    ChannelKind.BAILEYS: BaileysAdapter,
    ChannelKind.TWILIO: TwilioAdapter,
    ChannelKind.OFFICIAL: OfficialWaAdapter,
}


def build_adapter(
    kind: ChannelKind, *, allowlist: Allowlist | None = None
) -> ChannelAdapter | None:
    """Construct the adapter for a selected channel.

    Returns None for `none`, which is a valid configuration meaning "no channel
    is live". A caller that expects an adapter and gets None is the honest
    outcome — better than a NullAdapter that pretends to work.
    """
    if kind is ChannelKind.NONE:
        return None
    return ADAPTERS[kind](allowlist=allowlist)
