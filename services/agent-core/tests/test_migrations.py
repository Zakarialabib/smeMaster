"""Migration tests — the SQL is verified, not trusted.

A migration file nobody executes is a comment. These tests apply
`0001_tenants.sql` to a real Postgres and assert the invariants it claims:
the CHECK constraints actually reject, the indexes exist, and the columns the
console reads are the columns it gets.

**Skipped, not failed, when Postgres is absent.** CI and a developer machine with
Docker both have it; a laptop without does not. A missing database is an
environment fact, not a code defect - and per this repo's rule, report the skip
rather than fake a pass.
"""

from __future__ import annotations

import os
import pathlib
from typing import Iterator

import pytest
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

MIGRATIONS = pathlib.Path(__file__).resolve().parents[1] / "migrations"
ADMIN_URL = os.getenv("AGENT_CORE_TEST_DATABASE_URL")


def _url() -> str:
    # A per-run schema keeps a developer's real database untouched.
    return f"{ADMIN_URL.rstrip('/')}" if ADMIN_URL else ""


@pytest.fixture(scope="module")
def pg() -> Iterator[sa.Connection]:
    if not ADMIN_URL:
        pytest.skip("AGENT_CORE_TEST_DATABASE_URL not set (no Postgres to verify the SQL)")
    eng = sa.create_engine(_url())
    with eng.connect() as conn:
        conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        conn.execute(sa.text("DROP SCHEMA IF EXISTS agent_core_test CASCADE"))
        conn.execute(sa.text("CREATE SCHEMA agent_core_test"))
        conn.execute(sa.text("SET search_path TO agent_core_test"))
        conn.commit()
        try:
            yield conn
        finally:
            conn.execute(sa.text("DROP SCHEMA IF EXISTS agent_core_test CASCADE"))
            conn.commit()
            eng.dispose()


def _apply(conn: sa.Connection, name: str) -> None:
    sql = (MIGRATIONS / name).read_text(encoding="utf-8")
    for statement in [s.strip() for s in sql.split(";")]:
        if statement and not statement.startswith("--"):
            conn.execute(sa.text(statement))
    conn.commit()


class TestTenantsMigration:
    def test_migration_file_exists_and_is_numbered(self) -> None:
        files = sorted(p.name for p in MIGRATIONS.glob("*.sql"))
        assert files, "no migrations found"
        assert files[0] == "0001_tenants.sql", "migrations are NNNN_snake_case, zero-padded"
        for f in files:
            assert len(f.split("_")[0]) == 4

    def test_applies_cleanly(self, pg: sa.Connection) -> None:
        _apply(pg, "0001_tenants.sql")
        cols = {r["column_name"] for r in sa.inspect(pg).get_columns("tenants")}
        # Exactly what the console's Config + Topology screens read.
        for required in {
            "id", "name", "tz", "business_hours", "transfer_target", "answering",
            "tier", "after_hours_mode", "voice_fr", "voice_en",
            "disclosure_fr", "disclosure_en", "created_at",
        }:
            assert required in cols, f"missing column {required}"
        # And nothing audio-shaped: the no-audio rule is a schema property.
        assert not (cols & {"audio", "audio_url", "recording", "recording_path"})

    def test_answering_without_a_transfer_target_is_rejected(self, pg: sa.Connection) -> None:
        """The whole point of the table: a tenant that answers must have somewhere
        to send a caller."""
        _apply(pg, "0001_tenants.sql")
        with pytest.raises(sa.exc.IntegrityError):
            pg.execute(sa.text("INSERT INTO tenants (name, answering) VALUES ('bad', true)"))
        pg.rollback()

    def test_answering_with_a_transfer_target_is_accepted(self, pg: sa.Connection) -> None:
        _apply(pg, "0001_tenants.sql")
        pg.execute(
            sa.text(
                "INSERT INTO tenants (name, answering, transfer_target)"
                " VALUES ('good', true, '+33612345678')"
            )
        )
        pg.commit()
        row = pg.execute(sa.text("SELECT name FROM tenants WHERE name='good'")).first()
        assert row is not None and row[0] == "good"

    def test_unknown_tier_is_rejected(self, pg: sa.Connection) -> None:
        _apply(pg, "0001_tenants.sql")
        with pytest.raises(sa.exc.IntegrityError):
            pg.execute(sa.text("INSERT INTO tenants (name, tier) VALUES ('bad', 'gold')"))
        pg.rollback()

    def test_defaults_match_the_console(self, pg: sa.Connection) -> None:
        _apply(pg, "0001_tenants.sql")
        pg.execute(sa.text("INSERT INTO tenants (name) VALUES ('d')"))
        pg.commit()
        row = pg.execute(
            sa.text("SELECT tier, after_hours_mode, answering, tz FROM tenants WHERE name='d'")
        ).first()
        assert row is not None
        # These are the values the prototype's Config screen shows.
        assert tuple(row) == ("standard", "take_message", False, "Europe/Paris")

    def test_type_assertions_match_the_contract(self) -> None:
        """Cheap, DB-free guard so the SQL and the pydantic model cannot drift."""
        sql = (MIGRATIONS / "0001_tenants.sql").read_text(encoding="utf-8").lower()
        assert "jsonb" in sql, "business_hours is jsonb in both"
        assert "uuid primary key" in sql, "id is a uuid in both"
        # The pydantic side must not have grown a tenant-facing locale list.
        from agent_core.contracts import ProviderTier

        assert {t.value for t in ProviderTier} == {"budget", "standard", "premium", "selfhosted"}
        assert "locales" not in sql, "no locale list column - voice is FR/EN only"


class TestMigrationDeclaresItsInvariants:
    """DB-free structural guards.

    The Postgres tests above are the real proof, but they SKIP on a host without a
    database - and a skipped test is not a regression detector. These assert the
    migration still *declares* what it claims, so deleting a CHECK constraint is
    caught even on a machine with no Postgres. They are a floor, not a ceiling.
    """

    @pytest.fixture(scope="class")
    @staticmethod
    def sql() -> str:
        return (MIGRATIONS / "0001_tenants.sql").read_text(encoding="utf-8").lower()

    def test_answering_constraint_is_declared(self, sql: str) -> None:
        assert "constraint answering_requires_transfer_target" in sql
        # A constraint with a stray OR can be trivially always-true, which is what
        # a first draft of this very file did. Require the two-clause form.
        assert "not answering or transfer_target is not null" in sql.replace("  ", " ")

    def test_tier_is_constrained(self, sql: str) -> None:
        assert "check (tier in ('budget', 'standard', 'premium', 'selfhosted'))" in sql

    def test_after_hours_is_constrained(self, sql: str) -> None:
        assert "take_message" in sql
        assert "announce_only" in sql

    def test_no_audio_column_anywhere(self, sql: str) -> None:
        """The no-audio rule is a schema property, not only a UI one."""
        for banned in (" audio ", "recording", "audio_url", "blob"):
            assert banned not in sql, f"migration must not introduce {banned!r}"

    def test_statements_are_terminated(self, sql: str) -> None:
        body = "\n".join(
            ln for ln in sql.splitlines() if ln.strip() and not ln.strip().startswith("--")
        )
        assert body.rstrip().endswith(";")
