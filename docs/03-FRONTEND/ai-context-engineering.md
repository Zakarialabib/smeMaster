# Context Engineering — AI Context Construction Guide

> **Purpose:** Document how context is constructed for AI calls across email writing, CRM intelligence, inbox search, and the RAG assistant. Covers data sourcing, formatting, truncation strategies, and quality heuristics.
> **Principle:** Good context = good output. The quality of AI responses is directly proportional to the relevance, structure, and completeness of provided context.

---

## Table of Contents

1. [Context Engineering Principles](#1-context-engineering-principles)
2. [Email Writing Contexts](#2-email-writing-contexts)
3. [Inbox Intelligence Contexts](#3-inbox-intelligence-contexts)
4. [CRM Intelligence Contexts](#4-crm-intelligence-contexts)
5. [RAG Assistant Contexts](#5-rag-assistant-contexts)
6. [Context Truncation & Token Budget](#6-context-truncation--token-budget)
7. [Context Quality Heuristics](#7-context-quality-heuristics)
8. [Future Context Sources](#8-future-context-sources)

---

## 1. Context Engineering Principles

### The Context Pipeline

```
Raw Data → Selection → Formatting → Truncation → Injection
                ↓
         Relevance filter
                ↓
         Token budget check
```

### Principles

| #   | Principle                  | Description                                                                                        |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | **Signal over noise**      | Include only data that directly aids the AI response. Omit boilerplate, signatures, replies chains |
| 2   | **Structured formatting**  | Use consistent delimiters (`From:`, `Date:`, `Subject:`, `---`) so the model can parse easily      |
| 3   | **Tag isolation**          | Wrap user content in `<email_content>` or similar tags to prevent prompt injection                 |
| 4   | **Most-recent-first**      | For threads, recent messages are most relevant. Reverse-chronological order                        |
| 5   | **Token budget awareness** | Every context builder must know its max token budget and truncate intelligently                    |
| 6   | **Fallback always**        | Every context function must handle empty/missing data gracefully                                   |

---

## 2. Email Writing Contexts

### 2.1 Reply Generation (`writingStyleService.ts`)

**Context construction for auto-draft replies:**

```typescript
function formatThreadForDraft(messages: DbMessage[]): string {
  return messages
    .map((msg) => {
      const from = msg.from_name
        ? `${msg.from_name} <${msg.from_address}>`
        : (msg.from_address ?? 'Unknown');
      const date = new Date(msg.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const body = (msg.body_text ?? msg.snippet ?? '').trim();
      return `From: ${from}\nDate: ${date}\n\n${body}`;
    })
    .join('\n---\n');
}
```

**Final context assembled:**

```typescript
const userContent =
  `<email_content>Subject: ${subject}\n\n${threadContent}</email_content>` +
  `${styleSection}`.slice(0, 6000);
```

**Context sources:**
| Source | Selection | Format |
|--------|-----------|--------|
| Thread messages | All messages in thread | `From: name <email>\nDate: ...\n\nbody` separated by `\n---\n` |
| Subject | First message's subject | `Subject: ...` prepended |
| Writing style | Cached profile (if enabled + available) | Appended after `</email_content>` |

**Token budget:** 6000 chars (~1500 tokens)
**Truncation strategy:** Hard slice at 6000 chars — may cut mid-message

### 2.2 Smart Reply (`prompts.ts` → AiAssistPanel)

**Context:** Same thread format but typically limited to last 3-5 messages.

**Recommendation:** Add explicit `--- THREAD CONTINUES ---` marker when truncation occurs.

### 2.3 Writing Style Analysis (`writingStyleService.ts`)

**Context sources:**
| Source | Selection | Format |
|--------|-----------|--------|
| Sent messages | Last 15 sent messages from account | `--- Sample ---\nbody` delimited by `\n\n` |

**Token budget:** 8000 chars (~2000 tokens)
**Minimum threshold:** 3 samples minimum — returns `null` if fewer

---

## 3. Inbox Intelligence Contexts

### 3.1 Ask Inbox (`askInbox.ts`)

**Context pipeline:**

```
User question
    ↓
extractSearchTerms() — removes stop words, keeps meaningful keywords
    ↓
searchMessages(terms, accountId, 15) — FTS search returns top 15 results
    ↓
Format results with metadata:
    [Message ID: ...]
    From: ...
    Date: ...
    Subject: ...
    Preview: ...
    ↓
Pass to AI with ASK_INBOX_PROMPT
```

**Context sources:**
| Source | Selection | Format |
|--------|-----------|--------|
| FTS search results | Top 15 by relevance | `[Message ID: {id}]\nFrom: ...\nDate: ...\nSubject: ...\nPreview: ...` |
| Question | User's raw question | Passed as user content alongside context |

**Token budget:** ~8000 chars (truncated by FTS relevance limiting)

**Quality considerations:**

- FTS search quality depends on search term extraction (simple stop-word removal)
- No semantic search — relies entirely on keyword matching
- `snippet` field may be short (FTS snippet length limited)

**Recommendations:**

- Integrate RAG vector search as a parallel context source
- Add date-range filtering for time-sensitive questions
- Use embedding-based query expansion for better recall

### 3.2 Thread Summarization

**Context construction:**

```typescript
messages.map((msg) => `From: ${from}\nDate: ${date}\n\n${body}`).join('\n---\n');
```

**Selection:** All messages in thread, chronologically ordered.
**Token budget:** 8000 chars (via `body_text + snippet` slice).

### 3.3 Auto-Categorization (`categorizationManager.ts`)

**Context:**
| Source | Selection | Format |
|--------|-----------|--------|
| Threads | Up to 20 recently categorized | `id: {id}\nSubject: {subject}\nSnippet: {snippet}\nFrom: {fromAddress}` |

**Volume:** Multiple threads per call (batch processing).
**Note:** Categories come from AI _refinement_ of rule-based results, not replacement.

---

## 4. CRM Intelligence Contexts

### Current State

CRM intelligence is **rule-based** — no AI context construction exists yet. Scoring is based on:

- Email exchange frequency
- Recency of last contact
- Open/click rates (for campaigns)
- Tag and segment membership

### Proposed AI Context Architecture

```typescript
function buildCRMContext(contact: Contact, interactions: DbMessage[]): string {
  const recentInteractions = interactions.sort((a, b) => b.date - a.date).slice(0, 20); // Last 20 interactions

  const context = `
Contact: ${contact.name}
Company: ${contact.company ?? 'N/A'}
Role: ${contact.role ?? 'N/A'}
Tags: ${(contact.tags ?? []).join(', ')}
Total Interactions: ${interactions.length}
Last Contact: ${new Date(interactions[0]?.date ?? 0).toLocaleDateString()}

Recent Interactions:
${recentInteractions
  .map(
    (i) =>
      `[${new Date(i.date).toLocaleDateString()}]
     Direction: ${i.from_address === userEmail ? 'outbound' : 'inbound'}
     Subject: ${i.subject ?? '(no subject)'}
     ${(i.body_text ?? '').slice(0, 300)}`,
  )
  .join('\n---\n')}
    `.trim();

  return context;
}
```

### CRM-Specific Context Signals

| Signal             | Source                   | AI Use              |
| ------------------ | ------------------------ | ------------------- |
| Email frequency    | Interaction count / time | Engagement heat     |
| Response time      | Timestamp diff pattern   | Urgency indicator   |
| Sentiment trend    | Body text analysis       | Relationship health |
| Topic clustering   | Subject + body keywords  | Interest areas      |
| Mutual connections | Shared contacts/threads  | Network strength    |
| Deal history       | Linked deals + stages    | Sales phase insight |

---

## 5. RAG Assistant Contexts

### 5.1 Vector Search Context (`rag.rs`)

**Current implementation:**

```rust
pub fn generate_augmented_prompt(chunks: &[SearchResult], query: &str) -> String {
    let context = chunks
        .iter()
        .enumerate()
        .map(|(i, chunk)| format!("[Source {}]\n{}", i + 1, chunk.text))
        .collect::<Vec<_>>()
        .join("\n\n");

    format!(
        "Context from your knowledge base:\n{}\n\n---\n\nUser query: {}\n\n\
         Based on the context above, please answer the query.",
        context, query
    )
}
```

**Current limitations:**

- Chunks are ordered by vector index, not by relevance score
- No metadata (source type: email vs attachment vs vault)
- No date information
- No confidence/score attached to chunks

### 5.2 Recommended RAG Context Format

```rust
// Enhanced context format:
pub fn generate_augmented_prompt(chunks: &[RichSearchResult], query: &str) -> String {
    let context = chunks
        .iter()
        .enumerate()
        .map(|(i, chunk)| {
            let source_type = match chunk.source {
                Source::Email => "📧 Email",
                Source::Attachment => "📎 Attachment",
                Source::Vault => "🔒 Vault Document",
            };
            format!(
                "[Source {} | {} | Relevance: {:.2}%]\n\
                 Date: {}\n\
                 {}",
                i + 1,
                source_type,
                chunk.score * 100.0,
                chunk.date,
                chunk.text
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n---\n\n");

    format!(
        "<context>\n{}\n</context>\n\n\
         User question: {}\n\n\
         Answer the question based ONLY on the context above. \
         If the context doesn't contain the answer, say so.",
        context, query
    )
}
```

### 5.3 Context Selection Strategy

```
Vector search returns 20 candidates
    ↓
Re-rank by: relevance * 0.7 + recency * 0.2 + source_authority * 0.1
    ↓
Select top K (default: 10) within token budget
    ↓
If total context exceeds 4000 tokens:
    Remove lowest-scored chunks until within budget
    ↓
Return context + query
```

---

## 6. Context Truncation & Token Budget

### Current Truncation Strategies

| Feature                | Budget               | Strategy                | Risk               |
| ---------------------- | -------------------- | ----------------------- | ------------------ |
| Auto-draft reply       | 6000 chars           | Hard slice              | Cuts mid-message   |
| Writing style analysis | 8000 chars / 15 msgs | Sample count limit      | Low sample count   |
| Ask Inbox              | FTS top 15           | Relevance limit         | May miss relevant  |
| Thread summary         | 8000 chars           | Body text slice         | Cuts mid-thread    |
| RAG context            | Top-10 chunks        | Vector similarity limit | May miss edge case |

### Recommended Truncation Framework

```typescript
interface ContextBudget {
  maxTokens: number;
  priorityFields: string[]; // Fields to keep even if truncated
  truncationStrategy: 'head' | 'tail' | 'middle-out' | 'relevance';
}

const CONTEXT_BUDGETS: Record<string, ContextBudget> = {
  autoDraft: {
    maxTokens: 1500,
    priorityFields: ['latest_message', 'style_profile'],
    truncationStrategy: 'middle-out', // Keep first + last, summarize middle
  },
  askInbox: {
    maxTokens: 2000,
    priorityFields: ['top_5_results'],
    truncationStrategy: 'relevance', // Drop lowest relevance results
  },
  ragQuery: {
    maxTokens: 4000,
    priorityFields: ['top_3_chunks'],
    truncationStrategy: 'relevance', // Re-rank + keep top
  },
  crmInsight: {
    maxTokens: 2000,
    priorityFields: ['recent_10_interactions', 'contact_profile'],
    truncationStrategy: 'relevance', // Keep most recent + important
  },
};
```

### Middle-Out Truncation

For thread contexts where both start (context) and end (latest) matter:

```typescript
function truncateMiddleOut(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const halfBudget = Math.floor(maxChars / 2);
  const firstHalf = text.slice(0, halfBudget);
  const lastHalf = text.slice(text.length - halfBudget);

  return `${firstHalf}\n\n[... ${text.length - maxChars} characters truncated ...]\n\n${lastHalf}`;
}
```

---

## 7. Context Quality Heuristics

### Quality Score Formula

For each context sent to an AI provider, compute a quality score:

```
context_quality = signal_ratio * 0.4 + recency_score * 0.3 + completeness * 0.3

Where:
  signal_ratio  = meaningful_content / total_chars  (exclude boilerplate)
  recency_score = 1.0 - (days_since_last_update / 365)
  completeness  = min(tokens_provided / tokens_budget, 1.0)
```

### When to Skip AI Call

Skip the AI call entirely if:

| Condition        | Threshold                 | Feature                    |
| ---------------- | ------------------------- | -------------------------- |
| Too few samples  | < 3 messages              | Style analysis, auto-draft |
| Empty context    | 0 chars                   | All features               |
| Low signal ratio | < 0.3                     | Summarization, ask inbox   |
| Context too old  | > 90 days since last data | CRM insights               |

### Context Quality Logging

```typescript
// Monitor context quality in production:
interface ContextMetrics {
  feature: string;
  contextChars: number;
  signalRatio: number;
  messageCount: number;
  truncationApplied: boolean;
  qualityScore: number;
  aiProvider: string;
  responseSuccess: boolean;
}
```

---

## 8. Future Context Sources

### Multi-Source RAG Fusion

Combine multiple context sources for richer answers:

```
Query: "What did we agree with Acme Corp?"
    ↓
Vector DB search (semantic)      FTS search (keyword)
    ↓                                     ↓
Email chunks                    Recent email threads
    ↓                                     ↓
Attachment chunks               CRM deal notes
    ↓                                     ↓
    └────────── Fusion ──────────┘
                    ↓
          Re-ranked combined list
                    ↓
          Top-K within token budget
                    ↓
              Augmented prompt
```

### Context Sources Roadmap

| Source           | Current       | Target         | Integration        |
| ---------------- | ------------- | -------------- | ------------------ |
| Emails           | ✅ Full index | ✅ Incremental | Vector DB          |
| Attachments      | ✅ Full index | ✅ OCR support | Vector DB          |
| Vault documents  | ✅ Full index | ✅             | Vector DB          |
| CRM deals        | ❌            | Q4 2026        | Vector DB + SQLite |
| CRM notes        | ❌            | Q4 2026        | Vector DB          |
| Calendar events  | ❌            | Q1 2027        | SQLite + text      |
| Tasks            | ❌            | Q1 2027        | SQLite + text      |
| Contacts (vCard) | ❌            | Q1 2027        | SQLite + text      |

---

## Update Rules

Update this page when:

- A new feature constructs context for AI calls
- Context truncation strategy changes
- Token budget limits are adjusted
- A new context source is added (CRM, calendar, etc.)
- Context quality metrics are implemented
