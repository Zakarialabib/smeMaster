"""The `ChannelAdapter` seam — one interface, three real implementations.

`BACKEND.md` §4. Adding a fourth channel is an architecture decision, not a
patch, so the protocol is deliberately small.

Three rules that are not stylistic:

1. **No fake success.** A channel that cannot run says so through
   `Capabilities`. The console renders "capability unavailable" rather than a
   green tick over a channel with no credentials behind it.
2. **`configured` is derived, never stored.** It reflects what the SERVER can
   actually see in its environment. A client may *enable* a channel; only the
   server may claim one is configured.
3. **Normalise, then compare.** The allowlist check runs on the normalised
   number (`e164.py`), never on the raw string.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from enum import StrEnum
from typing import Literal

from .e164 import Allowlist, normalize_e164


class ChannelKind(StrEnum):
    """The selectable channels. Mirrors `contracts.Channel`."""

    BAILEYS = "baileys"
    TWILIO = "twilio"
    OFFICIAL = "official"
    NONE = "none"


class ChannelUnavailable(RuntimeError):
    """A channel cannot serve right now.

    Carries `channel` and `retryable` because the console shows a degraded
    channel by name. A bare exception here produces a silent failure, which is
    the one behaviour `BACKEND.md` §8 lists under "Never".
    """

    def __init__(self, message: str, *, channel: str, retryable: bool = True) -> None:
        super().__init__(message)
        self.channel = channel
        self.retryable = retryable


@dataclass(frozen=True, slots=True)
class Capabilities:
    """What THIS deployment can actually do for one channel.

    `configured` is the honest bit: it is derived from the server's environment
    at read time. `enabled` is the client's intent from config. The two are
    separate because a client enabling a channel it has no credentials for is a
    normal state the UI must be able to show.
    """

    enabled: bool
    configured: bool
    #: Why it is not usable, for the console. None when fully usable.
    reason: str | None = None

    @property
    def usable(self) -> bool:
        return self.enabled and self.configured


@dataclass(frozen=True, slots=True)
class InboundEvent:
    """One inbound event from a channel.

    `text` is None for a voice event that has not been transcribed yet — the
    transcript arrives on the agent's own turn loop, not on the adapter.
    """

    channel: ChannelKind
    #: E.164, ALREADY normalised by the adapter. Never a raw carrier string.
    from_e164: str
    kind: Literal["voice", "text", "status"]
    text: str | None = None
    #: The carrier/channel's own id for this leg, for correlating callbacks.
    external_id: str | None = None


@dataclass(frozen=True, slots=True)
class TransferResult:
    """The outcome of a transfer attempt.

    There is no "unknown". Every attempt has a result, which is the schema
    enforcing "no transfer fails silently" (`CALL-FLOW.md` §4).
    """

    completed: bool
    result: Literal["completed", "failed", "no_answer"]
    failure_reason: str | None = None


class ChannelAdapter(ABC):
    """One interface, three implementations, zero branching in the agent."""

    kind: ChannelKind

    def __init__(self, *, allowlist: Allowlist | None = None) -> None:
        #: Checked on every inbound event, in normalised form. An adapter with
        #: no allowlist accepts anything — only valid for a loopback test.
        self._allowlist = allowlist

    @abstractmethod
    def capabilities(self) -> Capabilities:
        """What this deployment can do. Derived, never stored."""

    @abstractmethod
    def inbound_events(self) -> AsyncIterator[InboundEvent]:
        """Yield inbound events until the channel closes."""

    @abstractmethod
    async def send_text(self, text: str, *, to: str) -> None:
        """Send a message. `to` is normalised by the adapter."""

    @abstractmethod
    async def transfer(self, target: str, *, call_id: str) -> TransferResult:
        """Hand a live call to a human. Never returns without a result."""

    def _admit(self, raw: str) -> str:
        """Normalise, then check the allowlist. Returns the normalised number.

        Raises `ChannelUnavailable` when refused. The order is the security
        rule: normalise FIRST, or the check is bypassable by formatting alone.
        """
        number = normalize_e164(raw)
        if self._allowlist is not None and not self._allowlist.is_allowed(number):
            raise ChannelUnavailable(
                f"caller {number} is not on the allowlist",
                channel=self.kind.value,
                retryable=False,
            )
        return number
