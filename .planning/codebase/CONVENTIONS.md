# Coding Conventions

**Analysis Date:** 2026-05-16

## TypeScript Strictness

`tsconfig.json` enables the strictest mode:
- `"strict": true` — full strict mode (strictNullChecks, noImplicitAny, etc.)
- `"noUnusedLocals": true`
- `"noUnusedParameters": true`
- `"noFallthroughCasesInSwitch": true`
- `"noUncheckedSideEffectImports": true`
- `"isolatedModules": true`
- Target: `ES2020`, module resolution: `bundler`

No ESLint or Prettier config found. Code style is enforced by the TypeScript compiler and Vitest linting integration only.

## Naming Patterns

**TypeScript files:**
- Component files: `PascalCase.tsx` — e.g., `ChatPanel.tsx`, `MessageItem.tsx`, `DualPanelLayout.tsx`
- Hook files: `camelCase.ts` with `use` prefix — e.g., `usePipelineController.ts`
- Utility files: `camelCase.ts` — e.g., `safeListener.ts`
- Type files: `camelCase.ts` — e.g., `claude.ts`
- Constants files: `camelCase.ts` — e.g., `pipelinePrompts.ts`
- Test files: `PascalCase.test.tsx` mirroring component name — e.g., `ChatPanel.test.tsx`

**Functions:**
- React components: `PascalCase` named exports — `export function ChatPanel(...)`
- Event handlers: `handle` prefix camelCase — `handleProjectSelect`, `handleCreate`, `handleUpdate`
- Callbacks: `on` prefix camelCase in props — `onSend`, `onStop`, `onProjectSelect`, `onCreated`
- Hook functions: `use` prefix — `useTauriListener`, `usePipelineController`
- Utility functions: camelCase descriptive verbs — `buildTree`, `parseGitStatus`, `getFileName`

**Variables:**
- State variables: camelCase noun — `[isRunning, setIsRunning]`, `[messages, setMessages]`
- Boolean state: `is`/`has` prefix — `isRunning`, `hasSessionRef`, `createModalOpened`
- Refs: `camelCase` with `Ref` suffix — `stateRef`, `pauseRequestedRef`, `rafIdRef`
- Constants (module-level): `SCREAMING_SNAKE_CASE` — `MAX_MESSAGES_IN_MEMORY`, `PIPELINE_DISCUSS_PANEL`

**TypeScript types/interfaces:**
- Interfaces: `PascalCase` with descriptive noun — `ChatMessage`, `SessionResult`, `PipelineTask`
- Props interfaces: `ComponentNameProps` — `MessageItemProps`, `ChatPanelProps`, `StatusBarProps`
- Union types: `PascalCase` type alias — `View`, `PipelineStatus`, `ChatMessage`
- Base interfaces: `Base` prefix for discriminated unions — `BaseChatMessage`

**Rust:**
- Structs: `PascalCase` — `Project`, `PipelineTask`, `ClaudeState`
- Functions: `snake_case` — `project_list`, `build_add_args`, `parse_git_status`
- Tauri commands: `snake_case` named by domain_action pattern — `project_create`, `claude_start`, `pipeline_task_list`
- Constants: `SCREAMING_SNAKE_CASE`
- Modules: `snake_case` — `commands/projects.rs`, `commands/claude.rs`

## Component Patterns

**Named exports only** — all components use named exports (no default exports):
```typescript
export function ChatPanel({ panelId = "code", mode = "code", cwd, ... }: ChatPanelProps) { ... }
export function MessageItem({ message, onSave }: MessageItemProps) { ... }
```

**Props interfaces defined inline** above component:
```typescript
interface ChatPanelProps {
  panelId?: string;
  mode?: string;
  cwd: string;
  projectId?: string;
}
```

**Memoization pattern** — use `React.memo` via `memo()` wrapper + inner function for expensive list items:
```typescript
// MessageItem.tsx: inner function + wrapped export
function MessageItemInner({ message, onSave }: MessageItemProps) { ... }
export const MessageItem = React.memo(MessageItemInner);
```

**`useMemo` for expensive renders:**
```typescript
const renderedAssistantContent = useMemo(() => {
  if (message.kind !== "assistant-text") return null;
  return <MarkdownRenderer content={message.text} />;
}, [message.kind, message.kind === "assistant-text" ? message.text : ""]);
```

**`useCallback` for stable handlers:**
```typescript
const handleSend = useCallback(() => { ... }, [value, attachments, isRunning, onSend]);
const addLog = useCallback((entry: Omit<PipelineLogEntry, "timestamp">) => { ... }, []);
```

**Mantine UI components** are used for all layout and UI primitives: `AppShell`, `Paper`, `Group`, `Stack`, `Text`, `Badge`, `ActionIcon`, `Tooltip`, `Textarea`, `Button`. Never use raw HTML elements for UI structure when a Mantine equivalent exists.

**CSS variable theming** for colors/spacing — use CSS custom properties rather than inline colors:
```typescript
bg="var(--ucc-bg-chat-user)"
style={{ borderTop: "1px solid var(--ucc-border-subtle)" }}
```

## Hook Patterns

**State + ref pattern** for values needed in callbacks without causing re-renders:
```typescript
const [state, setState] = useState<PipelineState>({ ... });
const stateRef = useRef(state);
stateRef.current = state; // always sync
```

