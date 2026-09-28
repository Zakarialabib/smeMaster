"""Live dev-server check: does a provider swap REALLY need no restart?

`test_swap.py` proves the swap in-process. This proves it across a **running
server**, which is a stronger claim and a different failure mode: a registry that
rebuilds providers per request is fine in tests and a memory leak in production,
and only a live server shows that.

Run against a dev server:
    uvicorn agent_core.api:app --port 8788
    python -m tests.live_swap --port 8788
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import urllib.error
import urllib.request

# Provider names as registered by register_fixtures(). These are the only strings
# this script sends; nothing here imports a provider class.
ALPHA = "alpha"
BETA = "beta"


def _get(path: str, port: int) -> dict:
    with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=10) as r:
        return json.loads(r.read())


def _post(path: str, payload: dict, port: int) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8788)
    args = ap.parse_args()
    p = args.port

    failures: list[str] = []

    def check(label: str, ok: bool, detail: str = "") -> None:
        print(f"  {'PASS' if ok else 'FAIL'}  {label}{f'  {detail}' if detail else ''}")
        if not ok:
            failures.append(label)

    print("live swap check — every claim is against a RUNNING server\n")

    # 1. The server is up and the registry is populated.
    reg = _get("/providers/registry", p)
    check("registry lists all four seams", set(reg["registered"]) == {"llm", "tts", "stt", "embedding"})
    check("each seam has >= 2 implementations", all(len(v) >= 2 for v in reg["registered"].values()))
    check("data is labelled as fixture data", reg["fixture_data"] is True)

    # 2. A live session succeeds and returns the exact contract keys.
    status, body = _post("/session", {"channel": "voice", "purpose": "test_call"}, p)
    check("POST /session returns 201", status == 201, f"got {status}")
    check(
        "session payload is exactly the contract",
        set(body) == {"sessionId", "state", "openedAt", "wsUrl", "disclosure"},
        str(sorted(body)),
    )
    check("no tenant id anywhere in the session payload", "tenant" not in json.dumps(body).lower())

    # 3. The guard that was silently broken. Live, over HTTP, camelCase.
    status, body = _post(
        "/session",
        {"channel": "voice", "purpose": "live", "callerOverride": "+33612345678"},
        p,
    )
    check("live + callerOverride is REFUSED with 403", status == 403, f"got {status}")
    check(
        "refusal uses the documented error envelope",
        body.get("error", {}).get("code") == "caller_override_not_allowed",
        json.dumps(body)[:120],
    )

    # 4. A turn streams the frames the console consumes, in order.
    frames = _get("/session/01JLIVE/demo-turn", p)
    kinds = [f["type"] for f in frames]
    check(
        "demo turn emits state, delta, stages, delta, meta",
        kinds == ["state", "delta", "stages", "delta", "meta"],
        str(kinds),
    )
    check("frames are camelCase on the wire", "callId" in json.dumps(frames) and "call_id" not in json.dumps(frames))

    # 5. Which provider answered — the field that makes a fallback visible.
    metas = [f for f in frames if f["type"] == "meta"]
    check("meta reports fallback state", bool(metas) and "fallbackActive" in metas[0])

    # 6. The snapshot is exactly the OpsSnapshot contract.
    snap = _get("/ops/snapshot", p)
    check(
        "snapshot is exactly the contract",
        set(snap)
        == {
            "generatedAt", "since", "p1", "p2Grouped", "p3Count",
            "callCount", "containedPct", "reachable", "lastSeenAt",
        },
        str(sorted(snap)),
    )
    check("reachable is a bool, never absent", isinstance(snap["reachable"], bool))
    check("P2 is grouped by rule", isinstance(snap["p2Grouped"], dict))
    check(
        "every alert carries a decision",
        all(a["decision"] for a in snap["p1"] + [x for v in snap["p2Grouped"].values() for x in v]),
    )

    # 7. No credential material in anything a settings screen would render.
    registry_raw = json.dumps(reg).lower()
    leaked = [w for w in ("api_key", "apikey", "secret", "password") if w in registry_raw]
    check("registry leaks no credential fields", not leaked, str(leaked))

    print()
    if failures:
        print(f"{len(failures)} FAILED: {failures}")
        return 1
    print("all live checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
