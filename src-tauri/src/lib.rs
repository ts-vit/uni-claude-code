use std::sync::Arc;
use tauri::Manager;
use tauri::Emitter;
use tokio::sync::Mutex;
use uni_db::{DbConfig, Migration, create_pool, run_migrations};
use uni_settings::{JsonSettingsStore, SettingsStore};
use uni_terminal::TerminalManager;

mod commands;

use commands::claude::{ClaudeManager, ClaudeState};

type SettingsState = Arc<JsonSettingsStore>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("app_data_dir");
            std::fs::create_dir_all(&app_data_dir).ok();

            // Settings
            let settings_path = app_data_dir.join("settings.json");
            let store = Arc::new(JsonSettingsStore::new(settings_path));
            app.manage(store as SettingsState);

            // Database
            let db_path = app_data_dir.join("uni-claude-code.db");
            let db_config = DbConfig::new(db_path.to_str().unwrap());
            let pool = tauri::async_runtime::block_on(async {
                let pool = create_pool(&db_config).await.map_err(|e| e.to_string())?;
                let migrations = vec![
                    Migration {
                        version: 1,
                        description: "create_projects",
                        sql: "CREATE TABLE IF NOT EXISTS projects (
                            id TEXT PRIMARY KEY,
                            name TEXT NOT NULL,
                            cwd TEXT NOT NULL,
                            created_at INTEGER NOT NULL,
                            updated_at INTEGER NOT NULL
                        )",
                    },
                    Migration {
                        version: 2,
                        description: "create_saved_messages",
                        sql: "CREATE TABLE IF NOT EXISTS saved_messages (
                            id TEXT PRIMARY KEY,
                            project_id TEXT NOT NULL,
                            user_prompt TEXT NOT NULL,
                            assistant_response TEXT NOT NULL,
                            model TEXT,
                            session_tab_id TEXT,
                            created_at INTEGER NOT NULL,
                            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                        )",
                    },
                    Migration {
                        version: 3,
                        description: "add_project_settings",
                        sql: "ALTER TABLE projects ADD COLUMN model TEXT;
                              ALTER TABLE projects ADD COLUMN permission_mode TEXT NOT NULL DEFAULT 'bypass'",
                    },
                    Migration {
                        version: 4,
                        description: "create_pipeline_tasks",
                        sql: "CREATE TABLE IF NOT EXISTS pipeline_tasks (
                            id TEXT PRIMARY KEY,
                            project_id TEXT NOT NULL,
                            title TEXT NOT NULL,
                            description TEXT NOT NULL DEFAULT '',
                            prompt TEXT,
                            status TEXT NOT NULL DEFAULT 'draft',
                            sort_order INTEGER NOT NULL DEFAULT 0,
                            result_summary TEXT,
                            error_message TEXT,
                            started_at INTEGER,
                            completed_at INTEGER,
                            created_at INTEGER NOT NULL,
                            updated_at INTEGER NOT NULL,
                            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                        )",
                    },
                ];
                run_migrations(&pool, &migrations).await.map_err(|e| e.to_string())?;
                Ok::<_, String>(pool)
            })?;
            app.manage(pool);

            // Claude Code
            let claude_manager: ClaudeManager = Arc::new(Mutex::new(ClaudeState::new()));
            app.manage(claude_manager);

            // SSH Tunnel
            let ssh_tunnel_manager = Arc::new(uni_ssh::SshTunnelManager::new());
            app.manage(ssh_tunnel_manager.clone());
            {
                let mut rx = ssh_tunnel_manager.subscribe();
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    while let Ok(event) = rx.recv().await {
                        match event {
                            uni_ssh::SshEvent::Connected { host, port } => {
                                let _ = app_handle.emit("ssh-tunnel-connected", serde_json::json!({ "host": host, "port": port }));
                            }
                            uni_ssh::SshEvent::Disconnected => {
                                let _ = app_handle.emit("ssh-tunnel-disconnected", serde_json::json!({}));
                            }
                            uni_ssh::SshEvent::Reconnecting => {
                                let _ = app_handle.emit("ssh-tunnel-reconnecting", serde_json::json!({}));
                            }
                            uni_ssh::SshEvent::ReconnectAttempt { attempt, max_attempts } => {
                                let _ = app_handle.emit("ssh-tunnel-reconnect-attempt", serde_json::json!({ "attempt": attempt, "maxAttempts": max_attempts }));
                            }
                            uni_ssh::SshEvent::Reconnected { port } => {
                                let _ = app_handle.emit("ssh-tunnel-reconnected", serde_json::json!({ "port": port }));
                                let _ = app_handle.emit("proxy-settings-changed", ());
                            }
                            uni_ssh::SshEvent::ReconnectFailed => {
                                let _ = app_handle.emit("ssh-tunnel-reconnect-failed", serde_json::json!({}));
                            }
                            uni_ssh::SshEvent::HostKeyChanged { host, port } => {
                                let _ = app_handle.emit("ssh-host-key-changed", serde_json::json!({ "host": host, "port": port }));
                            }
                            uni_ssh::SshEvent::ProxySettingsChanged => {
                                let _ = app_handle.emit("proxy-settings-changed", ());
                            }
                        }
                    }
                });
            }

            // Terminal PTY
            let (terminal_manager, terminal_rx) = TerminalManager::new();
            app.manage(std::sync::Mutex::new(terminal_manager));
            {
                let app_handle_term = app.handle().clone();
                std::thread::spawn(move || {
                    while let Ok(event) = terminal_rx.recv() {
                        match event {
                            uni_terminal::TerminalEvent::Data { session_id, data } => {
                                let _ = app_handle_term.emit(
                                    "pty-data",
                                    serde_json::json!({
                                        "sessionId": session_id,
                                        "data": data,
                                    }),
                                );
                            }
                            uni_terminal::TerminalEvent::Exit { session_id, code } => {
                                let _ = app_handle_term.emit(
                                    "pty-exit",
                                    serde_json::json!({
                                        "sessionId": session_id,
                                        "code": code,
                                    }),
                                );
                            }
                        }
                    }
                });
            }

            // SSH auto-connect at startup
            {
                let store = app.state::<SettingsState>().inner().clone();
                let ssh_mgr = ssh_tunnel_manager.clone();
                let app_data = app_data_dir.clone();
                tauri::async_runtime::spawn(async move {
                    let auto_connect = store.get("ssh.auto_connect").await.ok().flatten();
                    if auto_connect.as_deref() != Some("true") {
                        return;
                    }
                    let host = match store.get("ssh.host").await.ok().flatten() {
                        Some(h) if !h.is_empty() => h,
                        _ => return,
                    };
                    let port: u16 = store
                        .get("ssh.port")
                        .await
                        .ok()
                        .flatten()
                        .and_then(|p| p.parse().ok())
                        .unwrap_or(22);
                    let username = store
                        .get("ssh.username")
                        .await
                        .ok()
                        .flatten()
                        .unwrap_or_default();
                    let auth_type = store
                        .get("ssh.auth_type")
                        .await
                        .ok()
                        .flatten()
                        .unwrap_or_else(|| "password".to_string());
                    let password = store.get("ssh.password").await.ok().flatten();
                    let private_key = store.get("ssh.key_path").await.ok().flatten();

                    let forward_remote_port: u16 = store
                        .get("ssh.forward_remote_port")
                        .await
                        .ok()
                        .flatten()
                        .and_then(|p| p.parse().ok())
                        .unwrap_or(0);

                    let port_forward = if forward_remote_port > 0 {
                        Some(uni_ssh::PortForwardConfig {
                            local_port: 0,
                            remote_host: store
                                .get("ssh.forward_remote_host")
                                .await
                                .ok()
                                .flatten()
                                .unwrap_or_else(|| "127.0.0.1".to_string()),
                            remote_port: forward_remote_port,
                        })
                    } else {
                        None
                    };

                    let config = uni_ssh::SshConfig {
                        host: host.clone(),
                        port,
                        username,
                        auth_type,
                        password,
                        private_key,
                        known_hosts_path: app_data.join("ssh_known_hosts"),
                        port_forward,
                    };
                    match ssh_mgr.connect(config).await {
                        Ok(local_port) => {
                            eprintln!("SSH auto-connect: connected to {}:{} (local port {})", host, port, local_port);
                        }
                        Err(e) => {
                            eprintln!("SSH auto-connect: failed to connect to {}:{}: {}", host, port, e);
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Core — settings
            commands::uni_settings::get_setting,
            commands::uni_settings::set_setting,
            commands::uni_settings::delete_setting,
            commands::uni_settings::get_all_settings,
            // SSH Tunnel
            commands::ssh_tunnel::ssh_tunnel_connect,
            commands::ssh_tunnel::ssh_tunnel_disconnect,
            commands::ssh_tunnel::ssh_tunnel_status,
            commands::ssh_tunnel::ssh_remove_known_host,
            // Claude Code
            commands::claude::claude_start,
            commands::claude::claude_stop,
            commands::claude::claude_status,
            // MCP Servers
            commands::mcp::mcp_list,
            commands::mcp::mcp_add,
            commands::mcp::mcp_remove,
            // Projects
            commands::projects::project_list,
            commands::projects::project_create,
            commands::projects::project_update,
            commands::projects::project_delete,
            commands::projects::project_touch,
            // Files
            commands::files::file_tree,
            commands::files::file_read,
            commands::files::file_write,
            commands::files::git_branch_info,
            commands::files::claude_md_read,
            commands::files::claude_md_write,
            commands::files::file_diff,
            commands::files::git_changed_files,
            // History
            commands::history::history_save,
            commands::history::history_list,
            commands::history::history_delete,
            commands::history::history_export_markdown,
            commands::history::history_export_to_file,
            // Clipboard
            commands::clipboard::clipboard_save_image,
            // Terminal
            commands::terminal::terminal_create,
            commands::terminal::terminal_write,
            commands::terminal::terminal_resize,
            commands::terminal::terminal_kill,
            commands::terminal::get_current_proxy_url,
            // Pipeline
            commands::pipeline::pipeline_task_counts,
            commands::pipeline::pipeline_task_list,
            commands::pipeline::pipeline_task_create,
            commands::pipeline::pipeline_task_update,
            commands::pipeline::pipeline_task_delete,
            commands::pipeline::pipeline_task_reorder,
            commands::pipeline::pipeline_task_set_status,
            commands::pipeline::pipeline_task_set_result,
            commands::pipeline::pipeline_task_set_prompt,
            commands::pipeline::pipeline_queue_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
