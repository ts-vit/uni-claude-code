# Codebase Concerns

**Analysis Date:** 2026-05-16

## Security Considerations

**SSH password stored in plaintext settings JSON:**
- Risk: SSH password is stored as a plain string in the app's `settings.json` file via `JsonSettingsStore` (key `ssh.password`). Anyone with filesystem access to `%APPDATA%\com.uni.uni-claude-code\settings.json` can read it.
- Files: `src-tauri/src/lib.rs:199` (reads `ssh.password`), `src-tauri/src/commands/ssh_tunnel.rs:13` (passes to `SshConfig`)
- Current mitigation: None — the `uni-settings` store is a raw JSON file on disk.
- Recommendations: Use OS keychain (Windows Credential Manager via `keyring` crate) for sensitive SSH credentials instead of flat JSON.

**Content Security Policy explicitly disabled:**
- Risk: `"csp": null` in `src-tauri/tauri.conf.json:23` disables the Tauri CSP for the webview entirely. If any dependency renders unsanitized user or Claude-provided HTML/JS, XSS is possible within the webview context.
- Files: `src-tauri/tauri.conf.json:22-24`
- Current mitigation: None.
- Recommendations: Enable a restrictive CSP (`"csp": "default-src 'self'; script-src 'self'"`) and add nonce-based inline script support only where required.

**No path traversal validation on `file_read` and `file_write` IPC commands:**
- Risk: The `file_read` (`src-tauri/src/commands/files.rs:179-182`) and `file_write` (`src-tauri/src/commands/files.rs:310-320`) commands construct a full path as `Path::new(&cwd).join(&file_path)` with no check that the resolved path stays inside `cwd`. A `file_path` value of `../../etc/passwd` or similar escapes the project directory. There is no call to `canonicalize()` followed by a `starts_with(cwd)` guard.
- Files: `src-tauri/src/commands/files.rs:179-182`, `src-tauri/src/commands/files.rs:310-320`, `src-tauri/src/commands/files.rs:467`
- Current mitigation: None at the Rust layer. Callers on the frontend use project-scoped paths, but this is not enforced server-side.
- Recommendations: After `Path::new(&cwd).join(&file_path)`, call `.canonicalize()` and verify the result starts with the canonicalized `cwd` before proceeding.

**`history_export_to_file` writes to an arbitrary filesystem path:**
- Risk: `src-tauri/src/commands/history.rs:137-145` accepts a `file_path: String` argument and writes directly to it with no restriction. The frontend uses a save dialog (`src/components/HistoryPage.tsx:59`), but nothing prevents a crafted IPC call from writing to any path (e.g., startup scripts, SSH config).
- Files: `src-tauri/src/commands/history.rs:137-145`
- Current mitigation: Save dialog provides user intent signal but no enforcement.
- Recommendations: Either restrict the destination to a known safe directory, or document this as an intentional power-user feature and accept the risk.

**`mcp_add`/`mcp_remove` pass user-supplied `name`, `scope`, `cwd` directly as CLI arguments to `claude` process:**
- Risk: `src-tauri/src/commands/mcp.rs:350-358` and `src-tauri/src/commands/mcp.rs:369-384` call `Command::new("claude")` with args built via `build_add_args`. The `name` and `scope` fields come directly from frontend input. While `Command::args()` avoids shell injection (no shell is invoked), a maliciously crafted `name` containing `--scope`, `--transport`, etc. could inject unexpected CLI flags into the `claude` invocation.
- Files: `src-tauri/src/commands/mcp.rs:133-172`, `src-tauri/src/commands/mcp.rs:337-385`
- Current mitigation: Args are passed as a Vec (no shell expansion). The `--` separator protects the command/args in stdio mode.
- Recommendations: Validate `name` against an allowlist pattern (alphanumeric + hyphens/dots), validate `scope` as one of `{"local","user","project"}`, reject values that start with `-`.

**`claude.path` setting accepts an arbitrary executable path with no validation:**
- Risk: `src-tauri/src/commands/claude.rs:63-67` reads `claude.path` from settings and uses it directly as the process binary path. If an attacker can write to the settings file, they can redirect the Claude CLI invocation to any executable on the system.
- Files: `src-tauri/src/commands/claude.rs:60-68`, `crates/claude-code-core/src/runner.rs:33`
- Current mitigation: None — the path is used without any checks.
- Recommendations: Low priority for a desktop app (settings file is user-controlled), but worth documenting.

