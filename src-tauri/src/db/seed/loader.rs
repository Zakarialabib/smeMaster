// ── Seed Loader ─────────────────────────────────────────────────────────────
//
// Core logic for reading embedded JSON seed files, resolving timestamp offsets,
// and inserting them into the database within a single transaction.
//
// Each seed file is embedded at compile time via `include_str!`. The JSON is
// deserialized into a `SeedFile` struct, processed for timestamp resolution,
// and inserted via dynamic `INSERT OR IGNORE`.
//
// Design decisions:
//   - Single transaction → atomic seed, no partial state
//   - INSERT OR IGNORE → idempotent, safe to re-run
//   - Timestamp offsets → seed files don't contain absolute dates
//   - snake_case keys → JSON matches DB column names directly
// ─────────────────────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqliteArguments;
use sqlx::{query::Query, Sqlite, SqlitePool};

/// A single seed file (one table worth of data).
#[derive(Debug, Deserialize, Serialize)]
pub struct SeedFile {
    /// Target table name (e.g., "companies", "accounts").
    pub table: String,
    /// Fields that contain relative timestamp offsets to resolve.
    #[serde(default)]
    pub timestamp_fields: Vec<String>,
    /// The seed records to insert.
    pub records: Vec<serde_json::Value>,
}

/// Resolve relative timestamp offsets to absolute unix timestamps.
///
/// For each record, if `field` is in `timestamp_fields` and the value is a
/// number, it is treated as a relative offset from `now`:
///   •  0 = now
///   • -86400 = 1 day ago
///   •  86400 = 1 day from now
fn resolve_timestamps(
    records: &mut Vec<serde_json::Value>,
    timestamp_fields: &[String],
) {
    if timestamp_fields.is_empty() {
        return;
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    for record in records.iter_mut() {
        if let Some(obj) = record.as_object_mut() {
            for field in timestamp_fields {
                if let Some(val) = obj.get(field) {
                    if let Some(offset) = val.as_i64() {
                        let resolved = now.saturating_add(offset);
                        obj.insert(
                            field.clone(),
                            serde_json::Value::Number(resolved.into()),
                        );
                    }
                }
            }
        }
    }
}

/// Bind a serde_json::Value to a sqlx query.
fn bind_json_value<'q>(
    q: Query<'q, Sqlite, SqliteArguments>,
    val: &'q serde_json::Value,
) -> Query<'q, Sqlite, SqliteArguments> {
    match val {
        serde_json::Value::Null => q.bind(None::<String>),
        serde_json::Value::Bool(b) => q.bind(if *b { 1_i64 } else { 0_i64 }),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                q.bind(i)
            } else if let Some(f) = n.as_f64() {
                q.bind(f)
            } else {
                q.bind(n.to_string())
            }
        }
        serde_json::Value::String(s) => q.bind(s.clone()),
        serde_json::Value::Array(a) => q.bind(serde_json::to_string(a).unwrap_or_default()),
        serde_json::Value::Object(o) => q.bind(serde_json::to_string(o).unwrap_or_default()),
    }
}

/// Insert a single batch of records into the given table within a transaction.
async fn insert_seed_batch(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    seed_file: &SeedFile,
    seeded: &mut u64,
) -> Result<(), String> {
    if seed_file.records.is_empty() {
        return Ok(());
    }

    let table = &seed_file.table;

    for row in &seed_file.records {
        let obj = match row.as_object() {
            Some(o) => o,
            None => {
                log::warn!("[seed] Skipping non-object row in table '{table}'");
                continue;
            }
        };

        let keys: Vec<&String> = obj.keys().collect();
        if keys.is_empty() {
            continue;
        }

        // Build column list and parameter placeholders
        let columns: Vec<String> = keys.iter().map(|k| format!("\"{}\"", k)).collect();
        let placeholders: Vec<String> = (0..keys.len()).map(|_| "?".to_string()).collect();

        let sql = format!(
            "INSERT OR IGNORE INTO \"{}\" ({}) VALUES ({})",
            table,
            columns.join(", "),
            placeholders.join(", "),
        );

        let values: Vec<serde_json::Value> =
            keys.iter().map(|k| obj[k.as_str()].clone()).collect();

        let mut query = sqlx::query(sqlx::AssertSqlSafe(sql.as_str()));
        for val in &values {
            query = bind_json_value(query, val);
        }

        query
            .execute(&mut **tx)
            .await
            .map_err(|e| format!("[seed] Failed to insert into '{table}': {e}"))?;

        *seeded += 1;
    }

    Ok(())
}

