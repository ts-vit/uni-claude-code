# Codebase Structure

**Analysis Date:** 2026-05-16

## Directory Layout

```
uni-claude-code/
├── src/                          # React 19 frontend (TypeScript)
│   ├── main.tsx                  # App entry point — mounts UniProvider + App
│   ├── App.tsx                   # View router (7 views), project state
│   ├── App.css                   # App-level styles
│   ├── components/               # React UI components
│   │   ├── chat/                 # Chat subsystem components
│   │   │   ├── ChatPanel.tsx     # Claude session UI, event subscription
│   │   │   ├── MessageList.tsx   # Scrollable message list
│   │   │   ├── MessageItem.tsx   # Single message renderer
│   │   │   ├── PromptInput.tsx   # User input / submit
│   │   │   ├── StatusBar.tsx     # Session status display
│   │   │   └── ToolUseBlock.tsx  # Tool call result renderer
│   │   ├── DualPanelLayout.tsx   # Chat + terminal split layout, session tabs
│   │   ├── SessionTabs.tsx       # Tab bar (up to 5 tabs per project)
│   │   ├── ProjectSidebar.tsx    # Project list in left navbar
│   │   ├── CreateProjectModal.tsx # New project form modal
│   │   ├── WelcomeScreen.tsx     # Shown when no project selected
│   │   ├── SettingsPage.tsx      # Settings view
│   │   ├── HistoryPage.tsx       # Saved message history view
│   │   ├── FileTreePanel.tsx     # File explorer view
│   │   ├── ClaudeMdEditor.tsx    # CLAUDE.md editor view
│   │   ├── DiffViewer.tsx        # Git diff view
│   │   ├── PipelinePage.tsx      # Pipeline task management view
│   │   ├── SshStatusIndicator.tsx # SSH connection status in header
│   │   ├── McpServerModal.tsx    # MCP server add/edit modal
│   │   └── McpServersPage.tsx    # MCP servers list
│   ├── hooks/
│   │   └── usePipelineController.ts # Pipeline execution orchestration
│   ├── types/
│   │   └── claude.ts             # TypeScript types matching Rust serde shapes
│   ├── utils/
│   │   └── safeListener.ts       # useTauriListener hook (race-safe event subscription)
│   ├── constants/
│   │   └── pipelinePrompts.ts    # Pipeline prompt templates
│   ├── i18n/
│   │   ├── i18n.ts               # i18next initialization
│   │   └── locales/
│   │       ├── en.json           # English translations
│   │       └── ru.json           # Russian translations
│   └── __tests__/                # Vitest tests (co-located by convention in __tests__/)
│       ├── setup.ts              # Test setup — mocks Tauri, i18next, Mantine
│       ├── App.test.tsx
│       ├── ChatPanel.test.tsx
│       ├── DualPanelLayout.test.tsx
│       └── … (one test file per component)
├── src-tauri/                    # Tauri 2 Rust backend
│   ├── src/
│   │   ├── main.rs               # Rust binary entry — calls lib::run()
│   │   ├── lib.rs                # App setup: state init, migrations, event threads, handler registration
│   │   └── commands/             # IPC command modules
│   │       ├── mod.rs            # Re-exports all command modules
│   │       ├── claude.rs         # Claude process lifecycle (claude_start/stop/status)
│   │       ├── projects.rs       # Project CRUD (project_list/create/update/delete/touch)
│   │       ├── pipeline.rs       # Pipeline task CRUD + status management
│   │       ├── history.rs        # Saved message history (save/list/delete/export)
│   │       ├── files.rs          # File tree, read/write, git diff/status, CLAUDE.md
│   │       ├── terminal.rs       # PTY session management (create/write/resize/kill)
│   │       ├── ssh_tunnel.rs     # SSH tunnel connect/disconnect/status
│   │       ├── mcp.rs            # MCP server list/add/remove
│   │       ├── uni_settings.rs   # Settings get/set/delete/get_all
│   │       └── clipboard.rs      # Clipboard image save
│   ├── Cargo.toml                # src-tauri crate manifest
│   ├── tauri.conf.json           # Tauri app config (bundle, identifier, windows)
│   ├── capabilities/             # Tauri 2 capability definitions
│   ├── icons/                    # App icons (all sizes)
│   └── gen/schemas/              # Auto-generated Tauri permission schemas
├── crates/
│   └── claude-code-core/         # Reusable Claude CLI wrapper crate
│       ├── src/
│       │   ├── lib.rs            # Public re-exports
│       │   ├── runner.rs         # ClaudeCodeRunner — process spawn + event streaming
│       │   ├── session.rs        # SessionConfig + SessionMode — CLI arg builder
│       │   ├── parser.rs         # parse_event() — stream-JSON line → ClaudeEvent
│       │   └── types.rs          # ClaudeEvent, RunnerEvent type definitions
│       └── Cargo.toml
├── Cargo.toml                    # Workspace manifest (members: src-tauri, crates/claude-code-core)
├── package.json                  # npm scripts, frontend dependencies
├── vite.config.ts                # Vite bundler config
├── tsconfig.json                 # TypeScript compiler config
├── index.html                    # Vite entry HTML
├── CLAUDE.md                     # Project instructions for Claude Code
└── dist/                         # Vite build output (not committed)
```

