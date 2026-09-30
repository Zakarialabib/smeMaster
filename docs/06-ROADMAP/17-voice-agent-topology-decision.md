# Topology Decision — Desktop, VPS, or Both

> **Status:** Decision required before Gate 1. Written 2026-09-28 in response to the
> question *"the app runs on the desktop — why do we need a VPS?"*
> **Short answer:** the question is right that the VPS is **not** where the *interface* lives,
> and right that a desktop-hosted agent is a real option. The VPS is required by exactly one
> thing: **an inbound PSTN call must arrive at a socket the carrier can open, at all times.**
> That is a property of the telephone network, not of our architecture, and no open-source
> project changes it.
> **Related:** [`ADR-001`](../01-ARCHITECTURE/decisions/ADR-001-voice-agent-integration-seams.md) ·
> [`BACKEND.md`](../voice/design/BACKEND.md) · [`WIREFRAMES.md`](../voice/design/WIREFRAMES.md) ·
> [WhatsApp landscape](16-voice-agent-whatsapp-oss-landscape.md)

---

## 1. The honest version of your question

Two things are being conflated, and separating them makes the whole decision fall out:

| | Question | Answer |
|---|---|---|
| **A** | Where does the **user interface** live? | **Desktop and phone.** You are right about this, and the design set already assumes it — the console is `src/features/agent/`, React 19, inside the Tauri app. |
| **B** | Where must the **agent process** live to answer an inbound phone call? | **On a machine with a stable public endpoint, always on.** Not a laptop behind NAT. |

**The VPS exists only because of B.** Not for cost, not for elegance, not because a server
is fashionable. Remove B and the VPS disappears — §5 says exactly what that variant costs.

## 2. Why a desktop behind NAT cannot answer an inbound call, by itself

This is the load-bearing fact, and it is arithmetic rather than opinion.

1. A carrier (Telnyx, Twilio) does not *dial* your agent. When someone calls your FR DID,
   the carrier opens a **WebSocket media stream** to a URL **you** configured — at call setup,
   to a host it can reach.
2. A home/office desktop is behind **NAT** and typically a firewall. There is no inbound path:
   the router owns the public IP, and even with port forwarding, the address changes.
3. So the desktop needs a **public tunnel** (ngrok / Cloudflare Tunnel / Tailscale Funnel /
   WireGuard-to-a-host) to receive that stream.
4. Then the requirement is unchanged but inverted: **the tunnel must be up, and the desktop
   must be awake and logged in, or the call fails.** And a failed call is not a degraded
   experience — the **caller hears nothing**. A ring that goes to voicemail is survivable; a
   ring that is *silently dropped* is the failure the client pays us to prevent.

**That last point is the whole argument.** A desktop-hosted agent converts "the office is
closed" from a *known, survivable state* (voicemail → WhatsApp summary) into an *unannounced
silent failure* that the client only discovers because a customer said so.

### What would have to be true for desktop-only to work anyway

| Requirement | Status |
|---|---|
| Public, stable inbound path to the desktop | needs a permanent tunnel — a new always-on dependency, which is the VPS by another name |
| The desktop awake, logged in, app open, machine not asleep | **a second, human-dependent failure mode the product cannot have** |
| Tailscale/ngrok tunnel uptime | third-party dependency on the availability path of every call |
| Works when the client's laptop is closed at 18:00 | ❌ **it does not** |
| Works when the client's internet drops mid-call | ❌ the caller hears nothing |

**Verdict: desktop-only cannot serve the stated product** — *"never miss a call"*. It is fine
for a *demo*, and a demo is not a paid service.

## 3. What the desktop *should* own (you were right about this)

The desktop is not a bystander in this architecture. It should own:

| Concern | Why it belongs on the desktop |
|---|---|
| **The console** — digest, call log, live monitor, config, cost | It is a person looking at a screen |
| **Local speech for the self-hosted tier** | `sherpa-onnx` in a Tauri sidecar (Apache-2.0, 15k★, pushed 2026-09-22). The repo already runs `ml-sidecar` over JSON-RPC — the pattern is proven here. RTF < 1 offline, EU-residency without a vendor |
| **The knowledge authoring surface** | Someone has to read and curate the KB |
| **Local RAG (existing)** | candle + LanceDB, already shipped |
| **Provider keys — never on the VPS** | ⚠️ See §6. This is the security inversion that makes a split worth doing at all |

## 4. Recommended topology — a split, not a choice

```
        CLIENT'S DESKTOP (Tauri v2)                OUR EU VPS
        ┌──────────────────────────┐              ┌────────────────────────────┐
        │ Console (React 19)       │  HTTPS + WS  │ agent-core (Python)       │
        │  digest · call log ·     │◀────────────▶│  carrier media stream IN  │
        │  live · config · cost    │              │  turn loop · LLM · TTS    │
        │                          │              │  ChannelAdapter           │
        │ Local tier (optional)    │              │   ├ telephony → Telnyx    │
        │  sherpa-onnx sidecar     │              │   └ whatsapp  → BSP       │
        │  STT/TTS offline, RTF<1  │              │  metering · ops snapshot  │
        │  ✅ provider keys live   │              │  NO provider keys here    │
        │     HERE, not on the VPS │              └────────────────────────────┘
        └──────────────────────────┘
                     │
        ┌────────────┴─────────────┐
        │ phone browser (390px)    │  ← same agent, different skin
        └──────────────────────────┘
```

