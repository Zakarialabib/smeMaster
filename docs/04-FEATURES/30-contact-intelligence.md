# Contact Intelligence

> Insight layer on top of the core CRM/contact system.

## Scope

Contact intelligence is the analysis layer built on top of the core contacts feature.

This page covers:

- scoring and engagement signals
- insight-oriented helpers
- contact-centric interpretation of activity and relevance

The canonical contact/CRM surface remains `Core/03-crm-contacts.md`.

## Current Ownership

Representative code areas:

- `src/features/contacts/services/scoring.ts`
- `src/features/contacts/services/merge.ts`
- `src/features/contacts/db/contacts.ts`
- `src/features/contacts/components/SegmentPreviewDrawer.tsx`

## What It Does

The contact intelligence layer turns raw CRM data into signals that help users prioritize follow-up and understand relationship health.

That can include:

- engagement scoring
- contact-ranking or prioritization logic
- merge and duplicate-resolution support
- insight-oriented segment or preview helpers

## Boundaries

Keep these responsibilities separate:

- core CRUD, groups, tags, and contact management belong to `Core/03-crm-contacts.md`
- task follow-up logic belongs to `Core/08-tasks.md`
- AI-generated insight behavior belongs to `22-ai-integration.md` when applicable

## AI-Powered CRM Intelligence (Planned)

CRM intelligence currently uses **rule-based scoring** (engagement frequency, recency, interaction count). AI-powered insight generation is planned for future sprints.

### Proposed AI Surfaces

| Surface                | Description                                        | Priority | Prompt Pattern                 |
| ---------------------- | -------------------------------------------------- | -------- | ------------------------------ |
| Contact enrichment     | Extract company, role, intent from email history   | P1       | Structured JSON output         |
| Relationship health    | "How is the relationship with Acme Corp trending?" | P1       | Sentiment + frequency analysis |
| Deal stage prediction  | Predict deal stage based on email patterns         | P1       | Classification with confidence |
| Next action suggestion | "What should I do next with this contact?"         | P2       | Action-oriented generation     |
| Sentiment analysis     | Analyze email thread for positive/negative signals | P2       | Classification per thread      |
| Lead scoring           | Combine engagement signals with semantic analysis  | P2       | Hybrid (rules + AI)            |

### Context Sources for CRM AI

When AI-powered CRM is implemented, context should be built from:

| Source              | Data                                | Format                   |
| ------------------- | ----------------------------------- | ------------------------ |
| Email interactions  | Last 20 emails with contact         | Structured thread format |
| Contact profile     | Name, company, role, tags, segments | Key-value fields         |
| Deal history        | Linked deals, stages, amounts       | Timeline format          |
| Campaign engagement | Open/click data                     | Aggregated metrics       |

Full context engineering patterns for CRM are documented in [Context Engineering](../03-FRONTEND/ai-context-engineering.md#4-crm-intelligence-contexts).

### Prompt Design Guidance

For CRM AI prompts, follow the patterns established in [Prompt Engineering](../03-FRONTEND/ai-prompt-engineering.md):

1. Use structured JSON output for machine-consumable results
2. Wrap user/contact data in `<contact_context>` tags for injection protection
3. Include confidence scores for all predictions
4. Fall back to rule-based scoring when AI is unavailable
5. Cache results with appropriate TTL (contact interactions are relatively static)

### Key Files (AI-Ready)

| Area                 | Files                                       |
| -------------------- | ------------------------------------------- |
| Prompt constants     | `src/shared/services/ai/prompts.ts`         |
| AI service layer     | `src/shared/services/ai/aiService.ts`       |
| Provider factory     | `src/shared/services/ai/providerFactory.ts` |
| Scoring (rule-based) | `src/features/contacts/services/scoring.ts` |

## Key Files

| Area                       | Files                                                                |
| -------------------------- | -------------------------------------------------------------------- |
| Contact data layer         | `src/features/contacts/db/contacts.ts`                               |
| Scoring                    | `src/features/contacts/services/scoring.ts`                          |
| Merge support              | `src/features/contacts/services/merge.ts`                            |
| Group/Tag/Segment services | `src/features/contacts/services/groups.ts`, `tags.ts`, `segments.ts` |
| UI helpers                 | `src/features/contacts/components/SegmentPreviewDrawer.tsx`          |

## Update Rules

Update this page when:

- scoring formulas or ownership change materially
- CRM and intelligence boundaries move
- insight helpers become a larger standalone subsystem