**SSH `known_hosts` validation is opaque (delegated to `uni-ssh`):**
- Risk: The known-hosts file is stored at `app_data_dir/ssh_known_hosts` (`src-tauri/src/commands/ssh_tunnel.rs:34`). Whether host key verification is enforced (strict vs. tofu) is entirely inside the private `uni-ssh` crate whose source is not in this repo. There is a `ssh_remove_known_host` command (`src-tauri/src/commands/ssh_tunnel.rs:52-57`) and an `ssh-host-key-changed` event (`src-tauri/src/lib.rs:124-126`) but the enforcement policy cannot be audited locally.
- Files: `src-tauri/src/commands/ssh_tunnel.rs:27-37`, `src-tauri/src/lib.rs:124-126`
- Current mitigation: Custom known-hosts file and a host-key-changed event exist, implying some level of TOFU enforcement.
- Recommendations: Request source access or changelog for `uni-ssh` to confirm strict host-key pinning. Until then, treat SSH MITM resistance as unverified.

---

## Supply Chain Risk

**Private npm registry (`npm.ts-vit.com`) is a single point of failure:**
- Risk: Three production dependencies — `@uni-fw/ssh-ui@0.1.2`, `@uni-fw/terminal-ui@0.1.5`, `@uni-fw/ui@0.1.1` — and three transitive deps (`@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`) resolve exclusively from `https://npm.ts-vit.com`. If that registry goes offline, `npm ci` on a fresh machine fails completely. The registry is configured in `.npmrc` with no fallback.
- Files: `.npmrc`, `package-lock.json:2058,2077,2097`
- Impact: Breaks CI, new developer onboarding, and production builds. No offline fallback exists.
- Fix approach: Mirror packages to a secondary registry or commit tarballs to the repo. Add `registry=https://registry.npmjs.org` as a fallback for the `@xterm` scope since those appear to be re-published public packages.

**Private git repo (`github.com/ts-vit/ai-chat` branch `dev`) for five Rust crates:**
- Risk: Five production Rust crates — `uni-common`, `uni-settings`, `uni-ssh`, `uni-terminal`, `uni-db` — and two more via transitive — `uni-process`, `uni-settings` — come from the mutable `dev` branch of a private GitHub repo. `Cargo.lock` pins them to commit `862d4ad85777f430731530cea761c039bc152119`, but `cargo update` would pull whatever `dev` points to at that moment.
- Files: `src-tauri/Cargo.toml:22-29`, `crates/claude-code-core/Cargo.toml:9-10`, `Cargo.lock`
- Impact: Unreviewed upstream changes can silently enter the build after `cargo update`. Source of core SSH, terminal, and settings logic is not locally auditable.
- Fix approach: Pin to specific git tags or SHA revisions in `Cargo.toml` (not just branch). Consider vendoring with `cargo vendor`.

**No integrity enforcement for private npm packages at build time:**
- Risk: While `package-lock.json` contains `integrity` (sha512) hashes for `@uni-fw/*` packages (`package-lock.json:2058-2097`), if the private registry serves a different tarball with the same version number the lock hash would catch it — but only if `npm ci` is used (not `npm install`).
- Files: `package-lock.json`
- Current mitigation: `package-lock.json` exists and has integrity hashes.
- Recommendations: Enforce `npm ci` in all build scripts and CI. Document this requirement.

---

## Tech Debt

**Module-level mutable `tabCounter` persists across hot-reloads:**
- Issue: `let tabCounter = 0` at module scope in `src/components/DualPanelLayout.tsx:33` is a mutable module-level variable. In Vite HMR it does not reset between hot reloads, causing tab IDs like `discuss-15` after only 3 UI sessions. On app restart it correctly resets to 0.
- Files: `src/components/DualPanelLayout.tsx:33-36`
- Impact: Tab ID collisions after many hot-reload cycles in development; could cause event routing bugs if two tabs share an ID prefix.
- Fix approach: Replace with a `useRef`-based counter inside the component, or use a UUID generator.