**The invariant that makes the split coherent:** the desktop is a *client* of `agent-core`
in every case. If the desktop is off, calls still answer. If the VPS is down, the console
shows **"cannot reach the agent · last seen 14:51"** and never "no calls" — the state
`UX.md` §7 and `FRONTEND.md` §12.4 already specify.

## 5. The variants, honestly costed

| Variant | Answers calls when the office is shut? | Provider keys | Verdict |
|---|---|---|---|
| **VPS only** (today's plan) | ✅ always | on the VPS | works; weakest security story (§6) |
| **Desktop only** | ❌ **never** | on the desktop | ❌ **rejected** — silent call failure |
| **Desktop + tunnel** | ⚠️ only if the tunnel *and* the laptop are up | on the desktop | ❌ rejected — a VPS with extra steps and a human in the loop |
| **Split (recommended)** | ✅ always | **on the desktop** | ✅ best of both; adds one real service to build |

## 6. The security inversion — the strongest argument for the split

A desktop app can reach a speech vendor **directly**. So the desktop never needs a long-lived
API key on the server:

- **Provider keys live on the desktop**, in the Tauri store; the VPS holds only per-tenant
  configuration and its own infrastructure credentials.
- If the VPS is compromised, the blast radius is **tenant data and transcript history** — not
  our ElevenLabs, Deepgram and OpenRouter accounts, and not a path to spend against them.
- This is a genuinely better posture than "everything on the server", and it is a **free**
  consequence of the desktop being a first-class client rather than a thin view.

⚠️ **The same inversion has a cost, and it is the honest counter-argument:** if the desktop
holds the keys, **the self-hosted local tier and the cloud tier cannot both run server-side.**
Whichever provider the VPS calls must have a key *on* the VPS. So the split is:

- **Self-hosted tier** → keys on the **desktop** (truly local STT/TTS, nothing crosses the network)
- **Cloud tier** (v1 default) → keys on the **VPS** (the agent runs there; the desktop holds none)

Pick one per tenant, explicitly, and never pretend both are local. `ADR-001` D1 and
`ProviderTier` in [`BACKEND.md`](../voice/design/BACKEND.md) §10 already anticipate this.

## 7. Is there an open-source project that removes the VPS? (researched, 2026-09-28)

| Project | Licence | Verdict for us |
|---|---|---|
| [`pheonix-delta/axiom-voice-agent`](https://github.com/pheonix-delta/axiom-voice-agent) | **Apache-2.0** | ❌ **The closest match, and it confirms the constraint.** 147★, last push 2026-05-24, "<400 ms on 4 GB VRAM, fully offline, no API keys" — real, and the best latency-per-euro evidence we have. But it is a **robotics/edge** agent: FastAPI + Kokoro + sherpa + SetFit, a WebGL UI, and **no telephony at all**. It proves the *local tier* is viable; it does nothing for PSTN ingress. |
| [`off-grid-ai/OGAM`](https://github.com/off-grid-ai/OGAM) | **MIT** | 3.2k★, pushed 2026-09-28, local LLM + Whisper + STT on phone/Mac. **Pattern worth stealing:** the *orchestrator* is local; the *providers* are pluggable and federated. That is our §4 shape. Still no telephony. |
| [`k2-fsa/sherpa-onnx`](https://github.com/k2-fsa/sherpa-onnx) | **Apache-2.0** | 15k★, C++, pushed 2026-09-22. **The engine** for the self-hosted tier — STT/TTS/VAD/diarization offline. Already the basis of `SELF-HOSTING.md`. |
| `karem505/whatRust` | MIT | ❌ not an integration — see [the landscape doc](16-voice-agent-whatsapp-oss-landscape.md) |

**Every project that answers a phone call runs it on a server.** None moves PSTN ingress onto
a laptop. That is not a gap in the ecosystem; it is the telephone network.

## 8. What I could not verify

- **Carrier ingress requirements were not read from documentation.** Telnyx's docs are
  JS-rendered and unreachable without a browser (`curl` returned the Next.js shell). The NAT
  argument in §2 is from first principles about WebSocket media streams and is not in doubt,
  but the **exact** carrier contract — whether a tunnel is permitted for media streams, and
  what the webhook/IP requirements are — belongs in
  [`VENDOR-QUOTE-REQUEST.md`](../voice/client/VENDOR-QUOTE-REQUEST.md) Q11. Add it before Gate 4.
- **sherpa-onnx was not benchmarked on this host.** §3's RTF claim is the project's, not ours.
- **axiom's <400 ms was not reproduced** on comparable hardware; it is a 147★ project, not a peer.
