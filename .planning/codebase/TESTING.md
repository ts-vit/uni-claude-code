# Testing Patterns

**Analysis Date:** 2026-05-16

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `vitest.config.ts` (project root)
- Environment: `jsdom`
- Globals: enabled (no need to import `describe`/`it`/`expect` explicitly, but tests import them anyway)
- Setup file: `src/__tests__/setup.ts`

**Assertion Library:**
- `@testing-library/jest-dom` (via `@testing-library/jest-dom/vitest`) — DOM matchers like `toBeInTheDocument()`, `toBeDisabled()`
- Vitest built-ins — `toEqual`, `toHaveBeenCalledWith`, `toHaveBeenCalledTimes`, etc.

**React rendering:**
- `@testing-library/react` 16.x — `render`, `screen`, `fireEvent`, `act`, `waitFor`

**Run Commands:**
```bash
npm run test           # vitest run (single pass, CI mode)
npm run test:watch     # vitest (interactive watch mode)
npm run test:rust      # cargo test --workspace
npm run test:all       # npm run typecheck && npm run test && npm run test:rust
```

## Vitest Configuration

Full config at `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/__tests__/setup.ts"],
  },
});
```

No coverage thresholds or reporters configured. No path aliases configured (none exist in the project).

## Test File Organization

**Location:** All tests live in `src/__tests__/` (centralized, not co-located).

**Naming:** `ComponentName.test.tsx` or `utilityName.test.tsx` — mirrors the source file name:
- `src/components/chat/ChatPanel.tsx` → `src/__tests__/ChatPanel.test.tsx`
- `src/utils/safeListener.ts` → `src/__tests__/safeListener.test.tsx`
- `src/App.tsx` → `src/__tests__/App.test.tsx`

**Test file list:**
```
src/__tests__/
  setup.ts                  # Global mock setup (not a test file)
  App.test.tsx
  ChatPanel.test.tsx
  ClaudeMdEditor.test.tsx
  DiffViewer.test.tsx
  DualPanelLayout.test.tsx
  FileTreePanel.test.tsx
  HistoryPage.test.tsx
  McpServersPage.test.tsx
  MessageItem.test.tsx
  MessageList.test.tsx
  PipelinePage.test.tsx
  ProjectSidebar.test.tsx
  PromptInput.test.tsx
  safeListener.test.tsx
  SettingsPage.test.tsx
  SshStatusIndicator.test.tsx
  StatusBar.test.tsx
  ToolUseBlock.test.tsx
  WelcomeScreen.test.tsx
```

## Global Mock Setup (`src/__tests__/setup.ts`)

The setup file runs before every test file and establishes the following global mocks:

**Browser API polyfills** (jsdom limitations):
```typescript
// ResizeObserver — needed by Mantine ScrollArea and SegmentedControl
class ResizeObserverMock {
  observe() {} unobserve() {} disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverMock });

// matchMedia — needed by Mantine theme detection
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

**Tauri API mocks:**
```typescript
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));
```

**Mantine notifications mock:**
```typescript
vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));
```

**i18n mock** — `useTranslation` returns the translation key as-is (pass-through), enabling tests to assert on key strings:
```typescript
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return Object.entries(params).reduce(
          (str, [k, v]) => str.replace(`{{${k}}}`, String(v)), key
        );
      }
      return key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));
```

**UNI framework mocks:**
```typescript
vi.mock("@uni-fw/terminal-ui", () => ({ TerminalPanel: () => null }));
vi.mock("@uni-fw/ui", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => content,
  useSettings: vi.fn(() => ({ value: "", set: vi.fn() })),
  UniProvider: ({ children }: { children: React.ReactNode }) => children,
  ConfirmModal: ({ opened, title, message }) => opened ? `${title}: ${message}` : null,
}));
```

## Test Structure

**Suite organization pattern:**
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { ComponentName } from "../components/ComponentName";

// File-level mocks for this test's specific dependencies
vi.mock("@some/dependency", () => ({ ... }));

// Typed mock reference for IntelliSense
const mockedInvoke = vi.mocked(invoke);

// Render helper wrapping in MantineProvider
function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("ComponentName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInvoke.mockResolvedValue("idle"); // default stub
  });

  it("describes expected behavior", () => { ... });
  it("handles edge case", async () => { ... });
});
```

