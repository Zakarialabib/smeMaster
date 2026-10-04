"""Channel adapters — one interface, three real implementations.

`BACKEND.md` §4. The security-critical part is `e164.py`: normalise, THEN
compare, because a raw string comparison is bypassed by formatting alone.
"""

from .adapters import (
    ADAPTERS,
    BaileysAdapter,
    OfficialWaAdapter,
    TwilioAdapter,
    build_adapter,
)
from .base import (
    Capabilities,
    ChannelAdapter,
    ChannelKind,
    ChannelUnavailable,
    InboundEvent,
    TransferResult,
)
from .e164 import Allowlist, InvalidPhoneNumber, is_valid_e164, normalize_e164

__all__ = [
    "ADAPTERS",
    "Allowlist",
    "BaileysAdapter",
    "Capabilities",
    "ChannelAdapter",
    "ChannelKind",
    "ChannelUnavailable",
    "InboundEvent",
    "InvalidPhoneNumber",
    "OfficialWaAdapter",
    "TransferResult",
    "TwilioAdapter",
    "build_adapter",
    "is_valid_e164",
    "normalize_e164",
]