**Module-level `projectLayoutState` Map never garbage-collects deleted projects:**
- Issue: `const projectLayoutState = new Map<string, DualPanelLayoutState>()` at module scope in `src/App.tsx:31` accumulates layout state for every project ever opened in the current session. Projects deleted via `project_delete` are never removed from this map.
- Files: `src/App.tsx:31`, `src/App.tsx:288-290`
- Impact: Minor memory leak for long-running sessions with many projects; stale layout state can be applied if a project ID is reused (unlikely with UUID IDs).
- Fix approach: Call `projectLayoutState.delete(id)` when a project is deleted or closed.

**`pipeline_task_reorder` runs N independent UPDATE queries with no transaction:**
- Issue: `src-tauri/src/commands/pipeline.rs:169-184` iterates over task IDs and issues one `UPDATE` per task. If the process crashes mid-way, the `sort_order` column is left in a partially-updated inconsistent state.
- Files: `src-tauri/src/commands/pipeline.rs:169-184`
- Impact: Pipeline task ordering corruption on crash during a reorder operation.
- Fix approach: Wrap the loop in a SQLx transaction (`pool.begin()` / `tx.commit()`).

**`ProcessEvent::Error` is silently discarded in `ClaudeCodeRunner::next_event`:**
- Issue: `crates/claude-code-core/src/runner.rs:87-90` matches `ProcessEvent::Error(_)` and does nothing — no log, no event emitted to the frontend, no error propagation. Process spawn errors from the `uni-process` layer disappear silently.
- Files: `crates/claude-code-core/src/runner.rs:87-90`
- Impact: If the Claude CLI fails to spawn (wrong path, permissions, etc.), the UI hangs waiting for events that never arrive rather than showing an error.
- Fix approach: Return `Some(RunnerEvent::Stderr(format!("Process error: {:?}", e)))` or a dedicated `RunnerEvent::Error` variant.

**`eprintln!` used for SSH connection logging (goes to stderr, not app logs):**
- Issue: `src-tauri/src/lib.rs:237,240` uses `eprintln!` for SSH auto-connect status. In a packaged Tauri app, stderr is typically not visible to users and may not be captured anywhere.
- Files: `src-tauri/src/lib.rs:237-240`
- Impact: SSH auto-connect failures are invisible in production builds.
- Fix approach: Replace with `tracing::info!`/`tracing::error!` which integrate with Tauri's logging plugin.

**`tauri.conf.json` window title is still in Cyrillic after `productName` was fixed:**
- Issue: The `productName` was corrected to `"Code Architect"` in commit `bb7b1e6`, but `src-tauri/tauri.conf.json:15` still has `"title": "Архитектор кода"` as the window title. The fix was incomplete.
- Files: `src-tauri/tauri.conf.json:15`
- Impact: Window title bar displays Russian text in production, inconsistent with the English product name and the English i18n default locale.
- Fix approach: Change line 15 to `"title": "Code Architect"`.

**`eslint-disable-next-line react-hooks/exhaustive-deps` on critical pipeline hooks:**
- Issue: Two dependency suppression comments exist on `advanceToNext` and `executeTask` callbacks in `src/hooks/usePipelineController.ts:76,139`. This means the hooks deliberately omit dependencies from their closure arrays, using `stateRef`/`tasksRef` refs as workarounds.
- Files: `src/hooks/usePipelineController.ts:76,139`, `src/components/PipelinePage.tsx:116`
- Impact: If the ref pattern is not maintained carefully, stale closure values can cause incorrect task sequencing without any React warning.
- Fix approach: Accept the current ref-based approach (valid pattern for event handlers) but document the reasoning explicitly. Consider using `useReducer` to centralize pipeline state.

**`std::sync::Mutex` used for `TerminalManager` inside an async Tauri command handler:**
- Issue: `TerminalManager` is wrapped in `std::sync::Mutex` (`src-tauri/src/lib.rs:137`) and locked inside `async` Tauri commands (`src-tauri/src/commands/terminal.rs:63,75,87,106`). Blocking a `std::sync::Mutex` inside an async context can cause deadlocks if Tokio's executor runs on a small thread pool and all threads block simultaneously.
- Files: `src-tauri/src/commands/terminal.rs:62-108`, `src-tauri/src/lib.rs:137`
- Impact: Potential deadlock under concurrent terminal operations (low probability with the current low concurrency level, but a latent risk).
- Fix approach: Replace with `tokio::sync::Mutex` to match the pattern used for `ClaudeManager` (`src-tauri/src/commands/claude.rs:30`).

