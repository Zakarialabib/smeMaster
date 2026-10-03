"""Licence gate for self-hosted models.

**This module exists because of one specific near-miss.** A research brief
recommended `mistralai/Voxtral-4B-TTS-2603` as the v1 open-weight French TTS in
its summary, diagram, and decision tree. Its own §4 correctly noted the licence
was non-commercial. The model is `CC-BY-NC-4.0`. Shipping it would have meant
billing a client from work the licence forbids.

The failure was not reading the licence — the brief *had* read it. The failure
was that the summary outranked the detail, and nobody re-checked. A summary that
names a model is the thing people act on, so **the summary is what gets gated.**

`assert_commercially_usable` is called at provider construction. A model whose
licence is unknown fails, because unknown is a no until someone reads the actual
text. `COMMERCIAL_LICENSES` is deliberately a small allowlist rather than a
blocklist: a new licence nobody has classified must not pass by omission.

Values are the SPDX identifiers as DECLARED on the Hugging Face model card. A
declared licence is the floor to check, not the ceiling — a model can be more
permissive in practice (a separate commercial grant from the author) or less
(inherited weights). Re-verify against the HF API before quoting any of this to
a client.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

#: SPDX ids cleared for commercial use in a client deliverable. Anything not
#: listed is refused. Extend deliberately, with a citation, never reactively.
COMMERCIAL_LICENSES: frozenset[str] = frozenset(
    {
        "MIT",
        "Apache-2.0",
        "BSD-2-Clause",
        "BSD-3-Clause",
        "ISC",
        "MPL-2.0",
    }
)

#: Known-good, and the *reason* each was checked. Keep the comment; a bare SPDX id
#: tells the next person nothing about whether it was verified or assumed.
VERIFIED: dict[str, str] = {
    "MIT": "ResembleAI/chatterbox (HF API, 2026-09-28); bofenghuang/whisper-large-v3-french",
    "Apache-2.0": "openai/whisper-large-v3; hexgrad/Kokoro-82M (HF API, 2026-09-28)",
    "BSD-2-Clause": "LiveKit agents, pipecat",
    "BSD-3-Clause": "—",
    "ISC": "—",
    "MPL-2.0": "—",
}

#: Licences we have seen in the wild, recorded so the refusal message can say
#: WHY rather than just "no".
KNOWN_NON_COMMERCIAL: dict[str, str] = {
    "CC-BY-NC-4.0": "non-commercial; research use only",
    "CC-BY-NC-SA-4.0": "non-commercial + share-alike",
    "CPML": "Coqui Public Model License, non-commercial",
    "cc-by-nc-4.0": "non-commercial (lowercase SPDX variant)",
}


class LicenseVerdict(StrEnum):
    OK = "ok"
    NON_COMMERCIAL = "non_commercial"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class LicenseCheck:
    verdict: LicenseVerdict
    declared: str | None
    reason: str

    @property
    def ok(self) -> bool:
        return self.verdict is LicenseVerdict.OK


def check_license(declared: str | None) -> LicenseCheck:
    """Classify a DECLARED licence. Never returns OK for an unknown string."""
    if declared is None:
        return LicenseCheck(
            LicenseVerdict.UNKNOWN,
            None,
            "no licence declared on the model card. Unknown is a no until the "
            "licence text is read - an unlisted licence must not pass by omission.",
        )

    normalised = declared.strip()

    for known, why in KNOWN_NON_COMMERCIAL.items():
        if normalised.lower() == known.lower():
            return LicenseCheck(LicenseVerdict.NON_COMMERCIAL, declared, why)

    if normalised in COMMERCIAL_LICENSES:
        return LicenseCheck(
            LicenseVerdict.OK, declared, f"SPDX {normalised}, cleared for commercial use"
        )

    return LicenseCheck(
        LicenseVerdict.UNKNOWN,
        declared,
        f"{normalised!r} is not in the commercial allowlist. Do not ship it until "
        f"someone classifies it deliberately with a citation.",
    )


def assert_commercially_usable(model: str, declared: str | None) -> LicenseCheck:
    """Raise unless the model is cleared for a client deliverable.

    Call this at PROVIDER CONSTRUCTION, not at deploy time. A provider that
    cannot be built in a test is a provider nobody will discover is unlicensed
    until a client reads the invoice.
    """
    check = check_license(declared)
    if check.ok:
        return check
    raise NonCommercialModelError(model, check)


class NonCommercialModelError(RuntimeError):
    """A model was selected that its licence forbids shipping commercially."""

    def __init__(self, model: str, check: LicenseCheck) -> None:
        super().__init__(
            f"{model}: licence {check.declared!r} is {check.reason}. "
            "This project bills a client, so a non-commercial model cannot ship. "
            f"Cleared licences: {sorted(COMMERCIAL_LICENSES)}."
        )
        self.model = model
        self.check = check
