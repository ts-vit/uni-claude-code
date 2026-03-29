use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::process::Command;
use uni_settings::{JsonSettingsStore, SettingsStore};

#[derive(Serialize, Clone, Debug)]
pub struct McpServerEntry {
    pub name: String,
    pub scope: String,
    pub transport: String,
    pub command: Option<String>,
    pub args: Vec<String>,
    pub url: Option<String>,
    pub env_vars: Vec<EnvVar>,
    pub status: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct EnvVar {
    pub key: String,
    pub value: String,
}

/// Parse a single MCP server config JSON value into an McpServerEntry.
pub fn parse_server_config(name: &str, value: &serde_json::Value, scope: &str) -> McpServerEntry {
    let transport = value
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("stdio")
        .to_string();

    let command = if transport == "stdio" {
        value.get("command").and_then(|v| v.as_str()).map(String::from)
    } else {
        None
    };

    let args = if transport == "stdio" {
        value
            .get("args")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default()
    } else {
        vec![]
    };

    let url = if transport != "stdio" {
        value.get("url").and_then(|v| v.as_str()).map(String::from)
    } else {
        None
    };

    let env_vars = value
        .get("env")
        .and_then(|v| v.as_object())
        .map(|obj| {
            obj.iter()
                .map(|(k, v)| EnvVar {
                    key: k.clone(),
                    value: v.as_str().unwrap_or("").to_string(),
                })
                .collect()
        })
        .unwrap_or_default();

    McpServerEntry {
        name: name.to_string(),
        scope: scope.to_string(),
        transport,
        command,
        args,
        url,
        env_vars,
        status: "unknown".to_string(),
    }
}

/// Parsed entry from `claude mcp list` CLI output.
#[derive(Debug, Clone)]
pub struct McpListEntry {
    pub name: String,
    pub status: String,
    pub info: String,
}

/// Parse the output of `claude mcp list` into a list of entries with name, status, and info.
pub fn parse_mcp_list_output(output: &str) -> Vec<McpListEntry> {
    let mut entries = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("Checking MCP server health") {
            continue;
        }
        // Find the last " - " as separator between info and status
        if let Some(sep_idx) = line.rfind(" - ") {
            let left = &line[..sep_idx];
            let right = &line[sep_idx + 3..];

            // Name is text before first ":", info is text after
            let (name, info) = if let Some(colon_idx) = left.find(':') {
                (left[..colon_idx].trim(), left[colon_idx + 1..].trim())
            } else {
                (left.trim(), "")
            };

            let status = if right.contains('✓') {
                "connected"
            } else if right.contains('✗') {
                "failed"
            } else if right.contains('!') {
                "auth_required"
            } else {
                "unknown"
            };

            entries.push(McpListEntry {
                name: name.to_string(),
                status: status.to_string(),
                info: info.to_string(),
            });
        }
    }
    entries
}

/// Build CLI arguments for `claude mcp add`.
pub fn build_add_args(
    name: &str,
    scope: &str,
    transport: &str,
    command: &str,
    args: &[String],
    url: &str,
    env_keys: &[String],
    env_values: &[String],
) -> Vec<String> {
    let mut cli_args = vec!["mcp".to_string(), "add".to_string()];

    if transport != "stdio" {
        cli_args.push("--transport".to_string());
        cli_args.push(transport.to_string());
    }

    cli_args.push("--scope".to_string());
    cli_args.push(scope.to_string());

    for (k, v) in env_keys.iter().zip(env_values.iter()) {
        if !k.is_empty() {
            cli_args.push("--env".to_string());
            cli_args.push(format!("{}={}", k, v));
        }
    }

    cli_args.push(name.to_string());

    if transport == "stdio" {
        cli_args.push("--".to_string());
        cli_args.push(command.to_string());
        cli_args.extend(args.iter().cloned());
    } else {
        cli_args.push(url.to_string());
    }

    cli_args
}

/// Read mcpServers from a simple JSON file (top-level mcpServers only).
/// Used for .mcp.json and .claude/settings.local.json.
fn read_servers_simple(path: &PathBuf, scope: &str) -> Vec<McpServerEntry> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let mut servers = vec![];
    if let Some(mcp) = json.get("mcpServers").and_then(|v| v.as_object()) {
        for (name, config) in mcp {
            servers.push(parse_server_config(name, config, scope));
        }
    }
    servers
}

/// Parse mcpServers from ~/.claude.json nested project structure.
/// Top-level mcpServers → scope "user".
/// projects.<cwd>.mcpServers → scope "local".
pub fn parse_claude_json_servers(json: &serde_json::Value, cwd: &str) -> Vec<McpServerEntry> {
    let mut servers = vec![];

    // Top-level mcpServers → user scope
    if let Some(mcp) = json.get("mcpServers").and_then(|v| v.as_object()) {
        for (name, config) in mcp {
            servers.push(parse_server_config(name, config, "user"));
        }
    }

    // projects.<cwd>.mcpServers → local scope
    if let Some(projects) = json.get("projects").and_then(|v| v.as_object()) {
        let cwd_normalized = cwd.replace('/', "\\");
        for (project_path, project_value) in projects {
            let path_normalized = project_path.replace('/', "\\");
            if path_normalized == cwd_normalized || project_path == cwd {
                if let Some(mcp) = project_value.get("mcpServers").and_then(|v| v.as_object()) {
                    for (name, config) in mcp {
                        servers.push(parse_server_config(name, config, "local"));
                    }
                }
            }
        }
    }

    servers
}

