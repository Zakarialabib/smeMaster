# OSS Landscape — WhatsApp Integration (research 2026-09-28)

> **Scope:** what exists in the open-source ecosystem for WhatsApp, and specifically whether a
> Rust + Tauri project like [`karem505/whatRust`](https://github.com/karem505/whatRust) can serve
> as the inspiration for our WhatsApp channel. **Conclusion up front: no — and the reason is
> architectural, not a licensing quibble.**
> **Verified:** every licence read from the repo's own LICENSE file / model card, 2026-09-28.

## 1. Headline: whatRust is not a WhatsApp integration

`karem505/whatRust` — **MIT**, Rust + **Tauri v2**, 99★, last push 2026-08-27, `master`.
It looks, from the name, like exactly the thing we want. It is not.

**It implements no WhatsApp protocol at all.** It loads the official `web.whatsapp.com`
in the OS-native webview (WebKitGTK / WebView2 / WKWebView) and adds desktop shell
features around it. The full `src-tauri/src/` tree is:

```
accounts.rs  applock.rs  aumid.rs  biometric/  commands.rs  dlog.rs
lib.rs  lock.rs  main.rs  notify.rs  settings.rs  tray.rs  unread.rs  window.rs
```

There is no socket layer, no message store, no send/receive path, no
`WebSocket`/`Noise`/protobuf anything. `window.rs` is 59 KB of webview plumbing.
Its own disclaimer says it *"does not modify or intercept WhatsApp's services."*

**Why that disqualifies it for our channel, precisely:**

| What our agent needs | Can a webview shell provide it? |
|---|---|
| Headless 24/7 operation on a VPS | ❌ a webview needs a GUI session and a logged-in human's device |
| Read inbound messages as events | ❌ the DOM is WhatsApp's; scraping it is brittle and a ToS violation |
| Send a reply programmatically | ❌ no send API — a human clicks the button |
| Run on our EU VPS, not the client's laptop | ❌ it runs on a desktop, per-account, with a QR login |
| Survive the app being closed | ❌ persistent login, but the app must be running |

**A webview shell and a server-side channel adapter are different products.** One wraps a human's
GUI; the other is a headless service answering a webhook. Adopting whatRust's approach would
mean the agent only works while the client's laptop is on and someone is logged in — the exact
coupling that made us put the agent in a sidecar in the first place.

**What it IS good for** (and where the pattern genuinely transfers): a **desktop shell
reference** for Tauri v2 + a wrapped web surface — multi-account isolation, tray with unread
badge, native notifications, app lock (Argon2id / biometrics), persistent login, and a
page-zoom control. If SMEMaster ever needs to *show* a human's WhatsApp (a support agent
handing a conversation to a colleague, say), the pattern is worth studying. That is a
`human-in-the-loop` feature, not our inbound channel.

⚠️ **Its own limitations section is worth reading before anyone proposes it**, and it is candid:
- **Calls depend on the webview shipping WebRTC** — works on Windows/macOS, but *"most Linux
  distros build WebKitGTK without WebRTC, so calling isn't available on Linux."*
- Windows tray shows the unread *count* only on hover; macOS builds are unsigned, arm64 only.
- Flatpak native drag-and-drop needs read-only home access.
- Multi-account on macOS needs macOS 14+.

**The WebRTC line is the interesting one for us** and it cuts against the optimistic reading.
whatRust gets in-app *voice and video calling* only because the official WhatsApp **Web UI**
implements it and the OS webview provides WebRTC. That is a human clicking "call" in a GUI.
**It is not an API, it is not server-side, and it is not automatable** — so it does not
contradict our finding that *no* API exposes WhatsApp live voice. It confirms it, from the
opposite direction: even the one client that can place a WhatsApp call does so by driving a
web page a human is looking at.

## 2. The actual landscape: three architectures, one production-viable

| Approach | Projects | Licence | Automatable | 24/7 headless | Production verdict |
|---|---|---|---|---|---|
| **A. Official Cloud API via BSP** | Meta Cloud API, Twilio, 360dialog, MessageBird | commercial (Meta ToS) | ✅ full | ✅ | ✅ **the only production path** |
| **B. WhatsApp Web protocol reimplementation** | **Baileys** (`WhiskeySockets/Baileys`, MIT, 11.2k★, pushed 2026-09-27), `whatsapp-web.js` | MIT | ✅ full | ✅ | ⚠️ **dev sandbox only** — ToS violation, number ban, no SLA |
| **C. Webview shell** | **whatRust** (MIT, 99★), WAHA, similar | MIT | ❌ human-driven | ❌ desktop-only | ⛔ **not an integration** — a desktop client |

