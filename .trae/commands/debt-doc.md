---
description: Document technical debt or deprecations found during work
argument-hint: <type: backend|frontend|general> [summary]
---

## Document Technical Debt

Type: `$1`
Details: $ARGUMENTS

### Steps

1. **Read the relevant diagnostics file**:
   - `backend` type → read `docs/02-BACKEND/12-diagnostics.md`
   - `frontend` type → read `docs/03-FRONTEND/13-deprecations.md`
   - `general` type → create entry in whichever is more relevant

2. **Append debt entry** with this format:
   ```markdown
   ### YYYY-MM-DD: [Brief Title]
   
   **File**: `path/to/file.rs` or `path/to/Component.tsx` (line N)
   **Severity**: WARNING / INFO
   **Issue**: What is wrong or deprecated
   **Plan**: How to fix it in the future
   **Found during**: Context of how this was discovered
   ```

3. **Confirm the update** by reading the file back

This is a documentation-only command. Do NOT fix the debt — just record it.
