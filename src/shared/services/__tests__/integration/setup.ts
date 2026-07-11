import { DatabaseSync } from "node:sqlite";

export const dbRef: { current: MockTauriDb | null } = { current: null };

export class MockTauriDb {
  private db: DatabaseSync;
  private _isOpen = true;

  constructor() {
    this.db = new DatabaseSync(":memory:");
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number; lastInsertId?: number }> {
    this.ensureOpen();
    const { sql: converted, params: expanded } = this.convertParams(sql, params);
    if (expanded.length === 0) {
      this.db.exec(converted);
      return { rowsAffected: 0 };
    }
    const stmt = this.db.prepare(converted);
    const result = stmt.run(...(expanded as any[]));
    return { rowsAffected: Number(result.changes), lastInsertId: Number(result.lastInsertRowid) || undefined };
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.ensureOpen();
    const { sql: converted, params: expanded } = this.convertParams(sql, params);
    if (expanded.length === 0) {
      const stmt = this.db.prepare(converted);
      return stmt.all() as unknown as T[];
    }
    const stmt = this.db.prepare(converted);
    return stmt.all(...(expanded as any[])) as unknown as T[];
  }

  close(): void {
    if (this._isOpen) {
      this.db.close();
      this._isOpen = false;
    }
  }

  private ensureOpen(): void {
    if (!this._isOpen) throw new Error("Database is closed");
  }

  private convertParams(sql: string, params: unknown[]): { sql: string; params: unknown[] } {
    const paramMap = new Map<number, number[]>();
    let pos = 0;
    const newSql = sql.replace(/\$(\d+)/g, (_match: string, num: string) => {
      const idx = parseInt(num, 10);
      if (idx === 0) return "?";
      const positions = paramMap.get(idx) ?? [];
      positions.push(pos++);
      paramMap.set(idx, positions);
      return "?";
    });
    if (paramMap.size === 0) {
      return { sql, params };
    }
    const expandedParams: unknown[] = [];
    for (const [idx, positions] of paramMap) {
      let value: unknown;
      if (idx - 1 < params.length) {
        value = params[idx - 1];
      }
      if (value === undefined) value = null;
      else if (typeof value === "boolean") value = value ? 1 : 0;
      for (const p of positions) {
        expandedParams[p] = value;
      }
    }
    return { sql: newSql, params: expandedParams };
  }
}

export function freshTestDb(): MockTauriDb {
  if (dbRef.current) {
    dbRef.current.close();
  }
  const db = new MockTauriDb();
  dbRef.current = db;
  return db;
}

/**
 * Helper to create a vi.fn() based invoke mock that routes Tauri db_* commands
 * to SQL operations on the test database.
 *
 * Usage:
 *   const mockInvoke = createInvokeMock(db);
 *   mockInvoke.mockImplementation(async (cmd, args) => { ... });
 *
 * The returned object also has .handle(cmd, args) for direct testing.
 */
// Note: createInvokeMock is not needed — each test file creates its own vi.fn() for mockInvoke
// and uses createDbInvokeHandlers(db) for the implementation.

// ── Run migrations directly on the test DB ────────────────────────────────

