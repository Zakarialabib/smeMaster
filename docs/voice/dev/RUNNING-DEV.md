# Running agent-core in dev mode

> Verified 2026-09-28 against a live server. Every command and output below was
> actually run, not written from memory.

## Start

```bash
cd services/agent-core
.venv/Scripts/python.exe -m uvicorn agent_core.api:app \
  --host 127.0.0.1 --port 8788 --reload --log-level info
```

`--reload` matters: it picked up the B4 migration commit and the new
`licensing.py` without a restart.

Base URL is loopback by default. The desktop's `AGENT_CORE_URL` overrides it.

## What is live and what is not

This is the part worth internalising, because it is easy to over-read.

| Surface | State |
|---|---|
| HTTP + WS server, routing, error envelope, camelCase | **real** |
| Wire contract, both sides, drift-checked | **real** |
| Provider seams, registry, chain, fallback, licence gate | **real** |
| Session creation, E.164 guard, disclosure | **real logic, fixture data** |
| Ops snapshot, provider health | **fixture data** |
| Demo turn frames | **real frames, from the real chain** |
| Carriers, PSTN, WhatsApp, vendor calls, persistence | **absent** |

`/providers/registry` returns `fixture_data: true` on purpose. The demo turn is a
turn with no carrier, no microphone and no vendor key. It proves the chain and
the frame shapes hold together; it does not place a call.

## The two checks worth running

```bash
# 1. Is the server behaving as the contract says?
.venv/Scripts/python.exe tests/live_swap.py --port 8788        # 15 checks

# 2. Has the console drifted from the server?
.venv/Scripts/python.exe tests/verify_fixtures.py --port 8788  # 4 key-set checks
```

Run both after any contract change. Check 2 is the one that catches the failure
mode nobody notices: a renamed field that leaves the console rendering
`undefined` while every test still passes.

## A manual pass that is worth doing once

```bash
curl -s localhost:8788/healthz
# {"ok":true,"version":"0.1.0","startedAt":"...","db":"ok","providers":"ok"}
#   ^ startedAt is camelCase. It was started_at once. A unit test on the key set
#     is the only thing that catches that class of break.

# The security guard, in the exact shape the console sends:
curl -s -X POST localhost:8788/session -H 'Content-Type: application/json' \
  -d '{"channel":"voice","purpose":"live","callerOverride":"+33612345678"}'
# {"error":{"code":"caller_override_not_allowed", ...}}   403
#
# This one is worth running BY HAND. The guard was silently inert for a while:
# SessionRequest inherited BaseModel, which accepts snake_case and ignores
# camelCase, so callerOverride was dropped in and the check never ran. Three
# separate tests now cover it, and only this one exercises a real socket with
# real JSON produced by an actual client.
```

## Known gaps

- **WebSocket paths are not covered by the live script.** Probing them needs a
  `websockets` install that is not in the venv. The pytest suite does cover
  ping, no-auth refusal, the 4403 control-frame close, and malformed frames.
- **No persistence.** The five skipped migration tests need Postgres
  (`AGENT_CORE_TEST_DATABASE_URL`); there is none on this host, so nothing is
  written anywhere yet.
- **No auth.** The WS accepts any non-empty bearer token. Real tenant-scoped auth
  is Phase C work and is the gating item before this is exposed beyond loopback.
