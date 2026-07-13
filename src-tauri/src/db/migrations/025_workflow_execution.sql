-- Workflow Execution Logs + Message Tags + Notes tables

-- Execution logs for workflow rule runs
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    rule_name TEXT,
    trigger_event TEXT NOT NULL,
    actions_executed TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    executed_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES workflow_rules(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_logs_company ON workflow_execution_logs(company_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_logs_rule ON workflow_execution_logs(rule_id, executed_at DESC);

-- Message tags for workflow tagging actions
CREATE TABLE IF NOT EXISTS message_tags (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (account_id, message_id) REFERENCES messages(account_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_message_tags_account_msg ON message_tags(account_id, message_id);
CREATE INDEX IF NOT EXISTS idx_message_tags_tag ON message_tags(account_id, tag);

-- Notes for workflow add_note actions
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    message_id TEXT,
    contact_id TEXT,
    content TEXT NOT NULL,
    created_by TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notes_company ON notes(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_message ON notes(message_id);

-- Add is_flagged column to messages if not present
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a safe approach
-- that only adds the column if it doesn't already exist
CREATE TABLE IF NOT EXISTS _messages_flagged_check (id INTEGER);
DROP TABLE IF EXISTS _messages_flagged_check;
-- The column addition is handled by a runtime check in the WorkflowExecutor service
