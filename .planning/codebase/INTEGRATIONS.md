# External Integrations

**Analysis Date:** 2026-05-16

## APIs & External Services

**Claude Code CLI (Anthropic):**
- What: Runs the `claude` CLI binary as a subprocess to execute AI coding sessions. All LLM communication is delegated to the Claude CLI; the app never calls the Anthropic HTTP API directly.
- SDK/Client: `claude-code-core` crate (`crates/claude-code-core/`) — wraps `uni-process::ManagedProcess`
- Runner: `crates/claude-code-core/src/runner.rs` — `ClaudeCodeRunner::start()` spawns `claude --print --verbose --output-format stream-json -p <prompt>`
- Parser: `crates/claude-code-core/src/parser.rs` — parses newline-delimited stream-JSON from CLI stdout
- Config: `crates/claude-code-core/src/session.rs` — `SessionConfig` / `SessionMode` (Code / Discuss)
- CLI path: configurable via settings key `claude.path`; defaults to `"claude"` on PATH
- Model selection: settings key `claude.model` or per-project override passed as `--model <name>`
- Permission mode: `--dangerously-skip-permissions` flag; controlled by `permission_mode` project setting

**MCP (Model Context Protocol) Servers:**
- What: Claude Code's MCP ecosystem — external tool servers (stdio or HTTP transport) registered with the Claude CLI.
- Management commands: `src-tauri/src/commands/mcp.rs` — `mcp_list`, `mcp_add`, `mcp_remove`
- Discovery: reads `~/.claude.json` (user/local scope), `<cwd>/.mcp.json` (project scope), `<cwd>/.claude/settings.local.json` (local scope)
- Health check: invokes `claude mcp list` CLI command and parses output for `✓`, `✗`, `!` status indicators
- Transports supported: `stdio` (command + args) and `http`/`sse` (URL)
- Known cloud MCP servers encountered at runtime (e.g., Context7, Gmail) are surfaced in UI with scope `"cloud"`

## Data Storage

**Databases:**
- Type: SQLite (single file, embedded)
- Location: `<AppData>/uni-claude-code.db`
- Client: `sqlx` 0.8 with `SqlitePool` (runtime-tokio); pool managed via `uni-db` crate
- Migration runner: inline in `src-tauri/src/lib.rs` via `uni_db::run_migrations()`

**Schema (4 migrations applied in order):**

| Version | Table | Purpose |
|---------|-------|---------|
| 1 | `projects` | Project records: `id`, `name`, `cwd`, timestamps |
| 2 | `saved_messages` | Chat history: `user_prompt`, `assistant_response`, `model`, `session_tab_id`, FK→projects |
| 3 | (ALTER) | Adds `model` and `permission_mode` columns to `projects` |
| 4 | `pipeline_tasks` | Task pipeline: `title`, `description`, `prompt`, `status`, `sort_order`, timing columns, FK→projects |

Pipeline task statuses: `draft` → `prompt_ready` → `queued` → `discussing` / `executing` → `done` / `failed`

**Settings persistence:**
- Format: JSON flat key-value store via `uni-settings::JsonSettingsStore`
- Location: `<AppData>/settings.json`
- Access: async `get(key)` / `set(key, value)` / `delete(key)` / `get_all()` — IPC commands in `src-tauri/src/commands/uni_settings.rs`

**File Storage:**
- All file reads/writes operate on the local filesystem via `src-tauri/src/commands/files.rs`
- No remote file storage
- Clipboard image saves go to disk via `src-tauri/src/commands/clipboard.rs` + `arboard` + `image` crates

**Caching:**
- None — no in-process cache layer

## Authentication & Identity

**Auth Provider:**
- None — no user authentication in the app itself
- Claude API credentials are managed by the Claude CLI binary and its own config (`~/.claude.json`)
- MCP server auth (e.g., Gmail OAuth) is handled externally by the Claude CLI; the app surfaces `auth_required` status parsed from `claude mcp list` output

## SSH Tunneling

**Provider:** `uni-ssh` crate (git: `https://github.com/ts-vit/ai-chat`, branch `dev`)
- Manager: `uni_ssh::SshTunnelManager` — singleton managed app state
- Config: `uni_ssh::SshConfig` — host, port, username, `auth_type` (`"password"` or key), `password`, `private_key` (path), `port_forward`
- Port forwarding: `uni_ssh::PortForwardConfig` — local port 0 (OS-assigned), remote host + port
- Known hosts: stored at `<AppData>/ssh_known_hosts`; managed via `ssh_remove_known_host` IPC command
- Auto-connect on startup: reads `ssh.*` settings keys at app launch (`src-tauri/src/lib.rs` setup block)
- IPC commands: `ssh_tunnel_connect`, `ssh_tunnel_disconnect`, `ssh_tunnel_status`, `ssh_remove_known_host` (`src-tauri/src/commands/ssh_tunnel.rs`)
- Proxy forwarding: when SSH tunnel is active, its SOCKS/HTTP proxy URL is injected into Claude CLI env (`HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY`) and into PTY terminal sessions

## Monitoring & Observability

**Error Tracking:**
- None — no external error tracking service

