"""DB-free structural tests for migrations 0002-0004.

These run everywhere, including on a machine with no Postgres. The
`TestMigrationsAgainstRealPostgres` class in test_migrations.py applies the same
SQL to a real database; this file asserts the things that are checkable from the
text, so a dropped CHECK or a renamed column is caught without a database.

The value of these is highest for the constraints that encode a DECISION:
no audio column, masked-by-default caller, money as NUMERIC, a price list
version on every cost row, and the two-vector-space invariant.
"""

from __future__ import annotations

import pathlib
import re

import pytest

MIGRATIONS = pathlib.Path(__file__).resolve().parent.parent / "migrations"


def sql(name: str) -> str:
    return (MIGRATIONS / name).read_text(encoding="utf-8")


ALL_MIGRATIONS = sorted(p.name for p in MIGRATIONS.glob("*.sql"))


def strip_comments(sql_text: str) -> str:
    """Remove `--` comments before asserting a rule about COLUMNS.

    A comment that says "there is no audio_url" must not read as a violation, or
    the rule becomes untestable exactly when it is being honoured and written
    down. Reading the comments is how the schema documents itself.
    """
    return re.sub(r"--[^\n]*", "", sql_text).lower()


class TestMigrationSet:
    def test_the_four_migrations_exist_and_are_ordered(self) -> None:
        assert ALL_MIGRATIONS == [
            "0001_tenants.sql",
            "0002_calls.sql",
            "0003_metering.sql",
            "0004_knowledge.sql",
        ]

    def test_each_migration_creates_its_table_idempotently(self) -> None:
        # IF NOT EXISTS everywhere: a re-run must not fail, because a half-applied
        # migration is the worst state to be in.
        for name in ALL_MIGRATIONS:
            body = sql(name)
            creates = re.findall(r"CREATE TABLE (?!IF NOT EXISTS)", body)
            assert not creates, f"{name} has a non-idempotent CREATE TABLE"

    def test_every_foreign_key_cascades_or_nulls_deliberately(self) -> None:
        # ON DELETE behaviour must be explicit. An implicit NO ACTION means
        # deleting a tenant fails halfway and leaves orphans.
        #
        # Match the WHOLE statement, not just what follows the column list: the
        # price-list FK is added via ALTER TABLE and has its ON DELETE at the end
        # of a different line.
        for name in ALL_MIGRATIONS:
            pattern = r"ADD CONSTRAINT\s+\w+\s+FOREIGN KEY.*?;"
            for stmt in re.findall(pattern, sql(name), re.S):
                assert "ON DELETE" in stmt.upper(), f"{name}: {stmt[:80]!r}"
            inline = (
                r"REFERENCES\s+\w+\([^)]+\)"
                r"((?:[^,;]|\n)*?)(,|;|\n\s*(?:CREATE|ALTER|\)))"
            )
            for m in re.finditer(inline, sql(name)):
                tail = m.group(1)
                assert "ON DELETE" in tail.upper(), f"{name}: FK without ON DELETE: {tail!r}"


class TestNoAudioAnywhere:
    """The rule that must not be quietly broken by a later migration."""

    def test_no_migration_has_an_audio_column(self) -> None:
        for name in ALL_MIGRATIONS:
            body = strip_comments(sql(name))
            for banned in (
                "audio_url", "audio_blob", "recording_url", "recording_path", " pcm ", " wav ",
            ):
                assert banned not in body, f"{name} declares an audio column: {banned!r}"

    def test_the_no_audio_rule_is_documented_where_it_applies(self) -> None:
        # The comment that gets stripped above must actually be there.
        assert "no audio column" in sql("0002_calls.sql").lower()

    def test_audio_seconds_is_a_metering_unit_not_a_stored_file(self) -> None:
        # Duration is legitimate - you are billed for it. A file is not.
        assert "audio_seconds" in sql("0003_metering.sql")
        assert "audio_path" not in sql("0003_metering.sql").lower()


