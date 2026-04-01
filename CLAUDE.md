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
