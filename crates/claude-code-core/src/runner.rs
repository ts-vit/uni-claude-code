use crate::parser::parse_event;
use crate::session::SessionConfig;
use crate::types::ClaudeEvent;
use serde::Serialize;
use uni_common::UniError;
use uni_process::{ManagedProcess, ProcessConfig, ProcessEvent};

/// High-level event from ClaudeCodeRunner
#[derive(Debug, Clone, Serialize)]
pub enum RunnerEvent {
    /// Parsed Claude Code event
    Claude(ClaudeEvent),
    /// Line from stderr
    Stderr(String),
    /// Process exited
    ProcessExited { code: Option<i32> },
}

/// Wrapper around Claude Code CLI process
pub struct ClaudeCodeRunner {
    process: ManagedProcess,
    stdout_buffer: String,
    stderr_buffer: String,
}

impl ClaudeCodeRunner {
    /// Start Claude Code CLI with a prompt
    pub async fn start(config: &SessionConfig, prompt: &str) -> Result<Self, UniError> {
        let mut args = config.build_args();
        args.push("--".to_string());
        args.push(prompt.to_string());

        let process_config = ProcessConfig::new(&config.claude_path)
            .args(args)
            .cwd(&config.cwd)
            .envs(config.env.clone());

        let process = ManagedProcess::spawn(process_config).await?;

        Ok(Self {
            process,
            stdout_buffer: String::new(),
            stderr_buffer: String::new(),
        })
    }

    /// Get the next event. Returns None when the process has exited and all events are consumed.
    pub async fn next_event(&mut self) -> Option<RunnerEvent> {
        loop {
            let process_event = self.process.next_event().await?;
            match process_event {
                ProcessEvent::Stdout(data) => {
                    let text = String::from_utf8_lossy(&data);
                    self.stdout_buffer.push_str(&text);

                    while let Some(pos) = self.stdout_buffer.find('\n') {
                        let line = self.stdout_buffer[..pos].to_string();
                        self.stdout_buffer = self.stdout_buffer[pos + 1..].to_string();

                        if let Some(event) = parse_event(&line) {
                            return Some(RunnerEvent::Claude(event));
                        }
                    }
                }
                ProcessEvent::Stderr(data) => {
                    let text = String::from_utf8_lossy(&data);
                    self.stderr_buffer.push_str(&text);

                    while let Some(pos) = self.stderr_buffer.find('\n') {
                        let line = self.stderr_buffer[..pos].to_string();
                        self.stderr_buffer = self.stderr_buffer[pos + 1..].to_string();
                        if !line.trim().is_empty() {
                            return Some(RunnerEvent::Stderr(line));
                        }
                    }
                }
                ProcessEvent::Exited { code } => {
                    // Parse remaining stdout buffer
                    if !self.stdout_buffer.trim().is_empty() {
                        let remaining = std::mem::take(&mut self.stdout_buffer);
                        if let Some(event) = parse_event(&remaining) {
                            return Some(RunnerEvent::Claude(event));
                        }
                    }
                    return Some(RunnerEvent::ProcessExited { code });
                }
                ProcessEvent::Started { .. } | ProcessEvent::Error(_) => {
                    // Started is internal to uni-process; errors are rare edge cases.
                    // Continue to the next event.
                }
            }
        }
    }

    /// Wait for the process to exit and return the exit code
    pub async fn wait(&mut self) -> Result<Option<i32>, UniError> {
        while let Some(event) = self.next_event().await {
            if let RunnerEvent::ProcessExited { code } = event {
                return Ok(code);
            }
        }
        Ok(None)
    }

    /// Kill the process
    pub async fn kill(&self) -> Result<(), UniError> {
        self.process.force_kill().await
    }

    /// Get the process ID
    pub fn pid(&self) -> Option<u32> {
        Some(self.process.pid())
    }
}
