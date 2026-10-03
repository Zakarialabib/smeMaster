# Document & Email Extraction — OCR, Attachments, and Structured Invoice Capture

> **Status:** 📐 **Proposal / spike brief** (2026-10-01) — no code written yet.
> **Related:** [AI RAG (feature)](../04-FEATURES/ai-rag.md) · [AI RAG dimensions](../02-BACKEND/16-ai-rag-dimensions.md) · [Invoicing](../04-FEATURES/36-invoicing.md) · [Attachment vault](../04-FEATURES/25-attachment-vault.md)
> **Model sourcing:** [HF Spaces survey](#appendix-hf-spaces-survey) (appendix)
> **Companion doc:** [Offline STT & audio summarization](./20-offline-stt-and-audio-summarization.md)

## 1. Problem statement

SMEMaster's RAG pipeline can already index **text** from mail and attachments, and
`DocParser` handles digital PDF/DOCX/XLSX. But the pipeline silently produces
**nothing** for the two cases that matter most to this product:

1. **A photographed or scanned invoice.** These are image-only PDFs. `lopdf`'s
   `extract_text` returns an empty string, and `index_all_attachments` skips empty
   text (`if text.trim().is_empty() { continue; }`). The document vanishes from the
   knowledge base with no error and no user-visible signal.
2. **A structured invoice that needs field-level capture.** Even when text extracts,
   nothing turns a supplier invoice into `{invoice_number, date, total, line_items}`
   for the DGI-compliant invoicing module. The user retypes it.

The first is a correctness bug in the indexing path; the second is a missing feature.

## 2. Verified current state (read from source, 2026-10-01)

| Component        | Path                                          | Reality                                                                                                                                        |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust parser      | `src-tauri/src/ai/parser.rs`                  | Handles `pdf`/`docx`/`xlsx`/`txt`. **`parse_docx` returns the literal string `"DOCX content extraction placeholder"`** — a stub, not a parser. |
| Sidecar parser   | `src-tauri/crates/ml-sidecar/src/main.rs:417` | Real `parse_docx` via `docx_rs` + `extract_docx_text` recursion. Header claims "no stubs".                                                     |
| Indexer          | `src-tauri/src/ai/indexer.rs:111`             | `index_all_attachments` reads `attachments WHERE local_path IS NOT NULL`, calls `DocParser::parse_file`, **skips on empty text** (line 120).   |
| Sidecar commands | `ml-sidecar/src/main.rs`                      | 20 JSON-RPC methods: `embed`, `embed_batch`, `query_rag`, `index_vectors`, `parse_document`, `load_generation_model`, `memory_usage`, …        |
| Embeddings       | candle `bert`                                 | `BAAI/bge-small-en-v1.5`, 384-dim (Space A)                                                                                                    |
| Vectors          | LanceDB                                       | `knowledge_base_{dim}` per-dimension tables                                                                                                    |
| **OCR**          | —                                             | **Absent.** No tesseract, no PaddleOCR, no `ort`/ONNX runtime, no VLM.                                                                         |

**Key finding:** `candle-transformers 0.8.3` is already a dependency and ships
`whisper`, `trocr` (OCR), `colpali` (visual document retrieval), `qwen2`, `siglip`,
`llava`, `moondream`. Several paths below need **no new ML dependency**.
**Counter-finding:** the modern structured-extraction VLMs (Qwen2-VL/Qwen3-VL
family, NuExtract3) are **not** in candle.

## 3. Three distinct problems, three different answers

These are often conflated. They are not the same problem and do not share a solution.

| #      | Problem                             | Input              | Right tool                     | Why                                             |
| ------ | ----------------------------------- | ------------------ | ------------------------------ | ----------------------------------------------- |
| **P1** | Scanned/photographed invoice → text | image or image-PDF | **OCR** (trocr / provider VLM) | Cheap, deterministic, feeds existing RAG        |
| **P2** | Invoice → typed fields              | image or text      | **VLM / LLM with JSON schema** | OCR alone gives text, not `total_amount`        |
| **P3** | Scanned doc → searchable in RAG     | image PDF          | **P1 + existing indexer**      | Reuses `index_all_attachments` once text exists |

The critical design consequence: **P2 must not be built on P1.** Feeding OCR text
into an LLM to extract fields compounds two error rates (OCR character errors →
mis-parsed amounts). For money, that is unacceptable in a DGI context. P2 should read
the **image** directly.

## 4. Architecture options

### Option A — Provider VLM via the existing provider path _(recommended for P2)_

```
Attachment (image/pdf)
      │
      ▼
openAiCompatibleProvider ──► local Ollama / LM Studio / vLLM
      │                         serving a vision model
      ▼
structured JSON  ──►  invoice draft / index text
```

**Why this first:** `openAiCompatibleProvider.ts` + `ollamaProvider.ts` +
`lmstudioProvider.ts` already exist and already speak OpenAI-compatible chat. A
vision-capable model served locally needs **zero new ML plumbing** — it is a model
id, an `image_url` content part, and the `z.toJSONSchema()` schema path that already
exists for tool calling. Fits the "provider" abstraction instead of bypassing it.

**Candidate models** (all OpenAI-compatible chat, run locally):

| Model                                              | Size    | Notes                                                                       |
| -------------------------------------------------- | ------- | --------------------------------------------------------------------------- |
| `numind/NuExtract3`                                | ~4B     | Purpose-built: image + JSON template → JSON. Space: `numind/NuExtract-3-4B` |
| `ratlinghitman/qwen3vl-4b-receipt-extraction-gguf` | 4B GGUF | Receipt/invoice → JSON, GGUF runs under Ollama                              |
| Qwen3-VL (general)                                 | 2B–8B   | Broadest capability; 2B is the "small VLM for JSON" community default       |

### Option B — Candle-native OCR in the sidecar _(recommended for P1)_

Add a `transcribe`/`ocr` method to the 20-method sidecar using
`candle-transformers::models::trocr` (already vendored). Gives fully-offline OCR for
scanned text with no new dependency and no external server.

**Limitation to state plainly:** candle's `trocr` is Latin/handwriting-oriented.
**It is not a credible Arabic OCR path.** See §6.

### Option C — ColPali visual retrieval _(later, high ceiling)_

`candle-transformers::models::colpali` is vendored. Would let `query_rag` retrieve
from **scanned** documents without any OCR step, by embedding page images. Attractive
but requires a new embedding space (new vector table, new dimension) — see the
three-space invariant in [16-ai-rag-dimensions](../02-BACKEND/16-ai-rag-dimensions.md).
Not a first step.

## 5. Recommended sequence

| Phase  | Work                                                                                                                       | Effort | Unblocks                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------- |
| **0**  | Fix the silent skip: when `parse_file` returns empty on an image-PDF, record why and surface it in `KnowledgeBaseSettings` | S      | Trust — today this fails invisibly      |
| **0b** | Fix `ai/parser.rs::parse_docx` stub (port the sidecar's real impl)                                                         | S      | DOCX indexing is currently fake         |
| **1**  | Option B: sidecar `ocr` method via candle `trocr`; wire into `index_all_attachments`                                       | M      | Scanned docs become searchable (Latin)  |
| **2**  | Option A: vision provider + JSON-schema extraction → invoice draft in `src/features/invoicing/`                            | M      | DGI field capture, POS receipt scan     |
| **3**  | Option C: ColPali space for visual RAG                                                                                     | L      | Scanned-doc semantic search without OCR |

Phase 0 is not optional. Shipping OCR on top of a pipeline that silently discards
documents just makes the failure harder to see.

## 6. The Arabic problem — decision required

Morocco DGI invoicing means **Arabic (and French) documents are first-class**, not an
edge case. This is the weakest part of the current stack and needs an explicit call.

| Approach                           | Arabic support                    | Candle-reachable?            |
| ---------------------------------- | --------------------------------- | ---------------------------- |
| candle `trocr`                     | ❌ Latin/handwriting focus        | ✅ vendored                  |
| Tesseract `ara`                    | ⚠️ mediocre on cursive/diacritics | via `tesseract-rs` (new dep) |
| QARI-OCR (Qwen2-VL-2B fine-tune)   | ✅ SOTA open Arabic OCR           | ❌ not in candle             |
| `sherif1313/Arabic-Qwen3.5-OCR-v4` | ✅ Qwen3.5-0.8B base              | ❌ not in candle             |
| Provider VLM (Option A)            | ✅ depends on chosen model        | ✅ via OpenAI-compatible API |

**Implication:** if Arabic scanned invoices are in scope for v1, **Option A is the only
viable route today** — Option B's candle `trocr` will not carry it. That changes the
architecture decision from "add OCR to the sidecar" to "make the vision provider path
the primary extraction route, with candle OCR as a Latin-only offline fallback."

**Open question for the owner:** is Arabic OCR v1, v1.5, or v2?

## 7. Data model impact

Minimal if Option A/B are kept as _extraction_ steps that feed existing tables:

- **No new vector space** for P1/P2 (text goes into the existing 384-dim table).
- **Option C only** needs a new `knowledge_base_{dim}` table + a `colpali` space id.
- Invoice extraction should land in a **draft** the user confirms — never auto-commit
  into `invoices`. Money must be human-confirmed.

## 8. Risks

| Risk                                        | Severity | Mitigation                                                                |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| OCR character errors corrupt amounts        | **High** | P2 reads images, not OCR text (§3). Draft-then-confirm, never auto-commit |
| Vision model hallucinates a line item       | **High** | Schema-constrained output + confidence surfacing + human confirm          |
| Silent skip hides failures (today)          | **High** | Phase 0                                                                   |
| Arabic unsupported by chosen path           | **High** | §6 decision before Phase 2                                                |
| New ML dependency contradicts offline-first | Medium   | Prefer vendored candle (B) + local provider (A)                           |
| Model download size on constrained links    | Medium   | Existing downloader + resumable chunks                                    |

## 9. Acceptance criteria (proposed)

- [ ] An image-only PDF attachment, once indexed, returns non-empty search results
- [ ] A failed extraction produces a **visible** per-attachment status, not a silent skip
- [ ] `ai/parser.rs::parse_docx` returns real DOCX text (stub removed)
- [ ] A photographed invoice produces a **draft** with `invoice_number`, `date`,
      `total`, `line_items` for user confirmation
- [ ] No auto-commit to `invoices` without explicit user action
- [ ] French document verified end-to-end; Arabic status decided and documented

## Appendix: HF Spaces survey

Surveyed `huggingface.co/spaces` (2026-10-01) for capabilities relevant to this app.

**Relevant to this doc:**

| Space                                 | Category          | Relevance                                                     |
| ------------------------------------- | ----------------- | ------------------------------------------------------------- |
| `numind/NuExtract-3-4B`               | Document analysis | ⭐ Image + JSON template → structured JSON. Direct fit for P2 |
| `baidu/Unlimited-OCR`                 | OCR               | General OCR demo                                              |
| `prithivMLmods/GLM-OCR-Demo`          | OCR               | Complex document understanding                                |
| `nvidia/nemotron-ocr-v2`              | OCR               | Text + bounding boxes                                         |
| `PaddlePaddle/PP-OCRv6_Online_Demo`   | OCR               | ONNX CPU backend                                              |
| `nielsr/dit-document-layout-analysis` | Document analysis | Layout segmentation — useful _after_ OCR                      |

**Deliberately excluded:** image/video/music generation, voice cloning, and
"uncensored" LoRA studios dominate the trending list; none map to this app.

**Sourcing rule:** Spaces are _demos_ — they inform model selection, not runtime
dependencies. Nothing here should be called over the network from the app; the app
must run the model locally (candle or a local OpenAI-compatible server).
