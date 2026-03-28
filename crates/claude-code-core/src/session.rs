use std::collections::HashMap;
use std::path::PathBuf;

/// Claude Code CLI operating mode
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionMode {
    /// Read-only: planning, discussion (--permission-mode plan)
    Discuss,
    /// Full access: code execution, file writes
    Code,
}

/// Claude Code session configuration
#[derive(Debug, Clone)]
pub struct SessionConfig {
    /// Operating mode
    pub mode: SessionMode,
    /// Project working directory
    pub cwd: PathBuf,
    /// Additional environment variables (e.g. ALL_PROXY)
    pub env: HashMap<String, String>,
    /// Model override
    pub model: Option<String>,
    /// Path to claude CLI (default: "claude")
    pub claude_path: String,
    /// --dangerously-skip-permissions flag
    pub skip_permissions: bool,
    /// Additional CLI arguments
    pub extra_args: Vec<String>,
}

impl SessionConfig {
    pub fn new(mode: SessionMode, cwd: impl Into<PathBuf>) -> Self {
        Self {
            mode,
            cwd: cwd.into(),
            env: HashMap::new(),
            model: None,
            claude_path: "claude".to_string(),
            skip_permissions: false,
            extra_args: Vec::new(),
        }
    }

    pub fn with_proxy(mut self, proxy_url: &str) -> Self {
        self.env
            .insert("ALL_PROXY".to_string(), proxy_url.to_string());
        self.env
            .insert("HTTPS_PROXY".to_string(), proxy_url.to_string());
        self
    }

    pub fn with_model(mut self, model: &str) -> Self {
        self.model = Some(model.to_string());
        self
    }

    pub fn with_skip_permissions(mut self) -> Self {
        self.skip_permissions = true;
        self
    }

    /// Build CLI arguments
    pub fn build_args(&self) -> Vec<String> {
        let mut args = vec![
            "--print".to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--verbose".to_string(),
            "--include-partial-messages".to_string(),
        ];

        if self.skip_permissions {
            args.push("--dangerously-skip-permissions".to_string());
        }

        if let Some(ref model) = self.model {
            args.push("--model".to_string());
            args.push(model.clone());
        }

        if self.mode == SessionMode::Discuss {
            args.push("--permission-mode".to_string());
            args.push("plan".to_string());
        }

        args.extend(self.extra_args.clone());

        args
    }
}