**Always wrap in `MantineProvider`** — Mantine components crash without it. The shared helper function `renderWithMantine` is duplicated in every test file (no shared test utilities file).

**`beforeEach(() => { vi.clearAllMocks(); })`** is standard in every test suite to reset mock state between tests.

## Mocking Patterns

**Typed mock references** — use `vi.mocked()` for type-safe mock access:
```typescript
const mockedInvoke = vi.mocked(invoke);
const mockedListen = vi.mocked(listen);
// ...
mockedInvoke.mockResolvedValue("idle");
mockedListen.mockImplementation((_name, handler) => {
  capturedCallback = handler;
  return Promise.resolve(() => {});
});
```

**File-level `vi.mock()` for per-test dependencies** that aren't in global setup:
```typescript
// ChatPanel.test.tsx — mocks virtualizer which isn't needed globally
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, start: index * 80 })),
    getTotalSize: () => count * 80,
    measureElement: vi.fn(),
    scrollToIndex: vi.fn(),
  }),
}));
```

**Component mocks for isolation** — when testing a parent, mock heavyweight children:
```typescript
// App.test.tsx — mock all heavy children as minimal stubs
vi.mock("../components/DualPanelLayout", () => ({
  DualPanelLayout: ({ projectId }) => <div>{`dual-panel-${projectId}`}</div>,
}));
vi.mock("../components/SettingsPage", () => ({ SettingsPage: () => <div>settings</div> }));
```

**Custom invoke routing** — for components that call multiple commands, use a switch handler:
```typescript
function mockInvokeHandler(cmd: string, _args?: Record<string, unknown>) {
  switch (cmd) {
    case "project_list": return Promise.resolve(testProjects);
    case "pipeline_task_counts": return Promise.resolve(testTaskCounts);
    default: return Promise.resolve([]);
  }
}
mockedInvoke.mockImplementation(mockInvokeHandler as typeof invoke);
```

**Spy on module exports** to test memoization:
```typescript
const markdownSpy = vi.spyOn(UniUi, "MarkdownRenderer");
// ...render twice with same props...
expect(markdownSpy).toHaveBeenCalledTimes(1); // memo prevented second render
```

**`useSettings` mock** — override per test via `vi.mocked(useSettings).mockReturnValue(...)`:
```typescript
vi.mocked(useSettings).mockReturnValue({
  value: "3",
  loading: false,
  set: vi.fn(),
  delete: vi.fn(),
  refresh: vi.fn(),
});
```

## Async Testing

**`waitFor`** for DOM updates from async state changes:
```typescript
await waitFor(() => {
  expect(screen.getByText("dual-panel-p1")).toBeInTheDocument();
});
```

**`vi.waitFor`** for mock call assertions:
```typescript
await vi.waitFor(() => {
  expect(capturedCallback).not.toBeNull();
});
```

**`act()`** for batching multiple synchronous event dispatches:
```typescript
act(() => {
  capturedCallback!({ payload: { panel_id: "code", event: { ... } } });
  capturedCallback!({ payload: { panel_id: "code", event: { ... } } });
});

await vi.waitFor(() => {
  expect(screen.getByText("Hello world")).toBeInTheDocument();
});
```

**Async event listener capture** — capture the listener handler before firing events:
```typescript
let capturedCallback: ((event: { payload: PanelEvent }) => void) | null = null;
mockedListen.mockImplementation((_eventName, handler) => {
  capturedCallback = handler as typeof capturedCallback;
  return Promise.resolve(() => {});
});
renderWithMantine(<ChatPanel panelId="code" cwd="D:\\test" />);
await vi.waitFor(() => { expect(capturedCallback).not.toBeNull(); });
capturedCallback!({ payload: { ... } });
```

## Race Condition Testing

