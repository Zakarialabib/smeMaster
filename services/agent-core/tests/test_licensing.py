"""Licence gates on the self-hosted catalogue.

These are the tests that would have caught the Voxtral TTS near-miss at the point
it mattered. The research was not wrong about the licence — it was wrong about
which part to read. These tests make the licence impossible to route around:

- every candidate in `catalogue.ALL` builds (i.e. is commercially usable)
- every candidate in `catalogue.REFUSED` is refused, **with the reason named**
- an unknown licence is a no, and a null licence is a no
- adding a non-commercial model to the ALLOW-list is rejected

A test that only checked the licences of the models we happen to use today would
pass unchanged the day someone adds a fourth.
"""

from __future__ import annotations

import pytest

from agent_core.providers import catalogue, licensing
from agent_core.providers.licensing import (
    NonCommercialModelError,
    check_license,
)


class TestEveryClearedCandidateActuallyClears:
    @pytest.mark.parametrize(
        "c", catalogue.ALL, ids=lambda c: c.model, scope="module"
    )
    def test_builds(self, c: catalogue.SelfHostedCandidate) -> None:
        c.build()  # raises if not commercially usable

    @pytest.mark.parametrize(
        "c", catalogue.ALL, ids=lambda c: c.model, scope="module"
    )
    def test_declares_french_or_english(self, c: catalogue.SelfHostedCandidate) -> None:
        # v1 speaks FR and EN only. A candidate that speaks neither is not a
        # candidate for this project.
        assert {"fr", "en"} & set(c.languages), f"{c.model} speaks neither FR nor EN"


class TestRefusedModelsStayRefused:
    @pytest.mark.parametrize(
        "c", catalogue.REFUSED, ids=lambda c: c.model, scope="module"
    )
    def test_is_refused(self, c: catalogue.SelfHostedCandidate) -> None:
        with pytest.raises(NonCommercialModelError):
            c.build()

    @pytest.mark.parametrize(
        "c", catalogue.REFUSED, ids=lambda c: c.model, scope="module"
    )
    def test_refusal_names_the_licence(self, c: catalogue.SelfHostedCandidate) -> None:
        # "No" without a reason gets argued away in a code review.
        with pytest.raises(NonCommercialModelError) as exc:
            c.build()
        msg = str(exc.value)
        assert c.declared_license is None or c.declared_license in msg, msg
        assert "MIT" in msg, "the message should list what IS allowed: " + msg


class TestCatalogueIntegrity:
    def test_disqualified_is_disjoint_from_cleared(self) -> None:
        """A disqualified model must never be reachable via the cleared list."""
        cleared = {c.model for c in catalogue.ALL}
        bad = {c.model for c in catalogue.DISQUALIFIED}
        assert not (cleared & bad), f"in both lists: {cleared & bad}"

    def test_every_disqualified_model_is_actually_disqualified(self) -> None:
        for c in catalogue.DISQUALIFIED:
            with pytest.raises(NonCommercialModelError):
                c.build()

    def test_refused_and_disqualified_are_different_facts(self) -> None:
        # REFUSED = unverified/undeclared. DISQUALIFIED = verified real, verified
        # unusable. Conflating them loses the reason.
        refused = {c.model for c in catalogue.REFUSED}
        disq = {c.model for c in catalogue.DISQUALIFIED}
        assert refused and disq
        assert not (refused & disq)


class TestTheVoxtralEpisode:
    """The specific regression, kept as its own class so it stays readable."""

    def test_voxtral_tts_is_disqualified_despite_being_the_fastest(self) -> None:
        voxtral = next(c for c in catalogue.DISQUALIFIED if "Voxtral" in c.model)
        assert voxtral.latency_claim, "the temptation is the point of the test"
        with pytest.raises(NonCommercialModelError, match="non-commercial"):
            voxtral.build()

    def test_its_rejection_is_on_the_record(self) -> None:
        voxtral = next(c for c in catalogue.DISQUALIFIED if "Voxtral" in c.model)
        assert "DISQUALIFIED" in voxtral.note, (
            "the model stays in the catalogue with its rejection written down, so "
            "nobody re-litigates it from the latency number"
        )

    def test_voxtral_asr_models_are_not_affected(self) -> None:
        # The name collision is real and the distinction matters: the ASR models
        # are Apache-2.0. Only the TTS model is restricted.
        assert not any("Voxtral" in c.model for c in catalogue.STT)
        assert "DIFFERENT thing" in next(
            c for c in catalogue.DISQUALIFIED if "Voxtral" in c.model
        ).note


class TestLicenceClassification:
    @pytest.mark.parametrize("spdx", ["MIT", "Apache-2.0", "BSD-2-Clause"])
    def test_cleared(self, spdx: str) -> None:
        assert check_license(spdx).ok

    @pytest.mark.parametrize(
        "spdx", ["CC-BY-NC-4.0", "cc-by-nc-4.0", "CC-BY-NC-SA-4.0", "CPML"]
    )
    def test_non_commercial(self, spdx: str) -> None:
        check = check_license(spdx)
        assert not check.ok
        assert check.verdict is licensing.LicenseVerdict.NON_COMMERCIAL
        assert check.reason, "the refusal must say why"

    def test_none_is_a_no(self) -> None:
        check = check_license(None)
        assert not check.ok
        assert check.verdict is licensing.LicenseVerdict.UNKNOWN

    def test_an_unlisted_licence_is_a_no(self) -> None:
        # The allowlist is the mechanism. A novel licence must not pass by being
        # absent from a blocklist.
        assert not check_license("WTFPL-2.0").ok
        assert not check_license("SEE LICENSE IN MODEL CARD").ok

    def test_a_declared_but_unclassified_licence_is_not_silently_ok(self) -> None:
        check = check_license("Elastic-2.0")
        assert check.verdict is licensing.LicenseVerdict.UNKNOWN
        assert "not in the commercial allowlist" in check.reason


class TestTheAllowlistItself:
    def test_every_allowed_licence_has_a_note(self) -> None:
        # A bare SPDX id tells the next person nothing about whether it was
        # verified against a model card or assumed.
        missing = licensing.COMMERCIAL_LICENSES - set(licensing.VERIFIED)
        assert not missing, f"unannotated allowed licences: {sorted(missing)}"

    def test_adding_a_restricted_licence_is_rejected(self) -> None:
        assert "CC-BY-NC-4.0" not in licensing.COMMERCIAL_LICENSES
        assert "CPML" not in licensing.COMMERCIAL_LICENSES

    def test_voxtral_stays_out_of_the_allowlist(self) -> None:
        # Regression: if someone "fixes" the Voxtral rejection by allowlisting
        # cc-by-nc-4.0, this fails.
        assert "cc-by-nc-4.0" not in {x.lower() for x in licensing.COMMERCIAL_LICENSES}