There is also a **D. Android-emulation farms** (a real device farm driving the app) — used by some
agencies for market research. Excluded: it needs physical handsets per account, does not scale
past a handful of numbers, and has the same ToS exposure as B with none of B's cleanliness.

**B is the only OSS project in our list that could be a channel adapter, and it is sandbox-only.**
Baileys speaks the actual WhatsApp Web protocol over a socket, so it *can* be headless and
programmable — which is exactly why it is a dev tool and never a client production path. The
distinction from C is the whole point: B reimplements a protocol, C wraps a human's webview.

## 3. Licence gate (read from each LICENSE, not the badge)

| Project | Licence | Source |
|---|---|---|
| `karem505/whatRust` | **MIT** | repo `LICENSE` — permissive, but irrelevant given §1 |
| `WhiskeySockets/Baileys` | **MIT** | repo `LICENSE` (2025, Rajeh Taher) |
| `wppconnect-team/wa-js` | **Apache-2.0** | repo `LICENSE` |
| `pedrosalberio/whatsapp-web.js` | **MIT** | repo `LICENSE` |

No licence problem anywhere in this list. **The blocker is not legal permission, it is Meta's
terms and the permanence of a number ban.** That is worth stating plainly, because "MIT" reads
like a green light and it is not: an MIT licence grants us the right to *use the code*; it grants
nobody the right to *connect to WhatsApp*. A GPL/SSPL problem can be solved with a sidecar
process. A number ban cannot be solved at all.

## 4. What changes in our plan: **nothing**

The `ChannelAdapter` design, the Baileys sandbox, the E.164-normalised allowlist, the
BSP-in-production rule, and the "WhatsApp live voice is impossible" constraint **all survive this
research intact**. Specifically:

- **`ChannelAdapter` gains a third hypothetical implementation, and it stays hypothetical.** A
  webview-backed `ChannelAdapter` would be unimplementable headlessly (§1), so it is not a third
  implementation — it is a fourth architecture we are not adopting. Recorded here so the next
  reader does not re-derive it.
- **The Baileys sandbox is now better justified.** It is the *only* OSS path that is both
  automatable and headless, which is exactly why it is the right dev tool — and exactly why it
  is the wrong production tool.
- **The "no API for WhatsApp voice" claim is now doubly evidenced**: by the absence of any
  Cloud API surface, and by whatRust's WebRTC note showing the only in-client call path is a
  human-driven web page.

## 5. Recommendations

1. **Keep the plan.** Official Cloud API via a BSP in production; Baileys sandbox for dev, behind
   `ChannelAdapter`, with the E.164 allowlist on a number we own.
2. **Do not adopt whatRust for the channel.** Cite §1 when it is proposed — the request will
   otherwise be made again, because the name and the star count genuinely suggest otherwise.
3. **Optionally study the shell patterns** (multi-account isolation, tray, app lock) if SMEMaster
   ever needs a human-facing WhatsApp window. That is a separate, later, human-in-the-loop feature.
4. **Re-verify Baileys' licence and last push before each Gate 2.** It is the one dependency on
   the critical path that a WhatsApp-side change can break without warning.

## 6. Claims I could not verify

- **No headless webview claim was tested at runtime.** §1's table is reasoned from the repo's own
  file tree, README and disclaimer — all three are unambiguous that no protocol code exists, but
  I did not attempt to run it. A webview on a headless VPS with Xvfb *might* render the page; it
  would still not expose a send API or survive a logout, so the conclusion is unchanged either way.
- **Meta's per-message pricing was not verified** (login/JS-walled). See `client/COST-MODEL.md` §6.
- **BSP pricing and onboarding timelines are unverified** — `client/VENDOR-QUOTE-REQUEST.md` is
  the request that settles them.
- **No claim is made about what other BSPs or unofficial libraries might do beyond the four
  projects read here.** The landscape is larger; this was scoped to what changes our decision.

## Cross-references

[`ADR-001`](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) ·
[`BACKEND.md`](../voice/design/BACKEND.md) §4 `ChannelAdapter` ·
[`RAG-FORK.md`](../voice/dev/RAG-FORK.md) (the same licence-gate discipline, applied to embedders) ·
[`COST-MODEL.md`](../voice/client/COST-MODEL.md) §1 (WhatsApp ≈ €0 inbound)
