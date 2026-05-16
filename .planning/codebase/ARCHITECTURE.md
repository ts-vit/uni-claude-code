<!-- refreshed: 2026-05-16 -->
# Architecture

**Analysis Date:** 2026-05-16

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                    React 19 Frontend (src/)                       │
│   App.tsx (7-view router) → DualPanelLayout → ChatPanel          │
│   PipelinePage / HistoryPage / FileTreePanel / DiffViewer / …    │
└──────────┬──────────────────┬─────────────────┬──────────────────┘
           │ invoke()          │ listen()         │ invoke()
           ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────────┐
│              Tauri 2 IPC Bridge (src-tauri/)                      │
│   40+ command handlers in src-tauri/src/commands/                 │
│   State managers: ClaudeManager, SshTunnelManager, TerminalManager│
│                   DbPool (SQLite), SettingsState (JSON)           │
└──────────┬────────────────────────────────────────────────────────┘
           │ spawns / queries
           ▼
┌────────────────────────┐    ┌──────────────────────────────────┐
│  claude-code-core/     │    │  External processes / services   │
│  (crates/)             │    │  Claude CLI binary               │
│  ClaudeCodeRunner      │    │  PTY shells (via uni-terminal)   │
│  SessionConfig         │    │  SSH server (via uni-ssh)        │
│  parse_event()         │    │  SQLite DB file                  │
└────────────────────────┘    └──────────────────────────────────┘
           │ emits back
           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Tauri Event Bus → Frontend listeners (useTauriListener)          │
│  Channels: claude-event, pty-data, pty-exit,                     │
│            ssh-tunnel-*, proxy-settings-changed                  │
└──────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App | View router, project state, navbar | `src/App.tsx` |
| DualPanelLayout | Chat + terminal layout, session tabs (up to 5) | `src/components/DualPanelLayout.tsx` |
| ChatPanel | Message rendering, Claude event subscription | `src/components/chat/ChatPanel.tsx` |
| PipelinePage | Task pipeline UI | `src/components/PipelinePage.tsx` |
| ProjectSidebar | Project list, CRUD | `src/components/ProjectSidebar.tsx` |
| usePipelineController | Pipeline orchestration hook | `src/hooks/usePipelineController.ts` |
| ClaudeManager | Claude process lifecycle, multi-panel | `src-tauri/src/commands/claude.rs` |
| SshTunnelManager | SSH connections, port forwarding | `src-tauri/src/lib.rs` (wired) / `uni-ssh` |
| TerminalManager | PTY session lifecycle | `src-tauri/src/lib.rs` (wired) / `uni-terminal` |
| DbPool | SQLite: projects, saved_messages, pipeline_tasks | `src-tauri/src/lib.rs` |
| SettingsState | JSON settings file persistence | `src-tauri/src/lib.rs` |
| ClaudeCodeRunner | Claude CLI process wrapper + event streaming | `crates/claude-code-core/src/runner.rs` |
| SessionConfig | CLI flag builder, mode/proxy/model config | `crates/claude-code-core/src/session.rs` |
| parse_event | stream-JSON line → ClaudeEvent | `crates/claude-code-core/src/parser.rs` |

## Pattern Overview

**Overall:** Desktop application with Tauri IPC bridge between a React SPA and a Rust async backend.

