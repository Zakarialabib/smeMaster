# Build log — SMEMaster agent (voice + WhatsApp)

> Living document. Last updated **2026-09-28**. Read this first when picking the
> work up; it records what is *verified*, what is *not*, and what broke.

## Current state

```
agent-core   ruff clean · mypy clean (10 files) · 156 passed, 5 skipped
frontend     tsc TSC_EXIT=0 · eslint clean · vitest 5 files, 60 passed
live server  :8788 up · live_swap 15/15 · fixture drift 4/4
rust         ✅ cargo check --workspace CLEAN — 0 errors, 0 warnings
           ⚠️ test binary LINKS but will not EXECUTE on this host (see below)
frontend     tsc 0 · eslint 0 · vitest 6 files, 64 passed + 6 skipped (live tests; server was down at run time)
```

## Phase status

| Phase | State | Note |
|---|---|---|
| A — contracts, migrations, TS types, stores | ✅ CLOSED | [`PHASE-A-COMPLETE.md`](PHASE-A-COMPLETE.md) |
| B1 — four provider seams + swap test | ✅ | `test_swap.py` **is** the Gate 1 exit criterion |
| B2 — `/session`, `/ws/transcript`, `/ops/snapshot` | ✅ | plus a real security bug fixed |
| B3 — licence gate (Voxtral TTS rejection) | ✅ | [`OPEN-WEIGHT-SPEECH-VERIFIED.md`](OPEN-WEIGHT-SPEECH-VERIFIED.md) |
| B4 — migrations 0002-0004 | ✅ | structural tests; real PG still skipped |
| B5 — console HTTP client + captured fixtures | ✅ | tested against the **live** server |
| B6 — transcript WebSocket | ✅ | fixed an infinite-reconnect bug |
| B7 — Rust IPC client | ✅ compiles | 32 errors on first compile, all fixed; workspace now 0/0 |
| C — console data loading | 🟡 in progress | `useAgentResource` hook done (4 states, race-safe). Screens not yet ported |
| D — channels (PSTN + WhatsApp) | ⬜ | **7–11 d, SINGLE WRITER** — do not parallelise |
| E — real data (reuse invoicing module, §6) | ⬜ | |

## The three defects found (all by executing, not reading)

**1. Security guard silently inert.** `SessionRequest` inherited `BaseModel`,
which takes snake_case and *ignores* camelCase — so `callerOverride` was dropped
in, defaulted `None`, and `assert_caller_allowed` (correct) never fired. A live
session accepted a caller override through the endpoint built to refuse it.
Invisible because every test posted snake_case — what the broken class accepts.
Fixed; `test_camel_acceptance.py` now fails if any inbound contract stops being
a `Camel` subclass.

**2. A licence that would have shipped.** DeepSeek's brief recommended
`mistralai/Voxtral-4B-TTS-2603` in its summary, diagram *and* recommendation,
while its own §4 noted the licence. HF API: `license: cc-by-nc-4.0` —
**non-commercial**, and this project bills a client. v1 self-hosted TTS is
**Chatterbox (MIT)**. `providers/licensing.py` allowlists commercial licences so
unknown fails closed.

**3. Infinite reconnect.** `onopen` reset the retry counter, so a server that
completed the handshake then died was retried forever (measured: 13 sockets from
12 cycles). Reset now happens in `connect()` only.

## Build issues encountered (chronological)

These cost most of the session. Recorded so nobody repeats them.

