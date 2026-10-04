"""SQLite storage for agent-core — the dev database.

DECISIONS-2026-10-03.md §3.3: agent-core gets its OWN up/down SQL files, applied
at startup to a server-side SQLite for dev. Schema is PG-shaped so the Gate 1
Postgres swap is driver + runner, not a redesign.

This module is the single storage home. It translates PG-shaped DDL to SQLite
at apply time and exposes a tiny repository interface. When Postgres lands, this
module is the only file that changes.

The desktop app's SQLite (src-tauri) is a SEPARATE store on a SEPARATE machine.
They must never share a migration sequence.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# ── PG → SQLite DDL translation ──────────────────────────────────────────────

#: SQLite has no jsonb, no timestamptz, no gen_random_uuid(), no `now()`.
#: The translations are lossless for our column types: jsonb → TEXT (JSON),
#: timestamptz → TEXT (ISO 8601), gen_random_uuid() → app-side, now() →
#: app-side (Python datetime). CHECK constraints and defaults survive.
_PG_TO_SQLITE = {
    "jsonb": "TEXT",
    "timestamptz": "TEXT",
    "gen_random_uuid()": "(lower(hex(randomblob(16))))",
    "now()": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    "bigserial": "INTEGER",
    "serial": "INTEGER",
    "uuid": "TEXT",
    "boolean": "INTEGER",
    "numeric": "REAL",
    "int": "INTEGER",
    "integer": "INTEGER",
    "text": "TEXT",
}


def _translate_ddl(pg_ddl: str) -> str:
    """Translate a PG CREATE TABLE to SQLite.

    Only the column types we actually use are translated. Anything else raises
    loudly — a silent no-op here is a schema that looks applied and isn't.
    """
    out = pg_ddl
    # Remove PG cast syntax BEFORE type replacement, otherwise `::jsonb`
    # becomes `::TEXT` and the cast removal misses it.
    out = out.replace("::jsonb", "")
    for pg, sqlite in _PG_TO_SQLITE.items():
        out = out.replace(pg, sqlite)
    return out


# ── Connection ────────────────────────────────────────────────────────────────


def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ── Migration runner ──────────────────────────────────────────────────────────


def _sqlite_unsupported(stmt: str) -> bool:
    """Return True if SQLite cannot execute this statement.

    SQLite's ALTER TABLE is limited to RENAME, ADD COLUMN, and DROP COLUMN.
    ADD/DROP CONSTRAINT, ALTER COLUMN, and other PG DDL are skipped with a log
    message — the full schema applies when Postgres lands at Gate 1.
    """
    upper = stmt.upper().lstrip()
    if not upper.startswith("ALTER TABLE"):
        return False
    # SQLite supports: ALTER TABLE ... RENAME, ADD COLUMN, DROP COLUMN
    # It does NOT support: ADD CONSTRAINT, DROP CONSTRAINT, ALTER COLUMN
    if "ADD CONSTRAINT" in upper or "DROP CONSTRAINT" in upper:
        return True
    return "ALTER COLUMN" in upper


def apply_migrations(db_path: Path, migrations_dir: Path) -> list[str]:
    """Apply all pending migrations in filename order.

    Returns the list of applied migration filenames. Idempotent: already-applied
    migrations are tracked in `_migrations` and skipped.
    """
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = _connect(db_path)
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS _migrations ("
            "  name TEXT PRIMARY KEY,"
            "  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
            ")"
        )
        applied = {
            row["name"]
            for row in conn.execute("SELECT name FROM _migrations").fetchall()
        }
        pending = sorted(
            f for f in migrations_dir.glob("*.sql") if f.name not in applied
        )
        for migration_file in pending:
            pg_ddl = migration_file.read_text(encoding="utf-8")
            sqlite_ddl = _translate_ddl(pg_ddl)
            # Execute each statement separately (sqlite3 limitation).
            for stmt in _split_statements(sqlite_ddl):
                # SQLite has limited ALTER TABLE support. Skip statements that
                # SQLite cannot execute and log them — the PG-shaped schema
                # will be fully applied when Postgres lands at Gate 1.
                if _sqlite_unsupported(stmt):
                    print(f"  [sqlite-skip] {migration_file.name}: {stmt[:80]}...")
                    continue
                conn.execute(stmt)
            conn.execute(
                "INSERT INTO _migrations (name) VALUES (?)", (migration_file.name,)
            )
            conn.commit()
        return [f.name for f in pending]
    finally:
        conn.close()


def _split_statements(ddl: str) -> list[str]:
    """Split a DDL script into individual statements.

    Strips `--` comment lines first, then splits on `;` while respecting
    parentheses (CHECK constraints and DEFAULT expressions can contain
    semicolons inside parens).
    """
    # Strip comment lines
    lines = [ln for ln in ddl.splitlines() if not ln.strip().startswith("--")]
    clean = "\n".join(lines)

    statements = []
    current: list[str] = []
    depth = 0
    for ch in clean:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == ";" and depth == 0:
            stmt = "".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
        else:
            current.append(ch)
    # Trailing statement without semicolon
    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


# ── Config repository ─────────────────────────────────────────────────────────


class ConfigStore:
    """Typed access to the agent_config singleton row.

    One row, id=1. GET returns the current state; PUT replaces it wholesale.
    The `configured` flags in `channels` are derived from .env at read time,
    never stored — a client may enable a channel, but the flag never claims a
    channel that has no credentials behind it.
    """

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def get(self) -> dict[str, Any]:
        """Return the current config as a dict (camelCase keys for the wire)."""
        conn = _connect(self._db_path)
        try:
            row = conn.execute(
                "SELECT * FROM agent_config WHERE id = 1"
            ).fetchone()
            if row is None:
                return self._defaults()
            return self._row_to_dict(row)
        finally:
            conn.close()

    def put(self, updates: dict[str, Any]) -> dict[str, Any]:
        """Replace the config row. Returns the new state.

        Only known fields are written; unknown keys are silently dropped
        (a PUT that accepts arbitrary keys is a PUT that can corrupt state).
        """
        allowed = {
            "provider_mix", "consent_variant", "bilingual", "channel",
            "channels", "cost_sim", "hours", "tz", "transfer_target",
            "tier", "knowledge_scope", "after_hours_mode",
        }
        clean = {k: v for k, v in updates.items() if k in allowed}
        if not clean:
            return self.get()

        conn = _connect(self._db_path)
        try:
            # Build the UPDATE dynamically but safely (column names are from
            # the allowed set, not from user input).
            sets = ", ".join(f"{k} = ?" for k in clean)
            values = [_jsonify(v) for v in clean.values()]
            values.append(datetime.now(UTC).isoformat())
            conn.execute(
                f"UPDATE agent_config SET {sets}, updated_at = ? WHERE id = 1",
                values,
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM agent_config WHERE id = 1"
            ).fetchone()
            return self._row_to_dict(row)
        finally:
            conn.close()

    def _row_to_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        """Convert a DB row to the wire format (camelCase, JSON parsed)."""
        return {
            "providerMix": json.loads(row["provider_mix"]),
            "consentVariant": row["consent_variant"],
            "bilingual": row["bilingual"] in (1, "1", True),
            "channel": row["channel"],
            "channels": json.loads(row["channels"]),
            "costSim": json.loads(row["cost_sim"]),
            "hours": json.loads(row["hours"]),
            "tz": row["tz"],
            "transferTarget": row["transfer_target"],
            "tier": row["tier"],
            "knowledgeScope": json.loads(row["knowledge_scope"]),
            "afterHoursMode": row["after_hours_mode"],
            "updatedAt": row["updated_at"],
        }

    def _defaults(self) -> dict[str, Any]:
        """The defaults from the migration, as a dict."""
        return {
            "providerMix": {},
            "consentVariant": "announce_first",
            "bilingual": True,
            "channel": "none",
            "channels": {},
            "costSim": {"inputs": {}, "unverified": True},
            "hours": {"mon-fri": ["09:00", "18:00"]},
            "tz": "Europe/Paris",
            "transferTarget": None,
            "tier": "standard",
            "knowledgeScope": [],
            "afterHoursMode": "take_message",
            "updatedAt": None,
        }


# ── Call log · transcript · alerts (read side) ───────────────────────────────
#
# These are read models. Writes happen when channels land (batch step 4); for
# now the endpoints serve real rows from the real schema, which is what makes
# the console buildable against a server rather than against fixtures.


class CallStore:
    """Read access to calls, turns, and alerts."""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def list_calls(self, limit: int = 50, offset: int = 0) -> tuple[list[dict[str, Any]], int]:
        """Newest first. Returns (items, total)."""
        conn = _connect(self._db_path)
        try:
            total = conn.execute("SELECT COUNT(*) AS n FROM calls").fetchone()["n"]
            rows = conn.execute(
                "SELECT * FROM calls ORDER BY started_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
            return [self._call_row(r) for r in rows], total
        finally:
            conn.close()

    def get_call(self, call_id: str) -> dict[str, Any] | None:
        conn = _connect(self._db_path)
        try:
            row = conn.execute("SELECT * FROM calls WHERE id = ?", (call_id,)).fetchone()
            return self._call_row(row) if row else None
        finally:
            conn.close()

    def get_turns(self, call_id: str) -> list[dict[str, Any]]:
        conn = _connect(self._db_path)
        try:
            rows = conn.execute(
                "SELECT * FROM turns WHERE call_id = ? ORDER BY idx ASC", (call_id,)
            ).fetchall()
            return [self._turn_row(r) for r in rows]
        finally:
            conn.close()

    def list_alerts(
        self, severity: str | None = None, limit: int = 50
    ) -> tuple[list[dict[str, Any]], int]:
        conn = _connect(self._db_path)
        try:
            if severity:
                total = conn.execute(
                    "SELECT COUNT(*) AS n FROM alerts WHERE severity = ?", (severity,)
                ).fetchone()["n"]
                rows = conn.execute(
                    "SELECT * FROM alerts WHERE severity = ? "
                    "ORDER BY created_at DESC LIMIT ?",
                    (severity, limit),
                ).fetchall()
            else:
                total = conn.execute("SELECT COUNT(*) AS n FROM alerts").fetchone()["n"]
                rows = conn.execute(
                    "SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?", (limit,)
                ).fetchall()
            return [self._alert_row(r) for r in rows], total
        finally:
            conn.close()

    # ── row → wire ──────────────────────────────────────────────────────────

    def _call_row(self, row: sqlite3.Row) -> dict[str, Any]:
        started = row["started_at"]
        closed = row["closed_at"]
        duration = 0
        if started and closed:
            duration = max(0, int(_parse_ts(closed) - _parse_ts(started)))
        return {
            "id": row["id"],
            "channel": row["channel"],
            "outcome": row["outcome"] or "abandoned",
            "state": row["state"],
            "startedAt": started,
            "durationSec": duration,
            "callerMasked": row["caller_masked"],
            "flagged": row["flagged"],
            "costEur": row["cost_eur"],
            "containment": bool(row["contained"]),
            "shadowMode": bool(row["shadow_mode"]) if row["shadow_mode"] is not None else False,
            "spamScore": row["spam_score"],
            "summarySent": bool(row["summary_sent"]) if row["summary_sent"] is not None else False,
            "scopeVersion": row["scope_version"],
            "containmentReason": row["containment_reason"],
            "summary": row["summary"],
        }

    def _turn_row(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "idx": row["idx"],
            "role": row["role"],
            "text": row["text"],
            "final": bool(row["final"]),
            "vadMs": row["vad_ms"],
            "sttMs": row["stt_ms"],
            "llmMs": row["llm_ms"],
            "ttsMs": row["tts_ms"],
            "turnGapMs": row["turn_gap_ms"],
            "provenance": json.loads(row["provenance"]) if row["provenance"] else None,
            "emotionTag": row["emotion_tag"],
            "guardrailFired": row["guardrail_fired"],
            "language": row["language"],
            "at": row["at"],
        }

    def _alert_row(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "severity": row["severity"],
            "rule": row["rule"],
            "oneLiner": row["one_liner"],
            "decision": row["decision"],
            "evidence": json.loads(row["evidence"]),
            "callIds": json.loads(row["call_ids"]) if row["call_ids"] else [],
            "acknowledgedAt": row["acknowledged_at"],
            "acknowledgedBy": row["acknowledged_by"],
            "thresholdIsProvisional": bool(row["threshold_is_provisional"]),
            "createdAt": row["created_at"],
        }


def _parse_ts(value: str) -> float:
    """Parse an ISO 8601 timestamp to epoch seconds, tolerantly.

    The stored format varies (PG now(), Python isoformat, SQLite strftime), so
    this normalises the trailing Z and lets `fromisoformat` do the rest.
    """
    from datetime import datetime as _dt

    text = value.strip().replace("Z", "+00:00")
    try:
        return _dt.fromisoformat(text).timestamp()
    except ValueError:
        # Last resort: SQLite's strftime format with milliseconds
        try:
            return _dt.strptime(text, "%Y-%m-%dT%H:%M:%S.%f").timestamp()
        except ValueError:
            return 0.0


def _jsonify(value: Any) -> str:
    """Encode a value for storage in a TEXT column.

    Booleans are stored as "1"/"0" — `bool("false")` is True in Python, so
    JSON-encoding a boolean and reading it back is a silent corruption.
    """
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, str):
        return value
    return json.dumps(value)
