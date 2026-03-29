use std::collections::HashMap;
use std::path::PathBuf;

/// Claude Code CLI operating mode
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionMode {
    /// Read-only: planning, discussion. Write/Edit/Bash/NotebookEdit tools are disabled.
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
    /// Continue the most recent session in cwd
    pub continue_session: bool,
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
            continue_session: false,
            extra_args: Vec::new(),
        }
    }

    pub fn with_proxy(mut self, proxy_url: &str) -> Self {
        if proxy_url.starts_with("socks5://") {
            self.env
                .insert("ALL_PROXY".to_string(), proxy_url.to_string());
        } else {
            self.env
                .insert("HTTP_PROXY".to_string(), proxy_url.to_string());
            self.env
                .insert("HTTPS_PROXY".to_string(), proxy_url.to_string());
        }
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

    pub fn with_continue(mut self) -> Self {
        self.continue_session = true;
        self
    }

    /// Build CLI arguments
    pub fn build_args(&self) -> Vec<String> {
        let mut args = vec![
            "--print".to_string(),
            "--verbose".to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
        ];

        if self.skip_permissions || self.mode == SessionMode::Discuss {
            args.push("--dangerously-skip-permissions".to_string());
        }

        if let Some(ref model) = self.model {
            args.push("--model".to_string());
            args.push(model.clone());
        }

        if self.mode == SessionMode::Discuss {
            args.push("--disallowed-tools".to_string());
            args.push("Write,Edit,Bash,NotebookEdit".to_string());
        }

        if self.continue_session {
            args.push("--continue".to_string());
        }

        args.extend(self.extra_args.clone());

        args
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_discuss_mode_disallows_write_tools() {
        let config = SessionConfig::new(SessionMode::Discuss, "/tmp/test");
        let args = config.build_args();
        assert!(args.contains(&"--disallowed-tools".to_string()));
        assert!(args.contains(&"Write,Edit,Bash,NotebookEdit".to_string()));
        // Discuss mode always gets --dangerously-skip-permissions for auto-approving allowed tools
        assert!(args.contains(&"--dangerously-skip-permissions".to_string()));
    }

    #[test]
    fn test_code_mode_with_skip_permissions() {
        let config = SessionConfig::new(SessionMode::Code, "/tmp/test")
            .with_skip_permissions();
        let args = config.build_args();
        assert!(args.contains(&"--dangerously-skip-permissions".to_string()));
        assert!(!args.contains(&"--disallowed-tools".to_string()));
    }

    #[test]
    fn test_build_args_with_model_and_continue() {
        let config = SessionConfig::new(SessionMode::Code, "/tmp/test")
            .with_model("opus")
            .with_continue();
        let args = config.build_args();
        assert!(args.contains(&"--model".to_string()));
        assert!(args.contains(&"opus".to_string()));
        assert!(args.contains(&"--continue".to_string()));
    }

    #[test]
    fn test_proxy_socks5() {
        let config = SessionConfig::new(SessionMode::Code, "/tmp/test")
            .with_proxy("socks5://127.0.0.1:1080");
        assert_eq!(config.env.get("ALL_PROXY"), Some(&"socks5://127.0.0.1:1080".to_string()));
        assert!(!config.env.contains_key("HTTP_PROXY"));
    }

    #[test]
    fn test_proxy_http() {
        let config = SessionConfig::new(SessionMode::Code, "/tmp/test")
            .with_proxy("http://127.0.0.1:8888");
        assert_eq!(config.env.get("HTTP_PROXY"), Some(&"http://127.0.0.1:8888".to_string()));
        assert_eq!(config.env.get("HTTPS_PROXY"), Some(&"http://127.0.0.1:8888".to_string()));
    }
}
