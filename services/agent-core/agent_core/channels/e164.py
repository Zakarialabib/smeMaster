"""E.164 normalisation — the security rule that must not be reordered.

**Normalise, THEN compare.** `+33612345678`, `0033612345678`, `0612345678`,
`33612345678` and `33612345678@c.us` are ONE number. A raw string comparison is
bypassed by formatting alone — which is exactly the failure an allowlist exists
to prevent (`BACKEND.md` §4).

This module is deliberately dependency-free and pure: it is the one place a
phone number is interpreted, so it is the one place an allowlist bypass could
hide.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

#: What a normalised number must look like. Mirrors `contracts.E164`.
_E164_RE = re.compile(r"^\+[1-9]\d{6,14}$")

#: WhatsApp JID suffixes. A Baileys event carries `<number>@c.us`; the number
#: inside is the same number as the voice one and must compare equal.
_JID_SUFFIXES = ("@c.us", "@s.whatsapp.net", "@g.us")

#: Formatting characters that carry no meaning. Stripped BEFORE any comparison.
_STRIP_RE = re.compile(r"[\s\-\.\(\)\u00a0]")

#: The `(0)` national-trunk convention: `+33 (0)6 12 34 56 78` means `+336...`.
#: The parenthesised zero is NOT part of the number and must be dropped before
#: any prefix logic — leaving it produces `+3306...`, which is a different
#: number, and that is a silent misroute rather than a parse error.
_TRUNK_ZERO_RE = re.compile(r"\(\s*0\s*\)")

#: Default country calling code for a bare national number. This project's
#: first tenant is a French SME; it is a PARAMETER, not a constant, because the
#: clients are CH/FR/BE and a hard-coded 33 is a wrong number waiting to happen.
DEFAULT_COUNTRY_CODE = "33"


class InvalidPhoneNumber(ValueError):
    """The input cannot be read as a phone number at all."""


def normalize_e164(raw: str, *, default_cc: str = DEFAULT_COUNTRY_CODE) -> str:
    """Collapse every common spelling of a number to one `+<cc><national>` form.

    Accepts: `+33 6 12 34 56 78`, `0033612345678`, `0612345678`,
    `33612345678`, `33612345678@c.us`.

    Raises `InvalidPhoneNumber` when the result is not valid E.164 — an
    unreadable number must never silently become a comparable string.
    """
    if not isinstance(raw, str):
        raise InvalidPhoneNumber(f"not a string: {raw!r}")

    text = raw.strip()
    if not text:
        raise InvalidPhoneNumber("empty number")

    # 1. Strip a WhatsApp JID suffix. The local part is the number.
    for suffix in _JID_SUFFIXES:
        if text.endswith(suffix):
            text = text[: -len(suffix)]
            break

    # 2. Strip the `(0)` trunk convention BEFORE generic formatting, or the
    #    parentheses are removed and a stray `0` is left in the number.
    text = _TRUNK_ZERO_RE.sub("", text)

    # 3. Strip formatting. Done before any prefix test so `+33 6...` and
    #    `0033 6...` are the same input.
    text = _STRIP_RE.sub("", text)

    # 4. A leading `tel:` URI scheme, occasionally present in links.
    if text.lower().startswith("tel:"):
        text = text[4:]

    # 5. Collapse to a single `+`-prefixed international form.
    if text.startswith("+"):
        candidate = text
    elif text.startswith("00"):
        # International access code: 00 33 6... == +33 6...
        candidate = "+" + text[2:]
    elif text.startswith("0"):
        # National trunk prefix: 0 6... == +33 6... (the leading 0 is dropped)
        candidate = "+" + default_cc + text[1:]
    else:
        # Bare international without the `+`: 33612345678
        candidate = "+" + text

    if not _E164_RE.match(candidate):
        raise InvalidPhoneNumber(f"not valid E.164 after normalisation: {raw!r} -> {candidate!r}")
    return candidate


def is_valid_e164(value: str) -> bool:
    """True when `value` is already in normalised form. No interpretation."""
    return bool(_E164_RE.match(value))


@dataclass(frozen=True, slots=True)
class Allowlist:
    """A set of permitted callers, compared ONLY in normalised form.

    Every number is normalised on the way in, so a caller cannot bypass the
    check by writing the same number differently. Comparison is on the
    normalised value, never on the raw string.
    """

    numbers: frozenset[str] = field(default_factory=frozenset)
    #: When True, an EMPTY allowlist denies everyone. Default False so a dev
    #: setup with no allowlist configured is not silently locked out — but a
    #: configured allowlist is always enforced.
    deny_when_empty: bool = False

    @classmethod
    def of(cls, numbers: list[str], *, default_cc: str = DEFAULT_COUNTRY_CODE) -> Allowlist:
        """Build from raw strings, normalising each. Invalid entries raise."""
        return cls(frozenset(normalize_e164(n, default_cc=default_cc) for n in numbers))

    def is_allowed(self, raw: str, *, default_cc: str = DEFAULT_COUNTRY_CODE) -> bool:
        """True when `raw` names a permitted number, in ANY accepted spelling."""
        if not self.numbers:
            return not self.deny_when_empty
        try:
            candidate = normalize_e164(raw, default_cc=default_cc)
        except InvalidPhoneNumber:
            # An unreadable number is not on the list. Fails closed, and does
            # not raise into a caller-facing path.
            return False
        return candidate in self.numbers

    def __contains__(self, raw: object) -> bool:
        return isinstance(raw, str) and self.is_allowed(raw)

    def __len__(self) -> int:
        return len(self.numbers)
