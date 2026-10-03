"""Do the TS fixtures still match what the server actually sends?

The TS side has hand-copied the payloads into `src/features/agent/types/fixtures.ts`
and asserted against them. Hand-copied is exactly how they drift: a server field
is renamed, the TS fixture is not updated, and the test keeps passing against a
payload nothing produces any more.

So this compares the KEY SETS. It is deliberately a key-set check rather than a
deep-equality check — a timestamp or a generated id differing is not drift, but a
missing or extra key is, and only the key set tells us that.

Requires a dev server:
    uvicorn agent_core.api:app --port 8788
    python tests/verify_fixtures.py --port 8788
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

# tests/ -> agent-core/ -> services/ -> repo root. Three parents, not two.
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
FIXTURES = REPO_ROOT / "src" / "features" / "agent" / "types" / "fixtures.ts"

failures: list[str] = []


def get(path: str, port: int) -> dict:
    with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=10) as r:
        return json.loads(r.read())


def post(path: str, payload: dict, port: int) -> dict:
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def keys_of(obj: object) -> set[str]:
    return set(obj) if isinstance(obj, dict) else set()


def check(label: str, live: object, fixture_keys: set[str]) -> None:
    """Compare the server's key set against a set of key NAMES.

    `fixture_keys` is a set of strings, not a dict. Passing a dict here and then
    calling keys_of() on it worked only by accident for dicts, and produced
    "the fixture lacks every key" for a set — a comparison inverted into a
    guaranteed failure. The signature says set[str] so the mistake is a type
    error rather than a wrong answer.
    """
    live_keys = keys_of(live)
    missing = live_keys - fixture_keys
    extra = fixture_keys - live_keys
    ok = not missing and not extra
    print(f"  {'PASS' if ok else 'FAIL'}  {label}")
    if not ok:
        if missing:
            print(f"        server sends, TS fixture lacks: {sorted(missing)}")
        if extra:
            print(f"        TS fixture has, server never sends: {sorted(extra)}")
        failures.append(label)


def session_block(src: str) -> str:
    """The SESSION_RESPONSE_FIXTURE object literal, as text."""
    m = re.search(
        r"const SESSION_RESPONSE_FIXTURE[^=]*=\s*\{(.*?)\n\} satisfies", src, re.S
    )
    return m.group(1) if m else ""


def nested_keys(src: str, const: str, indent: int) -> set[str]:
    """Keys of a NESTED object literal inside a fixture, by indentation.

    Parsed by indentation rather than by tracking braces: a fixture is a literal,
    and indentation is enough to find a nested one reliably.
    """
    if const == "providerHealth":
        m = re.search(r"export function providerHealth\(\)[^{]*\{.*?return \[(.*)", src, re.S)
        if not m:
            return set()
        return set(re.findall(rf"^\s{{{indent}}}(\w+):", m.group(1), re.M))
    m = re.search(rf"const {const}[^=]*=\s*\{{(.*?)\n\}} satisfies", src, re.S)
    if not m:
        return set()
    return set(re.findall(rf"^\s{{{indent}}}(\w+):", m.group(1), re.M))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8788)
    args = ap.parse_args()
    p = args.port

    src = FIXTURES.read_text(encoding="utf-8")
    if not FIXTURES.exists():
        print(f"missing {FIXTURES}")
        return 1

    print("fixture drift check — live server vs src/features/agent/types/fixtures.ts\n")

    session = post("/session", {"channel": "voice", "purpose": "test_call"}, p)
    snap = get("/ops/snapshot", p)
    snap_dev = get("/ops/snapshot/dev", p)

    # Pull each fixture's key set out of the TS source by reading the object
    # literal, rather than re-declaring them here — otherwise this script could
    # drift from the TS in exactly the way it is meant to detect.
    def literal_keys(name: str) -> set[str]:
        m = re.search(rf"const {name}[^=]*=\s*\{{(.*?)\n\}} satisfies", src, re.S)
        if not m:
            return set()
        return set(re.findall(r"^\s{2}(\w+):", m.group(1), re.M))

    session_keys = set(re.findall(r"^\s{2}(\w+):", session_block(src), re.M))
    check("POST /session", session, session_keys)
    check("GET /ops/snapshot", snap, literal_keys("OPS_SNAPSHOT_FIXTURE"))

    live_alert = snap["p1"][0]
    check("ops alert", live_alert, nested_keys(src, "OPS_SNAPSHOT_FIXTURE", 6))

    live_health = snap_dev["providerHealth"]
    check("provider health entry", live_health[0], nested_keys(src, "providerHealth", 6))

    print()
    if failures:
        print(f"{len(failures)} DRIFTED: {failures}")
        print("\nUpdate src/features/agent/types/fixtures.ts from the live payloads.")
        return 1
    print("no drift — the TS fixtures match the live server")
    return 0


if __name__ == "__main__":
    sys.exit(main())
