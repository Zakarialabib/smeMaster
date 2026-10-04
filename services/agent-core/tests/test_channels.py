"""Channel adapter tests — the security rule gets the hardest coverage.

The rule under test (`BACKEND.md` §4): **normalise, THEN compare.** All four
spellings of one number must resolve to one entry, and a non-allowlisted number
must be rejected in EVERY spelling. A test that only tries `+33...` proves
nothing, because `+33...` is the form that already works.
"""

from __future__ import annotations

import pytest

from agent_core.channels import (
    ADAPTERS,
    Allowlist,
    BaileysAdapter,
    ChannelKind,
    ChannelUnavailable,
    InvalidPhoneNumber,
    OfficialWaAdapter,
    TwilioAdapter,
    build_adapter,
    is_valid_e164,
    normalize_e164,
)

#: One French mobile, in every spelling that means the same number.
SAME_NUMBER = [
    "+33612345678",
    "+33 6 12 34 56 78",
    "+33-6-12-34-56-78",
    "0033612345678",
    "0033 6 12 34 56 78",
    "0612345678",
    "06 12 34 56 78",
    "33612345678",
    "33612345678@c.us",
    "33612345678@s.whatsapp.net",
    "+33 (0)6 12 34 56 78",  # the (0) convention
]

CANONICAL = "+33612345678"


class TestNormalizeE164:
    @pytest.mark.parametrize("spelling", SAME_NUMBER)
    def test_every_spelling_normalises_to_one_form(self, spelling: str) -> None:
        assert normalize_e164(spelling) == CANONICAL

    def test_jid_suffix_is_stripped(self) -> None:
        assert normalize_e164("33612345678@c.us") == CANONICAL

    def test_tel_uri_scheme(self) -> None:
        assert normalize_e164("tel:+33612345678") == CANONICAL

    def test_default_cc_is_a_parameter_not_a_constant(self) -> None:
        # A Swiss client: 078 123 45 67 is +41781234567, not +33781234567.
        assert normalize_e164("0781234567", default_cc="41") == "+41781234567"
        assert normalize_e164("0781234567", default_cc="33") == "+33781234567"

    @pytest.mark.parametrize(
        "bad",
        ["", "   ", "not a number", "+0", "+", "00", "123", "+3361234567890123456"],
    )
    def test_unreadable_input_raises(self, bad: str) -> None:
        with pytest.raises(InvalidPhoneNumber):
            normalize_e164(bad)

    def test_non_string_raises(self) -> None:
        with pytest.raises(InvalidPhoneNumber):
            normalize_e164(None)  # type: ignore[arg-type]

    def test_is_valid_e164_is_strict(self) -> None:
        assert is_valid_e164(CANONICAL)
        assert not is_valid_e164("+33 6 12 34 56 78")  # spacing is not normalised
        assert not is_valid_e164("0612345678")  # national form is not E.164


class TestAllowlist:
    def test_accepts_all_spellings_of_a_listed_number(self) -> None:
        allow = Allowlist.of(["+33612345678"])
        for spelling in SAME_NUMBER:
            assert allow.is_allowed(spelling), f"{spelling} should be allowed"

    def test_rejects_a_different_number_in_every_spelling(self) -> None:
        """The whole point: a bypass by formatting must fail in EVERY form."""
        allow = Allowlist.of([CANONICAL])
        other = [
            "+33699999999",
            "0033699999999",
            "0699999999",
            "33699999999",
            "33699999999@c.us",
            "+33 6 99 99 99 99",
        ]
        for spelling in other:
            assert not allow.is_allowed(spelling), f"{spelling} must be rejected"

    def test_unreadable_number_fails_closed(self) -> None:
        allow = Allowlist.of([CANONICAL])
        assert not allow.is_allowed("garbage")
        assert not allow.is_allowed("")

    def test_empty_allowlist_admits_by_default(self) -> None:
        # A dev setup with nothing configured is not silently locked out.
        assert Allowlist.of([]).is_allowed(CANONICAL)

    def test_empty_allowlist_can_deny_everyone(self) -> None:
        assert not Allowlist(deny_when_empty=True).is_allowed(CANONICAL)

    def test_duplicates_collapse(self) -> None:
        allow = Allowlist.of(["+33612345678", "0612345678", "33612345678@c.us"])
        assert len(allow) == 1

    def test_in_operator(self) -> None:
        allow = Allowlist.of([CANONICAL])
        assert "0612345678" in allow
        assert "+33699999999" not in allow
        assert 12345 not in allow  # non-string, no crash


