use dashmap::DashMap;

/// Mirrors FEATURE_FLAGS for Rust-side reads.
/// In MVP, this is used for logging + observability only (advisory).
/// Hard enforcement is deferred to post-MVP.
pub struct ToolRegistry {
    tools: DashMap<String, bool>, // feature_id → enabled
}

impl ToolRegistry {
    pub fn new() -> Self {
        let tools = DashMap::new();
        // Initialize with MVP defaults: all Pro features enabled
        let mvp_flags = [
            // Daily Workflow
            "composing",
            "templates",
            "notifications",
            "snooze",
            "shortcuts",
            // AI & Automation
            "ai",
            "mail-rules",
            "workflows",
            "campaigns",
            // Security & Data
            "pgp",
            "compliance",
            "backup",
            "pairing",
            // Monitoring
            "queue",
            "deliverability-dashboard",
            "presend",
            "content",
            // Deliverability Tools
            "dns",
            "blacklist",
            "bounce",
            "warming",
            // Advanced
            "people",
            "offline-availability",
        ];
        for flag in mvp_flags {
            tools.insert(flag.to_string(), true);
        }
        Self { tools }
    }

    /// Check if a tool is enabled.
    pub fn is_enabled(&self, tool_id: &str) -> bool {
        self.tools.get(tool_id).map(|v| *v).unwrap_or(false)
    }

    /// Enable or disable a tool. Called by apply_tool_state().
    pub fn set_enabled(&self, tool_id: &str, enabled: bool) {
        self.tools.insert(tool_id.to_string(), enabled);
        log::info!("[tool-registry] {} = {}", tool_id, enabled);
    }

    /// Get all tool states (for debugging / IPC).
    pub fn get_all(&self) -> Vec<(String, bool)> {
        self.tools
            .iter()
            .map(|r| (r.key().clone(), *r.value()))
            .collect()
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}