**Key Characteristics:**
- Frontend is purely reactive — it never holds authoritative state for projects or tasks (all reads go via `invoke`)
- Backend state managers are held in Tauri's managed state (`app.manage(...)`) and accessed via `State<'_, T>` in command handlers
- All long-running backend work (Claude process, SSH events, PTY output) streams results back to the frontend via named Tauri events
- The `claude-code-core` crate is a dependency-free CLI wrapper that knows nothing about Tauri — it produces `RunnerEvent` values that `claude.rs` wraps and emits

## Layers

**Frontend View Layer:**
- Purpose: Render UI, capture user intent, route to backend via `invoke()`
- Location: `src/`
- Contains: React components, hooks, i18n, type definitions
- Depends on: Tauri IPC (`@tauri-apps/api/core`), `@uni-fw/*` UI packages
- Used by: End user

**Tauri Command Layer:**
- Purpose: Handle IPC commands, orchestrate backend state, emit events
- Location: `src-tauri/src/commands/`
- Contains: 11 command modules with 40+ `#[tauri::command]` functions
- Depends on: `claude-code-core`, `uni-ssh`, `uni-terminal`, `uni-db`, `uni-settings`, `sqlx`
- Used by: Frontend via `invoke()`

**Core Library Layer:**
- Purpose: Reusable Claude CLI wrapper, decoupled from Tauri
- Location: `crates/claude-code-core/src/`
- Contains: `ClaudeCodeRunner`, `SessionConfig`, `parse_event`, type definitions
- Depends on: `uni-process`, `uni-common`, `serde_json`, `tracing`
- Used by: `src-tauri/src/commands/claude.rs`

**UNI Framework Layer (external):**
- Purpose: Shared infrastructure (settings, SSH, terminal, DB, UI primitives)
- Location: `github.com/ts-vit/ai-chat` branch `dev` (git dependency)
- Contains: `uni-settings`, `uni-ssh`, `uni-terminal`, `uni-db`, `uni-common`, `uni-process`
- Used by: Both `src-tauri` and `crates/claude-code-core`

## Data Flow

### Claude Code Session (Primary Flow)

1. User types prompt → `PromptInput` component (`src/components/chat/PromptInput.tsx`)
2. `ChatPanel` calls `invoke("claude_start", { panelId, prompt, cwd, mode, ... })` (`src/components/chat/ChatPanel.tsx`)
3. `claude_start` in `src-tauri/src/commands/claude.rs` builds a `SessionConfig`, spawns `ClaudeCodeRunner::start()`
4. A Tokio async task loops on `runner.next_event()` — each event becomes `emit("claude-event", PanelEvent { panelId, event })`
5. Frontend `useTauriListener("claude-event", ...)` in `ChatPanel` receives `PanelEvent`, filters by `panelId`, updates message state
6. On `ProcessExited`, the runner is removed from `ClaudeState.runners` HashMap

### Terminal PTY Flow

1. `DualPanelLayout` (or `TerminalPanel` from `@uni-fw/terminal-ui`) calls `invoke("terminal_create", { cols, rows, cwd })`
2. `terminal_create` in `src-tauri/src/commands/terminal.rs` creates a PTY via `TerminalManager`
3. A dedicated `std::thread` (spawned in `src-tauri/src/lib.rs`) receives `TerminalEvent::Data` → `emit("pty-data", { sessionId, data })`
4. `TerminalEvent::Exit` → `emit("pty-exit", { sessionId, code })`
5. Frontend `@uni-fw/terminal-ui` listens on `pty-data`/`pty-exit` and renders xterm.js output

### SSH Tunnel Flow

1. User configures SSH in settings → frontend calls `invoke("ssh_tunnel_connect", { host, port, ... })`
2. `ssh_tunnel_connect` in `src-tauri/src/commands/ssh_tunnel.rs` delegates to `uni_ssh::SshTunnelManager::connect()`
3. An async Tokio task (spawned in `lib.rs`) subscribes to SSH events and emits:
   - `ssh-tunnel-connected`, `ssh-tunnel-disconnected`, `ssh-tunnel-reconnecting`
   - `ssh-tunnel-reconnect-attempt`, `ssh-tunnel-reconnected`, `ssh-tunnel-reconnect-failed`
   - `ssh-host-key-changed`, `proxy-settings-changed`
4. `SshStatusIndicator` (`src/components/SshStatusIndicator.tsx`) listens and reflects status

### Pipeline Automation Flow

1. `PipelinePage` manages tasks stored in SQLite `pipeline_tasks` table
2. `usePipelineController` hook (`src/hooks/usePipelineController.ts`) drives execution:
   - Invokes `claude_start` with reserved panel IDs (`pipeline-discuss`, `pipeline-code`)
   - Listens on `claude-event` filtered to pipeline panel IDs
   - For each task: Discuss phase → extract prompt → Code phase
3. Task status updates via `invoke("pipeline_task_set_status")`, results via `invoke("pipeline_task_set_result")`

**State Management:**
- Frontend view state (active view, opened projects, active project) lives in `App.tsx` via `useState`
- Per-project layout state is persisted in a `Map<string, DualPanelLayoutState>` module-level variable in `App.tsx`
- All persistent data (projects, history, pipeline tasks, settings) is owned by the Rust backend

## Key Abstractions

**`ClaudeManager` (`Arc<Mutex<ClaudeState>>`):**
- Purpose: Registry of active Claude CLI processes keyed by `panelId`
- Location: `src-tauri/src/commands/claude.rs`
- Pattern: `Arc<Mutex<HashMap<String, ClaudeCodeRunner>>>` — allows multiple concurrent Claude sessions per project

**`SessionConfig`:**
- Purpose: Immutable builder for Claude CLI arguments
- Location: `crates/claude-code-core/src/session.rs`
- Pattern: Builder methods (`with_proxy`, `with_model`, `with_continue`, `with_skip_permissions`), then `build_args()` → `Vec<String>`

**`RunnerEvent` / `PanelEvent`:**
- Purpose: Typed event from Claude CLI process, tagged with `panelId` before emission
- Location: `crates/claude-code-core/src/runner.rs` (RunnerEvent), `src-tauri/src/commands/claude.rs` (PanelEvent)
- Pattern: Externally-tagged serde enum (RunnerEvent), serialized to JSON for Tauri emit

**`useTauriListener`:**
- Purpose: React hook wrapping `@tauri-apps/api/event listen()` with race-condition protection
- Location: `src/utils/safeListener.ts`
- Pattern: Sets `disposed` flag before resolving to prevent subscriptions on unmounted components

**View Type (`App.tsx`):**
- `type View = "main" | "settings" | "history" | "files" | "claude-md" | "diff" | "pipeline"`
- Drives the entire view rendering in `AppShell.Main`

## Entry Points

**Frontend:**
- Location: `src/main.tsx`
- Triggers: Tauri WebView loads index.html
- Responsibilities: Bootstrap `UniProvider` (settings adapter), mount `App`, initialize i18n

**Backend:**
- Location: `src-tauri/src/lib.rs` — `pub fn run()`
- Triggers: Tauri app start (called from `src-tauri/src/main.rs`)
- Responsibilities: Initialize all state managers, run DB migrations, wire SSH/PTY event threads, register all 40+ IPC handlers

## Architectural Constraints

- **Threading:** Rust backend uses Tokio async runtime for most I/O; terminal event dispatching uses a dedicated `std::thread` (synchronous channel from `uni-terminal`)
- **Global state:** `projectLayoutState: Map<string, DualPanelLayoutState>` is a module-level variable in `src/App.tsx` — persists layout across view switches without re-render
- **Tab counter:** `tabCounter` is a module-level mutable in `src/components/DualPanelLayout.tsx` — generates unique tab IDs within the session
- **Max concurrent tabs:** Hard-coded `MAX_TABS_PER_PANEL = 5` in `DualPanelLayout.tsx`
- **Claude process isolation:** Each chat tab gets a unique `panelId`; `ClaudeState.runners` HashMap enforces one runner per panelId
- **No circular imports:** `claude-code-core` depends on no Tauri types; `src-tauri` depends on `claude-code-core`

## Anti-Patterns

### Spawning Claude on an already-running panel

**What happens:** Calling `claude_start` with a `panelId` that is already in `ClaudeState.runners`
**Why it's wrong:** Returns `Err("Session already running on panel {}")` — the frontend must check `isRunning` state before invoking
**Do this instead:** Check `isRunning` in `ChatPanel` state before calling `invoke("claude_start", ...)` (`src/components/chat/ChatPanel.tsx`)

### Reading .env or secrets files

**What happens:** Any code directly reading credential files from the filesystem
**Why it's wrong:** Settings are managed exclusively through `uni-settings` (`JsonSettingsStore`) accessed via `invoke("get_setting")` / `invoke("set_setting")`
**Do this instead:** Use `invoke("get_setting", { key: "..." })` for all configuration reads (`src-tauri/src/commands/uni_settings.rs`)

## Error Handling

**Strategy:** All IPC commands return `Result<T, String>` — errors are serialized as strings and surfaced in frontend via `invoke().catch()`

**Patterns:**
- Rust handlers use `.map_err(|e| e.to_string())` to convert typed errors to strings
- Frontend components catch `invoke()` rejections and show Mantine `notifications.show()` alerts
- `parse_event()` in `claude-code-core` silently warns on malformed lines (tracing::warn) and returns `None` — never panics

## Cross-Cutting Concerns

**Logging:** Rust uses `tracing` crate; frontend uses `console.error` / Mantine notifications
**Validation:** Session config validation implicit via `build_args()` logic in `SessionConfig`; no explicit input validation layer
**Authentication:** No in-app auth — the app runs locally; Claude API auth is handled by the Claude CLI binary itself; SSH uses password or private key passed via settings

---

*Architecture analysis: 2026-05-16*