/// Seed all demo data files in order.
///
/// The files MUST be ordered to respect foreign-key dependencies:
///   companies first → accounts → everything else.
///
/// Idempotent — if data has already been seeded (flag in `settings` table),
/// returns `Ok(0)` immediately without touching the database.
///
/// Returns the total number of rows seeded.
pub async fn seed_all(pool: &SqlitePool) -> Result<u64, String> {
    // ── Idempotency: skip if already seeded ────────────────────────────
    let already_seeded: bool = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM settings WHERE key = 'demo_full_seeded' AND value = '1'"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("[seed] Idempotency check failed: {e}"))?
        == 1;

    if already_seeded {
        log::info!("[seed] Demo data already seeded — skipping");
        return Ok(0);
    }

    // ── Build the ordered list of seed files (embedded at compile time) ──
    let mut seed_files: Vec<SeedFile> = Vec::new();

    // ═══════════════════════════════════════════════════════════════════════
    // CORE — FK targets for everything else
    // ═══════════════════════════════════════════════════════════════════════
    push_file(&mut seed_files, include_str!("../../../seeds/company.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/account.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/settings.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/app_config.json"));

    // Labels (references account)
    push_file(&mut seed_files, include_str!("../../../seeds/labels.json"));

    // Threads + Messages (references account)
    push_file(&mut seed_files, include_str!("../../../seeds/threads.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/messages.json"));

    // Thread junction tables (references threads + labels)
    push_file(&mut seed_files, include_str!("../../../seeds/thread_categories.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/thread_labels.json"));

    // Attachments (references messages)
    push_file(&mut seed_files, include_str!("../../../seeds/attachments.json"));

    // Composer presets (references account)
    push_file(&mut seed_files, include_str!("../../../seeds/composer_presets.json"));

    // Template categories (shared)
    push_file(&mut seed_files, include_str!("../../../seeds/template_categories.json"));

    // Signatures + Quick Replies (references account)
    push_file(&mut seed_files, include_str!("../../../seeds/signatures.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/quick_replies.json"));

    // ═══════════════════════════════════════════════════════════════════════
    // CRM (references company)
    // ═══════════════════════════════════════════════════════════════════════
    push_file(&mut seed_files, include_str!("../../../seeds/contacts.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/contact_segments.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/contact_tags.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/contact_tag_pivot.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/contact_files.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/engagement_log.json"));

    // ═══════════════════════════════════════════════════════════════════════
    // Campaigns + Tasks (references company, contacts)
    // ═══════════════════════════════════════════════════════════════════════
    push_file(&mut seed_files, include_str!("../../../seeds/campaigns.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/campaign_recipients.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/tasks.json"));

    // ═══════════════════════════════════════════════════════════════════════
    // Calendar (references company)
    // ═══════════════════════════════════════════════════════════════════════
    push_file(&mut seed_files, include_str!("../../../seeds/calendars.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/calendar_events.json"));

    // ═══════════════════════════════════════════════════════════════════════
    // Workflows (references company)
    // ═══════════════════════════════════════════════════════════════════════
    push_file(&mut seed_files, include_str!("../../../seeds/workflow_rules.json"));

    // ═══════════════════════════════════════════════════════════════════════
    // Compliance (no FK dependencies)
    // ═══════════════════════════════════════════════════════════════════════
    push_file(&mut seed_files, include_str!("../../../seeds/compliance_profiles.json"));

    // ═══════════════════════════════════════════════════════════════════════
    // Deliverability (references account)
    // ═══════════════════════════════════════════════════════════════════════
    push_file(&mut seed_files, include_str!("../../../seeds/deliverability_events.json"));
    push_file(&mut seed_files, include_str!("../../../seeds/blacklist_monitors.json"));

    // ── Resolve timestamp offsets ───────────────────────────────────────
    for sf in &mut seed_files {
        resolve_timestamps(&mut sf.records, &sf.timestamp_fields);
    }

    // ── Begin transaction ───────────────────────────────────────────────
    let mut tx = pool.begin().await.map_err(|e| format!("[seed] Begin transaction failed: {e}"))?;
    let mut seeded = 0u64;

    for sf in &seed_files {
        insert_seed_batch(&mut tx, sf, &mut seeded).await?;
    }

    // Set the seed completion flag in settings
    sqlx::query(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('demo_full_seeded', '1')",
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("[seed] Failed to set completion flag: {e}"))?;

    tx.commit().await.map_err(|e| format!("[seed] Commit failed: {e}"))?;

    log::info!("[seed] Demo data seeded: {seeded} rows across {} tables", seed_files.len());

    Ok(seeded)
}

/// Deserialize a JSON seed file string and push it into the vector.
fn push_file(files: &mut Vec<SeedFile>, json_str: &str) {
    match serde_json::from_str::<SeedFile>(json_str) {
        Ok(sf) => {
            if !sf.records.is_empty() {
                files.push(sf);
            }
        }
        Err(e) => {
            log::warn!("[seed] Failed to parse seed file (skipped): {e}");
        }
    }
}
