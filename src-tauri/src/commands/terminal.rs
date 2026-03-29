use std::collections::HashMap;
use std::sync::Arc;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use uni_settings::{JsonSettingsStore, SettingsStore};
use uni_ssh::SshTunnelManager;
use uni_terminal::{TerminalConfig, TerminalManager};

type SettingsState = Arc<JsonSettingsStore>;

/// Resolve current proxy URL: SSH tunnel first, then httpProxy setting
async fn resolve_proxy(
    ssh_manager: &SshTunnelManager,
    settings: &JsonSettingsStore,
) -> Option<String> {
    if let Some(proxy_url) = ssh_manager.get_proxy_url().await {
        return Some(proxy_url);
    }
    settings
        .get("httpProxy")
        .await
        .ok()
        .flatten()
        .filter(|s| !s.is_empty())
}

#[tauri::command]
pub async fn terminal_create(
    app: AppHandle,
    cols: u32,
    rows: u32,
    shell: Option<String>,
    cwd: Option<String>,
) -> Result<String, String> {
    let id = uni_common::generate_id();
    let ssh_manager = app.state::<Arc<SshTunnelManager>>();
    let settings = app.state::<SettingsState>();
    let proxy_url = resolve_proxy(&ssh_manager, &settings).await;

    let mut env = HashMap::new();
    if let Some(proxy) = proxy_url {
        for key in &[
            "HTTP_PROXY",
            "http_proxy",
            "HTTPS_PROXY",
            "https_proxy",
            "ALL_PROXY",
            "all_proxy",
        ] {
            env.insert(key.to_string(), proxy.clone());
        }
    }

    let config = TerminalConfig {
        cols: cols as u16,
        rows: rows as u16,
        shell,
        cwd: cwd.map(std::path::PathBuf::from),
        env,
    };

    let manager = app.state::<Mutex<TerminalManager>>();
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    mgr.create_session(id.clone(), config)?;
    Ok(id)
}

#[tauri::command]
pub async fn terminal_write(
    app: AppHandle,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let manager = app.state::<Mutex<TerminalManager>>();
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    mgr.write_to_session(&session_id, &data)
}

#[tauri::command]
pub async fn terminal_resize(
    app: AppHandle,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    let manager = app.state::<Mutex<TerminalManager>>();
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    mgr.resize_session(&session_id, cols as u16, rows as u16)
}

#[tauri::command]
pub async fn get_current_proxy_url(
    app: AppHandle,
) -> Result<Option<String>, String> {
    let ssh_manager = app.state::<Arc<SshTunnelManager>>();
    let settings = app.state::<SettingsState>();
    Ok(resolve_proxy(&ssh_manager, &settings).await)
}

#[tauri::command]
pub async fn terminal_kill(
    app: AppHandle,
    session_id: String,
) -> Result<(), String> {
    let manager = app.state::<Mutex<TerminalManager>>();
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    mgr.kill_session(&session_id)
}
