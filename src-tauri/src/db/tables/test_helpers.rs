// ── Shared Test Helpers ─────────────────────────────────────────────────────
//
// Reusable helpers for database tests.  Every ":memory:" pool created here
// runs migrations first so the full schema is available.

#[cfg(test)]
pub(crate) mod helpers {
    use sqlx::SqlitePool;

    /// Create an in-memory SQLite pool with migrations applied.
    pub(crate) async fn create_memory_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        crate::db::migrations::run_migrations(&pool).await.unwrap();
        pool
    }

    /// Insert a minimal account row so FK constraints on `account_id` pass.
    /// Returns the account id.
    pub(crate) async fn insert_test_account(pool: &SqlitePool, id: &str) -> String {
        let email = format!("{}@test.local", id);
        sqlx::query("INSERT OR IGNORE INTO accounts (id, email) VALUES (?, ?)")
            .bind(id)
            .bind(&email)
            .execute(pool)
            .await
            .unwrap();
        id.to_string()
    }

    /// Insert a minimal contact row so FK constraints on `contact_id` pass.
    /// Returns the contact id.
    pub(crate) async fn insert_test_contact(pool: &SqlitePool, id: &str) -> String {
        let email = format!("{}@test.local", id);
        sqlx::query("INSERT INTO contacts (id, email) VALUES (?, ?)")
            .bind(id)
            .bind(&email)
            .execute(pool)
            .await
            .unwrap();
        id.to_string()
    }

    /// Insert a minimal campaign row so FK constraints on `campaign_id` pass.
    /// Requires an existing account with `account_id`.
    /// Returns the campaign id.
    pub(crate) async fn insert_test_campaign(pool: &SqlitePool, id: &str, account_id: &str) -> String {
        sqlx::query("INSERT INTO campaigns (id, account_id, name, status) VALUES (?, ?, ?, ?)")
            .bind(id)
            .bind(account_id)
            .bind("test-campaign")
            .bind("draft")
            .execute(pool)
            .await
            .unwrap();
        id.to_string()
    }

    /// Insert a minimal local_draft row so FK constraints on `email_draft_id` pass.
    /// Returns the draft id.
    pub(crate) async fn insert_test_draft(pool: &SqlitePool, id: &str, account_id: &str) -> String {
        sqlx::query(
            "INSERT INTO local_drafts (id, account_id, subject) VALUES (?, ?, ?)",
        )
        .bind(id)
        .bind(account_id)
        .bind("test-draft")
        .execute(pool)
        .await
        .unwrap();
        id.to_string()
    }

    /// Insert a minimal company row so FK constraints on `company_id` pass.
    /// Returns the company id.
    pub(crate) async fn insert_test_company(pool: &SqlitePool, id: &str) -> String {
        sqlx::query("INSERT INTO companies (id, name) VALUES (?, ?)")
            .bind(id)
            .bind("Test Company")
            .execute(pool)
            .await
            .unwrap();
        id.to_string()
    }

    /// Insert a minimal workflow rule row so FK constraints on `rule_id` pass.
    /// Requires an existing account with `account_id` (used as company_id).
    /// Returns the rule id.
    pub(crate) async fn insert_test_workflow_rule(
        pool: &SqlitePool,
        id: &str,
        account_id: &str,
    ) -> String {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT OR IGNORE INTO workflow_rules (id, company_id, name, trigger_event, actions, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
        )
        .bind(id)
        .bind(account_id)
        .bind("test-rule")
        .bind("inbound")
        .bind(r#"[{"action":"log"}]"#)
        .bind(now)
        .execute(pool)
        .await
        .unwrap();
        id.to_string()
    }

    /// Insert a minimal client row so FK constraints on `client_id` pass.
    /// Generates an ID from `name` and links it to `company_id`.
    /// Returns the generated client id.
    pub(crate) async fn insert_test_client(
        pool: &SqlitePool,
        name: &str,
        company_id: &str,
    ) -> String {
        let id = format!("test-client-{name}");
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT OR IGNORE INTO clients (id, company_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(company_id)
        .bind(name)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .unwrap();
        id
    }
}
