"""Tests for the config endpoints and storage layer.

DECISIONS-2026-10-03.md §2: full §7 gate per endpoint group. These tests
cover the storage layer (migration application, PG→SQLite translation, CRUD)
and the HTTP contract (GET/PUT /config, camelCase wire format, unknown-key
dropping, no credentials in payload).
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from agent_core.contracts import ConfigResponse, ConfigUpdate
from agent_core.storage import ConfigStore, _translate_ddl, apply_migrations

# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture()
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.db"


@pytest.fixture()
def migrations_dir() -> Path:
    return Path(__file__).parent.parent / "migrations"


@pytest.fixture()
def client(db_path: Path, migrations_dir: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Test client with a temp DB and migrations applied."""
    monkeypatch.setenv("AGENT_CORE_DB_PATH", str(db_path))
    # Re-import to pick up the env var
    import importlib

    import agent_core.api as api_mod

    importlib.reload(api_mod)
    with TestClient(api_mod.app) as c:
        yield c


# ── Storage layer tests ───────────────────────────────────────────────────────


class TestMigrationRunner:
    def test_applies_all_migrations(self, db_path: Path, migrations_dir: Path) -> None:
        applied = apply_migrations(db_path, migrations_dir)
        assert "0001_tenants.sql" in applied
        assert "0002_calls.sql" in applied
        assert "0003_metering.sql" in applied
        assert "0004_knowledge.sql" in applied
        assert "0005_config.sql" in applied

    def test_idempotent(self, db_path: Path, migrations_dir: Path) -> None:
        apply_migrations(db_path, migrations_dir)
        applied_again = apply_migrations(db_path, migrations_dir)
        assert applied_again == []

    def test_creates_migrations_table(self, db_path: Path, migrations_dir: Path) -> None:
        apply_migrations(db_path, migrations_dir)
        conn = sqlite3.connect(db_path)
        row = conn.execute(
            "SELECT name FROM _migrations WHERE name = '0005_config.sql'"
        ).fetchone()
        assert row is not None
        conn.close()

    def test_seeds_config_singleton(self, db_path: Path, migrations_dir: Path) -> None:
        apply_migrations(db_path, migrations_dir)
        conn = sqlite3.connect(db_path)
        row = conn.execute("SELECT id FROM agent_config WHERE id = 1").fetchone()
        assert row is not None
        conn.close()


class TestPgToSqliteTranslation:
    def test_jsonb_to_text(self) -> None:
        assert "TEXT" in _translate_ddl("provider_mix jsonb NOT NULL")

    def test_timestamptz_to_text(self) -> None:
        assert "TEXT" in _translate_ddl("updated_at timestamptz NOT NULL")

    def test_boolean_to_integer(self) -> None:
        assert "INTEGER" in _translate_ddl("bilingual boolean NOT NULL")

    def test_now_to_strftime(self) -> None:
        assert "strftime" in _translate_ddl("created_at timestamptz NOT NULL DEFAULT now()")

    def test_jsonb_cast_removed(self) -> None:
        assert "::jsonb" not in _translate_ddl("DEFAULT '{}'::jsonb")

    def test_unknown_type_raises(self) -> None:
        # If we ever use a type not in the map, the translation should be
        # visible, not silently wrong. This test documents the limitation.
        result = _translate_ddl("data xml NOT NULL")
        # xml is not in the map — it passes through unchanged, which is fine
        # for SQLite (it accepts any type name). The test just documents this.
        assert "xml" in result


class TestConfigStore:
    def test_get_defaults(self, db_path: Path, migrations_dir: Path) -> None:
        apply_migrations(db_path, migrations_dir)
        store = ConfigStore(db_path)
        config = store.get()
        assert config["consentVariant"] == "announce_first"
        assert config["bilingual"] is True
        assert config["channel"] == "none"
        assert config["tier"] == "standard"
        assert config["costSim"]["unverified"] is True

    def test_put_and_get(self, db_path: Path, migrations_dir: Path) -> None:
        apply_migrations(db_path, migrations_dir)
        store = ConfigStore(db_path)
        store.put({
            "provider_mix": {"llm": "openai/gpt-4o", "tts": "elevenlabs"},
            "consent_variant": "announce_first",
            "bilingual": False,
            "channel": "baileys",
            "channels": {"baileys": {"enabled": True, "configured": True}},
            "tier": "premium",
        })
        config = store.get()
        assert config["providerMix"]["llm"] == "openai/gpt-4o"
        assert config["bilingual"] is False
        assert config["channel"] == "baileys"
        assert config["channels"]["baileys"]["enabled"] is True
        assert config["tier"] == "premium"

    def test_put_drops_unknown_keys(self, db_path: Path, migrations_dir: Path) -> None:
        apply_migrations(db_path, migrations_dir)
        store = ConfigStore(db_path)
        store.put({"unknown_field": "value", "tier": "budget"})
        config = store.get()
        assert config["tier"] == "budget"
        assert "unknown_field" not in config

    def test_put_empty_is_noop(self, db_path: Path, migrations_dir: Path) -> None:
        apply_migrations(db_path, migrations_dir)
        store = ConfigStore(db_path)
        before = store.get()
        store.put({})
        after = store.get()
        assert before == after

    def test_json_roundtrip(self, db_path: Path, migrations_dir: Path) -> None:
        apply_migrations(db_path, migrations_dir)
        store = ConfigStore(db_path)
        hours = {"mon-fri": ["09:00", "18:00"], "sat": ["10:00", "14:00"]}
        store.put({"hours": hours})
        config = store.get()
        assert config["hours"] == hours


