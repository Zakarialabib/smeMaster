# smeMaster → Paperling-Grade Campaign System: Transformation Plan

> ⚠️ **ARCHIVED WORKING DOC — 2026-07-15.** This design plan has been **executed**: the block-based campaign editor, live preview, AI copilot, Vault image picker, and `campaignComposerStore` (blocks + undo/redo + A/B) are shipped (see `docs/STATUS.md` → "Campaign Block Editor — Paperling-grade"). The code is now the source of truth; this file is kept for historical design rationale only. Do **not** implement from it — check `src/features/campaigns/` first.

## 0. Context

**Objective:** Transform the smeMaster campaign module from a basic form-based email sender into a Paperling-grade email campaign platform with block-based editor, live preview, file management, AI copilot, and integrated campaign workflows.

**Source Reference:** https://github.com/Razee4315/Paperling  
**Target Repository:** https://github.com/Zakarialabib/smeMaster  

**Working Branch:** `feat/paperling-campaign-transform`

**Scope Discipline:** This plan covers Phase 1 only. Every section marked `→ Phase 2` is documented but explicitly excluded from current implementation. Do not begin Phase 2 work. Do not partially implement Phase 2 features. If a Phase 2 dependency surfaces during Phase 1, stub it with a clearly labeled no-op and file a `TODO(P2)` comment.

---

## 1. Current State Assessment (VERIFIED 2026-07-13)

Inventory already run against the live repo. Findings below are ground truth — they
override the generic assumptions in the rest of this document. **Every architecture
decision in §3 was corrected to match these facts.**

### 1.1 What already exists (reuse, do not rebuild)

**Campaign module** (`src/features/campaigns/`):
- `CampaignList.tsx` — list view with status. Drives a `CampaignComposer` modal.
- `CampaignComposer.tsx` — a 4-step wizard (Audience → Template → Schedule → Review).
  Audience supports contacts / groups / segments; schedule supports immediate / scheduled /
  recurring; already has A/B testing (`variantA`/`variantB` subject+body + split ratio +
  duration), GDPR consent, open/click tracking toggle.
- `campaignComposerStore.ts` — Zustand store holding all composer state (the block editor
  state must EXTEND this store, not a new one).
- `campaignStore.ts` — Zustand store; persists via Rust `invokeCommand("db_create_campaign")`.
- `campaignService.ts` — orchestration layer; `createCampaign()` resolves group/segment IDs
  on the frontend and calls Rust `db_create_campaign_with_recipients`.
- `campaigns` DB schema (`src/shared/services/db/schema.ts`) already stores
  `subject`, `body_html`, `body_text` — so campaigns already persist HTML. The gap is the
  **authoring UX**: the composer picks a `templateId` / stores A/B subject+body as plain
  strings. There is no block-based editor.
- Already-built sub-systems: `abTesting.ts`, `analyticsService.ts`, `campaignTemplateCatalog.ts`
  (template picker), `campaignRecipients.ts`.

**File management — Vault** (`src/features/vault/`):
- Full file manager: `VaultPage` + components (grid/list, search, upload zone, breadcrumb,
  storage indicator, file preview, file card). `vaultStore.ts` (Zustand) supports grid/list,
  sort, search, folders, move/rename/copy, bulk select, PIN + biometric unlock, category filter.
- Backed by **Rust real storage** via `vaultService` (`listVaultDir`, `copyToVault`,
  `readVaultFile(path)` returns file content). NOT localStorage. This is the integration
  target for "file management" — no new storage layer needed.

**AI copilot — Assistant/RAG** (`src/features/assistant/` + `src/shared/services/ai/`):
- Real LLM backend: `aiService.callAi(systemPrompt, userPrompt)` dispatches to a configured
  provider (LM Studio / Ollama / OpenAI-compatible). `ragStore.ts` + `embeddingService`
  provide embeddings + vector search (local BGE-small or provider). `providerManager.isAiAvailable()`.
- So the AI copilot uses the REAL provider — NOT a mock. Swap point = `callAi` (already real).

**Shared infra already present:**
- UI primitives: `Modal`, `Button`, `EmptyState`, `AdaptiveBottomSheet`, `glass-panel`,
  design tokens in `globals.css`.
- State: **`zustand` is already a dependency** (used across the app).
- Drag/drop: **`@dnd-kit/core` + `@dnd-kit/sortable` are already installed** (^6.3.1).
- Rich text: **TipTap ^3.19 is already installed** (`@tiptap/react`, `starter-kit`,
  `extension-image`, `extension-link`, `extension-table`, `extension-underline`, etc.).
- i18n: `react-i18next` with en/ar/fr/it (locale files are LF; add keys, no new system).
- Shells: `MobileShell`/`DesktopShell`, `PageScaffold`, command palette, adaptive layout.

### 1.2 The real gap (what "Paperling-grade" must add)

1. **Block-based email editor** that produces `body_html` — replacing the composer's
   "pick a template / type A/B body as text" step. This is the core missing piece.
2. **Live split-pane preview** rendering `body_html` in an isolated iframe (`srcdoc`).
3. **Block config panel** (typography / color / alignment / link) + dnd-kit reorder.
4. **Vault integration in the editor** — "insert image from Vault", browse Vault picker.
5. **AI copilot panel** wired to the real `callAi` provider (subject/body generation,
   rewrite, tone, translate) — not a mock.
