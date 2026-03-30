use std::collections::HashMap;
use std::sync::Arc;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex;
use uni_settings::{JsonSettingsStore, SettingsStore};

use claude_code_core::{ClaudeCodeRunner, RunnerEvent, SessionConfig, SessionMode};

/// Wrapper around RunnerEvent that includes the panel_id
#[derive(Serialize, Clone)]
pub struct PanelEvent {
    pub panel_id: String,
    pub event: RunnerEvent,
}

/// Active Claude Code session state — supports multiple panels
pub struct ClaudeState {
    runners: HashMap<String, ClaudeCodeRunner>,
}

impl ClaudeState {
    pub fn new() -> Self {
        Self {
            runners: HashMap::new(),
        }
    }
}

pub type ClaudeManager = Arc<Mutex<ClaudeState>>;

/// Start a Claude Code session
#[tauri::command]
pub async fn claude_start(
    app: AppHandle,
    state: State<'_, ClaudeManager>,
    panel_id: String,
    prompt: String,
    cwd: String,
    mode: String,
    continue_session: bool,
    model: Option<String>,
    permission_mode: Option<String>,
) -> Result<(), String> {
    // Check if this panel already has a running session
    {
        let s = state.lock().await;
        if s.runners.contains_key(&panel_id) {
            return Err(format!("Session already running on panel {}", panel_id));
        }
    }

    let session_mode = match mode.as_str() {
        "discuss" => SessionMode::Discuss,
        _ => SessionMode::Code,
    };

    let mut config = SessionConfig::new(session_mode, &cwd);

    // Claude CLI path: settings → default "claude"
    {
        let settings = app.state::<Arc<JsonSettingsStore>>();
        if let Ok(Some(path)) = settings.get("claude.path").await {
            if !path.is_empty() {
                config.claude_path = path;
            }
        }
    }

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

    // Model: project override → settings → default
    if let Some(ref m) = model.filter(|m| !m.is_empty()) {
        config = config.with_model(m);
    } else {
        let settings = app.state::<Arc<JsonSettingsStore>>();
        if let Ok(Some(m)) = settings.get("claude.model").await {
            if !m.is_empty() {
                config = config.with_model(&m);
            }
        }
    }

    if continue_session {
        config = config.with_continue();
    }

    // Code mode: skip_permissions unless project uses "default" permission mode
    // Discuss mode gets disallowed-tools (via build_args)
    if session_mode == SessionMode::Code {
        let perm = permission_mode.as_deref().unwrap_or("bypass");
        if perm != "default" {
            config = config.with_skip_permissions();
        }
    }

    let runner = ClaudeCodeRunner::start(&config, &prompt)
        .await
        .map_err(|e| e.to_string())?;

    {
        let mut s = state.lock().await;
        s.runners.insert(panel_id.clone(), runner);
    }

    // Spawn event streaming task
    let manager = state.inner().clone();
    let pid = panel_id.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            let event = {
                let mut s = manager.lock().await;
                match s.runners.get_mut(&pid) {
                    Some(runner) => runner.next_event().await,
                    None => break,
                }
            };

            match event {
                Some(runner_event) => {
                    let is_exit = matches!(runner_event, RunnerEvent::ProcessExited { .. });

                    let panel_event = PanelEvent {
                        panel_id: pid.clone(),
                        event: runner_event,
                    };
                    let _ = app.emit("claude-event", &panel_event);

                    if is_exit {
                        let mut s = manager.lock().await;
                        s.runners.remove(&pid);
                        break;
                    }
                }
                None => {
                    // Channel closed
                    let mut s = manager.lock().await;
                    s.runners.remove(&pid);
                    break;
                }
            }
        }
    });

    Ok(())
}

/// Stop the current session
#[tauri::command]
pub async fn claude_stop(
    state: State<'_, ClaudeManager>,
    panel_id: String,
) -> Result<(), String> {
    let mut s = state.lock().await;
    if let Some(ref runner) = s.runners.get(&panel_id) {
        runner.kill().await.map_err(|e| e.to_string())?;
    }
    s.runners.remove(&panel_id);
    Ok(())
}

/// Get configured Claude CLI path
#[tauri::command]
pub async fn get_claude_path(
    app: AppHandle,
) -> Result<String, String> {
    let settings = app.state::<Arc<JsonSettingsStore>>();
    if let Ok(Some(path)) = settings.get("claude.path").await {
        if !path.is_empty() {
            return Ok(path);
        }
    }
    Ok("claude".to_string())
}

/// Get current session status
#[tauri::command]
pub async fn claude_status(
    state: State<'_, ClaudeManager>,
    panel_id: String,
) -> Result<String, String> {
    let s = state.lock().await;
    Ok(if s.runners.contains_key(&panel_id) {
        "running"
    } else {
        "idle"
    }
    .to_string())
}