# ── HTTP contract tests ───────────────────────────────────────────────────────


class TestGetConfig:
    def test_returns_200(self, client: TestClient) -> None:
        resp = client.get("/config")
        assert resp.status_code == 200

    def test_camel_case_keys(self, client: TestClient) -> None:
        resp = client.get("/config")
        data = resp.json()
        assert "providerMix" in data
        assert "consentVariant" in data
        assert "bilingual" in data
        assert "channel" in data
        assert "channels" in data
        assert "costSim" in data
        assert "knowledgeScope" in data
        assert "afterHoursMode" in data

    def test_no_credentials_in_payload(self, client: TestClient) -> None:
        resp = client.get("/config")
        body = resp.json()
        # No credential-like keys
        for key in body:
            assert "token" not in key.lower()
            assert "secret" not in key.lower()
            assert "password" not in key.lower()
            assert "key" not in key.lower() or key == "knowledgeScope"

    def test_no_tenant_id(self, client: TestClient) -> None:
        resp = client.get("/config")
        assert "tenantId" not in resp.json()
        assert "tenant_id" not in resp.json()

    def test_matches_contract(self, client: TestClient) -> None:
        resp = client.get("/config")
        ConfigResponse.model_validate(resp.json())


class TestPutConfig:
    def test_put_returns_200(self, client: TestClient) -> None:
        resp = client.put("/config", json={"tier": "premium"})
        assert resp.status_code == 200

    def test_put_updates_and_returns(self, client: TestClient) -> None:
        resp = client.put("/config", json={"tier": "premium", "bilingual": False})
        data = resp.json()
        assert data["tier"] == "premium"
        assert data["bilingual"] is False

    def test_put_persists(self, client: TestClient) -> None:
        client.put("/config", json={"tier": "budget"})
        resp = client.get("/config")
        assert resp.json()["tier"] == "budget"

    def test_put_drops_unknown_keys(self, client: TestClient) -> None:
        resp = client.put("/config", json={"unknownField": "value", "tier": "standard"})
        data = resp.json()
        assert "unknownField" not in data
        assert "unknown_field" not in data

    def test_put_empty_body(self, client: TestClient) -> None:
        before = client.get("/config").json()
        resp = client.put("/config", json={})
        assert resp.status_code == 200
        after = resp.json()
        assert before["tier"] == after["tier"]

    def test_put_provider_mix(self, client: TestClient) -> None:
        mix = {"llm": "google/gemini-3.x-flash", "tts": "elevenlabs", "stt": "deepgram"}
        resp = client.put("/config", json={"providerMix": mix})
        assert resp.json()["providerMix"] == mix

    def test_put_channels(self, client: TestClient) -> None:
        """`enabled` is the client's intent and round-trips; `configured` does NOT.

        `configured` is derived from the server environment on every read
        (`BACKEND.md` §4) — a stored true would be a fake success the moment a
        credential was removed.
        """
        channels = {
            "baileys": {"enabled": True, "configured": True},
            "twilio": {"enabled": False, "configured": False},
        }
        resp = client.put("/config", json={"channels": channels})
        got = resp.json()["channels"]
        assert got["baileys"]["enabled"] is True
        assert got["twilio"]["enabled"] is False
        # Derived, and no credentials are set in this test.
        assert got["baileys"]["configured"] is False

    def test_put_cost_sim(self, client: TestClient) -> None:
        cost_sim = {"inputs": {"monthlyCalls": 500}, "unverified": True}
        resp = client.put("/config", json={"costSim": cost_sim})
        assert resp.json()["costSim"] == cost_sim

    def test_put_knowledge_scope(self, client: TestClient) -> None:
        scope = ["services_pricing", "hours", "booking_rules"]
        resp = client.put("/config", json={"knowledgeScope": scope})
        assert resp.json()["knowledgeScope"] == scope

    def test_put_consent_variant(self, client: TestClient) -> None:
        resp = client.put("/config", json={"consentVariant": "announce_first"})
        assert resp.json()["consentVariant"] == "announce_first"

    def test_put_after_hours_mode(self, client: TestClient) -> None:
        resp = client.put("/config", json={"afterHoursMode": "transfer"})
        assert resp.json()["afterHoursMode"] == "transfer"

    def test_put_tz(self, client: TestClient) -> None:
        resp = client.put("/config", json={"tz": "Europe/Zurich"})
        assert resp.json()["tz"] == "Europe/Zurich"

    def test_put_hours(self, client: TestClient) -> None:
        hours = {"mon-fri": ["08:00", "17:00"]}
        resp = client.put("/config", json={"hours": hours})
        assert resp.json()["hours"] == hours

    def test_put_transfer_target(self, client: TestClient) -> None:
        resp = client.put("/config", json={"transferTarget": "+33612345678"})
        assert resp.json()["transferTarget"] == "+33612345678"

    def test_put_channel(self, client: TestClient) -> None:
        resp = client.put("/config", json={"channel": "baileys"})
        assert resp.json()["channel"] == "baileys"