6. **Campaign workflows** — connect editor → preview → Vault → AI → save (`body_html`) →
   audience/schedule (already exist) → send (Rust already sends).

### 1.3 Constraints discovered
- `/campaigns` route is a LEGACY redirect to the merged automation page
  (`routeTree.tsx`); the campaign UI currently lives in the `CampaignComposer` modal.
  The new block editor either (a) replaces the `template` step inside the modal, or
  (b) gets a new route `/campaigns/:id/editor`. Recommended (a) to minimize routing churn.
- DB is the source of truth (Rust `invokeCommand`), NOT localStorage. New editor state is
  ephemeral (Zustand) and flushed to `body_html` on save.
- Do NOT downgrade the existing Rust-backed persistence to localStorage.
- CRLF must be preserved on edited `.tsx`/`.css`/`.md`; locale JSON files are LF.
- Verification gate: `npx tsc --noEmit` delta 0 in touched files; `cargo check` if Rust changes;
  do NOT run `docs:build`.

---

## 2. Phase 1 Scope

### IN Scope (Build Now)
- Block-based email content editor (heading, paragraph, image, button, divider, spacer)
- Live split-pane preview that renders email-compatible HTML
- Block drag-and-drop reordering
- Per-block configuration panel (typography, colors, alignment, link)
- Template save/load from localStorage
- Basic file upload with grid display in a file manager view
- Campaign list view with status (draft/scheduled/sent)
- Campaign create/edit flow connecting editor → preview → save
- AI sidebar panel with subject line generation and content generation (mock/streaming-ready)
- Shared state layer connecting editor, preview, files, and campaign
- Responsive layout for the campaign module
- Navigation updates to access new campaign flows

### OUT of Scope → Phase 2
- A/B testing framework
- Analytics dashboard with charts (open rate, CTR, bounce)
- Dynamic audience segmentation with rule builder
- Timezone-aware scheduling with queue visualization
- Image optimization pipeline (compression, resize, thumbnails)
- AI smart segmentation suggestions
- AI send-time optimization
- Email sending backend integration (SendGrid, SES, etc.)
- Real file storage backend (S3, etc.)
- Template gallery with pre-built starters
- Folder/tag organization for files
- Recurring campaign sends
- Contact import/export
- Engagement history per contact

---

## 3. Architecture Decisions (CORRECTED to the verified repo — 2026-07-13)

> The original §3 assumed a greenfield app. Every decision below was rewritten to reuse the
> modules that already ship in this repo.

### 3.1 State Management: EXTEND the existing Zustand composer store
`zustand` is **already installed**. Do NOT add a new store. Add block-editor state
(`blocks`, `selectedBlockId`, history/undo) to `campaignComposerStore.ts` (or a sibling
`campaignEditorStore.ts` that imports the composer store). Keep editor state ephemeral;
flush to `body_html` on Save.

### 3.2 Drag and Drop: use the already-installed `@dnd-kit`
`@dnd-kit/core` + `@dnd-kit/sortable` are **already installed** (^6.3.1). Use them for
block reordering — no install needed. Configure `PointerSensor` + `TouchSensor` + `KeyboardSensor`.

### 3.3 Editor: custom block system OR TipTap — both are viable
TipTap ^3.19 is **already installed**. Two validated options:
- **(A) Custom block system** (closest to Paperling): array of typed block objects →
  `emailRenderer` → table-based inline-style HTML. Full output control, best email fidelity.
- **(B) TipTap with an email output serializer**: faster to build rich inline editing, but
  serializing to email-safe table HTML is non-trivial.
Recommendation: **(A) custom block system** for email fidelity; reuse TipTap only if a rich
inline-editor requirement emerges. Either way, NO new editor dependency.

### 3.4 Preview: iframe with srcdoc (unchanged)
Render `body_html` inside `<iframe srcdoc={...}>` for CSS isolation + desktop/mobile width
toggle. Same as original §3.4.

### 3.5 AI: REAL provider, not a mock
The repo already has a working LLM backend: `aiService.callAi(system, user)` → LM Studio /
Ollama / OpenAI-compatible (`src/shared/services/ai/aiService.ts`), plus `providerManager.isAiAvailable()`.
Wire the AI copilot to `callAi` directly. If no provider is configured, degrade gracefully
(show "connect a Local AI provider" CTA) — do NOT ship a mock that misrepresents capability.
Swap point for a different model = the provider config, already real.

### 3.6 File Storage: integrate with the existing Vault (Rust-backed), NOT localStorage
`vaultStore` + `vaultService` provide real file storage (grid/list, search, upload, folders,
PIN/biometric). The editor's "insert image" opens a Vault picker (`readVaultFile` returns
content / a vault path). Store the **vault path** (not base64) in the image block; resolve to
a data URL / signed URL at render/send time. This removes the localStorage 5MB limit entirely.
Do NOT introduce a second storage layer.

## 3.7 Reconciliation Bridge — how the remaining sections map to the real repo

