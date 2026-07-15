//! Lead-scoring engine for the CRM.
//!
//! Computes a 0..100 engagement score + health status from a contact's
//! `engagement_log` events, with recency decay. Pure math (`compute_score`) is
//! unit-testable without a DB; `recompute_scores` applies it across a company.

use sqlx::SqlitePool;

use crate::db::error::AppDbError;
use crate::db::tables::crm::contacts;

/// Half-life (seconds) for engagement decay — ~30 days.
const HALF_LIFE_SECS: f64 = 30.0 * 24.0 * 3600.0;
/// Events older than this (seconds) are ignored entirely.
const LOOKBACK_SECS: i64 = 180 * 24 * 3600; // 180 days

#[derive(Debug, Clone, PartialEq)]
pub struct ScoreResult {
    pub score: f64,
    pub health: String,
}

/// Pure scoring function. Sums `score_delta` from events, each weighted by an
/// exponential decay based on its age. Clamped to 0..100.
///
/// `events`: tuples of (score_delta, created_at_unix). `now`: current unix time.
pub fn compute_score(events: &[(f64, i64)], now: i64) -> ScoreResult {
    let mut raw: f64 = 0.0;
    for (delta, ts) in events {
        let age = (now - *ts).max(0) as f64;
        if age > LOOKBACK_SECS as f64 {
            continue;
        }
        let decay = 0.5_f64.powf(age / HALF_LIFE_SECS);
        raw += delta * decay;
    }
    let score = raw.clamp(0.0, 100.0);
    let health = classify(score, now, events);
    ScoreResult { score, health }
}

/// Health label from score + recency of last event.
fn classify(score: f64, now: i64, events: &[(f64, i64)]) -> String {
    let last = events.iter().map(|(_, ts)| *ts).max();
    let dormant = match last {
        Some(ts) => (now - ts) > 60 * 24 * 3600, // >60d silent
        None => true,
    };
    if dormant {
        return "Dormant".to_string();
    }
    if score >= 60.0 {
        "Hot".to_string()
    } else if score >= 25.0 {
        "Warm".to_string()
    } else {
        "Cold".to_string()
    }
}

/// Recompute engagement scores for every contact in a company and persist them.
/// Returns the number of contacts updated.
pub async fn recompute_scores(pool: &SqlitePool, company_id: &str) -> Result<usize, AppDbError> {
    // Collect (contact_id, score_delta, created_at) for recent events in the company.
    let rows: Vec<(String, f64, i64)> = sqlx::query_as(
        "SELECT el.contact_id, el.score_delta, el.created_at
         FROM engagement_log el
         JOIN contacts c ON c.id = el.contact_id
         WHERE c.company_id = ? AND el.created_at >= ?",
    )
    .bind(company_id)
    .bind(chrono::Utc::now().timestamp() - LOOKBACK_SECS)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)?;

    // Group events by contact.
    let mut by_contact: std::collections::HashMap<String, Vec<(f64, i64)>> =
        std::collections::HashMap::new();
    for (cid, delta, ts) in rows {
        by_contact.entry(cid).or_default().push((delta, ts));
    }

    let now = chrono::Utc::now().timestamp();
    let mut updated = 0usize;

    // Reset + recompute every contact in the company (those with no events → 0/Dormant).
    let contact_ids: Vec<(String,)> = sqlx::query_as(
        "SELECT id FROM contacts WHERE company_id = ?",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)?;

    for (cid,) in contact_ids {
        let events = by_contact.get(&cid).cloned().unwrap_or_default();
        let r = compute_score(&events, now);
        contacts::update_score(pool, &cid, r.score, now, &r.health).await?;
        updated += 1;
    }
    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ev(delta: f64, days_ago: i64) -> (f64, i64) {
        let now = 1_700_000_000_i64;
        (delta, now - days_ago * 24 * 3600)
    }

    #[test]
    fn fresh_high_value_event_is_hot() {
        let now = 1_700_000_000_i64;
        let r = compute_score(&[ev(80.0, 1)], now);
        assert!(r.score > 60.0);
        assert_eq!(r.health, "Hot");
    }

    #[test]
    fn old_event_decays_and_goes_dormant() {
        let now = 1_700_000_000_i64;
        // A single strong event 200 days ago → beyond lookback → score ~0, Dormant.
        let r = compute_score(&[ev(80.0, 200)], now);
        assert_eq!(r.score, 0.0);
        assert_eq!(r.health, "Dormant");
    }

    #[test]
    fn recent_small_event_is_cold() {
        let now = 1_700_000_000_i64;
        let r = compute_score(&[ev(10.0, 2)], now);
        assert!(r.score > 0.0 && r.score < 25.0);
        assert_eq!(r.health, "Cold");
    }

    #[test]
    fn no_events_is_dormant_zero() {
        let now = 1_700_000_000_i64;
        let r = compute_score(&[], now);
        assert_eq!(r.score, 0.0);
        assert_eq!(r.health, "Dormant");
    }
}
