// Standalone verification of the Agent scope rule.
//
// WHY THIS EXISTS
// `cargo test` cannot execute on this host: the test binary dies at OS load with
// 0xc0000139 STATUS_ENTRYPOINT_NOT_FOUND (the installed UCRT/VC++ runtime is
// older than what rustc links against). That is an environment mismatch, not a
// code defect — but it means "the tests compile" was the strongest claim
// available, and compiling is not passing.
//
// The scope functions are pure (no DB, no async, no Tauri), so they can be
// exercised by a plain binary, which DOES run here. This harness mirrors the
// assertions in `db::tables::ai::agents::tests` so the rule is observed, not
// merely compiled.
//
// Run:  rustc --edition 2021 -O scope_verify.rs -o scope_verify && ./scope_verify

use std::process::exit;

const KNOWLEDGE_TIERS: [&str; 4] = ["T0", "T1", "T2", "T3"];
const TOOLS: [&str; 14] = [
    "text", "streaming", "embedding", "stt", "tts", "realtime_voice",
    "model_discovery", "connection_test", "structured_output", "tool_calling",
    "reasoning", "vision", "context_caching", "batch_processing",
];
const CHANNELS: [&str; 4] = ["desktop", "voice", "whatsapp", "cron"];

#[derive(Debug, Clone, PartialEq, Eq)]
enum ScopeDecision {
    Granted,
    Denied { reason: String },
}

impl ScopeDecision {
    fn is_granted(&self) -> bool {
        matches!(self, ScopeDecision::Granted)
    }
}

// ── copied verbatim from db/tables/ai/agents.rs ──────────────────────────────

fn from_json_array(raw: &str) -> Vec<String> {
    // Same tolerant-parse contract: malformed => empty => fail closed.
    let t = raw.trim();
    if !t.starts_with('[') || !t.ends_with(']') {
        return Vec::new();
    }
    let inner = &t[1..t.len() - 1];
    if inner.trim().is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for part in inner.split(',') {
        let p = part.trim();
        if p.len() >= 2 && p.starts_with('"') && p.ends_with('"') {
            out.push(p[1..p.len() - 1].to_string());
        } else {
            return Vec::new();
        }
    }
    out
}

struct Agent {
    name: String,
    tools: String,
    knowledge_tiers: String,
}

fn scope_grants_tool(agent: &Agent, tool: &str) -> ScopeDecision {
    if !TOOLS.contains(&tool) {
        return ScopeDecision::Denied {
            reason: format!("'{tool}' is not a known capability"),
        };
    }
    if from_json_array(&agent.tools).iter().any(|t| t == tool) {
        ScopeDecision::Granted
    } else {
        ScopeDecision::Denied {
            reason: format!("agent '{}' is not granted the '{tool}' capability", agent.name),
        }
    }
}

fn scope_grants_tier(agent: &Agent, tier: &str) -> ScopeDecision {
    if !KNOWLEDGE_TIERS.contains(&tier) {
        return ScopeDecision::Denied {
            reason: format!("'{tier}' is not a known knowledge tier"),
        };
    }
    if tier == "T3" {
        return ScopeDecision::Denied {
            reason: "T3 is never-checked and cannot be granted to any agent".to_string(),
        };
    }
    if from_json_array(&agent.knowledge_tiers).iter().any(|t| t == tier) {
        ScopeDecision::Granted
    } else {
        ScopeDecision::Denied {
            reason: format!("agent '{}' is not granted knowledge tier {tier}", agent.name),
        }
    }
}

fn validate_scope(tiers: &[String], tools: &[String], channels: &[String]) -> Result<(), String> {
    for t in tiers {
        if !KNOWLEDGE_TIERS.contains(&t.as_str()) {
            return Err(format!("unknown knowledge tier '{t}'"));
        }
        if t == "T3" {
            return Err("T3 is never-checked and cannot be granted".to_string());
        }
    }
    for t in tools {
        if !TOOLS.contains(&t.as_str()) {
            return Err(format!("unknown capability '{t}'"));
        }
    }
    for c in channels {
        if !CHANNELS.contains(&c.as_str()) {
            return Err(format!("unknown channel '{c}'"));
        }
    }
    Ok(())
}

// ── harness ──────────────────────────────────────────────────────────────────

fn agent(tiers: &str, tools: &str) -> Agent {
    Agent {
        name: "Test".into(),
        tools: tools.into(),
        knowledge_tiers: tiers.into(),
    }
}

fn main() {
    let mut pass = 0;
    let mut fail = 0;

    macro_rules! check {
        ($name:expr, $cond:expr) => {
            if $cond {
                println!("  PASS  {}", $name);
                pass += 1;
            } else {
                println!("  FAIL  {}", $name);
                fail += 1;
            }
        };
    }

    println!("Agent scope rule — standalone verification\n");

    let a = agent(r#"["T0"]"#, r#"["text","vision"]"#);
    check!("grants a tool the agent has", scope_grants_tool(&a, "vision").is_granted());

    let b = agent(r#"["T0"]"#, r#"["text"]"#);
    let d = scope_grants_tool(&b, "vision");
    check!("denies a tool the agent lacks", !d.is_granted());
    match d {
        ScopeDecision::Denied { reason } => {
            check!("  denial names the tool", reason.contains("vision"))
        }
        _ => check!("  denial names the tool", false),
    }

    check!(
        "denies an unknown tool rather than allowing it",
        !scope_grants_tool(&a, "telepathy").is_granted()
    );

    // The load-bearing one: a bad grant in the DB must not widen access.
    let t3 = agent(r#"["T0","T3"]"#, "[]");
    let d3 = scope_grants_tier(&t3, "T3");
    check!("T3 is never grantable even if the column says so", !d3.is_granted());
    match d3 {
        ScopeDecision::Denied { reason } => {
            check!("  denial cites never-checked", reason.contains("never-checked"))
        }
        _ => check!("  denial cites never-checked", false),
    }

    let t01 = agent(r#"["T0","T1"]"#, "[]");
    check!("grants a tier the agent has", scope_grants_tier(&t01, "T1").is_granted());
    check!("denies a tier the agent lacks", !scope_grants_tier(&t01, "T2").is_granted());

    // Garbage must mean "no access", not "all access".
    let bad = agent("{{{", "not json");
    check!("a malformed tool grant fails closed", !scope_grants_tool(&bad, "text").is_granted());
    check!("a malformed tier grant fails closed", !scope_grants_tier(&bad, "T0").is_granted());

    // Write-time validation.
    check!(
        "validation rejects an unknown tool",
        validate_scope(&["T0".into()], &["visison".into()], &[]).is_err()
    );
    check!(
        "validation rejects an unknown channel",
        validate_scope(&["T0".into()], &[], &["telepathy".into()]).is_err()
    );
    check!(
        "validation rejects granting T3",
        validate_scope(&["T3".into()], &[], &[]).is_err()
    );
    check!(
        "validation accepts a well-formed scope",
        validate_scope(
            &["T0".into(), "T1".into(), "T2".into()],
            &["text".into(), "vision".into()],
            &["desktop".into(), "voice".into()],
        )
        .is_ok()
    );

    println!("\n{} passed, {} failed", pass, fail);
    if fail > 0 {
        exit(1);
    }
    println!("VERDICT: the scope rule behaves as specified.");
}