The sections below (§4 file structure, §5 types, §6 stores, §7 renderer, §8 components,
§9 routing, §10 tasks, §11 donts) were written for a greenfield app. Use them as the
UX/task checklist, but apply these mappings:

| Original (greenfield) | Reality in this repo | Action |
|---|---|---|
| `src/modules/campaign/` | `src/features/campaigns/` | Put new editor code under `src/features/campaigns/components/editor/`; reuse existing store/service/db files. |
| New Zustand stores (`useEditorStore` etc.) | `campaignComposerStore` + `campaignStore` already exist | EXTEND those stores; do NOT create parallel ones. |
| Types in `src/modules/campaign/types/` | `Campaign` schema already in `db/schema.ts` | Add an `EmailBlock` type in `campaigns/types/`; map blocks → `body_html` on save. |
| localStorage persistence | Rust `invokeCommand` DB | Persist via existing `campaignService.createCampaign` (pass `body_html`); no localStorage. |
| `useFileStore` + base64 localStorage | `vaultStore` + `vaultService` (Rust) | "Insert image" → Vault picker; store vault path, not base64. |
| `aiMock.ts` | `aiService.callAi` (real provider) | AI copilot calls `callAi`; graceful "no provider" CTA. |
| New `/campaigns` routes | `/campaigns` is a legacy redirect; UI is the `CampaignComposer` modal | Replace the `template` step of `CampaignComposer` with the block editor, OR add `/campaigns/:id/editor`. Keep legacy redirect intact. |
| §11 "do NOT install TipTap" | TipTap 3.19 already installed | OK to use TipTap if chosen in §3.3(B); otherwise custom blocks. Either way no NEW editor dep. |
| §11 "do NOT add real AI SDK" | Real provider already wired | This rule is reversed: USE the real provider; the mock is the wrong call. |
| §3.6 "localStorage + Base64" | Vault (Rust) | Reversed: integrate Vault, not localStorage. |

**Reuse checklist before writing any new file:**
- Block components → add under `src/features/campaigns/components/editor/blocks/`.
- Email renderer → `src/features/campaigns/services/emailRenderer.ts` (new, pure fn).
- Editor state → extend `campaignComposerStore.ts` (add `blocks`, `selectedBlockId`, `addBlock`, `moveBlock`, `updateBlock`, `undo`/`redo`).
- Image insert → spawn `AdaptiveBottomSheet` + a `VaultFilePicker` reading `useVaultStore`.
- AI panel → call `import("@shared/services/ai/aiService").callAi(...)`; guard with `providerManager.isAiAvailable()`. 
- Save → set `body_html` in the composer payload; flow through existing `campaignService.createCampaign`.

## 4. File Structure

Create this structure inside the existing `src/` directory. Adapt path prefixes based on the actual project structure (e.g., if using `src/pages/` vs `src/views/` vs `src/app/`):

```
src/
├── modules/
│   └── campaign/
│       ├── index.ts                      # Public API barrel export
│       ├── types/
│       │   ├── block.ts                  # Block type definitions
│       │   ├── campaign.ts               # Campaign type definitions
│       │   ├── file.ts                   # File type definitions
│       │   ├── ai.ts                     # AI message type definitions
│       │   └── index.ts                  # Barrel export
│       ├── stores/
│       │   ├── useEditorStore.ts         # Block array, selection, undo/redo
│       │   ├── useCampaignStore.ts       # Campaign CRUD, status flow
│       │   ├── useFileStore.ts           # File upload, listing, deletion
│       │   ├── useAIStore.ts             # AI messages, loading state
│       │   └── index.ts                  # Barrel export
│       ├── components/
│       │   ├── editor/
│       │   │   ├── EmailEditor.tsx       # Main editor container
│       │   │   ├── BlockList.tsx         # Sortable block list (dnd-kit)
│       │   │   ├── BlockPalette.tsx      # "+" insert menu between blocks
│       │   │   ├── blocks/
│       │   │   │   ├── BlockWrapper.tsx  # Drag handle, delete, duplicate, config toggle
│       │   │   │   ├── HeadingBlock.tsx
│       │   │   │   ├── ParagraphBlock.tsx
│       │   │   │   ├── ImageBlock.tsx
│       │   │   │   ├── ButtonBlock.tsx
│       │   │   │   ├── DividerBlock.tsx
│       │   │   │   ├── SpacerBlock.tsx
│       │   │   │   └── index.ts
│       │   │   └── config/
│       │   │       ├── BlockConfigPanel.tsx  # Dynamic config based on block type
│       │   │       ├── TypographyConfig.tsx
│       │   │       ├── ColorConfig.tsx
│       │   │       ├── AlignmentConfig.tsx
│       │   │       ├── LinkConfig.tsx
│       │   │       └── index.ts
│       │   ├── preview/
│       │   │   ├── EmailPreview.tsx      # iframe container with width toggle
│       │   │   └── emailRenderer.ts      # Blocks → email HTML string (pure function)
│       │   ├── files/
│       │   │   ├── FileManager.tsx       # Grid/list view, search, upload zone
│       │   │   ├── FileUploadZone.tsx    # Drag-drop upload area
│       │   │   ├── FileGrid.tsx          # Grid display of files
│       │   │   └── FileCard.tsx          # Individual file card
│       │   ├── ai/
│       │   │   ├── AIPanel.tsx           # Sidebar AI chat/generation panel
│       │   │   ├── AIMessage.tsx         # Single message bubble
│       │   │   └── aiMock.ts             # Mock AI implementation (swap point)
│       │   ├── campaigns/
│       │   │   ├── CampaignList.tsx      # Campaign table/grid with status filters
│       │   │   ├── CampaignCard.tsx      # Single campaign summary card
│       │   │   ├── CampaignBuilder.tsx   # Top-level: editor + preview + AI + save
│       │   │   └── CampaignStatusBadge.tsx
│       │   └── shared/
│       │       ├── ColorPicker.tsx       # Simple color picker (no heavy lib)
│       │       ├── WidthToggle.tsx       # Desktop/mobile preview toggle
│       │       └── EmptyState.tsx
│       ├── utils/
│       │   ├── blockDefaults.ts          # Default content for each block type
│       │   ├── emailCSS.ts               # Email-safe CSS constants
│       │   ├── cssToInline.ts            # CSS class → inline style converter
│       │   ├── idGenerator.ts            # Unique block/campaign/file IDs
│       │   └── localStorage.ts           # Typed localStorage get/set helpers
│       └── constants/
│           ├── blockTypes.ts             # Block type enum and metadata
│           └── campaignStatus.ts         # Status enum and transitions
```