The `useTauriListener` utility's race condition protection (unmount before `listen()` resolves) is explicitly tested in `src/__tests__/safeListener.test.tsx`:
```typescript
it("cleanup race condition", async () => {
  let resolveListen: undefined | ((value: () => void) => void);
  mockedListen.mockImplementation(() => new Promise((resolve) => { resolveListen = resolve; }));

  const { unmount } = render(<TestListener />);
  unmount(); // unmount BEFORE listen resolves

  resolveListen!(unlisten); // now resolve

  await waitFor(() => {
    expect(unlisten).toHaveBeenCalledTimes(1); // must still be called
  });
});
```

## Cleanup Testing

Always verify event listener cleanup on unmount:
```typescript
it("removes listener on unmount", async () => {
  const unlisten = vi.fn();
  mockedListen.mockResolvedValue(unlisten);
  const { unmount } = renderWithMantine(<ChatPanel panelId="code" cwd="D:\\test" />);
  await vi.waitFor(() => {
    expect(mockedListen).toHaveBeenCalledWith("claude-event", expect.any(Function));
  });
  unmount();
  await vi.waitFor(() => {
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
```

## Rust Tests

**Location:** Inline `#[cfg(test)]` modules at the bottom of each source file.

**Files with test blocks:**
- `crates/claude-code-core/src/parser.rs` — unit tests for JSON event parsing
- `crates/claude-code-core/src/session.rs` — unit tests for CLI argument building
- `src-tauri/src/commands/projects.rs` — serde serialization test
- `src-tauri/src/commands/clipboard.rs` — utility function test
- `src-tauri/src/commands/files.rs` — file tree/diff helpers
- `src-tauri/src/commands/history.rs` — serialization/query tests
- `src-tauri/src/commands/mcp.rs` — MCP config parsing tests

**Rust test pattern:**
```rust
#[cfg(test)]
mod tests {
    use super::*;  // always import parent module

    #[test]
    fn test_discuss_mode_disallows_write_tools() {
        let config = SessionConfig::new(SessionMode::Discuss, "/tmp/test");
        let args = config.build_args();
        assert!(args.contains(&"--disallowed-tools".to_string()));
        assert!(args.contains(&"Write,Edit,Bash,NotebookEdit".to_string()));
    }
}
```

**Rust test style:**
- Use `assert!`, `assert_eq!` — no third-party assertion libraries
- Pattern match on enums with `match` + `panic!("Expected X")` for wrong variants
- Tests are synchronous (no `#[tokio::test]`) — all test functions use pure in-memory logic, not async Tauri state

**Rust test run:**
```bash
cargo test --workspace          # all crates
cargo test -p claude-code-core  # specific crate
```

## Test Data

**Inline test fixtures** — test data is defined directly in each test file as `const` arrays of typed objects:
```typescript
const testProjects = [
  { id: "p1", name: "Project One", cwd: "/project-one", model: null,
    permissionMode: "bypass", createdAt: 1000, updatedAt: 1000 },
];
const testTasks = [
  { id: "1", projectId: "p1", title: "Task One", description: "desc",
    prompt: null, status: "draft", sortOrder: 0, ... },
];
```

No shared fixtures directory or factory utilities. Data matches the TypeScript types defined in `src/types/claude.ts`.

## Coverage

No coverage thresholds configured. No coverage reporters in `vitest.config.ts`. Run manually with:
```bash
npx vitest run --coverage
```

## What Is and Is Not Tested

**Tested:**
- Component render output and conditional rendering (streaming cursor, buttons by state)
- Tauri IPC call arguments and event handling
- Event listener lifecycle (attach on mount, detach on unmount, race condition)
- Business logic in pure functions (Rust: CLI arg building, serde serialization, JSON parsing)
- Message memory limits and buffer cleanup
- Panel event filtering by `panelId`

**Not tested:**
- End-to-end Tauri IPC flows (no real backend in tests)
- Database queries (SQLite commands have no integration test environment)
- SSH tunnel behavior
- Terminal PTY sessions
- Pipeline controller orchestration (mocked in `PipelinePage.test.tsx`)
- File system operations in `files.rs` (git commands, file reads)

---

*Testing analysis: 2026-05-16*