## Directory Purposes

**`src/components/chat/`:**
- Purpose: All UI for a single Claude chat session panel
- Contains: ChatPanel (orchestrator), MessageList, MessageItem, PromptInput, StatusBar, ToolUseBlock
- Key files: `src/components/chat/ChatPanel.tsx` (subscribes to `claude-event`, manages messages)

**`src/components/`:**
- Purpose: All top-level page/view components and shared layout
- Contains: 7 view-level components + sidebar + modals + layout
- Key files: `src/components/DualPanelLayout.tsx` (chat/terminal split + session tabs)

**`src/hooks/`:**
- Purpose: Stateful logic extracted from components
- Contains: `usePipelineController.ts` — drives pipeline task execution via `invoke`/`useTauriListener`

**`src/types/`:**
- Purpose: TypeScript type definitions mirroring Rust serde serialization
- Contains: `claude.ts` — all frontend-facing types: `RunnerEvent`, `ClaudeEvent`, `Project`, `PipelineTask`, etc.

**`src/utils/`:**
- Purpose: Framework-level utilities
- Contains: `safeListener.ts` — `useTauriListener` hook prevents memory leaks on unmount

**`src/i18n/`:**
- Purpose: Internationalization config and translation strings
- Contains: i18next setup, EN and RU locale JSON files

**`src/__tests__/`:**
- Purpose: All Vitest frontend tests
- Contains: One `*.test.tsx` per component/hook + `setup.ts` mocking Tauri/i18n/Mantine

**`src-tauri/src/commands/`:**
- Purpose: IPC command handlers — one module per domain
- Contains: 11 `.rs` files with 40+ `#[tauri::command]` functions

**`crates/claude-code-core/`:**
- Purpose: Tauri-agnostic library for launching and streaming Claude CLI
- Contains: Process management, session configuration, stream-JSON parsing
- Key insight: Has no `tauri` dependency — can be used independently

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Frontend bootstrap — `UniProvider`, settings adapter, i18n, xterm CSS
- `src-tauri/src/main.rs`: Rust binary entry — calls `uni_claude_code_lib::run()`
- `src-tauri/src/lib.rs`: Full backend setup — state init, DB migrations, all handler registration

**View Router:**
- `src/App.tsx`: `type View = "main" | "settings" | "history" | "files" | "claude-md" | "diff" | "pipeline"` — conditional render in `AppShell.Main`

**Core Chat Logic:**
- `src/components/chat/ChatPanel.tsx`: Subscribes to `claude-event`, manages `ChatMessage[]` state, calls `invoke("claude_start")`
- `src-tauri/src/commands/claude.rs`: `claude_start` handler, `ClaudeManager` type, event streaming loop

**Claude CLI Wrapper:**
- `crates/claude-code-core/src/runner.rs`: `ClaudeCodeRunner` — spawns process, buffers stdout, yields `RunnerEvent`
- `crates/claude-code-core/src/session.rs`: `SessionConfig` builder, `build_args()` method
- `crates/claude-code-core/src/parser.rs`: `parse_event(line: &str) -> Option<ClaudeEvent>`

