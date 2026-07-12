---
description: Save current session context to Persistent Knowledge Graph
---

## Memory Capture

Save the current work session context to the Persistent Knowledge Graph for future session continuity.

### Steps

1. **Analyze current session** — what was worked on, what decisions were made:
   - Files modified/created in this session
   - Architecture decisions made
   - Bugs found and fixes applied
   - Pending work or TODOs
   - Patterns discovered or established

2. **Check existing knowledge graph** — use `searchNodes` to find existing entities for SMEMaster (e.g., `SMEMaster`, `Tauri-v2`, `Rust-backend`, `CRDT-sync`, `Email-engine`)

3. **Update knowledge graph**:
   - Create/update entities for key project components touched
   - Add observations with specific technical details (file paths, decisions, rationale)
   - Create relations between entities to capture dependencies

4. **Create session summary** in `c:\laragon\www\smeMaster\.trae\memory\topics.md`:
   ```markdown
   ## Session: <date>
   
   ### Work Done
   - ...
   
   ### Decisions
   - ...
   
   ### Pending
   - ...
   
   ### Files Changed
   - ...
   ```

This ensures future sessions can continue seamlessly.
