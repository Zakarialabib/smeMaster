use std::net::IpAddr;

use chrono::Utc;
use trust_dns_resolver::config::{ResolverConfig, ResolverOpts};
use trust_dns_resolver::TokioAsyncResolver;

use crate::error::SerializedError;

use super::dnsbl::check_dnsbl;
use super::types::*;

pub async fn analyze_spf(resolver: &TokioAsyncResolver, domain: &str) -> RecordStatus {
    match resolver.txt_lookup(domain).await {
        Ok(response) => {
            for record in response.iter() {
                let txt = record.to_string();
                if txt.to_lowercase().starts_with("v=spf1") {
                    let mut issues = Vec::new();
                    let parts: Vec<&str> = txt.split_whitespace().collect();

                    let mut lookup_count = 0i32;

                    for part in &parts {
                        let lower = part.to_lowercase();
                        if lower.contains("include:") {
                            lookup_count += 1;
                        }
                        if lower == "+all" || lower == "all" {
                            issues.push("SPF record uses +all (permissive) — any server can send email as your domain".into());
                        }
                    }

                    if lookup_count > 10 {
                        issues.push(format!(
                            "SPF lookup limit exceeded: {} lookups (RFC 7208 max: 10)",
                            lookup_count
                        ));
                    }

                    let valid = issues.is_empty();
                    return RecordStatus {
                        present: true,
                        valid,
                        issues,
                        raw_value: Some(txt),
                    };
                }
            }
            RecordStatus {
                present: false,
                valid: false,
                issues: vec!["No SPF record found".into()],
                raw_value: None,
            }
        }
        Err(_) => RecordStatus {
            present: false,
            valid: false,
            issues: vec!["SPF lookup failed".into()],
            raw_value: None,
        },
    }
}

pub async fn analyze_dkim(resolver: &TokioAsyncResolver, domain: &str) -> RecordStatus {
    let selectors = ["default", "google", "selector1", "selector2"];

    for selector in &selectors {
        let dkim_domain = format!("{}._domainkey.{}", selector, domain);
        match resolver.txt_lookup(&dkim_domain).await {
            Ok(response) => {
                for record in response.iter() {
                    let txt = record.to_string();
                    if txt.to_lowercase().contains("v=dkim1") {
                        return RecordStatus {
                            present: true,
                            valid: true,
                            issues: vec![],
                            raw_value: Some(txt),
                        };
                    }
                }
            }
            Err(_) => continue,
        }
    }

    RecordStatus {
        present: false,
        valid: false,
        issues: vec![
            "No DKIM record found with common selectors (default, google, selector1, selector2)"
                .into(),
        ],
        raw_value: None,
    }
}

pub async fn analyze_dmarc(resolver: &TokioAsyncResolver, domain: &str) -> RecordStatus {
    let dmarc_domain = format!("_dmarc.{}", domain);
    match resolver.txt_lookup(&dmarc_domain).await {
        Ok(response) => {
            for record in response.iter() {
                let txt = record.to_string();
                let lower = txt.to_lowercase();
                if lower.starts_with("v=dmarc1") {
                    let mut issues = Vec::new();

                    if lower.contains("p=none") {
                        issues.push("DMARC policy is p=none (monitoring only, no enforcement)".into());
                    } else if !lower.contains("p=reject") && !lower.contains("p=quarantine") {
                        issues.push("DMARC record missing or unrecognized policy (p=)".into());
                    }

                    let valid = issues.is_empty();
                    return RecordStatus {
                        present: true,
                        valid,
                        issues,
                        raw_value: Some(txt),
                    };
                }
            }
            RecordStatus {
                present: false,
                valid: false,
                issues: vec!["No DMARC record found".into()],
                raw_value: None,
            }
        }
        Err(_) => RecordStatus {
            present: false,
            valid: false,
            issues: vec!["DMARC lookup failed".into()],
            raw_value: None,
        },
    }
}