**`parse_git_status` and git commands use `std::process::Command` (blocking) in async context:**
- Issue: `src-tauri/src/commands/files.rs:26-53` uses `std::process::Command` (synchronous) for `git status`. The calling IPC command `file_tree` is `async`. Running a blocking subprocess on a Tokio async thread blocks the executor thread.
- Files: `src-tauri/src/commands/files.rs:26-53`, `src-tauri/src/commands/files.rs:185-221`, `src-tauri/src/commands/files.rs:457-461`
- Impact: Blocks the Tokio thread pool during git operations on large repos. Three commands are affected: `file_tree`, `git_branch_info`, `file_diff`.
- Fix approach: Wrap git subprocess calls in `tokio::task::spawn_blocking`, or switch to `tokio::process::Command` (which is already used in `mcp.rs`).

---

## Known Bugs

**`tauri.conf.json` window title regression (Cyrillic remains):**
- Symptoms: Application window displays "Архитектор кода" as title bar text.
- Files: `src-tauri/tauri.conf.json:15`
- Trigger: Always reproducible on launch.
- Workaround: None visible to end user.

---

## Performance Hotspots

**`claude-event` is broadcast to ALL webview listeners, not scoped per panel:**
- Problem: `src-tauri/src/commands/claude.rs:141` calls `app.emit("claude-event", &panel_event)`, which delivers to every event listener in the webview. All `ChatPanel` instances, `DualPanelLayout`, `usePipelineController`, and `useTauriListener` hooks each receive every event from every panel and must filter by `panel_id` in JavaScript. At high Claude streaming throughput (many `content_block_delta` events per second) this creates fan-out overhead.
- Files: `src-tauri/src/commands/claude.rs:141`, `src/components/chat/ChatPanel.tsx:336-345`, `src/components/DualPanelLayout.tsx:124-151`, `src/hooks/usePipelineController.ts:237-283`
- Cause: Tauri's `emit` sends to all windows; `emit_to` with a target filter or per-panel event names would reduce dispatch cost.
- Improvement path: Use per-panel event channels (`claude-event-{panel_id}`) or Tauri's `emit_filter` to avoid broadcasting to unrelated listeners.

**`file_tree` performs synchronous `git status` on every call:**
- Problem: `parse_git_status` at `src-tauri/src/commands/files.rs:25-53` runs a full `git status --porcelain -u` subprocess on every `file_tree` invocation. For large repositories with many untracked files, this is slow and blocks the Tokio thread.
- Files: `src-tauri/src/commands/files.rs:25-53`, `src-tauri/src/commands/files.rs:161-176`
- Cause: No caching or debouncing; the result is freshly computed on every call.
- Improvement path: Cache the git status with a TTL (e.g., 500ms) or use a filesystem watcher to invalidate only on change.

**`archivedMessagesRef` in `ChatPanel` grows unboundedly for long sessions:**
- Problem: `src/components/chat/ChatPanel.tsx:69-74` moves messages into `archivedMessagesRef.current` when the live array exceeds `MAX_MESSAGES_IN_MEMORY` (200). The archive array has no upper bound and accumulates indefinitely for very long sessions.
- Files: `src/components/chat/ChatPanel.tsx:52`, `src/components/chat/ChatPanel.tsx:69-74`
- Cause: `applyMemoryLimit` slices the visible list but does not cap the archive.
- Improvement path: Cap `archivedMessagesRef.current` at a fixed size (e.g., 2000 messages) and discard oldest entries.

---

## Fragile Areas