**Logs:**
- `tracing` 0.1 crate used in `claude-code-core` for structured log output
- Tauri `eprintln!` used for SSH auto-connect status in `src-tauri/src/lib.rs`
- Frontend uses `notifications.show()` from `@mantine/notifications` for user-facing errors/messages

## CI/CD & Deployment

**Hosting:**
- Desktop app — distributed as a bundled executable via Tauri (`.exe`/`.msi` on Windows, `.dmg`/`.app` on macOS, `.AppImage`/`.deb` on Linux)
- Bundle targets: `"all"` (`src-tauri/tauri.conf.json`)

**CI Pipeline:**
- None detected — no `.github/`, `.gitlab-ci.yml`, or similar CI config found

## IPC Channels (Tauri Event Bus)

All backend-to-frontend push events use `tauri::Emitter::emit()`. Frontend subscribes via `@tauri-apps/api/event` `listen()`.

| Event Name | Direction | Payload | Source |
|---|---|---|---|
| `claude-event` | backend → frontend | `PanelEvent { panel_id, event: RunnerEvent }` | `src-tauri/src/commands/claude.rs` |
| `pty-data` | backend → frontend | `{ sessionId, data }` | `src-tauri/src/lib.rs` terminal loop |
| `pty-exit` | backend → frontend | `{ sessionId, code }` | `src-tauri/src/lib.rs` terminal loop |
| `ssh-tunnel-connected` | backend → frontend | `{ host, port }` | `src-tauri/src/lib.rs` SSH event loop |
| `ssh-tunnel-disconnected` | backend → frontend | `{}` | `src-tauri/src/lib.rs` SSH event loop |
| `ssh-tunnel-reconnecting` | backend → frontend | `{}` | `src-tauri/src/lib.rs` SSH event loop |
| `ssh-tunnel-reconnect-attempt` | backend → frontend | `{ attempt, maxAttempts }` | `src-tauri/src/lib.rs` SSH event loop |
| `ssh-tunnel-reconnected` | backend → frontend | `{ port }` | `src-tauri/src/lib.rs` SSH event loop |
| `ssh-tunnel-reconnect-failed` | backend → frontend | `{}` | `src-tauri/src/lib.rs` SSH event loop |
| `ssh-host-key-changed` | backend → frontend | `{ host, port }` | `src-tauri/src/lib.rs` SSH event loop |
| `proxy-settings-changed` | backend → frontend | `()` | `src-tauri/src/lib.rs` SSH event loop — triggers terminal proxy refresh |

## IPC Commands (Tauri invoke)

All frontend-to-backend calls use `invoke("command_name", params)` from `@tauri-apps/api/core`.

**Settings:** `get_setting`, `set_setting`, `delete_setting`, `get_all_settings`
**SSH:** `ssh_tunnel_connect`, `ssh_tunnel_disconnect`, `ssh_tunnel_status`, `ssh_remove_known_host`
**Claude:** `claude_start`, `claude_stop`, `claude_status`, `get_claude_path`
**MCP:** `mcp_list`, `mcp_add`, `mcp_remove`
**Projects:** `project_list`, `project_create`, `project_update`, `project_delete`, `project_touch`
**Files:** `file_tree`, `file_read`, `file_write`, `git_branch_info`, `claude_md_read`, `claude_md_write`, `file_diff`, `git_changed_files`
**History:** `history_save`, `history_list`, `history_delete`, `history_export_markdown`, `history_export_to_file`
**Clipboard:** `clipboard_save_image`
**Terminal:** `terminal_create`, `terminal_write`, `terminal_resize`, `terminal_kill`, `get_current_proxy_url`
**Pipeline:** `pipeline_task_counts`, `pipeline_task_list`, `pipeline_task_create`, `pipeline_task_update`, `pipeline_task_delete`, `pipeline_task_reorder`, `pipeline_task_set_status`, `pipeline_task_set_result`, `pipeline_task_set_prompt`, `pipeline_queue_all`

All commands registered in `src-tauri/src/lib.rs` via `tauri::generate_handler![]`.

## Environment Configuration

**Required at runtime:**
- `claude` CLI binary on PATH (or configured via `claude.path` setting)
- `@uni-fw/*` npm packages from private registry `https://npm.ts-vit.com` (registry configured in `.npmrc`)
- UNI Framework Rust crates from `https://github.com/ts-vit/ai-chat` (branch `dev`) — requires git access at build time

**Settings keys (runtime-configurable via UI):**
- `claude.path` — override path to claude CLI binary
- `claude.model` — default model name
- `httpProxy` — HTTP proxy URL (fallback when SSH tunnel not active)
- `ssh.host`, `ssh.port`, `ssh.username`, `ssh.auth_type`, `ssh.password`, `ssh.key_path` — SSH tunnel credentials
- `ssh.auto_connect` — `"true"` to connect SSH at startup
- `ssh.forward_remote_host`, `ssh.forward_remote_port` — port forwarding target
- `ui.maxOpenProjects` — max concurrently open projects (default 3)

**Secrets location:**
- SSH password/key stored in `settings.json` (via `uni-settings`); no OS keychain integration
- Claude API key managed entirely by the external `claude` CLI binary

## Webhooks & Callbacks

**Incoming:** None — desktop app, no inbound webhook endpoints

**Outgoing:** None — all external communication is outbound via the Claude CLI subprocess

---

*Integration audit: 2026-05-16*
