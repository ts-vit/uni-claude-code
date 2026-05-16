# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UNI Claude Code is a Tauri 2 desktop application — a Claude-based coding assistant IDE with multi-session chat, integrated terminal, SSH tunneling, MCP server management, and a task pipeline system. Frontend is React 19 + TypeScript + Mantine UI; backend is Rust with Tokio async runtime and SQLite (via SQLx).

## Common Commands

```bash
npm run dev              # Full Tauri dev (Vite + Rust backend)
npm run vite:dev         # Frontend only (port 1420)
npm run vite:build       # Frontend production build
npm run build            # Full production build (Tauri)
npm run typecheck        # TypeScript type checking
npm run test             # Vitest (single run)
npm run test:watch       # Vitest watch mode
npm run test:rust        # Cargo test (workspace)
npm run test:all         # typecheck + test + test:rust
```

## Architecture

### Rust Workspace

Two crates in `Cargo.toml` workspace:
- **src-tauri/** — Tauri backend: 40+ IPC command handlers in `src/commands/`, app state management, event broadcasting
- **crates/claude-code-core/** — Reusable Claude CLI wrapper: stream-JSON parser (`parser.rs`), process runner (`runner.rs`), session config (`session.rs`)

### Frontend (src/)

- **App.tsx** — View router with 7 views: main, settings, history, files, claude-md, diff, pipeline
- **components/chat/** — Chat UI (ChatPanel, MessageList, MessageItem, PromptInput, ToolUseBlock, StatusBar)
- **components/DualPanelLayout.tsx** — Main layout managing chat + terminal panels with up to 5 session tabs
- **i18n/** — Internationalization (EN + RU locales)
- **hooks/usePipelineController.ts** — Pipeline task orchestration

### Data Flow

Frontend calls Rust backend via `invoke("command_name", params)` (Tauri IPC). Backend mutates state (DB, settings, processes) and broadcasts updates via `emit("event-name", data)`. Key event channels: `claude-event`, `pty-data`, `pty-exit`, `ssh-tunnel-*`, `proxy-settings-changed`.

### Backend State (src-tauri/src/lib.rs)

- `SettingsState` — JSON settings file (via uni-settings)
- `DbPool` — SQLite: projects, saved_messages, pipeline_tasks tables
- `ClaudeManager` — Claude process lifecycle
- `SshTunnelManager` — SSH connections with port forwarding
- `TerminalManager` — PTY sessions

### External Dependencies

UNI Framework packages (`@uni-fw/*` on frontend, `uni-*` Rust crates) come from a private registry (npm: npm.ts-vit.com, git: github.com/ts-vit/ai-chat branch dev).

## Testing

Frontend tests use Vitest + @testing-library/react with jsdom. Test setup (`src/__tests__/setup.ts`) mocks Tauri APIs, i18next, and Mantine components. Rust tests run via `cargo test` on the workspace.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**UNI Claude Code**

Десктоп-приложение на Tauri 2 (React 19 + TypeScript + Rust) — IDE-ассистент на базе Claude Code CLI с многосессионным чатом, встроенным терминалом, SSH-туннелированием, управлением MCP-серверами и пайплайном задач. Используется автором как личный инструмент разработки.

Текущая milestone-цель — убрать зависимости от приватного npm-реестра и приватной ветки git-репозитория, чтобы репозиторий собирался из чистого клона без доступа к сети.

**Core Value:** Чистый клон репозитория без доступа к сети полностью собирается: `npm ci` и `cargo build` проходят, тесты `uni-claude-code` зелёные.

### Constraints

- **Tech stack**: Tauri 2 + React 19 + Rust 2021 — менять не разрешено. Цель — перенести зависимости, а не переписать стек.
- **Compatibility**: публичные API вендорированных пакетов не должны измениться (импорты в `src-tauri/src/` и `src/` остаются такими же).
- **Build determinism**: после фазы 3 сборка должна работать из чистого клона без `.npmrc`, без `cargo` git-credentials, без сетевого доступа к `npm.ts-vit.com` или `github.com/ts-vit/ai-chat`. Сетевой доступ к публичным реестрам npm/crates.io остаётся допустимым.
- **Источник кода**: `D:\work-ai\ai-chat` (локальный клон ветки `dev`). Никакого `git clone` приватного репо во время исполнения фаз — берём из этого пути.
- **Тесты**: Definition of Done гарантирует только зелёный набор тестов самого `uni-claude-code`. Тесты внутри вендорированных пакетов копируются «как есть»; если они зависят от инфраструктуры ai-chat и падают по unrelated причинам — помечаются `#[ignore]` (Rust) или `it.skip` (Vitest) с комментарием TODO, чтобы не блокировать сборку.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.8.3 — all frontend source under `src/`
- Rust 2021 edition — backend crates in `src-tauri/` and `crates/claude-code-core/`
- CSS — component styles (`src/App.css`)
## Runtime
- Node.js — frontend build and dev server (version determined by system; no `.nvmrc` present)
- Rust/Cargo — backend compilation
- npm (lockfile: `package-lock.json` present)
- Cargo (lockfile: `Cargo.lock` present)
## Frameworks
- React 19.1.0 — UI framework (`src/main.tsx`, `src/App.tsx`)
- Mantine 8.3.15 — component library (`@mantine/core`, `@mantine/hooks`, `@mantine/notifications`)
- react-i18next 15.4.0 / i18next 25.0.0 — internationalization; EN + RU locales (`src/i18n/locales/`)
- Tauri 2 — desktop app shell, IPC bridge, plugin system (`src-tauri/`)
- Tokio 1 (full features) — async runtime for all Rust async code
- SQLx 0.8 (runtime-tokio, sqlite) — async database access via `SqlitePool`
- Vite 7.0.4 — frontend bundler; config at `vite.config.ts`; dev port 1420
- @vitejs/plugin-react 4.6.0 — React fast refresh in Vite
- tauri-build 2 — Rust build script in `src-tauri/build.rs`
- @tauri-apps/cli 2 — `tauri dev` / `tauri build` commands
- Vitest 4.1.2 — test runner; config at `vitest.config.ts`; globals enabled
- @testing-library/react 16.3.2 — React component rendering
- @testing-library/jest-dom 6.9.1 — DOM matchers
- jsdom 29.0.1 — browser environment for Vitest
- cargo test (workspace) — Rust unit tests
## Key Dependencies
- `@tauri-apps/api` ^2 — `invoke()` IPC calls to Rust backend; `listen()` event subscriptions
- `@tauri-apps/plugin-dialog` ^2 — native file dialogs
- `@tauri-apps/plugin-shell` ^2 — shell execution from frontend
- `@tanstack/react-virtual` 3.13.23 — virtualised list rendering for message history
- `@tabler/icons-react` 3.31.0 — icon set throughout UI
- `@uni-fw/ui` ^0.1.0 — `MarkdownRenderer`, `useSettings`, `UniProvider`, `ConfirmModal`
- `@uni-fw/terminal-ui` ^0.1.5 — `TerminalPanel` component
- `@uni-fw/ssh-ui` ^0.1.2 — SSH configuration UI components
- `claude-code-core` (workspace crate, `crates/claude-code-core/`) — Claude CLI wrapper with stream-JSON parser and process runner
- `serde` 1 + `serde_json` 1 — serialization for IPC payloads
- `sqlx` 0.8 — SQLite queries for projects, saved_messages, pipeline_tasks tables
- `arboard` 3 — clipboard access for image paste (`src-tauri/src/commands/clipboard.rs`)
- `image` 0.25 (png feature) — PNG encoding for clipboard images
- `chrono` 0.4 — timestamp utilities
- `dirs` 6 — platform home dir / app-data paths
- `tracing` 0.1 — structured logging in `claude-code-core`
- `uni-common` — shared utilities: `generate_id()`, `now_unix_secs()`, `UniError`
- `uni-settings` — `JsonSettingsStore` / `SettingsStore` trait; persists `settings.json`
- `uni-ssh` — `SshTunnelManager`, `SshConfig`, `SshEvent`, `PortForwardConfig`
- `uni-terminal` — `TerminalManager`, `TerminalConfig`, `TerminalEvent` (PTY sessions)
- `uni-db` — `DbConfig`, `Migration`, `create_pool()`, `run_migrations()`
- `uni-process` — `ManagedProcess`, `ProcessConfig`, `ProcessEvent` (subprocess management)
## Configuration
- No `.env` file present; no `TAURI_*` secrets required at runtime
- Dev identifier override via inline env: `TAURI_CONFIG={"identifier":"com.uni.uni-claude-code-dev"}` (in `package.json` dev script) — separates dev AppData from prod
- Frontend picks up `TAURI_DEV_HOST` env var for remote dev (HMR on port 1421)
- Persisted at `<AppData>/settings.json` by `uni-settings` (`JsonSettingsStore`)
- Keys include: `claude.path`, `claude.model`, `httpProxy`, `ssh.*`, `ui.maxOpenProjects`
- Tauri app config: `src-tauri/tauri.conf.json` — identifier `com.uni.uni-claude-code`, product name "Code Architect", window 1200×800
- TypeScript config: `tsconfig.json` — strict mode, ES2020 target, bundler module resolution, `vitest/globals` types injected
- Vite config: `vite.config.ts` — port 1420, `**/src-tauri/**` excluded from file watcher
- Vitest config: `vitest.config.ts` — jsdom environment, globals, setup file `src/__tests__/setup.ts`
- Private npm registry for `@uni-fw/*`: configured in `.npmrc` as `@uni-fw:registry=https://npm.ts-vit.com`
## Platform Requirements
- Node.js (npm) for frontend tooling
- Rust toolchain (cargo) for backend compilation
- Tauri prerequisites per platform (WebView2 on Windows, webkit2gtk on Linux)
- `claude` CLI installed and on PATH (Claude Code CLI by Anthropic) — required at runtime for AI sessions and MCP management
- Single bundled desktop executable (Tauri `bundle.targets = "all"`)
- SQLite database and settings JSON stored in OS-specific AppData directory
- SSH known_hosts file stored alongside app data: `<AppData>/ssh_known_hosts`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## TypeScript Strictness
- `"strict": true` — full strict mode (strictNullChecks, noImplicitAny, etc.)
- `"noUnusedLocals": true`
- `"noUnusedParameters": true`
- `"noFallthroughCasesInSwitch": true`
- `"noUncheckedSideEffectImports": true`
- `"isolatedModules": true`
- Target: `ES2020`, module resolution: `bundler`
## Naming Patterns
- Component files: `PascalCase.tsx` — e.g., `ChatPanel.tsx`, `MessageItem.tsx`, `DualPanelLayout.tsx`
- Hook files: `camelCase.ts` with `use` prefix — e.g., `usePipelineController.ts`
- Utility files: `camelCase.ts` — e.g., `safeListener.ts`
- Type files: `camelCase.ts` — e.g., `claude.ts`
- Constants files: `camelCase.ts` — e.g., `pipelinePrompts.ts`
- Test files: `PascalCase.test.tsx` mirroring component name — e.g., `ChatPanel.test.tsx`
- React components: `PascalCase` named exports — `export function ChatPanel(...)`
- Event handlers: `handle` prefix camelCase — `handleProjectSelect`, `handleCreate`, `handleUpdate`
- Callbacks: `on` prefix camelCase in props — `onSend`, `onStop`, `onProjectSelect`, `onCreated`
- Hook functions: `use` prefix — `useTauriListener`, `usePipelineController`
- Utility functions: camelCase descriptive verbs — `buildTree`, `parseGitStatus`, `getFileName`
- State variables: camelCase noun — `[isRunning, setIsRunning]`, `[messages, setMessages]`
- Boolean state: `is`/`has` prefix — `isRunning`, `hasSessionRef`, `createModalOpened`
- Refs: `camelCase` with `Ref` suffix — `stateRef`, `pauseRequestedRef`, `rafIdRef`
- Constants (module-level): `SCREAMING_SNAKE_CASE` — `MAX_MESSAGES_IN_MEMORY`, `PIPELINE_DISCUSS_PANEL`
- Interfaces: `PascalCase` with descriptive noun — `ChatMessage`, `SessionResult`, `PipelineTask`
- Props interfaces: `ComponentNameProps` — `MessageItemProps`, `ChatPanelProps`, `StatusBarProps`
- Union types: `PascalCase` type alias — `View`, `PipelineStatus`, `ChatMessage`
- Base interfaces: `Base` prefix for discriminated unions — `BaseChatMessage`
- Structs: `PascalCase` — `Project`, `PipelineTask`, `ClaudeState`
- Functions: `snake_case` — `project_list`, `build_add_args`, `parse_git_status`
- Tauri commands: `snake_case` named by domain_action pattern — `project_create`, `claude_start`, `pipeline_task_list`
- Constants: `SCREAMING_SNAKE_CASE`
- Modules: `snake_case` — `commands/projects.rs`, `commands/claude.rs`
## Component Patterns
## Hook Patterns
## Error Handling
## State Management
## i18n Usage
## Import Organization
## Rust Serde Conventions
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
## Module Design
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- Frontend is purely reactive — it never holds authoritative state for projects or tasks (all reads go via `invoke`)
- Backend state managers are held in Tauri's managed state (`app.manage(...)`) and accessed via `State<'_, T>` in command handlers
- All long-running backend work (Claude process, SSH events, PTY output) streams results back to the frontend via named Tauri events
- The `claude-code-core` crate is a dependency-free CLI wrapper that knows nothing about Tauri — it produces `RunnerEvent` values that `claude.rs` wraps and emits
## Layers
- Purpose: Render UI, capture user intent, route to backend via `invoke()`
- Location: `src/`
- Contains: React components, hooks, i18n, type definitions
- Depends on: Tauri IPC (`@tauri-apps/api/core`), `@uni-fw/*` UI packages
- Used by: End user
- Purpose: Handle IPC commands, orchestrate backend state, emit events
- Location: `src-tauri/src/commands/`
- Contains: 11 command modules with 40+ `#[tauri::command]` functions
- Depends on: `claude-code-core`, `uni-ssh`, `uni-terminal`, `uni-db`, `uni-settings`, `sqlx`
- Used by: Frontend via `invoke()`
- Purpose: Reusable Claude CLI wrapper, decoupled from Tauri
- Location: `crates/claude-code-core/src/`
- Contains: `ClaudeCodeRunner`, `SessionConfig`, `parse_event`, type definitions
- Depends on: `uni-process`, `uni-common`, `serde_json`, `tracing`
- Used by: `src-tauri/src/commands/claude.rs`
- Purpose: Shared infrastructure (settings, SSH, terminal, DB, UI primitives)
- Location: `github.com/ts-vit/ai-chat` branch `dev` (git dependency)
- Contains: `uni-settings`, `uni-ssh`, `uni-terminal`, `uni-db`, `uni-common`, `uni-process`
- Used by: Both `src-tauri` and `crates/claude-code-core`
## Data Flow
### Claude Code Session (Primary Flow)
### Terminal PTY Flow
### SSH Tunnel Flow
### Pipeline Automation Flow
- Frontend view state (active view, opened projects, active project) lives in `App.tsx` via `useState`
- Per-project layout state is persisted in a `Map<string, DualPanelLayoutState>` module-level variable in `App.tsx`
- All persistent data (projects, history, pipeline tasks, settings) is owned by the Rust backend
## Key Abstractions
- Purpose: Registry of active Claude CLI processes keyed by `panelId`
- Location: `src-tauri/src/commands/claude.rs`
- Pattern: `Arc<Mutex<HashMap<String, ClaudeCodeRunner>>>` — allows multiple concurrent Claude sessions per project
- Purpose: Immutable builder for Claude CLI arguments
- Location: `crates/claude-code-core/src/session.rs`
- Pattern: Builder methods (`with_proxy`, `with_model`, `with_continue`, `with_skip_permissions`), then `build_args()` → `Vec<String>`
- Purpose: Typed event from Claude CLI process, tagged with `panelId` before emission
- Location: `crates/claude-code-core/src/runner.rs` (RunnerEvent), `src-tauri/src/commands/claude.rs` (PanelEvent)
- Pattern: Externally-tagged serde enum (RunnerEvent), serialized to JSON for Tauri emit
- Purpose: React hook wrapping `@tauri-apps/api/event listen()` with race-condition protection
- Location: `src/utils/safeListener.ts`
- Pattern: Sets `disposed` flag before resolving to prevent subscriptions on unmounted components
- `type View = "main" | "settings" | "history" | "files" | "claude-md" | "diff" | "pipeline"`
- Drives the entire view rendering in `AppShell.Main`
## Entry Points
- Location: `src/main.tsx`
- Triggers: Tauri WebView loads index.html
- Responsibilities: Bootstrap `UniProvider` (settings adapter), mount `App`, initialize i18n
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
### Reading .env or secrets files
## Error Handling
- Rust handlers use `.map_err(|e| e.to_string())` to convert typed errors to strings
- Frontend components catch `invoke()` rejections and show Mantine `notifications.show()` alerts
- `parse_event()` in `claude-code-core` silently warns on malformed lines (tracing::warn) and returns `None` — never panics
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
