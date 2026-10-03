# Quickstart

Hey, welcome. Here's how to get this thing running on your machine.

## What you need to know

This is a Tauri v2 desktop app — so you need both Node.js and Rust installed. The frontend is React + Vite, the backend is Rust. They talk over IPC. Everything is local, offline-first, no cloud.

## Prerequisites

- **Node.js** v20 LTS or v22 LTS (v25+ isn't supported by `@tauri-apps/cli` yet — ask me how I found out)
- **Rust** 1.77.2+ (stable channel)
- **Tauri v2 system deps** — check the [official prerequisites](https://v2.tauri.app/start/prerequisites/)
- **Windows (GNU toolchain):** Make sure `C:\msys64\ucrt64\bin` is in your PATH. That's where `dlltool.exe` lives.
- **protoc (only for full RAG/AI build):** The `lancedb` crate (on-device vector database) requires the Protocol Buffers compiler at build time. If you're building without the `local-ai` feature (see below), protoc is **not** needed.
  - **Windows:** Download `protoc-<version>-win64.zip` from [protobuf releases](https://github.com/protocolbuffers/protobuf/releases), extract `bin/protoc.exe` to a directory in your `PATH`.
  - **Linux:** `sudo apt install protobuf-compiler` (or `brew install protobuf` on macOS).
  - **macOS:** `brew install protobuf`.
  - ⚠️ **This is a live trap on this host (2026-09-28).** `.cargo/config.toml` pointed `PROTOC`
    at a vendored binary that is **not in the repo** (`src-tauri/tools/protoc/` does not
    exist). If you see `Could not find protoc`, install it on `PATH` — don't hunt for the
    vendored copy. Also: `tauri.conf.json` declares `externalBin: ['binaries/ml-sidecar']`,
    so **the main crate will not compile until `ml-sidecar` is built and copied to
    `src-tauri/binaries/`** (see `../01-ARCHITECTURE/07-sidecar-architecture.md` →
    "Building the Sidecar").

## ⚠️ Toolchain warning — read before running cargo (this host)

`cargo`/`rustc` via `~/.cargo/bin` (the rustup proxies) currently **fail** with
_"rustc.exe is not applicable to the toolchain"_. The toolchain's real binaries work.
Use this until rustup is repaired:

```bash
TC=/c/Users/user/.rustup/toolchains/stable-x86_64-pc-windows-msvc
export RUSTC=$TC/bin/rustc.exe
$TC/bin/cargo.exe check --workspace -j1
```

Also: `cargo test` binaries **link but do not launch** here (`STATUS_ENTRYPOINT_NOT_FOUND
0xc0000139`) — a Windows DLL/UCRT mismatch, not a code defect. Do not report Rust tests as
passing on this host; they should run in CI. Full detail, including disk-space requirements
(free 15+ G before any `cargo build`): **[`../voice/dev/BUILD-LOG.md`](../voice/dev/BUILD-LOG.md)**
— read it FIRST when picking work up.

## Commands you'll actually use

```bash
# Start Tauri dev (frontend + backend together)
npm run tauri dev

# Vite dev server only (no Tauri window)
npm run dev

# Run all tests
npm run test

# Run tests in watch mode (my go-to during dev)
npm run test:watch

# Run a specific test file
npx vitest run src/stores/core/uiStore.test.ts

# Type-check the whole TypeScript codebase
npx tsc --noEmit

# Build for production
npm run tauri build

# Rust-only commands (from src-tauri/)
cargo build
cargo test
cargo check

# Skip the local RAG/AI engine (no protoc needed)
cargo build --no-default-features -F rustls-tls        # core app only
cargo test --no-default-features -F rustls-tls         # tests without ML deps
```

> ⚠️ **Gate on the summary line, not the exit code.** On this host both `vitest` and
> `python -m pytest` have been observed to **false-green** (exit 0 with failures). Read the
> `passed`/`failed` counts. `cargo test` here fails to _launch_ (see the toolchain warning
> above) — see [`02-testing.md`](02-testing.md).

## Demo / Mailtrap

Copy `.env.example` to `.env`. This enables the Mailtrap sandbox — so you can test email sending/receiving without actually mailing real people. Trust me, your inbox will thank you.

## Email Setup

**Gmail (OAuth):** Create a Google Cloud project → enable the Gmail API → create OAuth 2.0 credentials (Desktop app type) → paste the Client ID in Settings. It uses PKCE flow, so no client secret needed. Nice and clean.

**IMAP/SMTP:** Click "Add IMAP Account" → enter your email + password. Auto-discovery works for well-known providers. Your passwords are encrypted with AES-256-GCM before they touch the database.

## AI Setup (Optional)

Drop API keys in Settings for whatever provider you want:

- **Anthropic Claude** — Haiku 4.5 (default), Sonnet 4, Opus 4
- **OpenAI** — GPT-4o Mini (default), GPT-4o, GPT-4.1 series
- **Google Gemini** — 2.5 Flash (default), 2.5 Pro
- **Custom** — Any OpenAI-compatible API (Ollama, LM Studio, whatever you're into)

## Building for Production

### Windows Desktop

```bash
cd src-tauri
cargo tauri build --bundles msi
# Output: src-tauri/target/release/bundle/msi/SMEMaster_*.msi
```

### Android

```bash
cd src-tauri
cargo tauri android build --apk
# Output: src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk
```

### CI/CD

Push a tag `v*` to trigger the release pipeline:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## The voice agent's second dev loop (`services/agent-core/`)

SMEMaster has a **second runtime** — a Python FastAPI service for the voice/messaging
agent. It is **not** started by `npm run tauri dev` and is not a Cargo workspace member
(see [`ADR-001`](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) D1).

| You want to…                                                           | Read                                                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Run `agent-core` in dev mode (uvicorn on `:8788`, the two live checks) | **[`../voice/dev/RUNNING-DEV.md`](../voice/dev/RUNNING-DEV.md)**                                        |
| Know the build status, toolchain breakage, and what is _not_ verified  | **[`../voice/dev/BUILD-LOG.md`](../voice/dev/BUILD-LOG.md)** — read FIRST                               |
| Pick up a gated piece of voice work                                    | [`../voice/dev/AGENT-PROMPTS.md`](../voice/dev/AGENT-PROMPTS.md)                                        |
| Understand the phase sequence                                          | [`../voice/dev/BUILD-PLAN.md`](../voice/dev/BUILD-PLAN.md) §7.2 (the commands that matter on this host) |

```bash
# agent-core dev mode (NOT part of `npm run tauri dev`)
cd services/agent-core
.venv/Scripts/python.exe -m uvicorn agent_core.api:app \
  --host 127.0.0.1 --port 8788 --reload --log-level info
```

## Source reconciliation (2026-07-19)

| Claim (before)                              | Verified reality                         | Evidence                             |
| ------------------------------------------- | ---------------------------------------- | ------------------------------------ |
| `npx vitest run src/stores/uiStore.test.ts` | Actual `src/stores/core/uiStore.test.ts` | `ls src/stores/core/uiStore.test.ts` |