| # | Issue | Cause | Status |
|---|---|---|---|
| 1 | `Could not find protoc` | `.cargo/config.toml` pointed `PROTOC` at a **vendored binary that is not in the repo** (`src-tauri/tools/protoc/` does not exist) | ✅ fixed → WinGet protoc. **TODO: vendor it properly or require it on PATH** |
| 2 | Disk hit 100% (1.5 G free) twice | Building `ml-sidecar` on a full disk | ✅ `ml-sidecar` built; disk freed |
| 3 | `ml-sidecar` missing | `tauri.conf.json` declares `externalBin: ['binaries/ml-sidecar']`; main crate will not compile without it | ✅ built + copied to `binaries/ml-sidecar-x86_64-pc-windows-msvc.exe` |
| 4 | **`rustup component remove` was a mistake** | I misread a 45-file `rust-std` dir as truncated. The official tarball has exactly 45 files. The real `E0463` cause was almost certainly the full disk | ⚠️ **I broke the toolchain**; repaired by hand (see below) |
| 5 | `rustup component add` fails, TLS `cannot decrypt peer's message` | rustup's HTTP client, not the network — `curl` fetched the same URL fine (HTTP 200) | ✅ worked around with `curl -C -` resume loop, then manual extract |
| 6 | rustup proxy: *"rustc.exe … is not applicable to the toolchain"* | rustup bookkeeping broken by #4 | ⚠️ **workaround, not a fix** — see below |
| 7 | 43 compile errors in `smemaster` | 32 in `src/agent/client.rs` (**ours**), 10 in `src/orchestrator/services.rs`, 1 in `src/commands/ai.rs` | ✅ ours 32→**0**; the other 11 are **pre-existing, not ours** |

## What the first Rust compile found (32 errors, all ours)

`src/agent/client.rs` had never been through `rustc`. Three distinct mistakes,
none visible by reading:

1. **`State<'_, dyn TokenSource>` (32 errors).** Tauri v2 requires
   `State<'_, T>` with `T: Send + Sync + 'static`; a `dyn Trait` is neither
   sized nor shareable. The diagnostics are a wall of `CommandArg` / `Send` /
   `Sync` complaints pointing at the `State`, which is a confusing way to be
   told "a trait object is not a state type". Replaced with a concrete
   `AgentAuth` newtype, matching the app's existing `AiState` pattern, and
   registered via `app.manage(...)` in `lib.rs`.

   The *intent* survived the rewrite: the token is still not a command
   argument. A token that crosses the IPC boundary is a token the frontend can
   log and get wrong.

2. **`send()` was not `async`.** It returned `Result<Response, _>` and callers
   did `.await` on it — a mistake that compiles in most other languages.

3. **`.send().map_err(...)`** — the future must be awaited *before* `map_err`,
   not after.

Two tests were added while fixing: sign-out must clear the token, and a missing
token must be a typed `AgentError::NoSession` the console can render as "sign
in", not a panic.

**This is the argument for compiling rather than reading.** The design was sound
in every review; the trait-object state type was wrong in a way only the
compiler could say.

## Pre-existing errors NOT ours

`cargo check --workspace` does not go green, and did not before this work:

- `src/orchestrator/services.rs` — 10 errors (`child.kill().await` on a
  non-future; `HealthStatus` returned where `()` expected)
- `src/commands/ai.rs` — 1 error

These are outside the agent feature. **Do not attribute them to Phase B**, and
do not let them hide a regression in `src/agent/` — check the per-file error
counts, not the exit code:

```bash
$TC/bin/cargo.exe check --workspace -j1 --message-format=short 2>&1 \
  | grep -E "^src" | sed 's/:.*//' | sort | uniq -c | sort -rn
```

## ⚠️ TOOLCHAIN WARNING — read before running cargo

`cargo`/`rustc` via `~/.cargo/bin` (the rustup proxies) currently **fail** with
*"rustc.exe is not applicable to the toolchain"*. The toolchain's real binaries
work. Use this until rustup is repaired:

```bash
TC=/c/Users/user/.rustup/toolchains/stable-x86_64-pc-windows-msvc
export RUSTC=$TC/bin/rustc.exe
$TC/bin/cargo.exe check --workspace -j1
```

Also: `rustup component list` does not report `rust-std-x86_64-pc-windows-msvc`
as installed, though the files are present and the compiler works. A future
`rustup update` may try to reinstall it. **Proper fix:** reinstall the
toolchain from a machine with a working download, or vendor the component.

