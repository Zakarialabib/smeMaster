// ── Company Settings table operations ────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::invoicing::schema::CompanySetting;

/// Get company settings by company ID. Returns None if not yet created.
pub async fn get_by_company(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<Option<CompanySetting>, AppDbError> {
    sqlx::query_as::<_, CompanySetting>(
        "SELECT * FROM company_settings WHERE company_id = ?"
    )
    .bind(company_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Input for upserting company settings.
pub struct UpsertCompanySettingInput<'a> {
    pub default_currency: Option<&'a str>,
    pub default_tax_rate: Option<f64>,
    pub invoice_prefix: Option<&'a str>,
    pub invoice_suffix: Option<&'a str>,
    pub quote_prefix: Option<&'a str>,
    pub default_template_id: Option<&'a str>,
    pub logo_url: Option<&'a str>,
    pub signature_text: Option<&'a str>,
    pub bank_details: Option<&'a str>,
    pub terms_default: Option<&'a str>,
    pub theme_color: Option<&'a str>,
    pub units_enabled: Option<&'a str>,
    pub tax_position: Option<&'a str>,
    pub decimal_places: Option<i64>,
}

/// Create or update company settings (upsert).
pub async fn upsert<'e, E>(
    executor: E,
    company_id: &str,
    input: UpsertCompanySettingInput<'_>,
) -> Result<CompanySetting, AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let now = chrono::Utc::now().timestamp();

    sqlx::query_as::<_, CompanySetting>(
        r#"
        INSERT INTO company_settings (
            company_id, default_currency, default_tax_rate,
            invoice_prefix, invoice_suffix, quote_prefix,
            default_template_id, logo_url, signature_text,
            bank_details, terms_default, theme_color,
            units_enabled, tax_position, decimal_places,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(company_id) DO UPDATE SET
            default_currency = COALESCE(?, default_currency),
            default_tax_rate = COALESCE(?, default_tax_rate),
            invoice_prefix = COALESCE(?, invoice_prefix),
            invoice_suffix = COALESCE(?, invoice_suffix),
            quote_prefix = COALESCE(?, quote_prefix),
            default_template_id = COALESCE(?, default_template_id),
            logo_url = COALESCE(?, logo_url),
            signature_text = COALESCE(?, signature_text),
            bank_details = COALESCE(?, bank_details),
            terms_default = COALESCE(?, terms_default),
            theme_color = COALESCE(?, theme_color),
            units_enabled = COALESCE(?, units_enabled),
            tax_position = COALESCE(?, tax_position),
            decimal_places = COALESCE(?, decimal_places),
            updated_at = ?
        RETURNING *
        "#,
    )
    .bind(company_id)
    .bind(input.default_currency)
    .bind(input.default_tax_rate)
    .bind(input.invoice_prefix)
    .bind(input.invoice_suffix)
    .bind(input.quote_prefix)
    .bind(input.default_template_id)
    .bind(input.logo_url)
    .bind(input.signature_text)
    .bind(input.bank_details)
    .bind(input.terms_default)
    .bind(input.theme_color)
    .bind(input.units_enabled)
    .bind(input.tax_position)
    .bind(input.decimal_places)
    .bind(now)
    // UPDATE set bindings
    .bind(input.default_currency)
    .bind(input.default_tax_rate)
    .bind(input.invoice_prefix)
    .bind(input.invoice_suffix)
    .bind(input.quote_prefix)
    .bind(input.default_template_id)
    .bind(input.logo_url)
    .bind(input.signature_text)
    .bind(input.bank_details)
    .bind(input.terms_default)
    .bind(input.theme_color)
    .bind(input.units_enabled)
    .bind(input.tax_position)
    .bind(input.decimal_places)
    .bind(now)
    .fetch_one(executor)
    .await
    .map_err(AppDbError::Database)
}

/// Delete company settings for a given company.
pub async fn delete<'e, E>(executor: E, company_id: &str) -> Result<(), AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let rows = sqlx::query("DELETE FROM company_settings WHERE company_id = ?")
        .bind(company_id)
        .execute(executor)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("CompanySettings for {company_id} not found")));
    }
    Ok(())
}