**Data Types:**
- `src/types/claude.ts`: All frontend TypeScript types (mirrors Rust serde)
- `crates/claude-code-core/src/types.rs`: All Rust ClaudeEvent/StreamEvent types

**Pipeline:**
- `src/hooks/usePipelineController.ts`: Pipeline state machine — discuss → extract → code phases
- `src-tauri/src/commands/pipeline.rs`: 9 pipeline commands backed by SQLite

**Testing:**
- `src/__tests__/setup.ts`: Mocks for `@tauri-apps/api`, `i18next`, `@mantine/core`
- `src/__tests__/*.test.tsx`: Per-component test files

**Configuration:**
- `src-tauri/tauri.conf.json`: App identifier, window size, bundle targets
- `vite.config.ts`: Dev server port (1420), Tauri integration
- `tsconfig.json`: TypeScript config

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `ChatPanel.tsx`, `DualPanelLayout.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `usePipelineController.ts`)
- Utilities: `camelCase.ts` (e.g., `safeListener.ts`)
- Constants: `camelCase.ts` (e.g., `pipelinePrompts.ts`)
- Rust modules: `snake_case.rs` (e.g., `ssh_tunnel.rs`, `uni_settings.rs`)
- Test files: `ComponentName.test.tsx` in `src/__tests__/`

**Directories:**
- Frontend: plural lowercase for feature groups (`components/`, `hooks/`, `types/`, `utils/`)
- Chat sub-components: grouped under `components/chat/`
- Rust: `snake_case` matching module names

**IPC commands:**
- Rust handler names become TypeScript `invoke()` strings: `claude_start` → `invoke("claude_start")`
- Commands grouped by domain prefix: `project_*`, `pipeline_task_*`, `ssh_tunnel_*`, `terminal_*`, `history_*`, `file_*`, `mcp_*`

**Tauri event names:**
- Kebab-case strings: `claude-event`, `pty-data`, `pty-exit`, `ssh-tunnel-connected`, `proxy-settings-changed`

## Where to Add New Code

**New view:**
1. Add view key to `type View` union in `src/App.tsx`
2. Create `src/components/NewViewPage.tsx`
3. Add navigation icon in `App.tsx` `AppShell.Header`
4. Add conditional render in `AppShell.Main`

**New IPC command:**
1. Add function with `#[tauri::command]` to appropriate module in `src-tauri/src/commands/`
2. Register in `tauri::generate_handler![]` macro in `src-tauri/src/lib.rs`
3. Call from frontend with `invoke("command_name", params)` — no TypeScript registration needed
4. Add corresponding TypeScript types to `src/types/claude.ts` if returning complex data

**New pipeline SQL field:**
1. Add a new `Migration` in `src-tauri/src/lib.rs` with incremented version number
2. Update `PipelineTask` struct in `src-tauri/src/commands/pipeline.rs`
3. Update TypeScript type in `src/types/claude.ts`

**New chat component:**
- Implementation: `src/components/chat/NewComponent.tsx`
- Test: `src/__tests__/NewComponent.test.tsx`

**New hook:**
- Implementation: `src/hooks/useNewHook.ts`
- Test: `src/__tests__/useNewHook.test.tsx` (or inline in component test)

**New shared utility:**
- Implementation: `src/utils/newUtil.ts`

**New i18n string:**
- Add to both `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`
- Access via `const { t } = useTranslation()` and `t("key")`

**New Rust crate (reusable library):**
- Create under `crates/new-crate/`
- Add to `[workspace] members` in root `Cargo.toml`
- Add as path dependency in `src-tauri/Cargo.toml`

## Special Directories

**`dist/`:**
- Purpose: Vite production build output
- Generated: Yes (by `npm run vite:build`)
- Committed: No

**`src-tauri/gen/`:**
- Purpose: Auto-generated Tauri 2 schemas and capability definitions
- Generated: Yes (by Tauri tooling)
- Committed: Yes (required for build)

**`src-tauri/target/`:**
- Purpose: Rust build artifacts
- Generated: Yes (by Cargo)
- Committed: No

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents consumed by plan/execute commands
- Generated: Yes (by `/gsd:map-codebase`)
- Committed: Yes

---

*Structure analysis: 2026-05-16*