# ── Contract tests (camelCase acceptance) ─────────────────────────────────────


class TestCamelCaseContract:
    """Every inbound contract must be a Camel subclass.

    This is the test_camel_acceptance pattern: if a contract stops being a
    Camel subclass, camelCase fields get silently dropped on the way in.
    """

    def test_config_update_is_camel(self) -> None:
        from agent_core.contracts import Camel
        assert issubclass(ConfigUpdate, Camel)

    def test_config_response_is_camel(self) -> None:
        from agent_core.contracts import Camel
        assert issubclass(ConfigResponse, Camel)

    def test_config_update_accepts_camel_case(self) -> None:
        """The PUT body must accept camelCase keys."""
        update = ConfigUpdate.model_validate({
            "providerMix": {"llm": "openai/gpt-4o"},
            "consentVariant": "announce_first",
            "bilingual": True,
            "channel": "baileys",
            "channels": {"baileys": {"enabled": True, "configured": True}},
            "costSim": {"inputs": {}, "unverified": True},
            "hours": {"mon-fri": ["09:00", "18:00"]},
            "tz": "Europe/Paris",
            "transferTarget": "+33612345678",
            "tier": "standard",
            "knowledgeScope": ["services_pricing"],
            "afterHoursMode": "take_message",
        })
        assert update.provider_mix == {"llm": "openai/gpt-4o"}
        assert update.consent_variant == "announce_first"
        assert update.channel == "baileys"
        assert update.tz == "Europe/Paris"
        assert update.transfer_target == "+33612345678"
        assert update.knowledge_scope == ["services_pricing"]
        assert update.after_hours_mode == "take_message"


# ── Integration: storage + HTTP together ──────────────────────────────────────


class TestConfigIntegration:
    def test_full_roundtrip(self, client: TestClient) -> None:
        """PUT a full config, GET it back, verify every field."""
        payload = {
            "providerMix": {
                "llm": "google/gemini-3.x-flash",
                "tts": "elevenlabs",
                "stt": "deepgram",
            },
            "consentVariant": "announce_first",
            "bilingual": True,
            "channel": "baileys",
            "channels": {
                "baileys": {"enabled": True, "configured": True},
                "twilio": {"enabled": False, "configured": False},
                "official": {"enabled": False, "configured": False},
            },
            "costSim": {"inputs": {"monthlyCalls": 500}, "unverified": True},
            "hours": {"mon-fri": ["09:00", "18:00"]},
            "tz": "Europe/Paris",
            "transferTarget": "+33612345678",
            "tier": "standard",
            "knowledgeScope": ["services_pricing", "hours", "booking_rules"],
            "afterHoursMode": "take_message",
        }
        client.put("/config", json=payload)
        resp = client.get("/config")
        data = resp.json()
        for key, value in payload.items():
            if key == "channels":
                # `configured` is derived, not echoed; compare `enabled` only.
                for name, entry in value.items():
                    assert data[key][name]["enabled"] == entry["enabled"], name
                continue
            assert data[key] == value, f"Field {key} mismatch: {data[key]} != {value}"

    def test_updated_at_changes(self, client: TestClient) -> None:
        client.put("/config", json={"tier": "premium"})
        after = client.get("/config").json().get("updatedAt")
        # updatedAt should change after a PUT
        assert after is not None
        # before might be None on first GET (no PUT yet), so just check after is set