class TestCapabilitiesAreHonest:
    """No fake success: a channel with no credentials is not usable."""

    def test_baileys_unconfigured_without_a_session(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("BAILEYS_SESSION_DIR", raising=False)
        cap = BaileysAdapter().capabilities()
        assert cap.enabled is True
        assert cap.configured is False
        assert cap.usable is False
        assert cap.reason and "DEDICATED TEST" in cap.reason

    def test_baileys_configured_with_a_session(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("BAILEYS_SESSION_DIR", "/tmp/baileys")
        cap = BaileysAdapter().capabilities()
        assert cap.configured is True
        assert cap.usable is True
        assert cap.reason is None

    def test_twilio_needs_both_vars(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACxxx")
        monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
        assert TwilioAdapter().capabilities().configured is False

        monkeypatch.setenv("TWILIO_AUTH_TOKEN", "secret")
        assert TwilioAdapter().capabilities().configured is True

    def test_official_needs_both_vars(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("META_WA_TOKEN", "tok")
        monkeypatch.delenv("META_WA_PHONE_ID", raising=False)
        assert OfficialWaAdapter().capabilities().configured is False

        monkeypatch.setenv("META_WA_PHONE_ID", "123")
        assert OfficialWaAdapter().capabilities().configured is True

    def test_blank_value_is_not_configured(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("BAILEYS_SESSION_DIR", "   ")
        assert BaileysAdapter().capabilities().configured is False


class TestNoFakeSuccess:
    """An unconfigured channel refuses; it never pretends to have sent."""

    @pytest.mark.asyncio
    async def test_baileys_send_refuses_without_a_session(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("BAILEYS_SESSION_DIR", raising=False)
        with pytest.raises(ChannelUnavailable) as exc:
            await BaileysAdapter().send_text("hi", to=CANONICAL)
        assert exc.value.channel == "baileys"
        assert exc.value.retryable is False

    @pytest.mark.asyncio
    async def test_twilio_transfer_refuses_without_credentials(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
        monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
        with pytest.raises(ChannelUnavailable):
            await TwilioAdapter().transfer(CANONICAL, call_id="c1")


class TestAllowlistIsEnforcedAtTheAdapter:
    @pytest.mark.asyncio
    async def test_non_allowlisted_target_is_refused(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("BAILEYS_SESSION_DIR", "/tmp/baileys")
        adapter = BaileysAdapter(allowlist=Allowlist.of([CANONICAL]))
        with pytest.raises(ChannelUnavailable) as exc:
            await adapter.send_text("hi", to="+33699999999")
        assert exc.value.retryable is False

    @pytest.mark.asyncio
    async def test_allowlisted_target_in_a_different_spelling_passes_the_gate(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Normalise-then-compare: the gate must pass for `0612345678`."""
        monkeypatch.setenv("BAILEYS_SESSION_DIR", "/tmp/baileys")
        adapter = BaileysAdapter(allowlist=Allowlist.of([CANONICAL]))
        # The transport is not wired, so it still raises — but with the
        # TRANSPORT message, not the allowlist refusal. That difference is the
        # proof the gate admitted the number.
        with pytest.raises(ChannelUnavailable) as exc:
            await adapter.send_text("hi", to="0612345678")
        assert "not wired" in str(exc.value)
        assert "allowlist" not in str(exc.value)


class TestBuildAdapter:
    def test_none_returns_no_adapter(self) -> None:
        """`none` is a valid configuration meaning "no channel is live"."""
        assert build_adapter(ChannelKind.NONE) is None

    @pytest.mark.parametrize(
        "kind,cls",
        [
            (ChannelKind.BAILEYS, BaileysAdapter),
            (ChannelKind.TWILIO, TwilioAdapter),
            (ChannelKind.OFFICIAL, OfficialWaAdapter),
        ],
    )
    def test_every_real_channel_builds(self, kind: ChannelKind, cls: type) -> None:
        adapter = build_adapter(kind)
        assert isinstance(adapter, cls)

    def test_registry_covers_every_real_channel(self) -> None:
        assert set(ADAPTERS) == {ChannelKind.BAILEYS, ChannelKind.TWILIO, ChannelKind.OFFICIAL}
        assert ChannelKind.NONE not in ADAPTERS


class TestWhatsAppIsNotAVoiceChannel:
    @pytest.mark.asyncio
    async def test_baileys_transfer_is_refused(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("BAILEYS_SESSION_DIR", "/tmp/baileys")
        with pytest.raises(ChannelUnavailable) as exc:
            await BaileysAdapter().transfer(CANONICAL, call_id="c1")
        assert exc.value.retryable is False
        assert "text channel" in str(exc.value)
