# Composer Architecture — Full Stack Map

> **Generated:** 2026-07-04
> **Purpose:** Map the entire composer subsystem (Rust + React) so the next holistic UI/UX improvement sprint can be planned.
> **Covers:** Mail composer, campaign composer, AI generation, prefill, template integration.

---

## 1. Rust Backend

### 1.1 Composer Plugin (`src-tauri/src/composer/`)

A minimal Tauri v2 plugin that exposes a single command:

| Command         | Signature                                     | Purpose                                                                                                              |
| --------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `open_composer` | `(mode: Option<String>) → Result<(), String>` | Opens composer via widget shortcut (Android quick compose). Emits `AppEvent::ComposerOpen { mode }` on the EventBus. |

**Only file:** `mod.rs` (32 lines) — plugin init + command handler.

### 1.2 Composer Presets (`src-tauri/src/db/tables/comms/composer_presets.rs`)

Full CRUD for the `composer_presets` SQLite table. Each preset stores:

| Field                | Type    | Purpose                                |
| -------------------- | ------- | -------------------------------------- |
| `id`                 | TEXT    | UUID primary key                       |
| `account_id`         | TEXT    | FK to accounts                         |
| `name`               | TEXT    | User-facing name                       |
| `default_reply_mode` | TEXT    | `"reply"` / `"replyAll"` / `"forward"` |
| `send_and_archive`   | INTEGER | Whether to archive after send          |
| `undo_send_delay`    | INTEGER | Delay in seconds                       |
| `font_family`        | TEXT    | Editor font                            |
| `font_size`          | INTEGER | Editor font size                       |
| `is_default`         | INTEGER | Default flag                           |
| `created_at`         | INTEGER | Timestamp                              |

**DB functions:** `list`, `get_by_id`, `get_default`, `create`, `update`, `delete`
**Tests:** 10 tests covering all CRUD operations + scoping.

### 1.3 Schema (`src-tauri/src/db/mail/schema.rs`)

`ComposerPreset` struct with `#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]`.

### 1.4 EventBus Integration (`src-tauri/src/events/mod.rs`)

- `AppEvent::ComposerOpen { mode: String }` — emitted by `open_composer` command
- Serialized as `{ "kind": "composer:open", "mode": "..." }`
- Forwarded to frontend via the EventBus bridge task

---

## 2. Frontend — Mail Composer

### 2.1 Store (`src/features/mail/stores/composerStore.ts`)

Zustand store (204 lines) managing the full composer state:

| State                | Type                   | Purpose                                          |
| -------------------- | ---------------------- | ------------------------------------------------ |
| `isOpen`             | boolean                | Visibility                                       |
| `mode`               | `ComposerMode`         | `"new"` / `"reply"` / `"replyAll"` / `"forward"` |
| `to`, `cc`, `bcc`    | `string[]`             | Recipients                                       |
| `subject`            | string                 | Subject line                                     |
| `bodyHtml`           | string                 | Editor HTML content                              |
| `threadId`           | `string \| null`       | Parent thread                                    |
| `inReplyToMessageId` | `string \| null`       | Message being replied to                         |
| `showCcBcc`          | boolean                | Toggle CC/BCC visibility                         |
| `draftId`            | `string \| null`       | Auto-save draft ID                               |
| `attachments`        | `ComposerAttachment[]` | File attachments                                 |
| `signatureHtml`      | string                 | Current signature                                |
| `fromEmail`          | `string \| null`       | Send-as alias                                    |
| `viewMode`           | `ComposerViewMode`     | `"modal"` / `"fullpage"`                         |

**Key actions:** `openComposer(opts)`, `closeComposer()`, field setters, `handleEvent(eventType, payload)`.

**EventBus subscription:** `composer:open` → routes to `openComposer()`.

### 2.2 Component Tree (25 files)

```
Composer.tsx                  ← Main orchestrator (750 lines)
├── ComposerHeader.tsx        ← Mode label, expand/pop-out/close, org badge (Building2 + company)
├── ComposerAddressSection.tsx ← From selector + To/Cc/Bcc inputs (64 lines)
│   ├── FromSelector.tsx      ← Send-as alias dropdown with "email — company" format
│   └── AddressInput.tsx      ← Email address input with contact info chip (name + company)
├── ComposerSubjectField.tsx  ← Subject line input (27 lines)
├── EditorToolbar.tsx         ← Rich text formatting toolbar
│   ├── EmojiPicker.tsx       ← Emoji selector
│   └── emojiData.ts          ← Emoji dataset
├── EditorContent (TipTap)    ← Rich text editor
│   ├── MentionExtension.tsx  ← @mention autocomplete
│   └── LinkPreviewExtension.tsx ← URL link preview
├── TemplatePicker.tsx        ← Template selection dialog
├── AiAssistPanel.tsx         ← AI compose/reply/transform side panel (201 lines)
├── CompliancePanel.tsx       ← GDPR/unsubscribe compliance check
├── AttachmentPicker.tsx      ← File attachment management
├── PreSendChecklist.tsx      ← Bulk send review dialog
├── ScheduleSendDialog.tsx    ← Scheduled send picker
├── ComposerFooter.tsx        ← Account label, "via [Company]" badge, save status, send/schedule (83 lines)
└── SignatureSelector.tsx     ← Signature picker
```

