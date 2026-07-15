// ── Deal / Pipeline Commands ────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;
use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::tables::crm::deals::{
    self, CreateDealRequest, Deal, DealStage, Pipeline,
};
use crate::db::tables::crm::scoring;
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDealCmd {
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDealCmd {
    pub company_id: String,
    pub id: String,
    #[serde(default)]
    pub fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePipelineCmd {
    pub company_id: String,
    pub name: String,
    pub is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStageCmd {
    pub pipeline_id: String,
    pub name: String,
    pub position: i64,
    pub probability: i64,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveDealStageCmd {
    pub id: String,
    pub stage_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecomputeScoresCmd {
    pub company_id: String,
}

#[tauri::command]
pub async fn db_create_deal(pool: State<'_, SqlitePool>, cmd: CreateDealCmd) -> CmdResult<Deal> {
    let req = CreateDealRequest {
        company_id: cmd.company_id,
        contact_id: cmd.contact_id,
        pipeline_id: cmd.pipeline_id,
        stage_id: cmd.stage_id,
        title: cmd.title,
        amount_minor: cmd.amount_minor,
        currency: cmd.currency,
        expected_close_at: cmd.expected_close_at,
        notes: cmd.notes,
    };
    deals::create_deal(&pool, req).await.map_err(|e| SerializedError::from(e))
}

#[tauri::command]
pub async fn db_update_deal(pool: State<'_, SqlitePool>, cmd: UpdateDealCmd) -> CmdResult<Deal> {
    deals::update_deal(&pool, &cmd.id, cmd.fields)
        .await
        .map_err(|e| SerializedError::from(e))
}

#[tauri::command]
pub async fn db_delete_deal(pool: State<'_, SqlitePool>, id: String) -> CmdResult<()> {
    deals::delete_deal(&pool, &id).await.map_err(|e| SerializedError::from(e))
}

#[tauri::command]
pub async fn db_get_deal(pool: State<'_, SqlitePool>, id: String) -> CmdResult<Deal> {
    deals::get_deal(&pool, &id)
        .await
        .map_err(|e| SerializedError::from(e))?
        .ok_or_else(|| SerializedError::from(AppDbError::NotFound(format!("deal {id}"))))
}

#[tauri::command]
pub async fn db_list_deals(
    pool: State<'_, SqlitePool>,
    company_id: String,
    pipeline_id: Option<String>,
    stage_id: Option<String>,
    status: Option<String>,
) -> CmdResult<Vec<Deal>> {
    deals::list_deals(&pool, &company_id, pipeline_id.as_deref(), stage_id.as_deref(), status.as_deref())
        .await
        .map_err(|e| SerializedError::from(e))
}

#[tauri::command]
pub async fn db_move_deal_stage(
    pool: State<'_, SqlitePool>,
    cmd: MoveDealStageCmd,
) -> CmdResult<Deal> {
    deals::move_deal_stage(&pool, &cmd.id, &cmd.stage_id)
        .await
        .map_err(|e| SerializedError::from(e))
}

#[tauri::command]
pub async fn db_create_pipeline(
    pool: State<'_, SqlitePool>,
    cmd: CreatePipelineCmd,
) -> CmdResult<Pipeline> {
    deals::create_pipeline(&pool, &cmd.company_id, &cmd.name, cmd.is_default.unwrap_or(false))
        .await
        .map_err(|e| SerializedError::from(e))
}

#[tauri::command]
pub async fn db_list_pipelines(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<Pipeline>> {
    deals::list_pipelines(&pool, &company_id).await.map_err(|e| SerializedError::from(e))
}

#[tauri::command]
pub async fn db_create_deal_stage(
    pool: State<'_, SqlitePool>,
    cmd: CreateStageCmd,
) -> CmdResult<DealStage> {
    deals::create_stage(
        &pool,
        &cmd.pipeline_id,
        &cmd.name,
        cmd.position,
        cmd.probability,
        &cmd.color.unwrap_or_else(|| "#0b57d0".to_string()),
    )
    .await
    .map_err(|e| SerializedError::from(e))
}

#[tauri::command]
pub async fn db_list_deal_stages(
    pool: State<'_, SqlitePool>,
    pipeline_id: String,
) -> CmdResult<Vec<DealStage>> {
    deals::list_stages(&pool, &pipeline_id).await.map_err(|e| SerializedError::from(e))
}

#[tauri::command]
pub async fn db_recompute_scores(
    pool: State<'_, SqlitePool>,
    cmd: RecomputeScoresCmd,
) -> CmdResult<usize> {
    scoring::recompute_scores(&pool, &cmd.company_id)
        .await
        .map_err(|e| SerializedError::from(e))
}
