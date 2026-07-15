//! Deal / Pipeline query layer for the CRM sales module.
//!
//! Tables: `pipelines` (per company), `deal_stages` (ordered columns of a board),
//! `deals` (opportunities). Money is i64 minor units (centimes). All functions are
//! async and return `Result<_, AppDbError>`.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db::error::AppDbError;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Pipeline {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub is_default: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DealStage {
    pub id: String,
    pub pipeline_id: String,
    pub name: String,
    pub position: i64,
    pub probability: i64,
    pub color: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Deal {
    pub id: String,
    pub company_id: String,
    pub contact_id: Option<String>,
    pub pipeline_id: String,
    pub stage_id: String,
    pub title: String,
    pub amount_minor: i64,
    pub currency: String,
    pub expected_close_at: Option<i64>,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDealRequest {
    pub company_id: String,
    pub contact_id: Option<String>,
    pub pipeline_id: String,
    pub stage_id: String,
    pub title: String,
    pub amount_minor: i64,
    pub currency: Option<String>,
    pub expected_close_at: Option<i64>,
    pub notes: Option<String>,
}

const DEFAULT_STAGES: &[(&str, i64, &str)] = &[
    ("Lead", 10, "#64748b"),
    ("Qualified", 30, "#0b57d0"),
    ("Proposal", 60, "#8b5cf6"),
    ("Negotiation", 80, "#f59e0b"),
    ("Won", 100, "#059669"),
    ("Lost", 0, "#e11d48"),
];

// ── Pipelines ────────────────────────────────────────────────────────────────

pub async fn create_pipeline(
    pool: &SqlitePool,
    company_id: &str,
    name: &str,
    is_default: bool,
) -> Result<Pipeline, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO pipelines (id, company_id, name, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(company_id)
    .bind(name)
    .bind(if is_default { 1i64 } else { 0i64 })
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(Pipeline {
        id,
        company_id: company_id.to_string(),
        name: name.to_string(),
        is_default: if is_default { 1 } else { 0 },
        created_at: now,
        updated_at: now,
    })
}

pub async fn list_pipelines(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<Vec<Pipeline>, AppDbError> {
    sqlx::query_as::<_, Pipeline>(
        "SELECT * FROM pipelines WHERE company_id = ? ORDER BY is_default DESC, created_at ASC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

pub async fn get_default_pipeline(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<Option<Pipeline>, AppDbError> {
    sqlx::query_as::<_, Pipeline>(
        "SELECT * FROM pipelines WHERE company_id = ? ORDER BY is_default DESC, created_at ASC LIMIT 1",
    )
    .bind(company_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Idempotently ensure a company has a default pipeline with standard stages.
/// Returns the default pipeline (existing or newly created).
pub async fn seed_default_pipeline(pool: &SqlitePool, company_id: &str) -> Result<Pipeline, AppDbError> {
    if let Some(existing) = get_default_pipeline(pool, company_id).await? {
        return Ok(existing);
    }
    let pipeline = create_pipeline(pool, company_id, "Sales", true).await?;
    for (i, (name, prob, color)) in DEFAULT_STAGES.iter().enumerate() {
        create_stage(pool, &pipeline.id, name, i as i64, *prob, color).await?;
    }
    Ok(pipeline)
}

// ── Stages ──────────────────────────────────────────────────────────────────

pub async fn create_stage(
    pool: &SqlitePool,
    pipeline_id: &str,
    name: &str,
    position: i64,
    probability: i64,
    color: &str,
) -> Result<DealStage, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO deal_stages (id, pipeline_id, name, position, probability, color, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(pipeline_id)
    .bind(name)
    .bind(position)
    .bind(probability)
    .bind(color)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(DealStage {
        id,
        pipeline_id: pipeline_id.to_string(),
        name: name.to_string(),
        position,
        probability,
        color: color.to_string(),
        created_at: now,
    })
}

pub async fn list_stages(pool: &SqlitePool, pipeline_id: &str) -> Result<Vec<DealStage>, AppDbError> {
    sqlx::query_as::<_, DealStage>(
        "SELECT * FROM deal_stages WHERE pipeline_id = ? ORDER BY position ASC",
    )
    .bind(pipeline_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

pub async fn get_stage(pool: &SqlitePool, stage_id: &str) -> Result<Option<DealStage>, AppDbError> {
    sqlx::query_as::<_, DealStage>("SELECT * FROM deal_stages WHERE id = ?")
        .bind(stage_id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

// ── Deals ────────────────────────────────────────────────────────────────────

pub async fn create_deal(pool: &SqlitePool, req: CreateDealRequest) -> Result<Deal, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = Uuid::new_v4().to_string();
    let currency = req.currency.unwrap_or_else(|| "MAD".to_string());
    sqlx::query(
        "INSERT INTO deals
         (id, company_id, contact_id, pipeline_id, stage_id, title, amount_minor,
          currency, expected_close_at, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)",
    )
    .bind(&id)
    .bind(&req.company_id)
    .bind(&req.contact_id)
    .bind(&req.pipeline_id)
    .bind(&req.stage_id)
    .bind(&req.title)
    .bind(req.amount_minor)
    .bind(&currency)
    .bind(req.expected_close_at)
    .bind(&req.notes)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(Deal {
        id,
        company_id: req.company_id,
        contact_id: req.contact_id,
        pipeline_id: req.pipeline_id,
        stage_id: req.stage_id,
        title: req.title,
        amount_minor: req.amount_minor,
        currency,
        expected_close_at: req.expected_close_at,
        status: "open".to_string(),
        notes: req.notes,
        created_at: now,
        updated_at: now,
    })
}

pub async fn get_deal(pool: &SqlitePool, id: &str) -> Result<Option<Deal>, AppDbError> {
    sqlx::query_as::<_, Deal>("SELECT * FROM deals WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

pub async fn list_deals(
    pool: &SqlitePool,
    company_id: &str,
    pipeline_id: Option<&str>,
    stage_id: Option<&str>,
    status: Option<&str>,
) -> Result<Vec<Deal>, AppDbError> {
    let mut sql = String::from("SELECT * FROM deals WHERE company_id = ?");
    if pipeline_id.is_some() {
        sql.push_str(" AND pipeline_id = ?");
    }
    if stage_id.is_some() {
        sql.push_str(" AND stage_id = ?");
    }
    if status.is_some() {
        sql.push_str(" AND status = ?");
    }
    sql.push_str(" ORDER BY created_at DESC");
    let mut q = sqlx::query_as::<_, Deal>(sqlx::AssertSqlSafe(&*sql)).bind(company_id);
    if let Some(p) = pipeline_id {
        q = q.bind(p);
    }
    if let Some(s) = stage_id {
        q = q.bind(s);
    }
    if let Some(st) = status {
        q = q.bind(st);
    }
    q.fetch_all(pool).await.map_err(AppDbError::Database)
}

pub async fn update_deal(
    pool: &SqlitePool,
    id: &str,
    fields: std::collections::HashMap<String, serde_json::Value>,
) -> Result<Deal, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let mut setters: Vec<String> = Vec::new();
    let mut binds: Vec<serde_json::Value> = Vec::new();
    for (k, v) in &fields {
        // Only allow known columns to be updated.
        match k.as_str() {
            "title" | "stage_id" | "pipeline_id" | "contact_id" | "amount_minor"
            | "currency" | "expected_close_at" | "status" | "notes" => {
                setters.push(format!("{k} = ?"));
                binds.push(v.clone());
            }
            _ => {}
        }
    }
    if setters.is_empty() {
        // Nothing to update; return current row.
        return get_deal(pool, id)
            .await?
            .ok_or_else(|| AppDbError::NotFound(format!("deal {id} not found")));
    }
    setters.push("updated_at = ?".to_string());
    binds.push(serde_json::Value::from(now));
    let sql = format!("UPDATE deals SET {} WHERE id = ?", setters.join(", "));
    let mut q = sqlx::query(sqlx::AssertSqlSafe(&*sql));
    for b in &binds {
        q = bind_json(q, b);
    }
    q = q.bind(id);
    q.execute(pool).await.map_err(AppDbError::Database)?;
    get_deal(pool, id)
        .await?
        .ok_or_else(|| AppDbError::NotFound(format!("deal {id} not found")))
}

pub async fn move_deal_stage(
    pool: &SqlitePool,
    id: &str,
    stage_id: &str,
) -> Result<Deal, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query("UPDATE deals SET stage_id = ?, updated_at = ? WHERE id = ?")
        .bind(stage_id)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    get_deal(pool, id)
        .await?
        .ok_or_else(|| AppDbError::NotFound(format!("deal {id} not found")))
}

pub async fn delete_deal(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    sqlx::query("DELETE FROM deals WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Helper: bind a serde_json::Value to a sqlx query (text/numeric/bool/null).
fn bind_json<'q>(
    q: sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments>,
    v: &serde_json::Value,
) -> sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments> {
    match v {
        serde_json::Value::String(s) => q.bind(s.clone()),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() { q.bind(i) } else { q.bind(n.as_f64().unwrap_or(0.0)) }
        }
        serde_json::Value::Bool(b) => q.bind(*b),
        _ => q.bind(None::<String>),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    async fn seed(pool: &SqlitePool) -> (Pipeline, DealStage) {
        let p = seed_default_pipeline(pool, "co_test").await.unwrap();
        let stages = list_stages(pool, &p.id).await.unwrap();
        (p, stages[0].clone())
    }

    #[tokio::test]
    async fn deal_crud_and_stage_move() {
        let pool = helpers::create_memory_pool().await;
        let (p, stage) = seed(&pool).await;
        let deal = create_deal(
            &pool,
            CreateDealRequest {
                company_id: "co_test".into(),
                contact_id: None,
                pipeline_id: p.id.clone(),
                stage_id: stage.id.clone(),
                title: "Acme sub".into(),
                amount_minor: 500000,
                currency: Some("MAD".into()),
                expected_close_at: None,
                notes: None,
            },
        )
        .await
        .unwrap();
        assert_eq!(deal.title, "Acme sub");
        assert_eq!(deal.amount_minor, 500000);

        let stages = list_stages(&pool, &p.id).await.unwrap();
        let moved = move_deal_stage(&pool, &deal.id, &stages[2].id).await.unwrap();
        assert_eq!(moved.stage_id, stages[2].id);

        let list = list_deals(&pool, "co_test", None, None, None).await.unwrap();
        assert_eq!(list.len(), 1);

        delete_deal(&pool, &deal.id).await.unwrap();
        let list = list_deals(&pool, "co_test", None, None, None).await.unwrap();
        assert!(list.is_empty());
    }

    #[tokio::test]
    async fn seed_is_idempotent() {
        let pool = helpers::create_memory_pool().await;
        let a = seed_default_pipeline(&pool, "co_dup").await.unwrap();
        let b = seed_default_pipeline(&pool, "co_dup").await.unwrap();
        assert_eq!(a.id, b.id);
        let all = list_pipelines(&pool, "co_dup").await.unwrap();
        assert_eq!(all.len(), 1);
    }
}