### 2.3 Supporting Services

**Auto-save** (`src/features/mail/services/composer/draftAutoSave.ts`):

- Debounced at 3s on content field changes
- Creates/updates drafts via `emailActions.ts`
- Guards against empty drafts and account mismatch
- `startAutoSave(accountId)` / `stopAutoSave()`

**Undo-send** (`src/features/mail/hooks/useUndoSend.ts`):

- Configurable delay (read from settings)
- Captures send snapshot via `pendingSendRef` to avoid stale closures
- After delay: calls `sendEmail()`, deletes draft, optionally archives

**Email builder** (`src/shared/utils/emailBuilder.ts`):

- Proper MIME construction with multipart/alternative, multipart/related, multipart/mixed

**Template interpolation** (`src/shared/utils/templateVariables.ts`):

- Variables: `{{recipientEmail}}`, `{{senderEmail}}`, `{{senderName}}`, `{{subject}}`

### 2.3a Company Context in Composer UI (2026-07-07)

The composer and its surrounding UI now display organizational context from the active account's `company` field:

| Component          | Display                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| **ComposerHeader** | Org badge (Building2 icon + `company` name) next to mode label              |
| **ComposerFooter** | "via [Company]" text label                                                  |
| **FromSelector**   | `email — company` format in dropdown                                        |
| **AddressInput**   | Contact info chip shows `company` (from `getContactByEmail` lookup on blur) |
| **InlineReply**    | Company badge (Building2 icon) in expanded reply header                     |
| **PremiumSidebar** | Company label below AccountSwitcher                                         |

The `Account` interface includes `company: string | null` — all account creation flows populate it (defaulting to `null`).

### 2.4 Sub-Components (not imported directly by Composer)

| Component                | Path                                 | Purpose                                 |
| ------------------------ | ------------------------------------ | --------------------------------------- |
| `UndoSendToast.tsx`      | `features/mail/components/composer/` | Toast shown after send with undo button |
| `SendPreview.tsx`        | `features/mail/components/composer/` | Preview rendered HTML before send       |
| `ScheduleSendDialog.tsx` | `features/mail/components/composer/` | Date/time picker for scheduled send     |
| `PreSendChecklist.tsx`   | `features/mail/components/composer/` | Bulk send review checklist              |
| `CompliancePanel.tsx`    | `features/mail/components/composer/` | GDPR consent, unsubscribe link          |
| `SignatureSelector.tsx`  | `features/mail/components/composer/` | Pick from saved signatures              |
| `TemplatePicker.tsx`     | `features/mail/components/composer/` | Browse and insert templates             |
| `AiAssistPanel.tsx`      | `features/mail/components/composer/` | AI compose/reply/transform              |

---

## 3. Frontend — AiGenerationFlow (Shared)

### 3.1 Component (`src/shared/components/ai/AiGenerationFlow.tsx`)

Generic 4-step modal workflow for AI generation:

| Step       | State          | Description                                  |
| ---------- | -------------- | -------------------------------------------- |
| Prompt     | `"prompt"`     | User enters a text prompt                    |
| Generating | `"generating"` | Loading spinner with label                   |
| Preview    | `"preview"`    | Shows generated result with regenerate/reset |
| Error      | `"error"`      | Error message with retry/cancel              |

**Generics:** `AiGenerationFlow<T>` where `T` is the result type.
**Slots:** `promptSlot`, `previewSlot`, `errorSlot` for per-feature customization.
**Locked state:** Shows `UpgradeBanner` when AI is paywalled.

**Used by (4 modals in settings):**

- `AiWorkflowGenerateModal.tsx`
- `AiWarmupGenerateModal.tsx`
- `AiSignatureGenerateModal.tsx`
- `AiTemplateGenerateModal.tsx`

### 3.2 AI Assist Panel (`src/features/mail/components/composer/AiAssistPanel.tsx`)

Inline AI panel within the mail composer:

- `composeFromPrompt(prompt)` — generates new email from description
- `generateReply(messages, instructions)` — generates reply given thread context
- `transformText(html, type)` — improves/shortens/formalizes existing text

---

## 4. Frontend — Campaign Composer

Location: `src/features/campaigns/` (4-step wizard)

| Step | Component    | Purpose                                              |
| ---- | ------------ | ---------------------------------------------------- |
| 1    | AudienceStep | Contact/group/segment selection with recipient count |
| 2    | TemplateStep | Template picker + A/B variant editor                 |
| 3    | ScheduleStep | Immediate/scheduled/recurring with end conditions    |
| 4    | ReviewStep   | Preview, mail-merge variable check, launch           |

**Store:** `campaignComposerStore.ts` (Zustand) — persists wizard state.

---

## 5. Data Flow: Composer Open → Send