class TestCallsTable:
    def test_caller_is_stored_masked_alongside_e164(self) -> None:
        body = sql("0002_calls.sql")
        assert "caller_masked" in body, "the console renders the masked number"

    def test_test_calls_are_separable_from_real_ones(self) -> None:
        # A count that mixes test traffic with real traffic cannot be billed from.
        assert "test_call" in sql("0002_calls.sql")

    def test_purpose_and_outcome_are_not_confused(self) -> None:
        body = sql("0002_calls.sql")
        assert "purpose" in body
        assert re.search(r"outcome\s+text", body), "outcome must stay open-ended"

    def test_four_stage_latency_marks_are_present_and_nullable(self) -> None:
        body = sql("0002_calls.sql")
        for col in ("vad_ms", "stt_ms", "llm_ms", "tts_ms", "turn_gap_ms"):
            assert re.search(rf"{col}\s+integer", body), f"{col} missing"
            assert not re.search(rf"{col}\s+integer\s+NOT NULL", body), (
                f"{col} must be nullable - a call that fails before turning has no marks"
            )

    def test_summaries_are_marked_as_inference(self) -> None:
        body = sql("0002_calls.sql")
        assert "summary" in body and "contained" in body
        assert "INFERENCE" in body, "the schema should say which columns are computed"

    def test_provider_names_are_stored_but_not_credentials(self) -> None:
        body = strip_comments(sql("0002_calls.sql"))
        for col in ("llm_provider", "tts_provider", "stt_provider"):
            assert col in body
        for banned in ("api_key", "secret", "credential", "token"):
            assert banned not in body, f"{banned} must never be a column"

    def test_the_credential_rule_is_documented_where_it_applies(self) -> None:
        assert "never credentials" in sql("0002_calls.sql").lower()


class TestMeteringTable:
    def test_money_is_numeric_never_float(self) -> None:
        body = sql("0003_metering.sql").lower()
        assert "cost_usd        numeric(12, 6)" in body or "cost_usd" in body
        for line in body.splitlines():
            floats = ("real", "double precision", "float")
            if "cost_" in line and any(f in line for f in floats):
                pytest.fail(f"money in floating point: {line.strip()}")

    def test_every_cost_row_names_its_price_list(self) -> None:
        # A cost row that does not say which price list produced it is not
        # auditable, and cannot be defended to a client.
        assert "price_list_version" in sql("0003_metering.sql")

    def test_price_list_version_is_a_real_foreign_key(self) -> None:
        body = sql("0003_metering.sql")
        assert "REFERENCES price_list_versions(version)" in body

    def test_price_lists_can_mark_themselves_unverified(self) -> None:
        # This is the mechanism that stops a provisional number being presented
        # to a client as a price.
        assert "is_verified" in sql("0003_metering.sql")
        assert "verified_on" in sql("0003_metering.sql")

    def test_the_provider_recorded_is_the_one_that_answered(self) -> None:
        body = sql("0003_metering.sql")
        assert "ANSWERED" in body or "answered" in body.lower()


class TestKnowledgeTable:
    def test_vector_dim_and_space_are_columns(self) -> None:
        body = sql("0004_knowledge.sql")
        assert re.search(r"dim\s+integer\s+NOT NULL", body)
        assert re.search(r"space\s+text\s+NOT NULL", body)

    def test_the_two_vector_spaces_are_named_in_the_schema(self) -> None:
        # 384 (desktop bge-small-en-v1.5) and 1024 (server bge-m3) must never be
        # merged - RAG-FORK.md. Naming both here is what makes that a fact the
        # next reader inherits rather than a rule they have to remember.
        body = sql("0004_knowledge.sql")
        assert "384" in body and "1024" in body

    def test_no_hnsw_index_is_written_before_the_model_is_chosen(self) -> None:
        # pgvector's HNSW needs the dimension at DDL time. Writing it now would
        # hard-code the pending RAG-FORK decision into the schema.
        body = strip_comments(sql("0004_knowledge.sql"))
        assert "using hnsw" not in body, "no vector index before the model is chosen"
        assert "TODO(RAG-FORK" in sql("0004_knowledge.sql"), (
            "the omission must be declared, not silent"
        )

    def test_unapproved_knowledge_is_visible_as_such(self) -> None:
        body = sql("0004_knowledge.sql")
        assert "approved_by" in body
        assert "unreviewed" in body.lower() or "approved" in body.lower()

    def test_source_language_is_fr_or_en_only(self) -> None:
        # Matches the voice constraint: the agent speaks fr/en, so a third
        # language in the KB has no way to be retrieved and spoken.
        body = sql("0004_knowledge.sql")
        assert re.search(r"language\s+text[^;]*IN \('fr', 'en'\)", body, re.S)