---

## 5. Type Definitions

### 5.1 `src/modules/campaign/types/block.ts`

```typescript
export type BlockType = 'heading' | 'paragraph' | 'image' | 'button' | 'divider' | 'spacer';

export interface BlockBase {
  id: string;
  type: BlockType;
}

export interface TypographyProps {
  fontSize: number;       // px
  fontWeight: number;     // 400, 500, 600, 700
  color: string;          // hex
  fontFamily: string;     // 'sans-serif' | 'serif' | 'monospace'
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;     // unitless
  padding: { top: number; bottom: number; left: number; right: number }; // px
}

export interface HeadingBlock extends BlockBase {
  type: 'heading';
  content: string;
  level: 1 | 2 | 3;       // h1, h2, h3
  typography: TypographyProps;
}

export interface ParagraphBlock extends BlockBase {
  type: 'paragraph';
  content: string;
  typography: TypographyProps;
}

export interface ImageBlock extends BlockBase {
  type: 'image';
  src: string;             // data URL in P1, real URL in P2
  alt: string;
  width: number;           // px
  alignment: 'left' | 'center' | 'right';
  linkUrl: string;         // optional click-through URL
  borderRadius: number;    // px
  padding: { top: number; bottom: number; left: number; right: number };
}

export interface ButtonBlock extends BlockBase {
  type: 'button';
  text: string;
  url: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: number;    // px
  padding: { top: number; bottom: number; left: number; right: number };
  alignment: 'left' | 'center' | 'right';
  fullWidth: boolean;
  typography: Pick<TypographyProps, 'fontSize' | 'fontWeight' | 'fontFamily'>;
}

export interface DividerBlock extends BlockBase {
  type: 'divider';
  color: string;
  thickness: number;       // px
  width: number;           // percentage 0-100
  padding: { top: number; bottom: number };
}

export interface SpacerBlock extends BlockBase {
  type: 'spacer';
  height: number;          // px
}

export type EmailBlock =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock;
```

### 5.2 `src/modules/campaign/types/campaign.ts`

```typescript
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent';

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  preheader: string;        // preview text in inbox
  blocks: EmailBlock[];     // the email content
  status: CampaignStatus;
  templateId: string | null; // if created from a template
  createdAt: string;        // ISO 8601
  updatedAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  blocks: EmailBlock[];
  createdAt: string;
}
```

### 5.3 `src/modules/campaign/types/file.ts`

```typescript
export type FileCategory = 'image' | 'document' | 'other';

export interface CampaignFile {
  id: string;
  name: string;
  type: string;             // MIME type
  category: FileCategory;
  size: number;             // bytes
  dataUrl: string;          // base64, P1 only
  uploadedAt: string;
}
```

### 5.4 `src/modules/campaign/types/ai.ts`

```typescript
export type AIMessageRole = 'user' | 'assistant';

export interface AIMessage {
  id: string;
  role: AIMessageRole;
  content: string;
  timestamp: string;
}

export type AITask =
  | 'generate_subject_lines'
  | 'generate_body'
  | 'rewrite_selection'
  | 'translate_selection'
  | 'change_tone';

export interface AIRequest {
  task: AITask;
  input: string;            // the user's prompt or selected text
  context?: string;         // surrounding email content for context
}
```

---

## 6. Store Implementations

### 6.1 `useEditorStore.ts`

```typescript
// Key shape — implement fully:
interface EditorState {
  blocks: EmailBlock[];
  selectedBlockId: string | null;
  configOpenBlockId: string | null;

  // Actions
  addBlock: (type: BlockType, afterIndex: number) => void;
  removeBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  moveBlock: (activeId: string, overId: string) => void;
  updateBlock: (id: string, changes: Partial<EmailBlock>) => void;
  selectBlock: (id: string | null) => void;
  toggleConfig: (id: string | null) => void;
  loadBlocks: (blocks: EmailBlock[]) => void;
  clearBlocks: () => void;

  // Undo/Redo (P1: basic, P2: full history)
  history: EmailBlock[][];
  historyIndex: number;
  undo: () => void;
  redo: () => void;
  _pushHistory: () => void;
}
```

