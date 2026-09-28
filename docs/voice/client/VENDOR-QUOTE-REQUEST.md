# Vendor Quote Request — BSP + Telephony Carrier

> **Status:** SEND-AS-IS. Nothing here commits us to anything.
> **Spec:** [`docs/specs/2026-09-28-voice-agent.md`](../../specs/2026-09-28-voice-agent.md)
> **Send to:** MessageBird · Twilio · 360dialog · Telnyx (all four, for comparison)
> **Date sent:** ☐  **Quotes due:** ☐

Send this to **all four**, including Telnyx for voice and Meta/WhatsApp
onboarding. One vendor covering both channels is worth a quote on its own — single
invoice, single SLA, single support thread.

---

## 1. WhatsApp Business Platform

1. Per-message price for France, by category: **service / utility / marketing /
   authentication**. Confirm which are free and under what conditions.
2. Platform fee (subscription) + any Meta pass-through charges.
3. Confirmation that **user-initiated service conversations inside the 24-hour
   window are free** (this is the basis of our v1 costing).
3b. **Owner-notification path.** We send a missed-call summary from the agent's
   WhatsApp number **to the business owner**. Is that message *user-initiated*
   (free) or *business-initiated* (template, priced)? If it needs a template:
   which category (utility?), the per-message price for France, and what
   opt-in/opt-out the owner must complete. This decides whether the
   voicemail→WhatsApp path is €0 or a per-call cost — see `CALL-FLOW.md` §5.1.
4. Business verification requirements and **timeline for a French entity**
   (SIREN, domain email, proof of business) — end-to-end, not per-step.
5. Number provisioning: can we get a FR WhatsApp display number, and can an
   **existing** FR number be ported? If so, timeline and cost (ARCEP constraints).
6. Data residency: is message content processed in the EU? Under what DPA?
7. SLA %, and the invoice currency (EUR vs USD).

## 2. Telephony (voice)

8. FR geographic DID provisioning cost, monthly, and porting an existing FR number.
9. **Inbound FR rate per minute**, by number type (geographic, national, toll-free).
10. **Outbound FR rate per minute**, and whether a transfer leg is billed
    separately from the initial leg.
11. Media streaming API: WebSocket/RTP, audio codec (μ-law / PCMA at 8 kHz),
    bidirectional streaming, and **documented webhook/media latency**.
12. Does the carrier support **warm transfer** with SIP REFER or equivalent? (We
    need transfer to a human on the client's existing setup.)
13. Number reputation monitoring and automated block/spam-rate suspension — what
    is the policy, what are the thresholds, and is there an appeal path?
14. Emergency number handling: do you support calls to/from FR emergency numbers
    (15, 17, 18, 112)? Our agent must never be the endpoint for an emergency.
15. **AI usage disclosure** — does the platform require or restrict automated
    agents on inbound calls? What do you require in the caller greeting?

## 3. Commercial

16. Volume tiers and where the breakpoints are (we price per minute, so we need
    the tier boundaries, not just the headline rate).
17. Test/sandbox environment: can we integrate and take real calls before signing?
18. Notice period and data portability (transcripts, recordings if any, numbers).

---

## Notes for the recipient

- Our agent is **inbound only** for v1. No outbound campaigns.
- Languages: **French and English**. No Arabic or Darija.
- We are a managed service — the end client is a French business; EU residency
  matters to them.
- We need a **rate card we can cite in a commercial proposal**, so please include
  the current published tier table.

## Internal: what we do with the answers

| Question | Feeds |
|---|---|
| 1–3, 7 | `COST-MODEL.md` §1 (WhatsApp = €0 confirmation) |
| 4, 5, 17 | Gate 7 timeline — Meta onboarding is the schedule risk |
| 8–10, 16 | `COST-MODEL.md` §1, §2 (the dominant variable cost) |
| 11, 12 | Gate 4 feasibility — no warm transfer = no v1 |
| 13 | Reuse the existing deliverability monitoring (see spec §Reuse) |
| 14 | `CALL-FLOW.md` §6 emergency policy |
| 15 | May constrain the disclosure script in `CALL-FLOW.md` §2 |
