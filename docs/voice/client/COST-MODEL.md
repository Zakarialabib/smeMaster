# Cost Model — Voice & WhatsApp Agent (FR/EN, v1 talk-only)

> **Status:** DRAFT — requires client sign-off (Gate 0) and dated price verification.
> **Spec:** [`docs/specs/2026-09-28-voice-agent.md`](../../specs/2026-09-28-voice-agent.md)
> **Verified on:** 2026-09-28 · **Next re-verify:** on client signature, and monthly after
> **Currency:** USD for vendor cost, EUR for client billing. +5% FX buffer applied to quotes.
> **Client VAT:** TVA 20% (B2B, FR domestic) — added at invoicing, not modelled here.

## 0. Read this before quoting anything

**There is no single cost number. There is a volume table.**

Every figure in this document was gathered 2026-09-28 from public vendor pages.
**All vendor rate cards are UNVERIFIED** — pages were login-walled, JS-rendered, or
require an authenticated API. Section 6 is the checklist that converts this draft
into a signable document. Do not send Section 1 to a client before that checklist is
done.

The most common way this project loses money: signing a **scale** price and running
a **pilot** on it. The dominant cost — TTS — is tier-dependent, and at pilot volume
you are on Creator/Pro, not Scale. The gap is 2–4×.

## 1. Variable cost per call-minute — FR inbound, talk-only v1

Assumption: ~950 TTS characters per minute of French speech. Agent speaks more than
a human receptionist (it re-prompts, confirms, transfers), so budget for 1,000.

| Component | Pilot (200–600 min/mo) | Scale (3,000+ min/mo) | Notes |
|---|---|---|---|
| Telnyx inbound (FR geographic) | $0.004–0.009 | same | confirm FR rate card |
| Transfer leg (~15% of calls) | $0.003–0.008 | same | amortized, outbound FR |
| STT — Deepgram Nova streaming | $0.004–0.007 | same | FR |
| LLM — Gemini Flash via OpenRouter | $0.002–0.005 | same | ~3–4 turns/min |
| TTS — ElevenLabs Flash (Creator/Pro) | $0.10–0.21 | — | **tier-dependent** |
| TTS — ElevenLabs Flash (Scale, full use) | — | $0.045–0.09 | 0.5× credit rate |
| TTS — ElevenLabs Multilingual v2 | $0.20–0.22 | $0.09 | better prosody |
| TTS — Azure Neural (legal Edge) | $0.015 | $0.015 | margin-rescue option |
| **ALL-IN — ElevenLabs tier** | **$0.12–0.25** | **$0.06–0.11** | |
| **ALL-IN — Azure tier** | **$0.03–0.04** | **$0.02–0.03** | budget tier |

**The reconciliation:** the €0.10–0.35/min range quoted during planning is the
**pilot** truth. The $0.05–0.09/min figure is the **scale** truth. Both are correct.
Neither is quoted alone. Any document that states one without labelling the volume
is wrong.

**WhatsApp:** v1 is inbound-only. User-initiated service conversations are **€0** on
Meta's side inside the 24-hour window. Outbound templates are priced per message by
category (marketing / utility / authentication) and are **out of scope for v1**.
⚠️ Meta pricing changed category model effective 2025-07-01 — verify the current
page and screenshot it (§6).

## 2. Fixed monthly cost — managed service, operated by us

| Item | €/mo |
|---|---|
| EU VPS + backups + monitoring | 25–60 |
| BSP (flat plan, or carrier per-message) | 49+ |
| FR number (Telnyx) | 1–5 |
| Misc / incident reserve | 10 |
| **Total** | **85–125** |

This is not a passive infrastructure bill. It buys **24/7 on-call coverage**, which
is the operational commitment accepted for this engagement. Budget 4–6 hours/month
of incident response and provider-degradation triage on top.

**Fixed cost per minute, and why per-minute pricing fails early:**

| Monthly minutes | Fixed cost added per minute |
|---|---|
| 300 | +€0.30 |
| 600 | +€0.15–0.20 |
| 2,000 | +€0.05–0.06 |
| 3,000 | +€0.03–0.04 |

**Break-even is ~2,000 min/month.** Below that, per-minute-only pricing cannot carry
the fixed base. This is arithmetic, not a pricing preference.

## 3. Pricing shapes to offer the client

| Shape | Structure | Use when |
|---|---|---|
| A | €150/mo platform + €0.25/min | Rejected — leaves no margin for 24/7 ops |
| B | €350/mo incl. 400 min, then €0.20/min | Workable, simple |
| **C (recommended)** | **€180/mo + €0.22/min business hours, €0.12/min off-hours, voicemail→WhatsApp always on** | Tiered rate sells a night receptionist at a discount — a feature, not a discount |

Shape C exists because off-hours volume is the cheapest minute to serve (no
transfer legs, no contention) and a client with a night shift gets one for less.
Present it as a product, not a price cut.

At scale, the Azure budget tier supports a €0.12–0.15/min sell with margin. The
ElevenLabs premium tier holds €0.25–0.35/min.

## 4. What is NOT in this model

- Cold outbound calls (out of scope v1) — materially different consent and spam cost.
- Human transfer target capacity (client-side cost, not ours).
- Native mobile app (repo already ships Android).
- Audio recording storage (v1 records none — see CALL-FLOW.md).
- Darija/Arabic voice (out of scope; Whisper is weak on Darija, MSA TTS is an
  audible tell to a Moroccan caller).

## 5. Revalidation triggers

Re-run §6 and re-issue this document when any of these change:
vendor pricing page, expected monthly minute volume crossing 1,000 or 3,000, a
provider change (BSP/carrier/TTS/STT), or a currency move beyond the +5% buffer.

## 6. Verification checklist — required before client signature

- [ ] Telnyx FR inbound/outbound rate card — screenshot, dated
- [ ] ElevenLabs current tier + credit table + Flash credit multiplier — screenshot, dated
- [ ] Deepgram Nova FR price + FR in the language list — screenshot, dated
- [ ] OpenRouter Gemini Flash price — screenshot, dated
- [ ] Meta per-message vs service-conversation pricing — screenshot, dated
- [ ] 2–3 BSP quotes (request template: [`docs/voice/client/VENDOR-QUOTE-REQUEST.md`](VENDOR-QUOTE-REQUEST.md))
- [ ] Expected monthly minutes from the client (this is the input that makes §1 real)