**Implementation rules:**
- Every mutation action must call `_pushHistory()` BEFORE mutating `blocks`
- `moveBlock` uses the dnd-kit `onDragEnd` result to splice the array
- `updateBlock` uses `map` to replace the matching block by id
- `addBlock` inserts at `afterIndex + 1` using `blockDefaults.ts` to get initial values
- Do NOT persist editor state to localStorage automatically — that's the campaign's responsibility

### 6.2 `useCampaignStore.ts`

```typescript
interface CampaignState {
  campaigns: Campaign[];
  templates: CampaignTemplate[];
  currentCampaignId: string | null;

  // Actions
  createCampaign: (name: string) => string; // returns id
  updateCampaign: (id: string, changes: Partial<Campaign>) => void;
  deleteCampaign: (id: string) => void;
  setCampaignStatus: (id: string, status: CampaignStatus) => void;
  setCurrentCampaign: (id: string | null) => void;
  saveAsTemplate: (campaignId: string, templateName: string) => string;
  loadFromTemplate: (templateId: string) => EmailBlock[];
  getCampaign: (id: string) => Campaign | undefined;
  getCurrentCampaign: () => Campaign | undefined;

  // Persistence
  _loadFromStorage: () => void;
  _saveToStorage: () => void;
}
```

**Implementation rules:**
- Call `_saveToStorage()` after every mutation
- Call `_loadFromStorage()` once in the store initializer
- `createCampaign` generates an id via `idGenerator.ts`, sets status to 'draft', empty blocks array
- `setCampaignStatus` must validate transitions: draft → scheduled → sending → sent (no backward transitions in P1)
- When `currentCampaignId` changes, call `useEditorStore.getState().loadBlocks(campaign.blocks)`

### 6.3 `useFileStore.ts`

```typescript
interface FileState {
  files: CampaignFile[];
  uploadInProgress: boolean;

  // Actions
  addFile: (file: File) => Promise<CampaignFile>;
  removeFile: (id: string) => void;
  getFilesByCategory: (category: FileCategory) => CampaignFile[];
  getFileById: (id: string) => CampaignFile | undefined;
  getTotalSize: () => number;

  // Persistence
  _loadFromStorage: () => void;
  _saveToStorage: () => void;
}
```

