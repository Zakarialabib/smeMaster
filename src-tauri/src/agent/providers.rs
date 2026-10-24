//! Provider chain — replaces Python `providers/chain.py`.
//!
//! The fallback chain: when the primary provider errors, chain to the next
//! provider and **record** that it happened. Never fail over silently.
//!
//! In the Rust version, providers are trait objects. The chain is a vector
//! of providers for each seam (LLM, TTS, STT, embedding).

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// The four provider seams.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Seam {
    Llm,
    Tts,
    Stt,
    Embedding,
}

impl Seam {
    pub fn as_str(&self) -> &'static str {
        match self {
            Seam::Llm => "llm",
            Seam::Tts => "tts",
            Seam::Stt => "stt",
            Seam::Embedding => "embedding",
        }
    }
}

/// A provider in the chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub name: String,
    pub seam: Seam,
    pub enabled: bool,
    pub priority: u32,
}

/// The fallback chain result — cannot lie about which provider served it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainResult<T> {
    pub value: T,
    pub provider: String,
    pub attempted: Vec<String>,
    pub fallback_active: bool,
    pub degraded: Vec<String>,
}

/// The provider chain — a map of seam to ordered providers.
#[derive(Debug, Clone, Default)]
pub struct ProviderChain {
    chains: BTreeMap<Seam, Vec<Provider>>,
}

impl ProviderChain {
    /// Create a new empty chain.
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a provider to a seam's chain.
    pub fn add(&mut self, seam: Seam, provider: Provider) {
        self.chains.entry(seam).or_default().push(provider);
    }

    /// Get the chain for a seam.
    pub fn chain(&self, seam: &Seam) -> Vec<&Provider> {
        self.chains
            .get(seam)
            .map(|v| v.iter().filter(|p| p.enabled).collect())
            .unwrap_or_default()
    }

    /// Run a call against each provider in order until one answers.
    ///
    /// `call` receives a provider name and returns a Result. A provider that
    /// returns Err is skipped and the next one is tried.
    pub async fn run<F, Fut, T>(
        &self,
        seam: &Seam,
        call: F,
    ) -> Result<ChainResult<T>, ChainExhausted>
    where
        F: Fn(&str) -> Fut,
        Fut: std::future::Future<Output = Result<T, String>>,
    {
        let providers = self.chain(seam);
        if providers.is_empty() {
            return Err(ChainExhausted {
                seam: *seam,
                attempted: vec![],
                errors: vec!["no providers configured for this seam".to_string()],
            });
        }

        let mut attempted = Vec::new();
        let mut degraded = Vec::new();

        for provider in providers {
            attempted.push(provider.name.clone());
            match call(&provider.name).await {
                Ok(value) => {
                    return Ok(ChainResult {
                        value,
                        provider: provider.name.clone(),
                        attempted: attempted.clone(),
                        fallback_active: attempted.len() > 1,
                        degraded,
                    });
                }
                Err(e) => {
                    degraded.push(format!("{}: {}", provider.name, e));
                }
            }
        }

        Err(ChainExhausted {
            seam: *seam,
            attempted,
            errors: degraded,
        })
    }
}

/// Every provider in the chain failed.
#[derive(Debug, Clone)]
pub struct ChainExhausted {
    pub seam: Seam,
    pub attempted: Vec<String>,
    pub errors: Vec<String>,
}

impl std::fmt::Display for ChainExhausted {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} chain exhausted after {}: {}",
            self.seam.as_str(),
            self.attempted.len(),
            self.errors.join("; ")
        )
    }
}

impl std::error::Error for ChainExhausted {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_chain_fails() {
        let chain = ProviderChain::new();
        assert!(chain.chain(&Seam::Llm).is_empty());
    }

    #[test]
    fn providers_are_filtered_by_enabled() {
        let mut chain = ProviderChain::new();
        chain.add(Seam::Llm, Provider {
            name: "primary".to_string(),
            seam: Seam::Llm,
            enabled: true,
            priority: 1,
        });
        chain.add(Seam::Llm, Provider {
            name: "disabled".to_string(),
            seam: Seam::Llm,
            enabled: false,
            priority: 2,
        });

        let providers = chain.chain(&Seam::Llm);
        assert_eq!(providers.len(), 1);
        assert_eq!(providers[0].name, "primary");
    }

    #[tokio::test]
    async fn chain_falls_back_on_error() {
        let mut chain = ProviderChain::new();
        chain.add(Seam::Llm, Provider {
            name: "primary".to_string(),
            seam: Seam::Llm,
            enabled: true,
            priority: 1,
        });
        chain.add(Seam::Llm, Provider {
            name: "fallback".to_string(),
            seam: Seam::Llm,
            enabled: true,
            priority: 2,
        });

        let result = chain
            .run(&Seam::Llm, |name| {
                // Own the name so the returned future doesn't borrow the
                // closure parameter (which would tie Fut's lifetime to F's
                // input and fail the `F: Fn(&str) -> Fut` bound).
                let name = name.to_string();
                async move {
                    if name == "primary" {
                        Err("primary failed".to_string())
                    } else {
                        Ok("fallback succeeded")
                    }
                }
            })
            .await;

        assert!(result.is_ok());
        let result = result.unwrap();
        assert_eq!(result.provider, "fallback");
        assert!(result.fallback_active);
        assert_eq!(result.attempted.len(), 2);
    }
}
