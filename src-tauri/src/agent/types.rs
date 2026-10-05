//! Wire types, mirroring `services/agent-core/agent_core/contracts.py`.
//!
//! Two constraints, both deliberate:
//! - **No `tenant_id`.** Identity is derived from the token server-side. A
//!   desktop-side field the server ignores is a field a future developer trusts.
//! - **No audio.** Nothing here is a blob of PCM. The console never holds audio,
//!   so there is nothing to accidentally persist or export.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Health {
    pub ok: bool,
    pub version: String,
    pub started_at: String,
    pub db: String,
    pub providers: String,
}

/// `GET /ops/snapshot`. `reachable` is a bool and not an Option: "cannot reach
/// the agent" and "no alerts" are different screens, and a missing field renders
/// as the wrong one.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpsSnapshot {
    pub generated_at: String,
    pub since: String,
    pub p1: Vec<OpsAlert>,
    pub p2_grouped: std::collections::BTreeMap<String, Vec<OpsAlert>>,
    pub p3_count: u32,
    pub contained_pct: u32,
    pub reachable: bool,
    pub last_seen_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpsAlert {
    pub id: String,
    pub severity: String,
    pub rule: String,
    pub one_liner: String,
    /// An alert without a decision is a log line. Never empty in practice.
    pub decision: String,
    pub evidence: AlertEvidence,
    pub acknowledged_at: Option<String>,
    pub acknowledged_by: Option<String>,
    /// True while the threshold is a guess. The console must not present a
    /// provisional threshold as if it had been agreed.
    pub threshold_is_provisional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlertEvidence {
    pub count: u32,
    pub first_at: String,
    pub last_at: String,
    pub blast_radius: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderHealth {
    pub provider: String,
    pub role: String,
    pub error_rate: f32,
    pub latency_p95_ms: Option<u32>,
    /// Whether this seam is currently answering from a fallback provider.
    pub fallback_active: bool,
    pub state: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The one that matters: a field named `tenant_id` anywhere in this module
    /// would let the desktop believe it selects a tenant. It cannot.
    #[test]
    fn no_tenant_id_field_exists() {
        let json = serde_json::to_string(&Health {
            ok: true,
            version: "0.1.0".into(),
            started_at: "now".into(),
            db: "ok".into(),
            providers: "ok".into(),
        })
        .unwrap();
        assert!(!json.contains("tenant"), "tenant leaked into the wire: {json}");
    }

    #[test]
    fn snake_case_fields_serialise_as_camel_case() {
        let json = serde_json::to_string(&ProviderHealth {
            provider: "Deepgram Nova".into(),
            role: "STT".into(),
            error_rate: 0.004,
            latency_p95_ms: Some(410),
            fallback_active: false,
            state: "ok".into(),
        })
        .unwrap();
        assert!(json.contains("latencyP95Ms"), "{json}");
        assert!(json.contains("fallbackActive"), "{json}");
        assert!(!json.contains("latency_p95_ms"), "{json}");
    }

    #[test]
    fn deserialises_a_camel_case_snapshot() {
        let body = r#"{
            "generatedAt":"2026-09-28T14:51:00Z","since":"2026-09-28T08:51:00Z",
            "p1":[],"p2Grouped":{},"p3Count":2,"containedPct":79,
            "reachable":true,"lastSeenAt":"2026-09-28T14:51:00Z"}"#;
        let snap: OpsSnapshot = serde_json::from_str(body).unwrap();
        assert!(snap.reachable, "reachable must survive the round trip");
        assert_eq!(snap.contained_pct, 79);
    }
}
