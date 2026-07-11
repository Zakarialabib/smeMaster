# SMEMaster — Dependency Security Audit

**Last refreshed:** 2026-07-11
**Scope:** `npm audit` (frontend) and `cargo audit` (run from `src-tauri/`, against `Cargo.lock`).
**Release target:** v1.0.0 — **Windows 10/11 (MSI, NSIS)** and **Android (APK, sideload)** only. macOS and Linux build targets are removed. No code signing and no auto-updater are shipped in v1.0.0 (no external certificates/keys, per release decision).

---

## 1. Frontend (`npm audit`)

| Severity | Package | Notes |
| --- | --- | --- |
| Low | `esbuild` (dev-server) | Dev-only transitive dependency used by Vite. Not shipped in production bundles. **Documented exception** — no production attack surface. |

No production (runtime) npm vulnerabilities were reported.

---

## 2. Rust backend (`cargo audit`, 1106 crate dependencies)

Scan result: **15 vulnerabilities** and **27 allowed warnings** (as of 2026-07-11).

### 2.1 HIGH / MEDIUM (tracked as documented exceptions for v1.0.0)

| Crate | Version | Advisory | Severity | Exploitability in SMEMaster |
| --- | --- | --- | --- | --- |
| `lopdf` | 0.34.0 | RUSTSEC-2026-0187 (stack overflow via deeply nested PDF objects) | 7.5 (HIGH) | Transitive. Only reachable if a malicious PDF is parsed by an unused/optional path. Not on the Windows/Android release attack surface for v1.0.0. |
| `quick-xml` | 0.31.0 / 0.36.2 / 0.39.4 | RUSTSEC-2026-0194 (quadratic parse on duplicate attributes) | 7.5 (HIGH) | Transitive (XML/HTML parsing). Local-first app; no untrusted remote XML is parsed in a security-sensitive context. |
| `quick-xml` | 0.31.0 / 0.36.2 / 0.39.4 | RUSTSEC-2026-0195 (unbounded namespace allocation / DoS) | 7.5 (HIGH) | Same as above. |
| `rsa` | 0.9.10 | RUSTSEC-2023-0071 (Marvin timing side-channel) | 5.9 (MEDIUM) | Transitive. No fixed upgrade available upstream for this pin. Used only for local key operations; no network-exposed RSA oracle. |
| `rustls-webpki` | 0.101.7 | RUSTSEC-2026-0098 / -0099 / -0104 (name-constraint handling) | (unscored) | Transitive TLS cert validation. Shipped Tauri v2 pin; not directly invoked by app code for untrusted chains. |
| `idna` | 0.4.0 | RUSTSEC-2024-0421 (Punycode decode) | (unscored) | Transitive URL parsing. |
| `crossbeam-epoch` | 0.9.18 | RUSTSEC-2026-0204 (invalid-pointer deref in `fmt::Pointer`) | (unscored) | Transitive concurrency primitive. |
| `ring` | 0.16.20 | RUSTSEC-2025-0009 (AES panic under overflow checks) | (unscored) | Transitive crypto primitive. |
| `object_store` | 0.9.1 | RUSTSEC-2024-0358 (AWS WebIdentity token in logs) | 3.8 (LOW) | Transitive; no AWS WebIdentity flow is configured. |

**Justification for suppression (v1.0.0):** All HIGH/MEDIUM items above are **transitive dependencies** of the Tauri v2 / Rust toolchain pin. None are reachable through a security-sensitive, attacker-controlled path in a local-first desktop app that performs no server-side processing and ships unsigned with the auto-updater disabled. Remediation (dependency upgrades) requires moving off the current Tauri v2 pin and is **tracked for post-v1.0.0**. These are documented exceptions pending that upgrade, not accepted-in-production risks.

### 2.2 Warnings (unmaintained / unsound)

27 warnings, the large majority of which are **GTK3 Linux desktop bindings** (`atk`, `atk-sys`, `gdk`, `gdk-sys`, `gdkwayland-sys`, `gdkx11`, `gdkx11-sys`, `gtk`, `gtk-sys`, `gtk3-macros`) plus related crates (`bincode`, `fxhash`, `instant`, `number_prefix`, `paste`, `proc-macro-error`, `ring`, `rustls-pemfile`, `trust-dns-proto`, `unic-*`).

**Why these do not block v1.0.0:** These crates exist only to satisfy Linux/GTK build paths. Since v1.0.0 ships **Windows (MSI/NSIS) and Android (APK) only**, the Linux/GTK dependency graph is **not part of the release build** and is excluded from the shipped attack surface. `unsound` warnings (`glib`, `lexical-core`) are likewise Linux/transitive-only.

---

## 3. Posture for v1.0.0

- Windows installers are built **unsigned** (no EV/standard code-signing certificate). Users install with the standard SmartScreen bypass.
- Android ships as a **sideload APK** (no Play Store signing key).
- The Tauri **auto-updater is disabled** (`updater.active: false`); no signing pubkey is embedded.
- No analytics, telemetry, or remote-script CSP exceptions are present (see `docs/privacy-policy.md`).
- Dependency upgrades to clear the transitive advisories above are scheduled for a post-v1.0.0 maintenance release.

---

## 4. Refresh procedure

Re-run on every release:

```bash
npm audit
cd src-tauri && cargo audit
```

Update this document with the new counts, dates, and any newly fixed/introduced advisories. Raw `cargo audit` output for 2026-07-11 is preserved in the audit run that produced this snapshot.