/// Read mcpServers from ~/.claude.json which has nested project structure.
fn read_servers_claude_json(path: &PathBuf, cwd: &str) -> Vec<McpServerEntry> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return vec![],
    };
    parse_claude_json_servers(&json, cwd)
}

/// Resolve proxy environment variables from SSH tunnel or httpProxy setting.
async fn resolve_proxy_env(app: &AppHandle) -> Vec<(String, String)> {
    let mut env = vec![];
    let ssh_manager = app.state::<Arc<uni_ssh::SshTunnelManager>>();
    if let Some(proxy_url) = ssh_manager.get_proxy_url().await {
        if proxy_url.starts_with("http://") {
            env.push(("HTTP_PROXY".to_string(), proxy_url.clone()));
            env.push(("HTTPS_PROXY".to_string(), proxy_url));
        } else {
            env.push(("ALL_PROXY".to_string(), proxy_url));
        }
    } else {
        let settings = app.state::<Arc<JsonSettingsStore>>();
        if let Ok(Some(http_proxy)) = settings.get("httpProxy").await {
            if !http_proxy.is_empty() {
                env.push(("HTTP_PROXY".to_string(), http_proxy.clone()));
                env.push(("HTTPS_PROXY".to_string(), http_proxy));
            }
        }
    }
    env
}

#[tauri::command]
pub async fn mcp_list(app: AppHandle, cwd: String) -> Result<Vec<McpServerEntry>, String> {
    let effective_cwd = if cwd.is_empty() {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ".".to_string())
    } else {
        cwd.clone()
    };

    let mut all_servers: Vec<McpServerEntry> = vec![];

    // Step 1: Read config files
    // User scope: ~/.claude.json (nested project structure)
    if let Some(home) = dirs::home_dir() {
        let user_config = home.join(".claude.json");
        all_servers.extend(read_servers_claude_json(&user_config, &effective_cwd));
    }

    // Project scope: <cwd>/.mcp.json
    let cwd_path = PathBuf::from(&effective_cwd);
    let project_config = cwd_path.join(".mcp.json");
    all_servers.extend(read_servers_simple(&project_config, "project"));

    // Local scope: <cwd>/.claude/settings.local.json
    let local_config = cwd_path.join(".claude").join("settings.local.json");
    all_servers.extend(read_servers_simple(&local_config, "local"));

    // Step 2: Health check via CLI
    let proxy_env = resolve_proxy_env(&app).await;
    let mut cmd = Command::new("claude");
    cmd.args(["mcp", "list"]).current_dir(&effective_cwd);
    for (key, value) in &proxy_env {
        cmd.env(key, value);
    }
    let health_result = cmd.output().await;

    if let Ok(output) = health_result {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let entries = parse_mcp_list_output(&stdout);

            // Apply statuses to known servers
            for server in &mut all_servers {
                if let Some(entry) = entries.iter().find(|e| e.name == server.name) {
                    server.status = entry.status.clone();
                }
            }

            // Add cloud servers (present in CLI output but not in config files)
            let known_names: Vec<String> = all_servers.iter().map(|s| s.name.clone()).collect();
            for entry in &entries {
                if !known_names.contains(&entry.name) {
                    all_servers.push(McpServerEntry {
                        name: entry.name.clone(),
                        scope: "cloud".to_string(),
                        transport: "http".to_string(),
                        command: None,
                        args: vec![],
                        url: if entry.info.starts_with("http") {
                            Some(entry.info.clone())
                        } else {
                            None
                        },
                        env_vars: vec![],
                        status: entry.status.clone(),
                    });
                }
            }
        }
    }

    Ok(all_servers)
}

#[tauri::command]
pub async fn mcp_add(
    app: AppHandle,
    cwd: String,
    name: String,
    scope: String,
    transport: String,
    command: String,
    args: Vec<String>,
    url: String,
    env_keys: Vec<String>,
    env_values: Vec<String>,
) -> Result<(), String> {
    let cli_args = build_add_args(&name, &scope, &transport, &command, &args, &url, &env_keys, &env_values);

    let proxy_env = resolve_proxy_env(&app).await;
    let mut cmd = Command::new("claude");
    cmd.args(&cli_args).current_dir(&cwd);
    for (key, value) in &proxy_env {
        cmd.env(key, value);
    }
    let output = cmd.output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("claude mcp add failed: {}", stderr));
    }

    Ok(())
}

