"""The `configured` flag is DERIVED, never stored.

`BACKEND.md` §4: the capability flags report what is genuinely configured —
never a fake success. A stored `configured: true` goes stale the moment a
credential is removed, and a stale true is exactly the lie the design forbids.

These tests prove the derivation by setting and unsetting the environment
variables a channel needs, and watching the flag follow.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from agent_core.storage import apply_migrations

#: Every channel env var, so a test can clear them all and start honest.
_ALL_CHANNEL_VARS = (
    "BAILEYS_SESSION_DIR",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "META_WA_TOKEN",
    "META_WA_PHONE_ID",
)


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    for var in _ALL_CHANNEL_VARS:
        monkeypatch.delenv(var, raising=False)
    db = tmp_path / "test.db"
    migrations = Path(__file__).parent.parent / "migrations"
    apply_migrations(db, migrations)
    monkeypatch.setenv("AGENT_CORE_DB_PATH", str(db))

    import importlib

    import agent_core.api as api_mod

    importlib.reload(api_mod)
    with TestClient(api_mod.app) as c:
        yield c


class TestConfiguredIsDerived:
    def test_all_channels_unconfigured_with_no_env(self, client: TestClient) -> None:
        channels = client.get("/config").json()["channels"]
        for name in ("baileys", "twilio", "official"):
            assert channels[name]["configured"] is False, f"{name} claimed configured"
            assert channels[name]["reason"], f"{name} gave no reason"

    def test_baileys_flips_when_the_session_appears(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("BAILEYS_SESSION_DIR", "/tmp/baileys")
        channels = client.get("/config").json()["channels"]
        assert channels["baileys"]["configured"] is True
        assert channels["baileys"]["reason"] is None

    def test_twilio_needs_both_vars(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACxxx")
        assert client.get("/config").json()["channels"]["twilio"]["configured"] is False
        monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok")
        assert client.get("/config").json()["channels"]["twilio"]["configured"] is True

    def test_a_stored_configured_true_is_overridden(
        self, client: TestClient
    ) -> None:
        """The client may ENABLE a channel; it may not CLAIM one is configured."""
        resp = client.put(
            "/config",
            json={"channels": {"baileys": {"enabled": True, "configured": True}}},
        )
        body = resp.json()
        # enabled is honoured (the client's intent)...
        assert body["channels"]["baileys"]["enabled"] is True
        # ...but configured is the server's answer, and there are no credentials.
        assert body["channels"]["baileys"]["configured"] is False

    def test_removing_a_credential_flips_the_flag_back(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The staleness this design exists to prevent."""
        monkeypatch.setenv("META_WA_TOKEN", "tok")
        monkeypatch.setenv("META_WA_PHONE_ID", "123")
        assert client.get("/config").json()["channels"]["official"]["configured"] is True

        monkeypatch.delenv("META_WA_TOKEN")
        assert client.get("/config").json()["channels"]["official"]["configured"] is False

    def test_every_real_channel_is_reported(self, client: TestClient) -> None:
        channels = client.get("/config").json()["channels"]
        assert set(channels) == {"baileys", "twilio", "official"}
        # `none` is not an adapter and must not appear as one.
        assert "none" not in channels
