#![allow(dead_code)]
// Types used by diagnostic.rs, sentinel.rs, intelligence.rs, and DeliverabilityPanel frontend

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainHealth {
    pub domain: String,
    pub score: u8,
    pub spf_status: RecordStatus,
    pub dkim_status: RecordStatus,
    pub dmarc_status: RecordStatus,
    pub ptr_status: RecordStatus,
    pub mx_status: RecordStatus,
    pub blacklist_status: Vec<BlacklistResult>,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordStatus {
    pub present: bool,
    pub valid: bool,
    pub issues: Vec<String>,
    pub raw_value: Option<String>,
}

impl Default for RecordStatus {
    fn default() -> Self {
        Self {
            present: false,
            valid: false,
            issues: Vec::new(),
            raw_value: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlacklistResult {
    pub provider: String,
    pub listed: bool,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Copy)]
pub struct ScoringPenalty {
    pub check: &'static str,
    pub penalty: i8,
    pub reason: &'static str,
}

pub const SCORING: &[ScoringPenalty] = &[
    ScoringPenalty {
        check: "missing_spf",
        penalty: -30,
        reason: "SPF record missing",
    },
    ScoringPenalty {
        check: "missing_dkim",
        penalty: -25,
        reason: "DKIM record missing",
    },
    ScoringPenalty {
        check: "missing_dmarc",
        penalty: -15,
        reason: "DMARC record missing",
    },
    ScoringPenalty {
        check: "blacklisted_ip",
        penalty: -40,
        reason: "IP blacklisted",
    },
    ScoringPenalty {
        check: "weak_dkim_key",
        penalty: -10,
        reason: "DKIM key < 1024 bits",
    },
    ScoringPenalty {
        check: "spf_permissive",
        penalty: -25,
        reason: "SPF +all detected",
    },
    ScoringPenalty {
        check: "spf_lookup_limit",
        penalty: -15,
        reason: "SPF lookup count > 10",
    },
    ScoringPenalty {
        check: "no_ptr_match",
        penalty: -10,
        reason: "PTR mismatch",
    },
    ScoringPenalty {
        check: "mx_issues",
        penalty: -5,
        reason: "MX configuration error",
    },
];

impl DomainHealth {
    pub fn calculate_score(
        spf: &RecordStatus,
        dkim: &RecordStatus,
        dmarc: &RecordStatus,
        mx: &RecordStatus,
        ptr: &RecordStatus,
        blacklist: &[BlacklistResult],
    ) -> u8 {
        let mut score: i16 = 100;

        if blacklist.iter().any(|b| b.listed) {
            score += lookup_penalty("blacklisted_ip");
        }

        if !spf.present {
            score += lookup_penalty("missing_spf");
        }
        if spf.present && spf.issues.iter().any(|i| i.contains("+all")) {
            score += lookup_penalty("spf_permissive");
        }
        if spf.present && spf.issues.iter().any(|i| i.contains("lookup")) {
            score += lookup_penalty("spf_lookup_limit");
        }

        if !dkim.present {
            score += lookup_penalty("missing_dkim");
        }
        if dkim.present && !dkim.valid {
            score += lookup_penalty("weak_dkim_key");
        }

        if !dmarc.present {
            score += lookup_penalty("missing_dmarc");
        }

        if !ptr.present || !ptr.valid {
            score += lookup_penalty("no_ptr_match");
        }

        if !mx.present || !mx.valid {
            score += lookup_penalty("mx_issues");
        }

        score.clamp(0, 100) as u8
    }
}

fn lookup_penalty(check: &str) -> i16 {
    SCORING
        .iter()
        .find(|p| p.check == check)
        .map(|p| p.penalty as i16)
        .unwrap_or_else(|| {
            log::warn!("[deliverability] Unknown check type: {:?}", check);
            0
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_valid(record: RecordStatus) -> RecordStatus {
        record
    }

    #[test]
    fn test_perfect_score() {
        let spf = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("v=spf1 -all".into()),
        };
        let dkim = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("v=DKIM1;...".into()),
        };
        let dmarc = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("v=DMARC1; p=reject".into()),
        };
        let mx = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("mx.example.com".into()),
        };
        let ptr = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("ptr.example.com".into()),
        };
        let blacklist = vec![];

        assert_eq!(
            DomainHealth::calculate_score(&spf, &dkim, &dmarc, &mx, &ptr, &blacklist),
            100
        );
    }

    #[test]
    fn test_missing_spf() {
        let spf = RecordStatus::default();
        let dkim = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("v=DKIM1;...".into()),
        };
        let dmarc = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("v=DMARC1; p=reject".into()),
        };
        let mx = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("mx.example.com".into()),
        };
        let ptr = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("ptr.example.com".into()),
        };
        let blacklist = vec![];

        assert_eq!(
            DomainHealth::calculate_score(&spf, &dkim, &dmarc, &mx, &ptr, &blacklist),
            70
        );
    }

    #[test]
    fn test_missing_all_critical_records() {
        let spf = RecordStatus::default();
        let dkim = RecordStatus::default();
        let dmarc = RecordStatus::default();
        let mx = RecordStatus::default();
        let ptr = RecordStatus::default();
        let blacklist = vec![BlacklistResult {
            provider: "spamhaus".into(),
            listed: true,
            details: None,
        }];

        assert_eq!(
            DomainHealth::calculate_score(&spf, &dkim, &dmarc, &mx, &ptr, &blacklist),
            0
        );
    }

    #[test]
    fn test_blacklisted() {
        let spf = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("v=spf1 -all".into()),
        };
        let dkim = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("v=DKIM1;...".into()),
        };
        let dmarc = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("v=DMARC1; p=reject".into()),
        };
        let mx = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("mx.example.com".into()),
        };
        let ptr = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("ptr.example.com".into()),
        };
        let blacklist = vec![BlacklistResult {
            provider: "spamhaus".into(),
            listed: true,
            details: None,
        }];

        assert_eq!(
            DomainHealth::calculate_score(&spf, &dkim, &dmarc, &mx, &ptr, &blacklist),
            60
        );
    }

    #[test]
    fn test_spf_permissive() {
        let spf = RecordStatus {
            present: true,
            valid: true,
            issues: vec!["+all detected".into()],
            raw_value: Some("v=spf1 +all".into()),
        };
        let dkim = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("v=DKIM1;...".into()),
        };
        let dmarc = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("v=DMARC1; p=reject".into()),
        };
        let mx = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("mx.example.com".into()),
        };
        let ptr = RecordStatus {
            present: true,
            valid: true,
            issues: vec![],
            raw_value: Some("ptr.example.com".into()),
        };
        let blacklist = vec![];

        assert_eq!(
            DomainHealth::calculate_score(&spf, &dkim, &dmarc, &mx, &ptr, &blacklist),
            75
        );
    }

    #[test]
    fn test_all_penalties_combined() {
        let spf = RecordStatus {
            present: true,
            valid: true,
            issues: vec!["+all detected".into(), "lookup count > 10".into()],
            raw_value: Some("v=spf1 +all".into()),
        };
        let dkim = RecordStatus {
            present: true,
            valid: false,
            issues: vec!["key too short".into()],
            raw_value: Some("v=DKIM1; p=short".into()),
        };
        let dmarc = RecordStatus::default();
        let mx = RecordStatus {
            present: true,
            valid: false,
            issues: vec!["bad mx".into()],
            raw_value: None,
        };
        let ptr = RecordStatus::default();
        let blacklist = vec![BlacklistResult {
            provider: "spamhaus".into(),
            listed: true,
            details: None,
        }];

        assert_eq!(
            DomainHealth::calculate_score(&spf, &dkim, &dmarc, &mx, &ptr, &blacklist),
            0
        );
    }
}