Two other things: the msvc toolchain pairs **cargo 1.98.1 with rustc 1.95.0**
(mismatch, pre-existing), and `rustup component remove`/`add` silently failed
partway — the `&&` chain stopped after the removal succeeded.

## Disk

The machine sits at **95–99% full** during Rust builds. This caused the E0463,
killed one build at 59 min, and is the single biggest time sink. Free 15+ G
before any `cargo build`.

## Not done / not verified

- **Real providers.** Phase B proves the swap with fixtures. No vendor code.
- **Real auth.** The WS accepts any non-empty bearer token. Gating item before
  anything leaves loopback.
- **Persistence.** No Postgres here; 5 migration tests skip. The structural
  tests run, the real ones don't.
- **`RAG-FORK` decision** — `bge-m3` vs arctic-embed-l-v2.0 still `☐ pending`.
  It gates the embedding impl and the HNSW index.
- **D channels** — needs a number, a BSP, Meta verification. Nothing can be
  built here that answers a call.

## ⚠️ HOTSPOT — another agent is editing the same files

Between 01:20 and 01:30 two commits landed on this branch from another agent
that **swept up work I had in progress**, uncommitted, in files I was actively
editing:

- `df13292` "feat: add useAgentResource hook + refactor ml-sidecar service" —
  committed `src-tauri/src/orchestrator/services.rs` (my tauri-plugin-shell 2.3
  migration) and the `useAgentResource` hook I had just written.
- `d6ac079` "fix: clean up code and fix critical sidecar bugs"

The work is intact and verified — those commits carry my changes, not
overwritten ones — but two agents writing the same file in the same window is
how a real conflict happens, and this was luck rather than design.

**Affected files:** `src-tauri/src/orchestrator/services.rs`,
`src-tauri/crates/ml-sidecar/src/main.rs`, `src/features/agent/api/`.

**Recommendation:** one writer for the Rust side until Phase D. Same rule
already agreed for D. I have stopped editing those files pending direction.

## ⚠️ Rust test binary will not launch on THIS host

`cargo test -p smemaster --lib` now **compiles and links cleanly** (0 errors,
0 warnings, `Finished test profile`). The produced binary
(`target/debug/deps/app_lib-*.exe`, 47 MB) then fails to start:

```
STATUS_ENTRYPOINT_NOT_FOUND (0xc0000139)
```

That is a **Windows DLL / entry-point problem, not a code problem** — the
binary exists, is well-formed, and returns 0 when run directly with no output.
Most likely a missing or mismatched system DLL, possibly aggravated by the
rustup-proxy workaround (the toolchain is being invoked directly, so its
`PATH` setup is not what rustup would normally provide).

**What this means:** the ~200 Rust unit tests in this crate are written and
compile, but they have **not been executed**. Do not report them as passing.
They should run in CI on a machine with a normal toolchain install.

To verify them here, someone needs to either repair the Windows DLL situation or
reinstall the toolchain cleanly — see the TOOLCHAIN WARNING above. That is the
same underlying problem and fixing it once likely fixes both.

### Tests added while fixing the warnings

The dead-code warnings were not silenced, they were **used** — the fixtures
already existed and were clearly written for tests that were never written:

- `health_monitor.rs` — `HealthyService` / `DegradedService` were never
  constructed. Three tests now exercise the `Service` trait through them.
- `service.rs` — `MockService::with_health` was never called. Three tests now
  use the builder, which is the only way a mock can express a specific state.

**A real gap the new test exposed:** `health_label()` matches
`HealthStatus::Degraded(_)` and **discards the reason**. An operator reading
the log sees "Degraded" with nothing to act on, which is the one thing a
Degraded status exists to convey. The test asserts today's behaviour and
documents the gap rather than silently changing an operator-visible log format.
**This should be fixed deliberately.**