#[tauri::command]
pub async fn mcp_remove(app: AppHandle, cwd: String, name: String, scope: String) -> Result<(), String> {
    let proxy_env = resolve_proxy_env(&app).await;
    let mut cmd = Command::new("claude");
    cmd.args(["mcp", "remove", &name, "-s", &scope])
        .current_dir(&cwd);
    for (key, value) in &proxy_env {
        cmd.env(key, value);
    }
    let output = cmd.output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("claude mcp remove failed: {}", stderr));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_mcp_list_output() {
        let output = "Checking MCP server health...\n\
            claude.ai Context7: https://mcp.context7.com/mcp - ✓ Connected\n\
            claude.ai Gmail: https://gmail.mcp.claude.com/mcp - ! Needs authentication\n\
            test-server: node -e console.log(1) - ✗ Failed to connect\n";

        let entries = parse_mcp_list_output(output);
        assert_eq!(entries.len(), 3);

        let ctx7 = entries.iter().find(|e| e.name == "claude.ai Context7").unwrap();
        assert_eq!(ctx7.status, "connected");
        assert_eq!(ctx7.info, "https://mcp.context7.com/mcp");

        let gmail = entries.iter().find(|e| e.name == "claude.ai Gmail").unwrap();
        assert_eq!(gmail.status, "auth_required");
        assert_eq!(gmail.info, "https://gmail.mcp.claude.com/mcp");

        let test = entries.iter().find(|e| e.name == "test-server").unwrap();
        assert_eq!(test.status, "failed");
        assert_eq!(test.info, "node -e console.log(1)");
    }

    #[test]
    fn test_parse_claude_json_servers() {
        let json = serde_json::json!({
            "projects": {
                "D:\\work-ai\\my-project": {
                    "mcpServers": {
                        "test-server": {
                            "type": "stdio",
                            "command": "node",
                            "args": ["-e", "1"]
                        }
                    },
                    "hasTrustDialogAccepted": true
                },
                "C:\\other": {
                    "mcpServers": {
                        "other-server": {
                            "type": "http",
                            "url": "https://other.com/mcp"
                        }
                    }
                }
            }
        });

        let servers = parse_claude_json_servers(&json, "D:\\work-ai\\my-project");
        assert_eq!(servers.len(), 1);
        assert_eq!(servers[0].name, "test-server");
        assert_eq!(servers[0].scope, "local");
    }

    #[test]
    fn test_parse_claude_json_servers_top_level() {
        let json = serde_json::json!({
            "mcpServers": {
                "global-server": {
                    "type": "http",
                    "url": "https://global.com/mcp"
                }
            },
            "projects": {
                "D:\\my-project": {
                    "mcpServers": {
                        "local-server": {
                            "type": "stdio",
                            "command": "npx",
                            "args": ["server"]
                        }
                    }
                }
            }
        });

        let servers = parse_claude_json_servers(&json, "D:\\my-project");
        assert_eq!(servers.len(), 2);
        assert!(servers.iter().any(|s| s.name == "global-server" && s.scope == "user"));
        assert!(servers.iter().any(|s| s.name == "local-server" && s.scope == "local"));
    }

    #[test]
    fn test_parse_server_config() {
        let json = serde_json::json!({
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "@some/server"],
            "env": { "API_KEY": "test" }
        });

        let entry = parse_server_config("test", &json, "user");
        assert_eq!(entry.name, "test");
        assert_eq!(entry.transport, "stdio");
        assert_eq!(entry.command, Some("npx".to_string()));
        assert_eq!(entry.args, vec!["-y", "@some/server"]);
        assert_eq!(entry.env_vars.len(), 1);
        assert_eq!(entry.env_vars[0].key, "API_KEY");
    }

    #[test]
    fn test_parse_server_config_http() {
        let json = serde_json::json!({
            "type": "http",
            "url": "https://example.com/mcp"
        });

        let entry = parse_server_config("remote", &json, "project");
        assert_eq!(entry.transport, "http");
        assert_eq!(entry.url, Some("https://example.com/mcp".to_string()));
        assert_eq!(entry.command, None);
        assert!(entry.args.is_empty());
    }

    #[test]
    fn test_build_add_args_stdio() {
        let args = build_add_args(
            "my-server", "local", "stdio",
            "npx", &["-y".to_string(), "@server".to_string()],
            "", &["API_KEY".to_string()], &["xxx".to_string()],
        );
        assert!(args.contains(&"--scope".to_string()));
        assert!(args.contains(&"local".to_string()));
        assert!(args.contains(&"--".to_string()));
        assert!(args.contains(&"npx".to_string()));
        assert!(args.contains(&"--env".to_string()));
        assert!(args.contains(&"API_KEY=xxx".to_string()));
    }

    #[test]
    fn test_build_add_args_http() {
        let args = build_add_args(
            "remote", "user", "http",
            "", &[], "https://example.com/mcp",
            &[], &[],
        );
        assert!(args.contains(&"--transport".to_string()));
        assert!(args.contains(&"http".to_string()));
        assert!(args.contains(&"https://example.com/mcp".to_string()));
        assert!(!args.contains(&"--".to_string()));
    }
}