**Implementation rules:**
- `addFile` reads the File as dataURL via FileReader, enforces 2MB per-file limit, enforces 5MB total limit
- Categorize by MIME: image/* → 'image', application/pdf → 'document', else 'other'
- Persist to localStorage after every add/remove
- Warn (console.warn, not alert) when approaching storage limits

### 6.4 `useAIStore.ts`

```typescript
interface AIState {
  messages: AIMessage[];
  isLoading: boolean;

  // Actions
  sendRequest: (request: AIRequest) => Promise<void>;
  clearMessages: () => void;
}
```

**Implementation rules:**
- `sendRequest` adds the user message, sets `isLoading: true`, calls the mock, adds the assistant response, sets `isLoading: false`
- The mock implementation lives in `aiMock.ts` — a single async function
- Do NOT import OpenAI SDK or any AI library in Phase 1
- The mock must simulate a 800-1500ms delay to show loading state realistically
- Mock responses should be plausible marketing email copy, not lorem ipsum

---

## 7. Core Utility: Email HTML Renderer

### 7.1 `emailRenderer.ts` — THE most critical file

This pure function converts `EmailBlock[]` to an email-compatible HTML string. Requirements:

```
Input:  EmailBlock[]
Output: string (complete HTML document with inline styles)
```

**Rules:**
- Output MUST use `<table>` for layout (no CSS Grid, no Flexbox)
- Output MUST use inline styles on every element (no `<style>` block, no classes)
- Use the `cssToInline.ts` helper to convert any design-system values to inline style strings
- Font stack must be email-safe: `'Arial, Helvetica, sans-serif'` for sans, `'Georgia, serif'` for serif
- Max-width of email body: 600px, centered
- Each block becomes a `<tr><td>...</td></tr>` inside the main table
- Image blocks: `<img>` with explicit width, height, alt, border="0", style="display:block"
- Button blocks: `<a>` styled as a button inside a `<td>` with background-color, padding, border-radius, text-decoration:none
- Divider blocks: `<hr>` with inline styles or a `<td>` with border-bottom
- Spacer blocks: `<td>` with explicit height and `font-size:0; line-height:0`
- Wrap everything in `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f4f4f4">...</body></html>`

**Test this function independently.** Write a test file `emailRenderer.test.ts` that:
1. Renders an empty block array → produces valid empty email HTML
2. Renders one of each block type → produces valid HTML
3. Output has NO class attributes
4. Output has NO `<style>` tags
5. All images have alt text
6. Button links have `text-decoration: none`

---

## 8. Component Specifications

### 8.1 `CampaignBuilder.tsx` — Top-Level Layout

```
┌─────────────────────────────────────────────────────────┐
│  Campaign Header: Name input | Subject | Status badge   │
├──────────────────────┬──────────────┬───────────────────┤
│                      │              │                   │
│   EmailEditor        │ EmailPreview │   AIPanel         │
│   (scrollable)       │ (iframe)     │   (sidebar)       │
│                      │              │                   │
│                      │              │                   │
│                      │              │                   │
├──────────────────────┴──────────────┴───────────────────┤
│  Footer: Save Draft | Save as Template | Schedule (P2)  │
└─────────────────────────────────────────────────────────┘
```

- On screens < 1024px: stack editor above preview, hide AI panel behind a toggle button
- On screens < 768px: full-width single column, AI behind a floating action button
- The AI panel should be collapsible (toggle icon in the header area)

### 8.2 `EmailEditor.tsx`

- Contains `BlockList` (the dnd-kit sortable container)
- Between each block, renders a `BlockPalette` trigger (a "+" button that appears on hover of the gap between blocks)
- At the bottom, always show a `BlockPalette` for adding the first block or appending
- When a block is selected, show a subtle highlight border
- When config is open for a block, show `BlockConfigPanel` as a slide-in panel on the right side of the editor (or below on mobile)

### 8.3 `BlockWrapper.tsx`

Every block renders inside this wrapper, which provides:
- Drag handle (grip icon, left side, visible on hover)
- Click to select (sets `selectedBlockId`)
- Delete button (trash icon, visible on hover or when selected)
- Duplicate button (copy icon, visible on hover or when selected)
- Config toggle (gear icon)
- Uses `useSortable` from dnd-kit

### 8.4 `BlockPalette.tsx`

When clicked, shows a dropdown/popover with block type options:
- Each option shows an icon + label: "Heading", "Paragraph", "Image", "Button", "Divider", "Spacer"
- Clicking an option calls `addBlock(type, afterIndex)` and closes the palette
- Position the palette directly below the "+" trigger

### 8.5 Individual Block Components

Each block component receives its block data and an `onChange` callback.

**HeadingBlock:** ContentEditable `<h1>`/`<h2>`/`<h3>` that calls `updateBlock` on `onBlur` (not on every keystroke — too expensive for the preview sync). Level switcher in the toolbar above the block (h1 | h2 | h3 tabs).

**ParagraphBlock:** ContentEditable `<p>` that calls `updateBlock` on `onBlur`. Supports basic keyboard: Enter creates a new paragraph block below, Backspace at start of empty block deletes it.

**ImageBlock:** If `src` is empty, show an upload drop zone. If `src` exists, show the image with resize handle. Alt text input below the image. Link URL input. Integration with `useFileStore` — "Choose from files" button that opens a mini file picker.

**ButtonBlock:** Text input, URL input, color pickers for bg/text, alignment toggle, full-width toggle. Live preview of the button styled inline.

**DividerBlock:** Color picker, thickness slider (1-5px), width slider (50-100%).

**SpacerBlock:** Height slider (8-80px). Visual representation as a dashed-outline empty area with height label.

### 8.6 `EmailPreview.tsx`

- Renders `<iframe srcdoc={emailHTML} />` 
- Width toggle buttons: "Desktop (600px)" and "Mobile (375px)" 
- The iframe container transitions width smoothly
- Add a subtle device frame around the iframe (rounded corners, shadow)
- Shows "No content yet" empty state when blocks array is empty
- Re-renders on every block change (use `useMemo` on the renderer output keyed on `blocks`)

### 8.7 `FileManager.tsx`

Route: `/campaigns/files` (or wherever the existing file-related routes live)

- Top bar: search input, "Upload" button, grid/list view toggle
- `FileUploadZone`: full-width drop area at top when dragging files over the page, or always-visible compact zone
- `FileGrid`: responsive grid of `FileCard` components
- `FileCard`: thumbnail/preview, filename, size, type badge, delete button, "Use in email" button
- "Use in email" navigates to the campaign builder and opens the image block config

### 8.8 `AIPanel.tsx`

- Chat-style message list with `AIMessage` bubbles
- Input area at bottom with text input + send button
- Quick action buttons above input: "Generate Subjects", "Write Body", "Rewrite", "Change Tone"
- "Generate Subjects" sends a `generate_subject_lines` request with current email context
- "Write Body" sends a `generate_body` request with a prompt
- "Rewrite" sends a `rewrite_selection` request with the currently selected block's text
- When the AI returns subject lines, render them as clickable chips — clicking one applies it to the campaign subject field
- When the AI returns body content, show an "Insert as blocks" button that parses the response into paragraph/heading blocks and appends them
- Show a "Powered by AI (mock)" badge — make it clear this is not a real AI in P1

### 8.9 `CampaignList.tsx`

- Table or card grid showing all campaigns
- Each row/card: name, subject, status badge, created date, updated date
- Status filter tabs: All | Draft | Scheduled | Sent
- "New Campaign" button → navigates to `CampaignBuilder` with a new campaign
- Click a campaign → navigates to `CampaignBuilder` with that campaign loaded
- Delete campaign (with confirmation, not `window.confirm` — use an inline confirm)

---

## 9. Routing Integration

Add these routes to the existing router configuration. Adapt the exact paths to match the project's convention:

```typescript
// Add to existing route config:
{
  path: '/campaigns',
  children: [
    { index: true, element: <CampaignList /> },
    { path: 'new', element: <CampaignBuilder /> },
    { path: ':id', element: <CampaignBuilder /> },
    { path: 'files', element: <FileManager /> },
  ]
}
```

Update the existing navigation/sidebar to include:
- "Campaigns" link → `/campaigns` (the list)
- "Files" link → `/campaigns/files`

If the existing campaign module has routes that conflict, rename the old ones to `/campaigns-old/...` rather than deleting them. Preserve the old code until the new flow is verified working.

---

## 10. Task Execution Order

Execute in this exact order. Do not skip ahead. Each task has a verification step.

### Task 1: Scaffold & Types
- [ ] Create the `src/modules/campaign/` directory structure
- [ ] Create all type definitions (block.ts, campaign.ts, file.ts, ai.ts)
- [ ] Create `idGenerator.ts` — use `crypto.randomUUID()` with fallback
- [ ] Create `blockDefaults.ts` — export a function for each block type returning a complete default block
- [ ] Create `blockTypes.ts` — export block type metadata (label, icon name, description)
- [ ] Create `campaignStatus.ts` — export status enum, valid transitions, status colors
- **Verify:** TypeScript compiles with no errors

### Task 2: Stores
- [ ] Install zustand
- [ ] Implement `useEditorStore.ts`
- [ ] Implement `useCampaignStore.ts`
- [ ] Implement `useFileStore.ts`
- [ ] Implement `useAIStore.ts`
- [ ] Create `localStorage.ts` helpers
- **Verify:** Write a temporary test component that uses each store's actions and verify state changes in React DevTools

### Task 3: Email Renderer
- [ ] Implement `emailCSS.ts` — email-safe CSS constants
- [ ] Implement `cssToInline.ts` — converts typography/block props to inline style strings
- [ ] Implement `emailRenderer.ts` — blocks to email HTML
- [ ] Write `emailRenderer.test.ts` and run it
- **Verify:** All 6 tests pass. Open a rendered output in a browser — it should look like a real email

### Task 4: Block Components
- [ ] Implement `BlockWrapper.tsx`
- [ ] Implement `SpacerBlock.tsx` (simplest, start here)
- [ ] Implement `DividerBlock.tsx`
- [ ] Implement `HeadingBlock.tsx`
- [ ] Implement `ParagraphBlock.tsx`
- [ ] Implement `ButtonBlock.tsx`
- [ ] Implement `ImageBlock.tsx`
- **Verify:** Render each block individually in a test page with sample data

### Task 5: Editor Assembly
- [ ] Install dnd-kit packages
- [ ] Implement `BlockPalette.tsx`
- [ ] Implement `BlockList.tsx` (dnd-kit sortable)
- [ ] Implement `BlockConfigPanel.tsx` and sub-configs
- [ ] Implement `EmailEditor.tsx` (assembles BlockList + BlockPalette)
- **Verify:** Can add blocks, reorder them via drag, select, open config, change settings, delete, duplicate

### Task 6: Preview
- [ ] Implement `WidthToggle.tsx`
- [ ] Implement `EmailPreview.tsx`
- **Verify:** Add blocks in editor → see them render in preview iframe in real-time. Toggle desktop/mobile width. No console errors in iframe.

### Task 7: Campaign Builder Page
- [ ] Implement `CampaignStatusBadge.tsx`
- [ ] Implement `CampaignBuilder.tsx` — assembles editor + preview + AI placeholder
- [ ] Wire up campaign save/load: editing blocks → "Save Draft" → persists to localStorage → navigate away → come back → blocks restored
- **Verify:** Full round-trip: create campaign → add blocks → save → leave → return → blocks are there

### Task 8: Campaign List
- [ ] Implement `CampaignCard.tsx`
- [ ] Implement `CampaignList.tsx` with status filters
- **Verify:** Shows saved campaigns, filters work, clicking navigates to builder, delete works

### Task 9: File Manager
- [ ] Implement `FileCard.tsx`
- [ ] Implement `FileGrid.tsx`
- [ ] Implement `FileUploadZone.tsx`
- [ ] Implement `FileManager.tsx`
- **Verify:** Upload an image via drag-drop → appears in grid → shows correct size/type → delete works → "Use in email" navigates to builder

### Task 10: AI Panel
- [ ] Implement `aiMock.ts`
- [ ] Implement `AIMessage.tsx`
- [ ] Implement `AIPanel.tsx`
- [ ] Integrate into `CampaignBuilder.tsx`
- **Verify:** Type a prompt → see loading state → see mock response → "Generate Subjects" returns clickable subject chips → "Write Body" returns insertable content

### Task 11: Routing & Navigation
- [ ] Add campaign routes to router config
- [ ] Update navigation to include Campaigns and Files links
- [ ] Rename old campaign routes if they exist
- **Verify:** All navigation links work, direct URL access works, browser back/forward works

### Task 12: Responsive
- [ ] Test CampaignBuilder at 1440px, 1024px, 768px, 375px
- [ ] Adjust layout breakpoints: collapse AI panel at 1024px, stack editor/preview at 768px
- [ ] Test FileManager at all breakpoints
- [ ] Test CampaignList at all breakpoints
- **Verify:** No horizontal overflow, no overlapping elements, all interactive elements reachable on mobile

### Task 13: Polish
- [ ] Add loading skeletons for campaign list and file grid
- [ ] Add empty states for all list views
- [ ] Add transition animations for block add/remove/reorder (keep subtle, 150-200ms)
- [ ] Add keyboard shortcuts: Ctrl+Z undo, Ctrl+Shift+Z redo, Ctrl+S save draft
- [ ] Ensure all text is real — no "Lorem ipsum", no "Test text", no placeholder filler
- **Verify:** Walk through the full flow: new campaign → add 5+ blocks → configure them → preview → use AI → save → view in list → re-open → edit → save as template

---

## 11. What NOT to Do

- Do NOT install TipTap, Slate, ProseMirror, Draft.js, or any rich text editor library
- Do NOT install Framer Motion for this phase — use CSS transitions only
- Do NOT add real OpenAI/AI SDK dependencies
- Do NOT add chart libraries (recharts, chart.js, etc.)
- Do NOT add date picker libraries — use native `<input type="datetime-local">` for any date fields
- Do NOT implement backend API calls — everything is localStorage
- Do NOT modify files outside `src/modules/campaign/` except for routing config and navigation
- Do NOT refactor existing smeMaster modules (CRM, Projects, Invoices) — leave them untouched
- Do NOT add i18n/internationalization
- Do NOT add unit tests for components (only the emailRenderer test is required)
- Do NOT add Storybook stories
- Do NOT change the color scheme or design tokens of the existing app — use whatever design system is already in place

---

## 12. Phase 2 Preview (Reference Only — Do Not Implement)

These items are documented so the Phase 2 plan has a starting point. Do NOT begin any of this work.

- **P2.1:** A/B test framework — campaign variant splitting, result comparison
- **P2.2:** Analytics dashboard — open/CTR/bounce charts, per-campaign and aggregate
- **P2.3:** Segment builder — rule-based dynamic segments from contact data
- **P2.4:** Scheduling system — timezone handling, queue visualization, cron-like recurring sends
- **P2.5:** Image pipeline — client-side compression (browser-image-compression), thumbnail generation, WebP conversion
- **P2.6:** Real file storage — S3-compatible upload, signed URLs, CDN delivery
- **P2.7:** Real AI integration — OpenAI SDK, streaming responses, prompt engineering, rate limiting
- **P2.8:** Template gallery — 6+ pre-built templates, categorized, preview before select
- **P2.9:** File organization — folders, tags, bulk operations, storage quota dashboard
- **P2.10:** Contact management — import CSV, custom fields, engagement timeline, unsubscribe handling
- **P2.11:** Email sending — SendGrid/SES/Resend integration, webhook handling, bounce processing
- **P2.12:** AI segmentation — analyze contact engagement to suggest segments
- **P2.13:** AI send-time optimization — historical open-time analysis per segment

---

## 13. Completion Criteria

Phase 1 is complete when ALL of the following are true:

1. `pnpm build` (or `npm run build`) completes with zero errors
2. `pnpm lint` (or `npm run lint`) completes with zero new warnings in campaign module
3. The email renderer test passes
4. The full user flow works: New Campaign → Add Blocks → Configure → Preview → AI Generate → Save → List → Reopen → Edit → Save as Template
5. File Manager: Upload → Grid Display → Delete → Use in Email
6. Campaign List: Filter by status → Create → Delete
7. Responsive: No layout breakage at 375px, 768px, 1024px, 1440px
8. No `console.error` in normal usage flow
9. No `alert()`, `prompt()`, or `confirm()` calls
10. All user-visible text is real, meaningful English — no placeholder text
11. Keyboard shortcuts Ctrl+Z, Ctrl+Shift+Z, Ctrl+S function correctly
12. Old campaign module routes still accessible at `/campaigns-old/` (if they existed)

---

## 14. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Existing project structure differs from assumptions | Task 0 inventory catches this. Adapt paths/names accordingly. Do not force the planned structure if it conflicts — adapt the plan. |
| ContentEditable is unreliable for rich text | We use it only for plain text with styling applied via the block config, not for rich formatting. Keep ContentEditable usage minimal. |
| localStorage hits 5-10MB limit | Enforce per-file 2MB limit and total 5MB limit. Show warnings. This is a known P1 limitation documented in the UI. |
| dnd-kit mobile touch issues | Test on mobile viewport early (Task 12). dnd-kit supports touch sensors — ensure `KeyboardSensor` and `TouchSensor` are both configured. |
| Email HTML rendering differences across clients | P1 focuses on structural correctness (tables, inline styles). Cross-client testing is P2. The renderer output should be correct by spec even if visual differences exist. |
| Performance with many blocks | Use `React.memo` on block components. The preview renderer uses `useMemo`. For P1, campaigns with 50+ blocks are unlikely. Profile if needed. |
```