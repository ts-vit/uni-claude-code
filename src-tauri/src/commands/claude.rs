use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex;
use uni_settings::{JsonSettingsStore, SettingsStore};

use claude_code_core::{ClaudeCodeRunner, RunnerEvent, SessionConfig, SessionMode};

/// Active Claude Code session state
pub struct ClaudeState {
    runner: Option<ClaudeCodeRunner>,
}

impl ClaudeState {
    pub fn new() -> Self {
        Self { runner: None }
    }
}

pub type ClaudeManager = Arc<Mutex<ClaudeState>>;

/// Start a Claude Code session
#[tauri::command]
pub async fn claude_start(
    app: AppHandle,
    state: State<'_, ClaudeManager>,
    prompt: String,
    cwd: String,
    mode: String,
) -> Result<(), String> {
    // Check if already running
    {
        let s = state.lock().await;
        if s.runner.is_some() {
            return Err("Session already running".to_string());
        }
    }

    let session_mode = match mode.as_str() {
        "discuss" => SessionMode::Discuss,
        _ => SessionMode::Code,
    };

    let mut config = SessionConfig::new(session_mode, &cwd);

    // Check SSH tunnel for proxy first, fall back to httpProxy from settings
    let ssh_manager = app.state::<Arc<uni_ssh::SshTunnelManager>>();
    if let Some(proxy_url) = ssh_manager.get_proxy_url().await {
        config = config.with_proxy(&proxy_url);
    } else {
        let settings = app.state::<Arc<JsonSettingsStore>>();
        if let Ok(Some(http_proxy)) = settings.get("httpProxy").await {
            if !http_proxy.is_empty() {
                config
                    .env
                    .insert("HTTPS_PROXY".to_string(), http_proxy.clone());
                config.env.insert("HTTP_PROXY".to_string(), http_proxy);
            }
        }
    }

    if session_mode == SessionMode::Code {
        config = config.with_skip_permissions();
    }

    let runner = ClaudeCodeRunner::start(&config, &prompt)
        .await
        .map_err(|e| e.to_string())?;

    {
        let mut s = state.lock().await;
        s.runner = Some(runner);
    }

    // Spawn event streaming task
    let manager = state.inner().clone();
    tauri::async_runtime::spawn(async move {
        loop {
            // Lock only to get the next event, then release
            let event = {
                let mut s = manager.lock().await;
                match s.runner.as_mut() {
                    Some(runner) => runner.next_event().await,
                    None => break,
                }
            };

            match event {
                Some(runner_event) => {
                    let is_exit = matches!(runner_event, RunnerEvent::ProcessExited { .. });

                    let _ = app.emit("claude-event", &runner_event);

                    if is_exit {
                        let mut s = manager.lock().await;
                        s.runner = None;
                        break;
                    }
                }
                None => {
                    // Channel closed
                    let mut s = manager.lock().await;
                    s.runner = None;
                    break;
                }
            }
        }
    });

    Ok(())
}

/// Stop the current session
#[tauri::command]
pub async fn claude_stop(state: State<'_, ClaudeManager>) -> Result<(), String> {
    let mut s = state.lock().await;
    if let Some(ref runner) = s.runner {
        runner.kill().await.map_err(|e| e.to_string())?;
    }
    s.runner = None;
    Ok(())
}

/// Get current session status
#[tauri::command]
pub async fn claude_status(state: State<'_, ClaudeManager>) -> Result<String, String> {
    let s = state.lock().await;
    Ok(if s.runner.is_some() {
        "running"
    } else {
        "idle"
    }
    .to_string())
}
