# Technology Stack

**Analysis Date:** 2026-05-16

## Languages

**Primary:**
- TypeScript 5.8.3 — all frontend source under `src/`
- Rust 2021 edition — backend crates in `src-tauri/` and `crates/claude-code-core/`

**Secondary:**
- CSS — component styles (`src/App.css`)

## Runtime

**Environment:**
- Node.js — frontend build and dev server (version determined by system; no `.nvmrc` present)
- Rust/Cargo — backend compilation

**Package Manager:**
- npm (lockfile: `package-lock.json` present)
- Cargo (lockfile: `Cargo.lock` present)

## Frameworks

**Core (Frontend):**
- React 19.1.0 — UI framework (`src/main.tsx`, `src/App.tsx`)
- Mantine 8.3.15 — component library (`@mantine/core`, `@mantine/hooks`, `@mantine/notifications`)
- react-i18next 15.4.0 / i18next 25.0.0 — internationalization; EN + RU locales (`src/i18n/locales/`)

**Core (Backend):**
- Tauri 2 — desktop app shell, IPC bridge, plugin system (`src-tauri/`)
- Tokio 1 (full features) — async runtime for all Rust async code
- SQLx 0.8 (runtime-tokio, sqlite) — async database access via `SqlitePool`

**Build/Dev:**
- Vite 7.0.4 — frontend bundler; config at `vite.config.ts`; dev port 1420
- @vitejs/plugin-react 4.6.0 — React fast refresh in Vite
- tauri-build 2 — Rust build script in `src-tauri/build.rs`
- @tauri-apps/cli 2 — `tauri dev` / `tauri build` commands

**Testing:**
- Vitest 4.1.2 — test runner; config at `vitest.config.ts`; globals enabled
- @testing-library/react 16.3.2 — React component rendering
- @testing-library/jest-dom 6.9.1 — DOM matchers
- jsdom 29.0.1 — browser environment for Vitest
- cargo test (workspace) — Rust unit tests

## Key Dependencies

**Critical (Frontend):**
- `@tauri-apps/api` ^2 — `invoke()` IPC calls to Rust backend; `listen()` event subscriptions
- `@tauri-apps/plugin-dialog` ^2 — native file dialogs
- `@tauri-apps/plugin-shell` ^2 — shell execution from frontend
- `@tanstack/react-virtual` 3.13.23 — virtualised list rendering for message history
- `@tabler/icons-react` 3.31.0 — icon set throughout UI

**UNI Framework (Frontend — vendored npm workspaces in `packages/uni-fw-*`):**
- `@uni-fw/ui` ^0.1.0 — `MarkdownRenderer`, `useSettings`, `UniProvider`, `ConfirmModal`
- `@uni-fw/terminal-ui` ^0.1.5 — `TerminalPanel` component
- `@uni-fw/ssh-ui` ^0.1.2 — SSH configuration UI components

**Critical (Backend):**
- `claude-code-core` (workspace crate, `crates/claude-code-core/`) — Claude CLI wrapper with stream-JSON parser and process runner
- `serde` 1 + `serde_json` 1 — serialization for IPC payloads
- `sqlx` 0.8 — SQLite queries for projects, saved_messages, pipeline_tasks tables
- `arboard` 3 — clipboard access for image paste (`src-tauri/src/commands/clipboard.rs`)
- `image` 0.25 (png feature) — PNG encoding for clipboard images
- `chrono` 0.4 — timestamp utilities
- `dirs` 6 — platform home dir / app-data paths
- `tracing` 0.1 — structured logging in `claude-code-core`

**UNI Framework (Rust — vendored workspace path-dependencies in `crates/uni-*`):**
- `uni-common` — shared utilities: `generate_id()`, `now_unix_secs()`, `UniError`
- `uni-settings` — `JsonSettingsStore` / `SettingsStore` trait; persists `settings.json`
- `uni-ssh` — `SshTunnelManager`, `SshConfig`, `SshEvent`, `PortForwardConfig`
- `uni-terminal` — `TerminalManager`, `TerminalConfig`, `TerminalEvent` (PTY sessions)
- `uni-db` — `DbConfig`, `Migration`, `create_pool()`, `run_migrations()`
- `uni-process` — `ManagedProcess`, `ProcessConfig`, `ProcessEvent` (subprocess management)

## Configuration

**Environment:**
- No `.env` file present; no `TAURI_*` secrets required at runtime
- Dev identifier override via inline env: `TAURI_CONFIG={"identifier":"com.uni.uni-claude-code-dev"}` (in `package.json` dev script) — separates dev AppData from prod
- Frontend picks up `TAURI_DEV_HOST` env var for remote dev (HMR on port 1421)

**Runtime settings file:**
- Persisted at `<AppData>/settings.json` by `uni-settings` (`JsonSettingsStore`)
- Keys include: `claude.path`, `claude.model`, `httpProxy`, `ssh.*`, `ui.maxOpenProjects`

**Build:**
- Tauri app config: `src-tauri/tauri.conf.json` — identifier `com.uni.uni-claude-code`, product name "Code Architect", window 1200×800
- TypeScript config: `tsconfig.json` — strict mode, ES2020 target, bundler module resolution, `vitest/globals` types injected
- Vite config: `vite.config.ts` — port 1420, `**/src-tauri/**` excluded from file watcher
- Vitest config: `vitest.config.ts` — jsdom environment, globals, setup file `src/__tests__/setup.ts`
- `@uni-fw/*` packages resolved as npm workspaces (no `.npmrc` required — package source is `packages/uni-fw-*` inside repo)

## Platform Requirements

**Development:**
- Node.js (npm) for frontend tooling
- Rust toolchain (cargo) for backend compilation
- Tauri prerequisites per platform (WebView2 on Windows, webkit2gtk on Linux)
- `claude` CLI installed and on PATH (Claude Code CLI by Anthropic) — required at runtime for AI sessions and MCP management

**Production:**
- Single bundled desktop executable (Tauri `bundle.targets = "all"`)
- SQLite database and settings JSON stored in OS-specific AppData directory
- SSH known_hosts file stored alongside app data: `<AppData>/ssh_known_hosts`

---

*Stack analysis: 2026-05-16*
