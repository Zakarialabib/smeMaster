# Quickstart

Hey, welcome. Here's how to get this thing running on your machine.

## What you need to know

This is a Tauri v2 desktop app — so you need both Node.js and Rust installed. The frontend is React + Vite, the backend is Rust. They talk over IPC. Everything is local, offline-first, no cloud.

## Prerequisites

- **Node.js** v20 LTS or v22 LTS (v25+ isn't supported by `@tauri-apps/cli` yet — ask me how I found out)
- **Rust** 1.77.2+ (stable channel)
- **Tauri v2 system deps** — check the [official prerequisites](https://v2.tauri.app/start/prerequisites/)
- **Windows (GNU toolchain):** Make sure `C:\msys64\ucrt64\bin` is in your PATH. That's where `dlltool.exe` lives.

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
```

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

## Source reconciliation (2026-07-19)

| Claim (before) | Verified reality | Evidence |
| --- | --- | --- |
| `npx vitest run src/stores/uiStore.test.ts` | Actual `src/stores/core/uiStore.test.ts` | `ls src/stores/core/uiStore.test.ts` |