**Tauri event subscription** — always use `useTauriListener` from `src/utils/safeListener.ts`:
```typescript
useTauriListener<PanelEvent>("claude-event", (event) => { ... }, [panelId]);
```
Never call `listen()` directly in components — it lacks race condition protection.

**Settings access** — use `useSettings(key)` from `@uni-fw/ui`:
```typescript
const maxOpenProjectsSetting = useSettings("ui.maxOpenProjects");
const maxOpenProjects = parseInt(maxOpenProjectsSetting.value ?? "3", 10) || 3;
```

**Effect cleanup** — all `useEffect` hooks that create subscriptions or timers must return a cleanup function.

## Error Handling

**Frontend pattern — try/catch with `notifications.show`:**
```typescript
try {
  await invoke("pipeline_task_create", { projectId, title, description });
  notifications.show({ message: t("pipeline.created"), color: "green" });
} catch (e) {
  notifications.show({ message: `${t("pipeline.createError")}: ${e}`, color: "red" });
}
```

**Success notifications:** `color: "green"` for success, `color: "yellow"` for warnings, `color: "red"` for errors, `color: "blue"` for info.

**Fire-and-forget invocations** — use `.catch(() => {})` for non-critical background calls:
```typescript
invoke("project_touch", { id: project.id }).catch(() => {});
```

**Rust error handling pattern** — all Tauri commands return `Result<T, String>`:
```rust
pub async fn project_list(pool: State<'_, Pool>) -> Result<Vec<Project>, String> {
    let rows = sqlx::query("SELECT ...")
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows.iter().map(|row| Project { ... }).collect())
}
```

**Rust uses `.map_err(|e| e.to_string())?`** consistently to convert library errors into `String` for IPC serialization. No `anyhow` or `thiserror` in the Tauri crate — plain `String` errors propagated directly to frontend.

**Non-fatal Rust errors** — use `eprintln!` for startup/background errors:
```rust
Err(e) => {
    eprintln!("SSH auto-connect: failed to connect to {}:{}: {}", host, port, e);
}
```

## State Management

**No global state library** — all state is local React `useState`/`useRef`. Module-level `Map` used for cross-render persistence:
```typescript
// App.tsx — persists layout state across project switches
const projectLayoutState = new Map<string, DualPanelLayoutState>();
```

**State lifting** — state is owned at the highest component that needs it, passed down via props and callbacks.

**Functional state updates** — always use updater form when next state depends on previous:
```typescript
setMessages((prev) => applyMemoryLimit(updater(prev)));
setState((prev) => ({ ...prev, log: [...prev.log, logEntry].slice(-MAX_PIPELINE_LOG_ENTRIES) }));
```

## i18n Usage

**All user-visible strings must go through `useTranslation`:**
```typescript
const { t } = useTranslation();
// ...
<Text>{t("chat.idle")}</Text>
<Badge>{t("history.save")}</Badge>
notifications.show({ message: t("pipeline.completed"), color: "green" });
```

**Translation key convention:** `domain.key` or `domain.sub.key` — e.g., `"settings.nav.general"`, `"chat.placeholder"`, `"pipeline.createError"`.

**Locale files:** `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`. Keys must exist in both files.

**i18n is initialized once** in `src/i18n/i18n.ts` and imported by `src/main.tsx`. Components access it only via `useTranslation()` hook.

**Interpolation syntax:** `{{key}}` in locale strings — e.g., `"connectSuccess": "Connected via port {{port}}"`. Passed as second argument: `t("key", { port: 1234 })`.

**In tests:** `useTranslation` is mocked to return the key itself (pass-through), so test assertions use the translation key string: `expect(screen.getByText("history.save")).toBeInTheDocument()`.

## Import Organization

**Order (TypeScript):**
1. React and React hooks — `import { useState, useEffect } from "react"`
2. Mantine UI — `import { Group, Text, Badge } from "@mantine/core"`
3. Tabler icons — `import { IconSend } from "@tabler/icons-react"`
4. Tauri APIs — `import { invoke } from "@tauri-apps/api/core"`
5. i18next — `import { useTranslation } from "react-i18next"`
6. Internal types (type-only imports) — `import type { ChatMessage } from "../../types/claude"`
7. Internal components — `import { MessageList } from "./MessageList"`
8. Internal utilities — `import { useTauriListener } from "../../utils/safeListener"`

**Path style:** relative paths with no aliases. Deep imports use `../../` traversal.

## Rust Serde Conventions

**All serialized structs use `#[serde(rename_all = "camelCase")]`** to match TypeScript conventions:
```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub permission_mode: String,  // → "permissionMode" in JSON
    pub created_at: i64,          // → "createdAt" in JSON
}
```

**Optional fields use `Option<T>`** — serialized as `null` in JSON, typed as `T | null` in TypeScript.

## Module Design

**Rust commands** — one file per domain in `src-tauri/src/commands/`: `projects.rs`, `claude.rs`, `history.rs`, `pipeline.rs`, `files.rs`, `mcp.rs`, `terminal.rs`, `ssh_tunnel.rs`, `clipboard.rs`, `uni_settings.rs`. All registered in `src-tauri/src/lib.rs` via `tauri::generate_handler![]`.

**Frontend components** — flat `src/components/` directory with a `chat/` subdirectory for chat-specific components. No deep nesting.

**Shared types** — all TypeScript types live in `src/types/claude.ts`. No per-component type files.

---

*Convention analysis: 2026-05-16*