pub async fn analyze_mx(resolver: &TokioAsyncResolver, domain: &str) -> RecordStatus {
    match resolver.mx_lookup(domain).await {
        Ok(response) => {
            let records: Vec<_> = response.iter().collect();
            if records.is_empty() {
                RecordStatus {
                    present: false,
                    valid: false,
                    issues: vec!["No MX records found".into()],
                    raw_value: None,
                }
            } else {
                RecordStatus {
                    present: true,
                    valid: true,
                    issues: vec![],
                    raw_value: Some(
                        records
                            .iter()
                            .map(|r| format!("{} {}", r.preference(), r.exchange()))
                            .collect::<Vec<_>>()
                            .join(", "),
                    ),
                }
            }
        }
        Err(_) => RecordStatus {
            present: false,
            valid: false,
            issues: vec!["MX lookup failed".into()],
            raw_value: None,
        },
    }
}

pub async fn analyze_ptr(ip: &str) -> RecordStatus {
    let resolver = TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default());
    let ip_addr: IpAddr = match ip.parse() {
        Ok(addr) => addr,
        Err(_) => {
            return RecordStatus {
                present: false,
                valid: false,
                issues: vec![format!("Invalid IP address: {}", ip)],
                raw_value: None,
            }
        }
    };

    match resolver.reverse_lookup(ip_addr).await {
        Ok(response) => {
            let records: Vec<_> = response.iter().collect();
            if records.is_empty() {
                RecordStatus {
                    present: false,
                    valid: false,
                    issues: vec!["No PTR record found".into()],
                    raw_value: None,
                }
            } else {
                RecordStatus {
                    present: true,
                    valid: true,
                    issues: vec![],
                    raw_value: Some(records[0].to_string()),
                }
            }
        }
        Err(_) => RecordStatus {
            present: false,
            valid: false,
            issues: vec!["PTR lookup failed".into()],
            raw_value: None,
        },
    }
}

pub fn calculate_score(
    spf: &RecordStatus,
    dkim: &RecordStatus,
    dmarc: &RecordStatus,
    mx: &RecordStatus,
    ptr: &RecordStatus,
    blacklist: &[BlacklistResult],
) -> u8 {
    let mut score: i16 = 100;

    if !spf.present {
        score -= 30;
    }
    for issue in &spf.issues {
        if issue.contains("permissive") {
            score -= 25;
        }
        if issue.contains("lookup") {
            score -= 15;
        }
    }

    if !dkim.present {
        score -= 25;
    }

    if !dmarc.present {
        score -= 15;
    }

    if !mx.present || !mx.valid {
        score -= 5;
    }

    if !ptr.present {
        score -= 10;
    }

    for bl in blacklist {
        if bl.listed {
            score -= 40;
        }
    }

    score.clamp(0, 100) as u8
}

pub async fn run_full_diagnostic(domain: &str, sending_ip: Option<&str>) -> DomainHealth {
    let resolver = TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default());

    let (spf, dkim, dmarc, mx) = tokio::join!(
        analyze_spf(&resolver, domain),
        analyze_dkim(&resolver, domain),
        analyze_dmarc(&resolver, domain),
        analyze_mx(&resolver, domain),
    );

    let ptr = match sending_ip {
        Some(ip) => analyze_ptr(ip).await,
        None => RecordStatus {
            present: false,
            valid: false,
            issues: vec!["No sending IP provided".into()],
            raw_value: None,
        },
    };

    let blacklist = match sending_ip {
        Some(ip) => check_dnsbl(ip)
            .await
            .into_iter()
            .map(|r| BlacklistResult {
                provider: r.list_name,
                listed: r.listed,
                details: None,
            })
            .collect(),
        None => vec![],
    };

    let score = calculate_score(&spf, &dkim, &dmarc, &mx, &ptr, &blacklist);

    DomainHealth {
        domain: domain.into(),
        score,
        spf_status: spf,
        dkim_status: dkim,
        dmarc_status: dmarc,
        ptr_status: ptr,
        mx_status: mx,
        blacklist_status: blacklist,
        checked_at: Utc::now(),
    }
}

#[tauri::command]
pub async fn check_domain_health(
    domain: String,
    sending_ip: Option<String>,
) -> Result<DomainHealth, SerializedError> {
    // Require deliverability_sentinel subsystem active
    crate::orchestrator::require_subsystem("deliverability_sentinel", None)
        .await
        .map_err(|e| SerializedError::from(e))?;

    Ok(run_full_diagnostic(&domain, sending_ip.as_deref()).await)
}