export async function runMigrations(): Promise<void> {
  const db = dbRef.current!;

  // Create core tables (idempotent)
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at INTEGER,
      history_id TEXT,
      last_sync_at INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      provider TEXT NOT NULL DEFAULT 'gmail_api',
      imap_host TEXT,
      imap_port INTEGER,
      imap_security TEXT,
      smtp_host TEXT,
      smtp_port INTEGER,
      smtp_security TEXT,
      auth_method TEXT NOT NULL DEFAULT 'oauth',
      imap_password TEXT,
      imap_username TEXT,
      oauth_provider TEXT,
      oauth_client_id TEXT,
      oauth_client_secret TEXT,
      smtp_username TEXT,
      smtp_password TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS labels (
      account_id TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'user',
      color_bg TEXT,
      color_fg TEXT,
      visible INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      imap_folder_path TEXT,
      imap_special_use TEXT,
      PRIMARY KEY (account_id, id)
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS threads (
      account_id TEXT NOT NULL,
      id TEXT NOT NULL,
      subject TEXT,
      snippet TEXT,
      last_message_at INTEGER,
      message_count INTEGER NOT NULL DEFAULT 0,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_starred INTEGER NOT NULL DEFAULT 0,
      is_important INTEGER NOT NULL DEFAULT 0,
      has_attachments INTEGER NOT NULL DEFAULT 0,
      is_snoozed INTEGER NOT NULL DEFAULT 0,
      snooze_until INTEGER,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (account_id, id)
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS messages (
      account_id TEXT NOT NULL,
      id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      from_address TEXT,
      from_name TEXT,
      to_addresses TEXT,
      cc_addresses TEXT,
      bcc_addresses TEXT,
      reply_to TEXT,
      subject TEXT,
      snippet TEXT,
      date INTEGER NOT NULL DEFAULT 0,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_starred INTEGER NOT NULL DEFAULT 0,
      body_html TEXT,
      body_text TEXT,
      body_cached INTEGER NOT NULL DEFAULT 0,
      raw_size INTEGER,
      internal_date INTEGER,
      list_unsubscribe TEXT,
      list_unsubscribe_post TEXT,
      auth_results TEXT,
      message_id_header TEXT,
      references_header TEXT,
      in_reply_to_header TEXT,
      imap_uid INTEGER,
      imap_folder TEXT,
      PRIMARY KEY (account_id, id)
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      frequency INTEGER NOT NULL DEFAULT 0,
      last_contacted_at INTEGER,
      first_contacted_at INTEGER,
      notes TEXT,
      engagement_score REAL NOT NULL DEFAULT 0.0,
      last_engaged_at INTEGER,
      health_status TEXT NOT NULL DEFAULT 'new',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS contact_groups (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      name TEXT NOT NULL,
      subject TEXT,
      body_html TEXT NOT NULL DEFAULT '',
      shortcut TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      category_id TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      usage_count INTEGER NOT NULL DEFAULT 0,
      last_used_at INTEGER,
      conditional_blocks_json TEXT,
      template_type TEXT NOT NULL DEFAULT 'email',
      origin TEXT NOT NULL DEFAULT 'user_created',
      delivery_config_json TEXT,
      ai_config_json TEXT,
      voice_config_json TEXT,
      compliance_profile_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS filter_rules (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      criteria_json TEXT NOT NULL DEFAULT '{}',
      actions_json TEXT NOT NULL DEFAULT '{}',
      group_operator TEXT NOT NULL DEFAULT 'AND',
      score_threshold INTEGER,
      chaining_action TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS attachments (
      id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      filename TEXT,
      mime_type TEXT,
      size INTEGER,
      gmail_attachment_id TEXT,
      content_id TEXT,
      is_inline INTEGER NOT NULL DEFAULT 0,
      local_path TEXT,
      cached_at INTEGER,
      cache_size INTEGER,
      imap_part_id TEXT,
      PRIMARY KEY (id, message_id)
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS folder_sync_state (
      account_id TEXT NOT NULL,
      folder_path TEXT NOT NULL,
      uidvalidity INTEGER,
      last_uid INTEGER NOT NULL DEFAULT 0,
      modseq INTEGER,
      last_sync_at INTEGER,
      PRIMARY KEY (account_id, folder_path)
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS filter_logs (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL REFERENCES filter_rules(id) ON DELETE CASCADE,
      message_id TEXT NOT NULL,
      matched INTEGER NOT NULL DEFAULT 0,
      score REAL NOT NULL DEFAULT 0,
      applied_actions TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`);
  } catch { /* may already exist */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS thread_categories (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    category TEXT NOT NULL,
    is_manual INTEGER NOT NULL DEFAULT 0,
    is_user_override INTEGER NOT NULL DEFAULT 0,
    assigned_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(account_id, thread_id)
  )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      template_id TEXT,
      segment_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      sent_count INTEGER NOT NULL DEFAULT 0,
      sent_at INTEGER,
      ab_test_config TEXT,
      analytics_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS campaign_recipients (
      campaign_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      opened_at INTEGER,
      clicked_at INTEGER,
      variant TEXT,
      is_winner INTEGER,
      PRIMARY KEY (campaign_id, contact_id)
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      calendar_id TEXT,
      google_event_id TEXT,
      remote_event_id TEXT,
      summary TEXT,
      description TEXT,
      location TEXT,
      start_time INTEGER NOT NULL DEFAULT 0,
      end_time INTEGER NOT NULL DEFAULT 0,
      is_all_day INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'confirmed',
      organizer_email TEXT,
      attendees_json TEXT,
      html_link TEXT,
      etag TEXT,
      ical_data TEXT,
      uid TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS pending_operations (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      resource_id TEXT,
      params TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      next_retry_at INTEGER,
      error_message TEXT,
      campaign_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`);
  } catch { /* already exists */ }

  // Add pending_operations.hold_until column if missing
  try {
    await db.execute("ALTER TABLE pending_operations ADD COLUMN hold_until INTEGER");
  } catch { /* Column may already exist */ }

  try {
    await db.execute("PRAGMA foreign_keys=OFF");
  } catch { /* Non-fatal */ }

  // Add accounts columns that source code expects but may not be in base schema
  for (const col of ["accept_invalid_certs", "caldav_url", "caldav_username", "caldav_password", "caldav_principal_url", "caldav_home_url", "calendar_provider"]) {
    try { await db.execute(`ALTER TABLE accounts ADD COLUMN ${col} TEXT`); } catch { /* may already exist */ }
  }
  try { await db.execute("ALTER TABLE accounts ADD COLUMN accept_invalid_certs INTEGER NOT NULL DEFAULT 0"); } catch { /* may already exist */ }

  try { await db.execute(`CREATE TABLE IF NOT EXISTS contact_tags (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(account_id, name)
  )`); } catch { /* may already exist */ }

  try { await db.execute(`CREATE TABLE IF NOT EXISTS contact_tag_pivot (
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES contact_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
  )`); } catch { /* may already exist */ }

  try { await db.execute(`CREATE TABLE IF NOT EXISTS contact_group_pivot (
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, group_id)
  )`); } catch { /* may already exist */ }

  try { await db.execute(`CREATE TABLE IF NOT EXISTS thread_labels (
    account_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    label_id TEXT NOT NULL,
    PRIMARY KEY (account_id, thread_id, label_id),
    FOREIGN KEY (account_id, thread_id) REFERENCES threads(account_id, id) ON DELETE CASCADE
  )`); } catch { /* may already exist */ }

  try { await db.execute(`CREATE TABLE IF NOT EXISTS filter_conditions (
    id TEXT PRIMARY KEY,
    filter_id TEXT NOT NULL REFERENCES filter_rules(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    operator TEXT NOT NULL,
    value TEXT NOT NULL
  )`); } catch { /* may already exist */ }

  try { await db.execute(`CREATE TABLE IF NOT EXISTS thread_categories (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    category TEXT NOT NULL,
    is_manual INTEGER NOT NULL DEFAULT 0,
    is_user_override INTEGER NOT NULL DEFAULT 0,
    assigned_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(account_id, thread_id)
  )`); } catch { /* may already exist */ }

  try { await db.execute(`CREATE TABLE IF NOT EXISTS entity_pivots (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    pivot_type TEXT NOT NULL,
    pivot_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`); } catch { /* may already exist */ }

  // AI cache table (referenced by db_get_ai_cache / db_set_ai_cache / db_upsert_ai_cache)
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS ai_cache (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(account_id, thread_id, type)
    )`);
  } catch { /* may already exist */ }
}

const TEST_ACCOUNT_ID = "test-account-1";

export function getTestAccountId(): string {
  return TEST_ACCOUNT_ID;
}

export async function seedAccount(overrides: Record<string, unknown> = {}): Promise<void> {
  const db = dbRef.current!;
  const id = (overrides.id as string) ?? TEST_ACCOUNT_ID;
  const email = (overrides.email as string) ?? "test@example.com";
  const provider = (overrides.provider as string) ?? "gmail_api";
  const imapHost = (overrides.imap_host as string) ?? null;
  const imapPort = (overrides.imap_port as number) ?? null;
  const imapSecurity = (overrides.imap_security as string) ?? null;
  const smtpHost = (overrides.smtp_host as string) ?? null;
  const smtpPort = (overrides.smtp_port as number) ?? null;
  const smtpSecurity = (overrides.smtp_security as string) ?? null;
  const authMethod = (overrides.auth_method as string) ?? "oauth";
  const accessToken = (overrides.access_token as string) ?? null;
  const refreshToken = (overrides.refresh_token as string) ?? null;

  await db.execute(
    `INSERT INTO accounts (id, email, provider, imap_host, imap_port, imap_security, smtp_host, smtp_port, smtp_security, auth_method, access_token, refresh_token, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, unixepoch(), unixepoch())`,
    [id, email, provider, imapHost, imapPort, imapSecurity, smtpHost, smtpPort, smtpSecurity, authMethod, accessToken, refreshToken],
  );
}

export async function getTestAccount(): Promise<Record<string, unknown> | null> {
  const db = dbRef.current!;
  const rows = await db.select<Record<string, unknown>>("SELECT * FROM accounts WHERE id = $1", [TEST_ACCOUNT_ID]);
  return rows[0] ?? null;
}

export async function getTestMessages(accountId?: string): Promise<Record<string, unknown>[]> {
  const db = dbRef.current!;
  return db.select<Record<string, unknown>>(
    "SELECT * FROM messages WHERE account_id = $1 ORDER BY date ASC",
    [accountId ?? TEST_ACCOUNT_ID],
  );
}

export async function getTestThreads(accountId?: string): Promise<Record<string, unknown>[]> {
  const db = dbRef.current!;
  return db.select<Record<string, unknown>>(
    "SELECT * FROM threads WHERE account_id = $1 ORDER BY last_message_at DESC",
    [accountId ?? TEST_ACCOUNT_ID],
  );
}

// ── Invoke mock factory ──────────────────────────────────────────────────

/**
 * Creates a set of common invoke command handlers that route Tauri db_*
 * commands to SQL operations on the test database.
 *
 * Returns an object with `.handler(cmd, args)` that can be used as:
 *   mockInvoke.mockImplementation((cmd, args) => dbInvokeHandlers.handler(cmd, args))
 *
 * Each command maps to SQL on the provided MockTauriDb.
 */
export function createDbInvokeHandlers(db: MockTauriDb) {
  // Helper: generate a UUID v4
  function uuid(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Helper: convert args to snake_case column name mapping for INSERT/UPDATE
  function argsToSnake(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snake = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      result[snake] = value ?? null;
    }
    return result;
  }

  // Helper: build INSERT with dynamic columns
  async function dbInsert(table: string, data: Record<string, unknown>): Promise<void> {
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    await db.execute(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`,
      vals,
    );
  }

  // Helper: build UPDATE SET clause
  async function dbUpdate(
    table: string,
    idCol: string,
    id: string,
    fields: { set: Record<string, unknown>; unset: string[] },
  ): Promise<void> {
    const setEntries = Object.entries(fields.set);
    const unsetCols = fields.unset;
    if (setEntries.length > 0) {
      const setClauses = setEntries.map(([key]) => `${key} = ?`);
      const setVals = setEntries.map(([_, v]) => v ?? null);
      await db.execute(
        `UPDATE ${table} SET ${setClauses.join(", ")} WHERE ${idCol} = ?`,
        [...setVals, id],
      );
    }
    for (const col of unsetCols) {
      try {
        await db.execute(`UPDATE ${table} SET ${col} = NULL WHERE ${idCol} = ?`, [id]);
      } catch { /* ignore */ }
    }
  }

  // Helper: SELECT first row or null
  async function dbGetOne<T>(table: string, idCol: string, id: string): Promise<T | null> {
    const rows = await db.select<T>(`SELECT * FROM ${table} WHERE ${idCol} = $1`, [id]);
    return rows[0] ?? null;
  }

  async function handler(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
    switch (cmd) {
      // ═══════════════════════════════════════════════════════════════════
      // ACCOUNTS
      // ═══════════════════════════════════════════════════════════════════
      case "db_create_account": {
        const acct = (args?.account ?? args) as Record<string, unknown> | undefined;
        if (!acct) return null;
        const id = (acct.id as string) ?? uuid();
        const data = argsToSnake(acct);
        data.id = id;
        if (!data.is_active) data.is_active = 1;
        if (!data.auth_method) data.auth_method = "oauth";
        data.metadata_json = "{}";
        const now = Math.floor(Date.now() / 1000);
        data.created_at = now;
        data.updated_at = now;
        await dbInsert("accounts", data);
        return dbGetOne("accounts", "id", id);
      }

      case "db_get_account": {
        return dbGetOne("accounts", "id", args?.accountId as string);
      }

      case "db_get_account_by_email": {
        const rows = await db.select<any>("SELECT * FROM accounts WHERE email = $1", [args?.email]);
        return rows[0] ?? null;
      }

      case "db_list_accounts": {
        return db.select<any[]>("SELECT * FROM accounts");
      }

      case "db_update_account": {
        await dbUpdate("accounts", "id", args?.id as string, args?.fields as any);
        return undefined;
      }

      case "db_update_account_last_sync": {
        await db.execute("UPDATE accounts SET history_id = $1, last_sync_at = unixepoch() WHERE id = $2", [args?.historyId, args?.id]);
        return undefined;
      }

      // ═══════════════════════════════════════════════════════════════════
      // LABELS
      // ═══════════════════════════════════════════════════════════════════
      case "db_upsert_label": {
        const label = (args?.label ?? args) as Record<string, unknown>;
        if (!label) return undefined;
        const data = argsToSnake(label);
        if (data.type === undefined) data.type = "user";
        if (data.visible === undefined) data.visible = 1;
        if (data.sort_order === undefined) data.sort_order = 0;
        await db.execute(
          `INSERT OR REPLACE INTO labels (account_id, id, name, type, color_bg, color_fg, visible, sort_order, imap_folder_path, imap_special_use)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [data.account_id, data.id, data.name, data.type, data.color_bg ?? null, data.color_fg ?? null,
           data.visible, data.sort_order, data.imap_folder_path ?? null, data.imap_special_use ?? null],
        );
        return undefined;
      }

      case "db_get_labels_for_account": {
        return db.select<any[]>("SELECT * FROM labels WHERE account_id = $1", [args?.accountId]);
      }

      // ═══════════════════════════════════════════════════════════════════
      // MESSAGES
      // ═══════════════════════════════════════════════════════════════════
      case "db_upsert_message": {
        const msg = (args?.msg ?? args) as Record<string, unknown>;
        if (!msg) return undefined;
        const data = argsToSnake(msg);
        // Ensure required fields
        if (!data.id) data.id = uuid();
        if (!data.date) data.date = Math.floor(Date.now() / 1000);
        if (data.body_cached === undefined) data.body_cached = 0;
        // Use INSERT OR REPLACE
        await dbInsert("messages", data);
        return undefined;
      }

      case "db_get_messages_for_thread": {
        return db.select<any[]>(
          "SELECT * FROM messages WHERE account_id = $1 AND thread_id = $2 ORDER BY date ASC",
          [args?.accountId, args?.threadId],
        );
      }

      case "db_bulk_update_message_thread": {
        const { accountId, messageIds, threadId } = args ?? {};
        if (Array.isArray(messageIds)) {
          for (const msgId of messageIds) {
            await db.execute(
              "UPDATE messages SET thread_id = $1 WHERE account_id = $2 AND id = $3",
              [threadId, accountId, msgId],
            );
          }
        }
        return undefined;
      }

      // ═══════════════════════════════════════════════════════════════════
      // THREADS
      // ═══════════════════════════════════════════════════════════════════
      case "db_upsert_thread": {
        const thread = (args?.thread ?? args) as Record<string, unknown>;
        if (!thread) return undefined;
        const data = argsToSnake(thread);
        if (!data.id) data.id = uuid();
        if (data.metadata_json === undefined) data.metadata_json = "{}";
        if (data.is_snoozed === undefined) data.is_snoozed = 0;
        if (data.message_count === undefined) data.message_count = 0;
        await dbInsert("threads", data);
        return undefined;
      }

      case "db_get_thread": {
        return dbGetOne("threads", "id", args?.threadId as string);
      }

      case "db_get_all_threads": {
        return db.select<any[]>("SELECT * FROM threads WHERE account_id = $1", [args?.accountId]);
      }

      case "db_set_thread_labels": {
        const { accountId, threadId, labelIds } = args ?? {};
        // Remove existing
        await db.execute("DELETE FROM thread_labels WHERE account_id = $1 AND thread_id = $2", [accountId, threadId]);
        // Insert new
        if (Array.isArray(labelIds)) {
          for (const lid of labelIds) {
            await db.execute(
              "INSERT OR IGNORE INTO thread_labels (account_id, thread_id, label_id) VALUES ($1, $2, $3)",
              [accountId, threadId, lid],
            );
          }
        }
        return undefined;
      }

      case "db_get_thread_label_ids": {
        const rows = await db.select<{ label_id: string }>(
          "SELECT label_id FROM thread_labels WHERE account_id = $1 AND thread_id = $2",
          [args?.accountId, args?.threadId],
        );
        return rows.map((r) => r.label_id);
      }

      case "db_add_thread_label": {
        await db.execute(
          "INSERT OR IGNORE INTO thread_labels (account_id, thread_id, label_id) VALUES ($1, $2, $3)",
          [args?.accountId, args?.threadId, args?.labelId],
        );
        return undefined;
      }

      case "db_remove_thread_label": {
        await db.execute(
          "DELETE FROM thread_labels WHERE account_id = $1 AND thread_id = $2 AND label_id = $3",
          [args?.accountId, args?.threadId, args?.labelId],
        );
        return undefined;
      }

      // ═══════════════════════════════════════════════════════════════════
      // CONTACTS
      // ═══════════════════════════════════════════════════════════════════
      case "db_upsert_contact": {
        const contact = (args?.contact ?? args) as Record<string, unknown>;
        if (!contact) return null;
        const email = (contact.email as string) ?? "";
        const existing = await db.select<any>("SELECT * FROM contacts WHERE email = $1", [email]);
        const data = argsToSnake(contact);
        if (!data.id) data.id = uuid();
        if (data.frequency === undefined) data.frequency = 1;
        if (data.engagement_score === undefined) data.engagement_score = 0;
        if (data.health_status === undefined) data.health_status = "new";
        if (existing.length > 0) {
          // Update existing contact (dedupe by email); keep its id.
          const setClauses: string[] = [];
          const vals: unknown[] = [];
          for (const [k, v] of Object.entries(data)) {
            if (k === "id") continue;
            setClauses.push(`${k} = ?`);
            vals.push(v);
          }
          vals.push(email);
          await db.execute(`UPDATE contacts SET ${setClauses.join(", ")} WHERE email = ?`, vals);
          return dbGetOne("contacts", "email", email);
        }
        await dbInsert("contacts", data);
        return dbGetOne("contacts", "id", data.id as string);
      }

      case "db_get_contact": {
        return dbGetOne("contacts", "id", args?.contactId as string);
      }

      case "db_get_contact_by_email": {
        const rows = await db.select<any>("SELECT * FROM contacts WHERE email = $1", [args?.email]);
        return rows[0] ?? null;
      }

      case "db_list_contacts": {
        return db.select<any[]>("SELECT * FROM contacts ORDER BY email");
      }

      case "db_get_contact_stats": {
        const rows = await db.select<any>(
          "SELECT COUNT(*) as total_emails FROM messages WHERE from_address = $1 OR to_addresses LIKE $2",
          [args?.email, `%${args?.email}%`],
        );
        return {
          total_emails: Number(rows[0]?.total_emails ?? 0),
          total_meetings: 0,
          total_calls: 0,
          last_interaction: null,
          engagement_trend: "stable",
        };
      }

      // ═══════════════════════════════════════════════════════════════════
      // CONTACT GROUPS
      // ═══════════════════════════════════════════════════════════════════
      case "db_create_contact_group":
      case "db_upsert_contact_group": {
        const group = (args?.group ?? args) as Record<string, unknown>;
        const groupId = (args?.id as string) ?? uuid();
        const data = {
          id: groupId,
          account_id: (args?.accountId ?? args?.companyId ?? group?.accountId ?? group?.account_id) as string,
          name: (args?.name ?? group?.name) as string,
          description: (args?.description ?? group?.description) as string | null,
        };
        await dbInsert("contact_groups", data);
        return groupId;
      }

      case "db_get_contact_count_for_group": {
        const rows = await db.select<{ count: number }>(
          "SELECT COUNT(*) as count FROM contact_group_pivot WHERE group_id = $1",
          [args?.groupId],
        );
        return Number(rows[0]?.count ?? 0);
      }

      case "db_get_contact_group_members": {
        return db.select<any[]>(
          "SELECT contact_id FROM contact_group_pivot WHERE group_id = $1",
          [args?.groupId],
        );
      }

      case "db_add_contact_to_group": {
        await db.execute(
          "INSERT OR IGNORE INTO contact_group_pivot (contact_id, group_id) VALUES ($1, $2)",
          [args?.contactId, args?.groupId],
        );
        return undefined;
      }

      case "db_list_contact_groups": {
        return db.select<any[]>("SELECT * FROM contact_groups WHERE account_id = $1", [args?.accountId]);
      }

      // ═══════════════════════════════════════════════════════════════════
      // CONTACT TAGS
      // ═══════════════════════════════════════════════════════════════════
      case "db_upsert_contact_tag": {
        const tagId = (args?.id as string) ?? uuid();
        await db.execute(
          `INSERT OR REPLACE INTO contact_tags (id, account_id, name, color, sort_order, created_at)
           VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(sort_order) + 1 FROM contact_tags WHERE account_id = $2), 0), unixepoch())`,
          [tagId, args?.accountId ?? args?.companyId, args?.name, args?.color ?? null],
        );
        return tagId;
      }

      case "db_get_contact_tag_by_id": {
        return dbGetOne("contact_tags", "id", args?.id as string);
      }

      case "db_get_contact_count_for_tag": {
        const rows = await db.select<{ count: number }>(
          "SELECT COUNT(*) as count FROM contact_tag_pivot WHERE tag_id = $1",
          [args?.tagId],
        );
        return Number(rows[0]?.count ?? 0);
      }

      // ═══════════════════════════════════════════════════════════════════
      // ENTITY PIVOTS (Tags)
      // ═══════════════════════════════════════════════════════════════════
      case "db_add_tag":
      case "db_add_entity_link": {
        const pivotId = uuid();
        await db.execute(
          `INSERT OR IGNORE INTO entity_pivots (id, entity_type, entity_id, pivot_type, pivot_id, created_at)
           VALUES ($1, $2, $3, $4, $5, unixepoch())`,
          [pivotId, args?.entityType, args?.entityId, args?.pivotType, args?.pivotId],
        );
        return undefined;
      }

      case "db_remove_entity_link": {
        await db.execute(
          `DELETE FROM entity_pivots WHERE entity_type = $1 AND entity_id = $2 AND pivot_type = $3 AND pivot_id = $4`,
          [args?.entityType, args?.entityId, args?.pivotType, args?.pivotId],
        );
        return undefined;
      }

      case "db_get_linked_entities": {
        return db.select<any[]>(
          `SELECT * FROM entity_pivots WHERE entity_type = $1 AND entity_id = $2`,
          [args?.entityType, args?.entityId],
        );
      }

      // ═══════════════════════════════════════════════════════════════════
      // FILTERS
      // ═══════════════════════════════════════════════════════════════════
      case "db_create_filter_rule": {
        const r = (args?.rule ?? args) as Record<string, unknown>;
        const filterId = (r?.id as string) ?? uuid();
        const isEnabled = r?.is_enabled ?? r?.isEnabled;
        const data = {
          id: filterId,
          account_id: (r?.account_id ?? r?.accountId) as string,
          name: r?.name as string,
          is_enabled: isEnabled === undefined ? 1 : (isEnabled as number),
          criteria_json: (r?.criteria_json ?? r?.criteriaJson ?? "{}") as string,
          actions_json: (r?.actions_json ?? r?.actionsJson ?? "{}") as string,
          group_operator: (r?.group_operator ?? "AND") as string,
          score_threshold: (r?.score_threshold ?? r?.scoreThreshold ?? null) as number | null,
          chaining_action: (r?.chaining_action ?? r?.chainingAction ?? "stop") as string,
        };
        await dbInsert("filter_rules", data);
        return { ...data };
      }

      case "db_get_filter_rule": {
        return dbGetOne("filter_rules", "id", args?.id as string);
      }

      case "db_list_filter_rules": {
        return db.select<any[]>("SELECT * FROM filter_rules WHERE account_id = $1", [args?.accountId]);
      }

      case "db_get_enabled_filter_rules": {
        return db.select<any[]>(
          "SELECT * FROM filter_rules WHERE account_id = $1 AND is_enabled = 1",
          [args?.accountId],
        );
      }

      case "db_update_filter": {
        const { id, fields } = args ?? {};
        if (id && fields) {
          await dbUpdate("filter_rules", "id", id as string, fields as any);
        }
        return undefined;
      }

      // ═══════════════════════════════════════════════════════════════════
      // TEMPLATES
      // ═══════════════════════════════════════════════════════════════════
      case "db_upsert_template": {
        const t = args as Record<string, unknown> ?? {};
        const tmplId = (t.id as string) ?? uuid();
        await db.execute(
          `INSERT OR REPLACE INTO templates (id, account_id, name, subject, body_html, shortcut, category_id, template_type, origin, conditional_blocks_json, delivery_config_json, ai_config_json, voice_config_json, compliance_profile_id, is_favorite, usage_count, sort_order, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, unixepoch())`,
          [
            tmplId,
            t.accountId ?? null,
            t.name ?? "",
            t.subject ?? null,
            t.bodyHtml ?? "",
            t.shortcut ?? null,
            t.categoryId ?? null,
            t.templateType ?? "email",
            t.origin ?? "user_created",
            t.conditionalBlocksJson ?? null,
            t.deliveryConfigJson ?? null,
            t.aiConfigJson ?? null,
            t.voiceConfigJson ?? null,
            t.complianceProfileId ?? null,
            t.isFavorite ?? false ? 1 : 0,
            0,
            0,
          ],
        );
        return undefined;
      }

      case "db_get_template": {
        return dbGetOne("templates", "id", args?.id as string);
      }

      case "db_list_templates": {
        const accountId = args?.accountId;
        if (accountId) {
          return db.select<any[]>("SELECT * FROM templates WHERE account_id = $1", [accountId]);
        }
        return db.select<any[]>("SELECT * FROM templates");
      }

      // ═══════════════════════════════════════════════════════════════════
      // AI CACHE
      // ═══════════════════════════════════════════════════════════════════
      case "db_get_ai_cache": {
        const rows = await db.select<any>(
          "SELECT * FROM ai_cache WHERE account_id = $1 AND thread_id = $2 AND type = $3",
          [args?.accountId, args?.threadId, args?.cacheType],
        );
        return rows[0] ?? null;
      }

      case "db_upsert_ai_cache": {
        const entry = args?.entry as Record<string, unknown> ?? {};
        const entryId = uuid();
        await db.execute(
          `INSERT OR REPLACE INTO ai_cache (id, account_id, thread_id, type, content, created_at)
           VALUES ($1, $2, $3, $4, $5, unixepoch())`,
          [entryId, entry.accountId, entry.threadId, entry.type, entry.content],
        );
        return undefined;
      }

      case "db_set_ai_cache": {
        const entryId = uuid();
        await db.execute(
          `INSERT OR REPLACE INTO ai_cache (id, account_id, thread_id, type, content, created_at)
           VALUES ($1, $2, $3, $4, $5, unixepoch())`,
          [entryId, args?.accountId, args?.threadId, args?.cacheType, args?.content],
        );
        return undefined;
      }

      // ═══════════════════════════════════════════════════════════════════
      // PENDING OPERATIONS
      // ═══════════════════════════════════════════════════════════════════
      case "db_upsert_pending_operation": {
        const opData = (args?.op ?? args) as Record<string, unknown> ?? {};
        const opId = (opData.id as string) ?? uuid();
        await db.execute(
          `INSERT OR REPLACE INTO pending_operations (id, account_id, operation_type, resource_id, params, status, campaign_id, retry_count, max_retries, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, unixepoch())`,
          [
            opId,
            opData.accountId ?? opData.companyId,
            opData.operationType ?? opData.operation_type,
            opData.resourceId ?? opData.resource_id ?? null,
            typeof opData.params === "string" ? opData.params : JSON.stringify(opData.params ?? {}),
            opData.status ?? "pending",
            opData.campaignId ?? opData.campaign_id ?? null,
            opData.retryCount ?? opData.retry_count ?? 0,
            opData.maxRetries ?? opData.max_retries ?? 3,
          ],
        );
        return opId;
      }

      case "db_delete_pending_operation": {
        await db.execute("DELETE FROM pending_operations WHERE id = $1", [args?.id]);
        return undefined;
      }

      case "db_list_pending_operations": {
        return db.select<any[]>("SELECT * FROM pending_operations WHERE account_id = $1", [args?.accountId]);
      }

      case "db_delete_pending_ops_by_ids": {
        const ids = (args?.ids as string[]) ?? [];
        for (const id of ids) {
          await db.execute("DELETE FROM pending_operations WHERE id = $1", [id]);
        }
        return undefined;
      }

      // ═══════════════════════════════════════════════════════════════════
      // CALENDAR EVENTS
      // ═══════════════════════════════════════════════════════════════════
      case "db_create_calendar_event":
      case "db_update_calendar_event":
      case "db_upsert_calendar_event": {
        const evt = (args?.event ?? args) as Record<string, unknown> ?? {};
        const evtId = (evt.id as string) ?? uuid();
        const data = argsToSnake(evt);
        // Map the legacy/alias company_id onto account_id (schema column).
        if (!data.account_id && data.company_id) data.account_id = data.company_id;
        delete data.company_id;
        if (!data.id) data.id = evtId;
        if (!data.start_time && evt.startTime) data.start_time = evt.startTime;
        if (!data.end_time && evt.endTime) data.end_time = evt.endTime;
        await dbInsert("calendar_events", data);
        return undefined;
      }

      // ═══════════════════════════════════════════════════════════════════
      // CAMPAIGNS
      // ═══════════════════════════════════════════════════════════════════
      case "db_create_campaign": {
        const camp = (args?.campaign ?? args) as Record<string, unknown> ?? {};
        const campId = (camp.id ?? args?.id) as string ?? uuid();
        const data = argsToSnake(camp);
        if (!data.id) data.id = campId;
        if (data.sent_count === undefined) data.sent_count = 0;
        if (data.status === undefined) data.status = "draft";
        await dbInsert("campaigns", data);
        return campId;
      }

      case "db_create_campaign_with_recipients": {
        const input = (args?.input ?? args) as Record<string, unknown>;
        const campaignId = (input.campaign_id as string) ?? uuid();
        const campaignData: Record<string, unknown> = {
          id: campaignId,
          account_id: input.company_id,
          name: input.name,
          template_id: input.template_id ?? null,
          segment_id: input.segment_id ?? null,
          status: "draft",
          sent_count: 0,
          ab_test_config: input.ab_test_config ?? null,
        };
        await dbInsert("campaigns", campaignData);
        const contactIds = (input.contact_ids as string[]) ?? [];
        for (const cid of contactIds) {
          await dbInsert("campaign_recipients", {
            campaign_id: campaignId,
            contact_id: cid,
            status: "pending",
          });
        }
        return { campaign: { id: campaignId }, recipientCount: contactIds.length };
      }

      case "db_send_campaign": {
        const campaignId = args?.campaignId as string;
        await db.execute(
          "UPDATE campaigns SET status = 'sent', sent_count = 1 WHERE id = $1",
          [campaignId],
        );
        const campaign = await db.select<{ account_id: string }[]>(
          "SELECT account_id FROM campaigns WHERE id = $1",
          [campaignId],
        );
        const accountId = campaign[0]?.account_id ?? null;
        const recipients = await db.select<{ contact_id: string }[]>(
          "SELECT contact_id FROM campaign_recipients WHERE campaign_id = $1",
          [campaignId],
        );
        for (const r of recipients) {
          await db.execute(
            `INSERT OR REPLACE INTO pending_operations (id, account_id, operation_type, resource_id, params, status, campaign_id, retry_count, max_retries, created_at)
             VALUES ($1, $2, 'send_campaign_email', $3, $4, 'pending', $5, 0, 5, unixepoch())`,
            [uuid(), accountId, r.contact_id, null, campaignId],
          );
        }
        return recipients.length;
      }

      case "db_update_campaign": {
        const upCamp = (args?.campaign ?? args) as Record<string, unknown> ?? {};
        const upCampId = (upCamp.id ?? args?.id) as string ?? uuid();
        const upData = argsToSnake(upCamp);
        if (!upData.id) upData.id = upCampId;
        if (upData.sent_count === undefined) upData.sent_count = 0;
        if (upData.status === undefined) upData.status = "draft";
        await dbInsert("campaigns", upData);
        return undefined;
      }

      case "db_insert_campaign_recipient":
      case "db_create_campaign_recipient": {
        await db.execute(
          "INSERT OR IGNORE INTO campaign_recipients (campaign_id, contact_id, status) VALUES ($1, $2, 'pending')",
          [args?.campaignId, args?.contactId],
        );
        return undefined;
      }

      case "db_list_campaigns": {
        return db.select<any[]>("SELECT * FROM campaigns WHERE account_id = $1", [args?.accountId]);
      }

      // ═══════════════════════════════════════════════════════════════════
      // SETTINGS
      // ═══════════════════════════════════════════════════════════════════
      case "db_get_setting": {
        const rows = await db.select<{ value: string }>("SELECT value FROM settings WHERE key = $1", [args?.key]);
        return rows[0]?.value ?? null;
      }

      case "db_set_setting": {
        await db.execute(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
          [args?.key, args?.value],
        );
        return undefined;
      }

      // ═══════════════════════════════════════════════════════════════════
      // THREAD CATEGORIES
      // ═══════════════════════════════════════════════════════════════════
      case "db_upsert_thread_category": {
        const cat = (args?.cat ?? args) as Record<string, unknown> ?? {};
        const catId = uuid();
        await db.execute(
          `INSERT OR REPLACE INTO thread_categories (id, account_id, thread_id, category, is_manual, is_user_override, assigned_at)
           VALUES ($1, $2, $3, $4, $5, $6, unixepoch())`,
          [catId, cat.accountId, cat.threadId, cat.category, cat.isManual ?? 0, cat.isUserOverride ?? 0],
        );
        return undefined;
      }

      case "db_list_thread_categories": {
        return db.select<any[]>("SELECT * FROM thread_categories WHERE account_id = $1", [args?.accountId]);
      }

      // ═══════════════════════════════════════════════════════════════════
      // EXECUTE SEARCH QUERY (used by some migration helpers)
      // ═══════════════════════════════════════════════════════════════════
      case "db_execute_search_query": {
        try {
          const rows = await db.select<any>(args?.sql as string, (args?.params as unknown[]) ?? []);
          return rows;
        } catch {
          return [];
        }
      }

      case "db_execute_insert": {
        try {
          await db.execute(args?.sql as string, (args?.params as unknown[]) ?? []);
          return { rowsAffected: 1 };
        } catch {
          return { rowsAffected: 0 };
        }
      }

      default:
        return undefined;
    }
  }

  return { handler };
}
