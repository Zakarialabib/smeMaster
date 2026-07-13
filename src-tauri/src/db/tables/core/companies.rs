use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::core::schema::Company;
use crate::db::commands::UpdateFields;

pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Company, AppDbError> {
    sqlx::query_as::<_, Company>("SELECT * FROM companies WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?
        .ok_or_else(|| AppDbError::NotFound(format!("Company {id} not found")))
}

pub async fn update_fields(
    pool: &SqlitePool,
    id: &str,
    fields: &UpdateFields,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let mut set_parts: Vec<String> = Vec::new();
    let mut set_values: Vec<serde_json::Value> = Vec::new();

    for key in &fields.unset {
        set_parts.push(format!("\"{key}\" = NULL"));
    }

    for (key, value) in &fields.set {
        set_parts.push(format!("\"{key}\" = ?"));
        set_values.push(value.clone());
    }

    set_parts.push("\"updated_at\" = ?".to_string());

    let sql = format!(
        "UPDATE companies SET {} WHERE id = ?",
        set_parts.join(", ")
    );

    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql));
    for val in &set_values {
        q = match val {
            serde_json::Value::String(s) => q.bind(s),
            serde_json::Value::Number(n) => {
                if let Some(i) = n.as_i64() { q.bind(i) }
                else { q.bind(n.as_f64().unwrap_or(0.0)) }
            },
            serde_json::Value::Bool(b) => q.bind(if *b { 1 } else { 0 }),
            _ => q.bind(val.to_string()),
        };
    }
    q = q.bind(now);
    q = q.bind(id);

    q.execute(pool).await.map_err(AppDbError::Database)?;
    Ok(())
}