```
Kotlin Widget Click / EventBus
        │
        ▼
Rust: open_composer command
        │
        ▼
EventBus: emit ComposerOpen { mode }
        │
        ▼
JS EventBus Bridge → composerStore.handleEvent("composer:open", { mode })
        │
        ▼
Composer.tsx renders (CSSTransition slide-up)
        │
        ▼
useEffect: load signature, aliases, templates in parallel
        │
        ▼
User edits → draftAutoSave (3s debounce)
        │
        ▼
User clicks Send → buildRawEmail() → executeSend()
        │
        ▼
capture snapshot → pendingSendRef → undoSend.schedule()
        │
        ▼
After delay → sendEmail() → delete draft → archive (optional)
```

---

## 6. Gaps & Opportunities for Next UI/UX Sprint

### 6.1 Mail Composer

| Gap                                     | Priority | Notes                                                 |
| --------------------------------------- | -------- | ----------------------------------------------------- |
| Composer.tsx is 750 lines — still large | P1       | Can extract `ComposerProvider` for data-loading logic |
| AddressInput not reusable               | P2       | Tightly coupled to composer store                     |
| No template shortcut visual UI          | P2       | User can't discover `:shortcut` without memorizing    |
| Pre-send threshold hardcoded at 5       | P2       | Should be a setting                                   |
| Compliance panel only for non-replies   | P2       | Some compliance rules apply to replies                |
| No test for main Composer component     | P1       | Integration test gap                                  |
| Drag-and-drop polish                    | P3       | Animated overlay, progress indicator                  |

### 6.2 AI Integration

| Gap                                                                      | Priority | Notes                                         |
| ------------------------------------------------------------------------ | -------- | --------------------------------------------- |
| AiAssistPanel lacks context-aware suggestions                            | P1       | Could suggest replies based on thread content |
| No AI prefill for common email types (quote, follow-up, meeting request) | P1       | Template + AI hybrid                          |
| AiGenerationFlow locked state shows upgrade UI but no fallback           | P2       | Should offer offline/fallback generation      |
| No AI "smart compose" (inline suggestions)                               | P2       | Requires Rust-side streaming inference        |
| No prompt history / recently used prompts                                | P3       | UX polish                                     |

### 6.3 Prefill System

| Gap                                                    | Priority | Notes                                                             |
| ------------------------------------------------------ | -------- | ----------------------------------------------------------------- |
| No URL-based prefill for `to`, `cc`, `subject`, `body` | P1       | `mailto:` link parsing exists but not for app-internal navigation |
| No deep-link prefill from contact/profile pages        | P1       | "Send email to this contact" should prefill To: field             |
| No prefill from calendar events                        | P2       | "Email attendees" should prefill addresses                        |
| No prefill from CRM context (deal, lead, ticket)       | P2       | Context-aware subject line suggestions                            |
| `composer:open` event doesn't carry prefill data       | P1       | Currently only carries `mode` — should carry full prefill payload |

### 6.4 Template System

| Gap                                                    | Priority | Notes                                         |
| ------------------------------------------------------ | -------- | --------------------------------------------- |
| Template system is per-account, not global             | P1       | Templates should be shareable across accounts |
| No template categories/groups                          | P2       | Flat list scales poorly                       |
| Template shortcut (`:shortcut`) has no discoverability | P2       | Needs inline popup UI                         |
| No template preview before insertion                   | P2       | Should show rendered preview                  |
| Campaign templates and mail templates are separate     | P2       | Should share engine                           |

### 6.5 Campaign Composer

| Gap                                    | Priority | Notes                               |
| -------------------------------------- | -------- | ----------------------------------- |
| No campaign attachments                | P2       | File attachments in campaign emails |
| No rich text A/B variant editor        | P2       | Currently basic textareas           |
| No campaign send history per recipient | P3       | Track per-recipient send status     |
| No engagement prediction               | P3       | ML-based open/click rate estimates  |

---

## 7. Recommendation: Next Sprint Focus

**Phase 1 — Prefill & Deep Link (P1, 2-3 days)**

1. Extend `composer:open` event to carry full prefill payload (`to`, `cc`, `subject`, `body`, `threadId`, `draftId`)
2. Wire "Send email to contact" from contact profile → opens composer with To: pre-filled
3. Wire "Email attendees" from calendar event → opens composer with addresses pre-filled
4. Parse `mailto:` links for app-internal navigation

**Phase 2 — AI Context-Awareness (P1, 3-4 days)**

1. Pass thread context (last N messages) to `AiAssistPanel` for reply generation
2. Add "Suggest reply" button in thread view that opens composer with AI-generated reply
3. Add prefill slot for "compose type" (quote/follow-up/meeting request/thank you)
4. Improve prompt templates with context variables

**Phase 3 — Template UX (P2, 2-3 days)**

1. Add template category picker
2. Add template preview before insertion
3. Add `:` shortcut popup in editor
4. Unify mail templates + campaign templates

**Phase 4 — Composer Extraction (P1, 1-2 days)**

1. Extract `ComposerProvider.tsx` for data-loading logic (signatures, aliases, templates, settings)
2. Add integration tests for main Composer component
3. Make `AddressInput` reusable
4. Make pre-send threshold configurable via settings