**Pipeline orchestration relies on React closure refs for cross-phase state:**
- Files: `src/hooks/usePipelineController.ts`
- Why fragile: `discussResponseRef`, `codeResultRef`, `stateRef`, `tasksRef`, and `pauseRequestedRef` are all mutable refs shared across async callbacks (`handleDiscussComplete`, `handleCodeComplete`, `advanceToNext`, `executeTask`). The `eslint-disable` suppressions on dependency arrays mean React's rules-of-hooks guarantees do not apply. A race between `handleDiscussComplete` finishing and a user-triggered `stop()` can leave `currentTaskId` inconsistent with the actual running panels.
- Safe modification: Always pair ref mutations with `setState` updates. Add an explicit pipeline state machine (e.g., `useReducer`) rather than mutating refs directly.
- Test coverage: `PipelinePage.test.tsx` exists but tests only render behavior, not the async state machine transitions.

**`ClaudeCodeRunner` accumulates unbounded stdout/stderr buffers:**
- Files: `crates/claude-code-core/src/runner.rs:23-24`
- Why fragile: `stdout_buffer` and `stderr_buffer` grow until a newline is received. For malformed Claude CLI output (no newline before EOF), the buffer holds the entire output without flushing. A very large assistant response with no intermediate newlines would accumulate entirely in memory.
- Safe modification: Add a max buffer size (e.g., 4MB) with a forced flush/error when exceeded.
- Test coverage: Parser tests (`crates/claude-code-core/src/parser.rs`) do not test oversized or newline-free input.

**`dev` script uses `set TAURI_CONFIG=...` which is Windows cmd.exe syntax only:**
- Files: `package.json:7`
- Why fragile: `"dev": "set TAURI_CONFIG={\"identifier\":\"com.uni.uni-claude-code-dev\"} && tauri dev"` uses Windows `set` command syntax and `&&` chaining. This fails on PowerShell (requires `$env:`) and completely fails on macOS/Linux.
- Safe modification: Use `cross-env` npm package or a `.env`-based approach so the script is platform-portable.
- Test coverage: No CI enforcing cross-platform behavior.

---

## Scaling Limits

**SQLite with no connection pool tuning:**
- Current capacity: Single SQLite file at `app_data_dir/uni-claude-code.db`. `create_pool` from `uni-db` is used with default settings.
- Limit: SQLite write-lock contention if multiple IPC commands write simultaneously (pipeline updates + history saves during an active pipeline run).
- Scaling path: Enable WAL mode (`PRAGMA journal_mode=WAL`) for concurrent reads. The `uni-db` configuration options are not visible locally (private crate).

**Maximum 5 session tabs is hardcoded:**
- Current capacity: `MAX_TABS_PER_PANEL = 5` in `src/components/DualPanelLayout.tsx:32`.
- Limit: Users are silently blocked from adding a 6th tab with no settings override available.
- Scaling path: Expose as a user setting via `ui.maxSessionTabs`.

---

## Test Coverage Gaps

**Pipeline state machine transitions are not tested:**
- What's not tested: The async flow in `usePipelineController.ts` — discuss phase → extract prompt → code phase → advance to next task — has no dedicated unit tests. `PipelinePage.test.tsx` only tests rendering, not the hook behavior.
- Files: `src/hooks/usePipelineController.ts`, `src/__tests__/PipelinePage.test.tsx`
- Risk: Regressions in task sequencing, pause/resume behavior, or error recovery go undetected.
- Priority: High

**`file_read` and `file_write` path traversal prevention is not tested:**
- What's not tested: No test verifies that `../` sequences in `file_path` are rejected.
- Files: `src-tauri/src/commands/files.rs:179-182`, `src-tauri/src/commands/files.rs:310-320`
- Risk: Path traversal vulnerability introduced or regressed silently.
- Priority: High (security)

**SSH command handler tests are absent:**
- What's not tested: `ssh_tunnel_connect`, `ssh_tunnel_disconnect`, `ssh_remove_known_host` have no Rust unit tests.
- Files: `src-tauri/src/commands/ssh_tunnel.rs`
- Risk: SSH config construction regressions (wrong known_hosts path, wrong port_forward config) go undetected.
- Priority: Medium

**`mcp_remove` argument injection is not tested:**
- What's not tested: No test verifies that a `name` value containing `--scope` or `-s` does not inject extra flags.
- Files: `src-tauri/src/commands/mcp.rs:369-384`
- Risk: Argument injection bug introduced during future refactoring.
- Priority: Medium

---

*Concerns audit: 2026-05-16*
