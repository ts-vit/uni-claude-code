# Phase 5: Chat Visibility & Controls — Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 7 (2 production refactors + 1 type extension + 2 locale files + 2 test extensions)
**Analogs found:** 7 / 7 (один analog — Mantine `CopyButton` — отсутствует в codebase, для него зафиксирован «new pattern» с конкретным контрактом)

Все правки строго frontend. Backend (`crates/claude-code-core`, `src-tauri/`) и публичные API `@uni-fw/*` НЕ трогаем — это инвариант v1.0 (см. CONTEXT.md `<domain>`).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/chat/StatusBar.tsx` | component (presentational) | request-response (props → render) | сам себя (расширение existing) + `MessageItem.tsx:45-65` для Tooltip/ActionIcon | exact (self-extension) |
| `src/components/chat/ChatPanel.tsx` | component (stateful container) | event-driven (Tauri `claude-event` → state) | сам себя (`handleClaudeEvent` `system`/`assistant`/`result` cases) | exact (self-extension) |
| `src/types/claude.ts` | type definitions | n/a | existing `SessionResult` interface (lines 257-263) | exact |
| `src/i18n/locales/en.json` | config / i18n | n/a | existing `chat.*` namespace (lines 276-299) | exact |
| `src/i18n/locales/ru.json` | config / i18n | n/a | existing `chat.*` namespace (lines 276-299) | exact |
| `src/__tests__/StatusBar.test.tsx` | test (unit, presentational) | request-response | сам себя (`renderBar` helper, lines 7-13) | exact (self-extension) |
| `src/__tests__/ChatPanel.test.tsx` | test (unit, event-driven) | event-driven | сам себя (`capturedCallback` pattern lines 58-111) + `PromptInput.test.tsx` для disabled-button | exact (self-extension) |

---

## Pattern Assignments

### `src/components/chat/StatusBar.tsx` (component, presentational)

**Analog:** сам себя (расширение existing) + `src/components/chat/MessageItem.tsx:45-65` для Tooltip-wrapped ActionIcon + `src/components/chat/PromptInput.tsx:155-165` для Tooltip-wrapped ActionIcon с `disabled`.

#### Pattern A — расширение `StatusBarProps` интерфейса (lines 5-8)

**Existing shape (что есть):**
```tsx
interface StatusBarProps {
  isRunning: boolean;
  sessionResult: SessionResult | null;
}
```

**Что добавить (per D-05-12 + Claude's Discretion `SessionMetadata`):**
```tsx
interface StatusBarProps {
  isRunning: boolean;
  sessionResult: SessionResult | null;
  // new in Phase 5:
  model: string | null;          // sessionModel ?? projectModel ?? null (resolved в caller)
  sessionId: string | null;      // полный UUID или null
  usage: Usage | null;           // импортируется из ../../types/claude
}
```

Импортный блок (line 3) расширяется до `import type { SessionResult, Usage } from "../../types/claude";`. `Usage` уже строго типизирован (`src/types/claude.ts:101-106`) — переиспользуем без модификации.

#### Pattern B — поля рендера между Badge и cost/duration/turns (lines 22-54)

Существующий layout — flat `Group gap="md"` (line 14). Новые поля встраиваются ровно в той же стилистике (`Text size="xs" c="dimmed"`), без обёртки в дополнительный Stack/Box (D-05-01: «zero-state-management Tooltip, минимальный diff»).

**Existing cost-field (lines 44-46) — образец для новых Text-полей:**
```tsx
{sessionResult.cost != null && sessionResult.cost > 0 && (
  <Text size="xs" c="dimmed">{t("chat.cost")}: ${sessionResult.cost.toFixed(4)}</Text>
)}
```

**Куда вставлять (между line 41 `</Badge>` и line 42 `{sessionResult && ...}`):**
- model field
- session_id field (prefix + CopyButton)
- ΣTokens field (Tooltip-wrapped)

Em-dash для null-значений (D-05-12): `<Text size="xs" c="dimmed">{t("chat.model")}: {model ?? "—"}</Text>`.

#### Pattern C — Tooltip-wrapped ActionIcon (для CopyButton render-prop)

**Analog в codebase:** `src/components/chat/MessageItem.tsx:45-64` (bookmark-button) — точный размер и variant, который CONTEXT.md `<code_context>` называет конвенцией.

```tsx
{!message.streaming && onSave && (
  <Tooltip label={t("history.save")} position="left">
    <ActionIcon
      variant="subtle"
      size="xs"
      onClick={onSave}
      aria-label={t("history.save")}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        opacity: 0.4,
        transition: "opacity 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; }}
    >
      <IconBookmark size={14} stroke={1.5} />
    </ActionIcon>
  </Tooltip>
)}
```

**Что копировать для CopyButton в StatusBar:**
- `<Tooltip label={...}>` обёртка
- `ActionIcon variant="subtle" size="xs"`
- `aria-label={t("chat.copySessionId")}` (i18n key per D-05 Claude's Discretion)
- иконка `size={14} stroke={1.5}` (`IconCopy` / `IconCheck` switching via CopyButton render-prop)

**Что НЕ копировать:**
- absolute positioning + opacity hover-эффект (это специфика bookmark-кнопки в `Paper`-карточке assistant-message; в StatusBar кнопка inline в `Group`, без `position: "absolute"` и без opacity-transition)
- `position="left"` на Tooltip → в StatusBar default `top` подходит лучше (StatusBar — bottom of panel, Tooltip должен раскрываться вверх).

#### Pattern D — Mantine CopyButton render-prop (NEW PATTERN — в codebase отсутствует)

`Grep("CopyButton")` по `src/` — нет ни одного использования. Это первый CopyButton в проекте. Рекомендуемый shape per Mantine 8 contract:

```tsx
import { CopyButton, ActionIcon, Tooltip } from "@mantine/core";
import { IconCopy, IconCheck } from "@tabler/icons-react";

<CopyButton value={sessionId} timeout={1500}>
  {({ copied, copy }) => (
    <Tooltip label={copied ? t("chat.copied") : t("chat.copySessionId")} withArrow position="top">
      <ActionIcon
        variant="subtle"
        size="xs"
        color={copied ? "teal" : "gray"}
        onClick={copy}
        aria-label={t("chat.copySessionId")}
      >
        {copied ? <IconCheck size={12} stroke={1.5} /> : <IconCopy size={12} stroke={1.5} />}
      </ActionIcon>
    </Tooltip>
  )}
</CopyButton>
```

**Anchor для планнера:** handler-stack должен быть идентичен IconBookmark (`MessageItem.tsx:45-64`) — тот же `variant="subtle" size="xs"`, тот же `aria-label` через `useTranslation`, та же визуальная плотность иконки (`size={12-14} stroke={1.5}`). Уникально для CopyButton: render-prop API даёт `copy()` колбэк и `copied` boolean — обёртка `Tooltip.label` реактивно меняется на «Copied» (D-05 Claude's Discretion: переиспользовать `chat.copied` key).

**Не использовать:** `chat.cleared` key (он зарезервирован под Toast notification, см. D-05-14) для tooltip-фидбэка CopyButton.

#### Pattern E — Tooltip-wrapped Text для tokens breakdown

**Analog:** `src/components/SessionTabs.tsx:112-130` — Tooltip+ActionIcon, но семантика похожа: hover-only раскрытие detail.

```tsx
<Tooltip
  label={t(mode === "developer" ? "panel.modeDeveloperTooltip" : "panel.modeArchitectTooltip")}
  withArrow
  position="top"
>
  ...
</Tooltip>
```

**Что копировать:** `withArrow`, `position="top"` (StatusBar внизу панели). Tooltip.label для breakdown — multiline через `<Stack gap={4}>` внутри JSX-label:

```tsx
<Tooltip
  withArrow
  position="top"
  label={
    <Stack gap={2}>
      <Text size="xs">{t("chat.tokensTooltip.input")}: {usage.input_tokens.toLocaleString()}</Text>
      <Text size="xs">{t("chat.tokensTooltip.output")}: {usage.output_tokens.toLocaleString()}</Text>
      <Text size="xs">{t("chat.tokensTooltip.cacheCreation")}: {usage.cache_creation_input_tokens.toLocaleString()}</Text>
      <Text size="xs">{t("chat.tokensTooltip.cacheRead")}: {usage.cache_read_input_tokens.toLocaleString()}</Text>
    </Stack>
  }
>
  <Text size="xs" c="dimmed" style={{ cursor: "default" }}>
    {t("chat.tokens")}: {(usage.input_tokens + usage.output_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens).toLocaleString()}
  </Text>
</Tooltip>
```

**Что НЕ копировать из SessionTabs:** Menu-wrap (`<Menu.Target>`) — здесь ничего не открывается на click, только hover-tooltip per D-05-01.

**Number formatting (D-05 Claude's Discretion):** `.toLocaleString()` — единственное использование number-локали в проекте (`HistoryPage.tsx:76` использует `Date.toLocaleString()` для дат). `Intl.NumberFormat` нигде не используется. `.toLocaleString()` без аргументов вернёт thousand-separator по locale (`12,345` / `12 345`), что соответствует рекомендации «абсолютные числа без сокращений k/M».

---

### `src/components/chat/ChatPanel.tsx` (component, event-driven container)

**Analog:** сам себя — расширяем существующий switch в `handleClaudeEvent` + state-declaration block. Никакого refactor structure; только additive state, additive cases, и extract `handleClear` per D-05-11.

#### Pattern A — state declaration (lines 44-54)

**Existing block:**
```tsx
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [isRunning, setIsRunning] = useState(false);
const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);

const hasSessionRef = useRef(false);
const currentBlockIndexRef = useRef<number>(-1);
const toolJsonBuffersRef = useRef<Map<number, string>>(new Map());
const archivedMessagesRef = useRef<ChatMessage[]>([]);
const nextMessageIdRef = useRef(0);
const streamBufferRef = useRef("");
const rafIdRef = useRef<number | null>(null);
```

**Что добавить (рядом с `useState`, не `useRef` — D-05-04 / CONTEXT.md `<code_context>` Established Patterns: «render-driving — useState»):**
```tsx
const [sessionModel, setSessionModel] = useState<string | null>(null);
const [sessionId, setSessionId] = useState<string | null>(null);
const [accumulatedUsage, setAccumulatedUsage] = useState<Usage | null>(null);
```

**Что НЕ копировать:** `useRef` для accumulator — это render-driving state (StatusBar должна перерендериться при изменении). `hasSessionRef` использует useRef именно потому что нужен в `handleSend` callback'е без re-render trigger; usage наоборот должен триггерить re-render StatusBar.

#### Pattern B — расширение case `"system"` (lines 137-156)

**Existing:**
```tsx
case "system": {
  const wasExisting = hasSessionRef.current;
  hasSessionRef.current = true;
  const info = [
    claudeEvent.model && `Model: ${claudeEvent.model}`,
    claudeEvent.session_id && `Session: ${claudeEvent.session_id.slice(0, 8)}...`,
  ]
    .filter(Boolean)
    .join(" | ");

  if (info && !wasExisting) {
    updateMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.kind === "system-info" && last.text === info) {
        return prev;
      }
      return [...prev, { id: createMessageId(), kind: "system-info", text: info }];
    });
  }
  break;
}
```

**Что добавить (per D-05-05 / D-05-06 / specifics truth #4):**

```tsx
case "system": {
  const wasExisting = hasSessionRef.current;
  hasSessionRef.current = true;

  // NEW: reset accumulator при смене session_id (D-05-06)
  setSessionId((prevId) => {
    if (claudeEvent.session_id && claudeEvent.session_id !== prevId) {
      setAccumulatedUsage(null);
    }
    return claudeEvent.session_id ?? prevId;
  });

  // NEW: update model (D-05-12)
  if (claudeEvent.model) {
    setSessionModel(claudeEvent.model);
  }

  // existing inline system-info message — оставить как есть
  const info = [...];
  if (info && !wasExisting) { updateMessages(...) }
  break;
}
```

**Important:** функциональная форма `setSessionId((prevId) => ...)` нужна, чтобы избежать stale closure (см. CONTEXT.md `<code_context>` Established Patterns: «Functional state updates»). Вызов `setAccumulatedUsage(null)` внутри функционального updater — допустимо в React 19; альтернатива через `useEffect([sessionId])` усложняет без выгоды.

**Что НЕ менять:** существующая логика inline `system-info` message — продолжает работать (CONTEXT.md `<code_context>` Integration Points: «оставить как есть, всё ещё полезно для inline-видимости»).

#### Pattern C — расширение case `"assistant"` (lines 251-271)

**Existing:**
```tsx
case "assistant": {
  const textBlocks = claudeEvent.message.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (textBlocks) { updateMessages(...) }

  resetStreamingState();
  break;
}
```

**Что добавить (per D-05-04 / specifics truth #5):**
```tsx
case "assistant": {
  // NEW: accumulator update — единственный source of truth для usage
  if (claudeEvent.message.usage) {
    const curr = claudeEvent.message.usage;
    setAccumulatedUsage((prev) => {
      if (prev === null) return { ...curr };  // init from first event
      return {
        input_tokens: prev.input_tokens + curr.input_tokens,
        output_tokens: prev.output_tokens + curr.output_tokens,
        cache_creation_input_tokens: prev.cache_creation_input_tokens + curr.cache_creation_input_tokens,
        cache_read_input_tokens: prev.cache_read_input_tokens + curr.cache_read_input_tokens,
      };
    });
  }

  // existing textBlocks logic
  const textBlocks = ...;
  if (textBlocks) { updateMessages(...) }
  resetStreamingState();
  break;
}
```

**Что НЕ копировать / не делать:**
- НЕ читать `claudeEvent.usage` в case `"result"` (lines 273-295) — D-05-04 запрещает (typed `unknown`, double-count risk).
- НЕ читать `stream_event.message_delta.usage` (lines 51, parser file) — D-05-04 запрещает.
- НЕ заменять spread `{ ...curr }` на reference-assign — `Usage` объект приходит из event payload, может быть mutated/recycled внутри Tauri-bridge; defensive copy.

#### Pattern D — extract `handleClear` (lines 396-403)

**Existing inline в `handleSend`:**
```tsx
if (text.trim() === "/clear") {
  setMessages([]);
  setSessionResult(null);
  hasSessionRef.current = false;
  archivedMessagesRef.current = [];
  resetStreamingState();
  return;
}
```

**Что сделать (D-05-11):** вынести в `useCallback` рядом с другими handlers (`handleSaveMessage` line 357, `handleStop` line 429):

```tsx
const handleClear = useCallback(() => {
  setMessages([]);
  setSessionResult(null);
  setSessionModel(null);       // new
  setSessionId(null);          // new
  setAccumulatedUsage(null);   // new
  hasSessionRef.current = false;
  archivedMessagesRef.current = [];
  resetStreamingState();
}, [resetStreamingState]);
```

Затем `handleSend` `/clear` ветка заменяется на:
```tsx
if (text.trim() === "/clear") {
  handleClear();
  return;
}
```

**Что НЕ добавлять (D-05-14):** notification.show с `t("chat.cleared")` — нет, для consistency с существующим silent `/clear`.

#### Pattern E — Clear-button в header `Group` (lines 460-469)

**Existing header:**
```tsx
<Group px="xs" py={4} gap="xs" style={{ borderBottom: "1px solid var(--ucc-border-subtle)" }}>
  <Badge
    size="xs"
    variant="light"
    color={mode === "code" ? "orange" : "blue"}
    style={{ textTransform: "uppercase", letterSpacing: 1 }}
  >
    {t(mode === "code" ? "panel.modeDeveloper" : "panel.modeArchitect")}
  </Badge>
</Group>
```

**Что добавить (D-05-07 / D-05-08 / D-05-10):**

Analog для контракта — `src/components/chat/PromptInput.tsx:155-165` (Tooltip + ActionIcon + disabled-проп):
```tsx
<Tooltip label={t("chat.attach")}>
  <ActionIcon
    size="md"
    variant="subtle"
    onClick={handleAttachFile}
    disabled={isRunning}
    style={{ flexShrink: 0, marginRight: 4, alignSelf: "flex-end" }}
  >
    <IconPaperclip size={18} stroke={1.5} />
  </ActionIcon>
</Tooltip>
```

**Применить к Clear-button:**
```tsx
<Group px="xs" py={4} gap="xs" style={{ borderBottom: "1px solid var(--ucc-border-subtle)" }}>
  <Badge ... >{t(...)}</Badge>
  <Tooltip label={t("chat.clearChat")} withArrow position="bottom">
    <ActionIcon
      ml="auto"
      size="xs"
      variant="subtle"
      onClick={handleClear}
      disabled={isRunning}
      aria-label={t("chat.clearChat")}
    >
      <IconEraser size={14} stroke={1.5} />
    </ActionIcon>
  </Tooltip>
</Group>
```

**Что копировать из PromptInput:** Tooltip→ActionIcon→Icon nesting, `variant="subtle"`, `disabled={isRunning}` контракт.

**Что НЕ копировать:**
- `size="md"` PromptInput'а — у Clear `size="xs"` (D-05-07 — header-level convention из MessageItem bookmark + дальше от accidental click).
- `style={{ flexShrink: 0, marginRight: 4 }}` — у Clear `ml="auto"` (D-05-07: пространственно отделить от mode-badge, прижать к правому краю → антипаттерн Google AI Studio адрессован).
- `position="top"` Tooltip'а — для header'а `position="bottom"`, иначе tooltip перекрывает ChatPanel content (mirror logic StatusBar's `position="top"`).

**Импорты, которые надо добавить (line 2-4):**
```tsx
import { Stack, Group, Text, Badge, ActionIcon, Tooltip } from "@mantine/core";
import { IconFolderOpen, IconMessage, IconEraser } from "@tabler/icons-react";
```

#### Pattern F — прокинуть props в `<StatusBar />` (line 520)

**Existing:**
```tsx
<StatusBar isRunning={isRunning} sessionResult={sessionResult} />
```

**Что заменить (D-05-12: `sessionModel ?? projectModel ?? null` fallback resolves в caller):**
```tsx
<StatusBar
  isRunning={isRunning}
  sessionResult={sessionResult}
  model={sessionModel ?? projectModel ?? null}
  sessionId={sessionId}
  usage={accumulatedUsage}
/>
```

`projectModel` уже в props (line 25, `ChatPanelProps.projectModel?: string | null`). Em-dash placeholder резолвится внутри StatusBar (`{model ?? "—"}`), не здесь.

---

### `src/types/claude.ts` (type definitions)

**Analog:** existing `SessionResult` interface (lines 257-263):

```tsx
export interface SessionResult {
  cost?: number;
  durationMs?: number;
  numTurns?: number;
  sessionId?: string;
  permissionDenials: PermissionDenial[];
}
```

#### Pattern A — добавить `SessionMetadata` (D-05 Claude's Discretion)

Per CONTEXT.md рекомендация: **новый параллельный тип**, не расширять `SessionResult` (семантика «итоги завершённой сессии» vs «live runtime state»):

```tsx
// === Session Metadata (live runtime state, Phase 5) ===
export interface SessionMetadata {
  model: string | null;
  sessionId: string | null;
  usage: Usage | null;
}
```

Вставить рядом с `SessionResult` (после line 263 или ближе к `Usage` блоку lines 100-106). **Опционально** для планнера: можно вообще не вводить `SessionMetadata` тип и передавать 3 prop'а отдельно — обе формы acceptable, но `SessionMetadata` упрощает test fixtures (одна переменная вместо трёх).

**Что копировать из существующих типов:**
- `export interface` + PascalCase + descriptive noun (CONVENTIONS.md Naming Patterns).
- Optional / nullable выражается через `| null`, не через `?` — потому что значения всегда явно сетятся в state (null = «нет данных»), а не «может отсутствовать в payload».

**Что НЕ копировать:**
- НЕ расширять существующий `Usage` interface (lines 101-106) — он строго matches Rust shape (`crates/claude-code-core/src/types.rs` `Usage` struct). Любое extension может сломать сериализацию.
- НЕ менять `ClaudeEvent` discriminated union (lines 12-18) — типы payload уже корректны, accumulator работает поверх existing `AssistantEvent.message.usage`.

---

### `src/i18n/locales/{en,ru}.json` (i18n, namespace `chat.*`)

**Analog:** existing `chat.*` block (lines 276-299 в обоих файлах).

**Existing keys (точная structure для копирования стилистики):**
```json
"chat": {
  "placeholder": "Type a prompt... (Enter to send, Shift+Enter for new line)",
  "send": "Send",
  "stop": "Stop",
  "idle": "Ready",
  "running": "Running...",
  "cost": "Cost",
  "duration": "Duration",
  "turns": "Turns",
  ...
  "cleared": "Chat cleared",  // оставить как есть, dead-key per D-05-14
  ...
}
```

**Keys to add (D-05 Claude's Discretion — точные имена на усмотрение планнера, ниже — рекомендация):**

```json
"chat": {
  ...existing keys...,
  "model": "Model",              // ru: "Модель"
  "session": "Session",          // ru: "Сессия"
  "tokens": "Tokens",            // ru: "Токены"
  "copySessionId": "Copy session ID",  // ru: "Копировать session ID"
  "copied": "Copied",            // ru: "Скопировано"
  "clearChat": "Clear chat",     // ru: "Очистить чат"
  "tokensTooltip": {
    "input": "Input",            // ru: "Вход"
    "output": "Output",          // ru: "Выход"
    "cacheCreation": "Cache creation",  // ru: "Создание кэша"
    "cacheRead": "Cache read"    // ru: "Чтение кэша"
  }
}
```

**Convention (CONVENTIONS.md i18n Usage + CONTEXT.md `<code_context>` Established Patterns):**
- Namespace `chat.*` — для всего, что относится к ChatPanel/StatusBar.
- Keys identical в en и ru (порядок строк MUST совпадать — облегчает diff review).
- Nested object для grouped keys (`tokensTooltip.input`) — match existing `settings.mcp.scopeLabel.user` / `panel.modeArchitectTooltip` pattern.
- Не использовать i18next interpolation `{{...}}` для статичных лейблов (interpolation только когда есть динамика, как `chat.processExited`).

**Что НЕ делать:**
- НЕ удалять `chat.cleared` (D-05-14: dead-key для возможной будущей Toast/Undo фичи).
- НЕ переиспользовать `common.copy` / `common.copied` — их нет в существующих локалях (`common.*` содержит только save/cancel/delete/loading/settings). Добавлять в `common.*` — out of scope; добавляем в `chat.*` namespace.

---

### `src/__tests__/StatusBar.test.tsx` (unit test, presentational)

**Analog:** сам себя — расширение `renderBar` helper (lines 7-13).

**Existing helper:**
```tsx
function renderBar(isRunning: boolean, sessionResult: SessionResult | null = null) {
  return render(
    <MantineProvider>
      <StatusBar isRunning={isRunning} sessionResult={sessionResult} />
    </MantineProvider>,
  );
}
```

**Что заменить (под новые props):**
```tsx
function renderBar(opts: {
  isRunning?: boolean;
  sessionResult?: SessionResult | null;
  model?: string | null;
  sessionId?: string | null;
  usage?: Usage | null;
} = {}) {
  return render(
    <MantineProvider>
      <StatusBar
        isRunning={opts.isRunning ?? false}
        sessionResult={opts.sessionResult ?? null}
        model={opts.model ?? null}
        sessionId={opts.sessionId ?? null}
        usage={opts.usage ?? null}
      />
    </MantineProvider>,
  );
}
```

**Что копировать из existing tests (lines 15-60):**
- `describe("StatusBar", ...)` структура.
- `screen.getByText("chat.running")` — t-mock возвращает key как есть (см. setup.ts lines 49-62).
- `screen.queryByText(/chat\.cost/)` для проверки отсутствия.
- `expect(...).toBeInTheDocument()` / `.not.toBeInTheDocument()`.

**Test cases для добавления (per D-05 Claude's Discretion list + specifics truths):**

1. `shows model when model prop is set` → `renderBar({ model: "claude-sonnet-4-6" })` → `getByText(/claude-sonnet-4-6/)`.
2. `shows em-dash when model is null` → `renderBar({ model: null })` → `getByText(/—/)`.
3. `shows session_id prefix (8 chars) when sessionId is set` → `renderBar({ sessionId: "abc12345-def6-7890-abcd-ef1234567890" })` → `getByText(/abc12345/)`; full UUID не отображается.
4. `does not render CopyButton when sessionId is null` → `renderBar({ sessionId: null })` → `queryByLabelText("chat.copySessionId")` is null.
5. `shows sum of usage tokens` → `renderBar({ usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 200 }})` → `getByText(/350/)`.
6. `shows em-dash for tokens when usage is null` → assert tokens-field renders `"—"`.

**Что НЕ делать:**
- НЕ тестировать Tooltip-breakdown content через `screen.getByText` — Tooltip Mantine лениво монтируется на hover; для assertion нужен `userEvent.hover` или mock'ать Tooltip как passthrough. Optional test, можно пропустить (Tooltip — purely presentational).
- НЕ тестировать реальный clipboard copy — `navigator.clipboard` не доступен в jsdom; ограничиться проверкой что ActionIcon с `aria-label="chat.copySessionId"` рендерится при non-null sessionId.

---

### `src/__tests__/ChatPanel.test.tsx` (unit test, event-driven container)

**Analog:** сам себя — `capturedCallback` pattern (lines 58-111) и `act(() => { capturedCallback!({...}) })` для эмуляции событий + `PromptInput.test.tsx:35-40` для disabled-button assertion.

#### Pattern A — capture listener callback (lines 59-72)

```tsx
let capturedCallback: ((event: { payload: PanelEvent }) => void) | null = null;

mockedListen.mockImplementation((_eventName, handler) => {
  capturedCallback = handler as (event: { payload: PanelEvent }) => void;
  return Promise.resolve(() => {});
});

renderWithMantine(<ChatPanel panelId="code" cwd="D:\\test" />);

await vi.waitFor(() => {
  expect(capturedCallback).not.toBeNull();
});
```

**Что копировать as-is** для всех новых тестов Phase 5.

#### Pattern B — fire system event (lines 92-110)

```tsx
capturedCallback!({
  payload: {
    panel_id: "code",
    event: {
      Claude: {
        type: "system",
        subtype: "init",
        session_id: "test-session-2",
        tools: [],
        mcp_servers: [],
        model: "sonnet",
      },
    },
  },
});

await vi.waitFor(() => {
  expect(screen.getByText(/Model: sonnet/)).toBeInTheDocument();
});
```

**Что копировать as-is** для эмуляции `system` event в новых тестах (с разными `session_id` чтобы проверить reset accumulator).

#### Pattern C — assistant event с usage (NEW — нет в existing tests)

В existing тестах нет fixtures для `assistant` event с usage. Shape (из `src/types/claude.ts:78-83` + `Usage` lines 101-106):
```tsx
capturedCallback!({
  payload: {
    panel_id: "code",
    event: {
      Claude: {
        type: "assistant",
        session_id: "session-1",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hi" }],
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 200,
          },
        },
      },
    },
  },
});
```

#### Pattern D — find disabled Clear button (analog: `PromptInput.test.tsx:35-40`)

```tsx
it("disables send when empty", () => {
  renderWithMantine(<PromptInput isRunning={false} onSend={mockSend} onStop={mockStop} />);
  const buttons = screen.getAllByRole("button");
  const sendButton = buttons[buttons.length - 1];
  expect(sendButton).toBeDisabled();
});
```

**Что копировать для Clear-button:** `screen.getByRole("button", { name: "chat.clearChat" })` (aria-label поиск) → `.toBeDisabled()` при isRunning.

**Что НЕ копировать:** `getAllByRole("button")[idx]` index-доступ — у PromptInput кнопки без `aria-label`, у Clear `aria-label="chat.clearChat"` есть, надо использовать `getByRole("button", { name: ... })`.

#### Test cases для добавления (per D-05 Claude's Discretion list + specifics truths):

1. `accumulator grows on assistant event with usage` (specifics truth #5).
2. `system event with new session_id resets accumulator` (specifics truth #4).
3. `Clear button is disabled while isRunning` (D-05-10, specifics truth #6) — нужно сначала дать `claude_start` invoke вернуть state «running» через `mockedInvoke.mockResolvedValueOnce("running")`.
4. `clicking Clear resets messages, sessionMetadata, accumulator` (D-05-09, specifics truth #7).
5. `system event sets sessionModel and sessionId` (specifics truth #1).
6. (Optional) `assistant event before any system event still initializes accumulator from null` (edge case в `<specifics>`).

**Что НЕ копировать:**
- НЕ тестировать через `userEvent.click` ConfirmModal-flow — modal не используется (D-05-09).
- НЕ тестировать reset accumulator при view-switch — это explicit anti-test per `<deferred>` («Reset accumulator при view-switch — НЕТ, Phase 4 invariant»).
- НЕ загромождать существующие тесты (lines 48-270) — добавлять новые `it(...)` блоки в конец describe-блока.

---

## Shared Patterns

### Cross-cutting: i18n
**Source:** `react-i18next` через `useTranslation()` hook + setup.ts mock (lines 49-62)
**Apply to:** StatusBar, ChatPanel, tests
**Pattern:**
```tsx
import { useTranslation } from "react-i18next";
const { t } = useTranslation();
// t("chat.model")  // → возвращает строку
```
В тестах `t(key)` mock возвращает key as-is → проверяем по `screen.getByText("chat.model")` или regex.

### Cross-cutting: ActionIcon stylistic convention
**Source:** `src/components/chat/MessageItem.tsx:45-64` (size="xs" variant="subtle") + `src/components/SessionTabs.tsx:155-164` (вариант с Tooltip wrap)
**Apply to:** Clear-button в ChatPanel header, CopyButton в StatusBar
**Pattern:**
```tsx
<Tooltip label={t("...")} withArrow position="..." >
  <ActionIcon size="xs" variant="subtle" aria-label={t("...")} disabled={...} onClick={...}>
    <IconX size={14} stroke={1.5} />
  </ActionIcon>
</Tooltip>
```

### Cross-cutting: Functional state updates
**Source:** CONTEXT.md `<code_context>` Established Patterns
**Apply to:** все три новых setState в ChatPanel (`setSessionModel`, `setSessionId`, `setAccumulatedUsage`)
**Pattern:** `setX((prev) => ...)` всегда, когда новое значение зависит от старого (чтобы избежать stale closure при быстром стриминге).

### Cross-cutting: useState vs useRef heuristic
**Source:** CONTEXT.md `<code_context>` Established Patterns + ChatPanel.tsx:44-54
**Apply to:** новые поля в ChatPanel
**Pattern:** «Render-driving — useState; нужно в callback без re-render — useRef». `sessionModel`/`sessionId`/`accumulatedUsage` → useState (StatusBar должна перерендериться). `hasSessionRef` остаётся useRef (используется в `handleSend` без trigger re-render).

### Cross-cutting: Disabled-button contract
**Source:** `src/components/chat/PromptInput.tsx:159` (`disabled={isRunning}` на attach), `PromptInput.tsx:193` (`disabled={!value.trim() && ...}` на send)
**Apply to:** Clear-button (D-05-10)
**Pattern:** `disabled={isRunning}` — UI controls, которые могут портить CLI-runner state.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Mantine `CopyButton` — render-prop с `{({ copied, copy }) => ...}` | UI primitive | request-response | В `src/` нет ни одного использования (Grep("CopyButton") = 0 hits). Mantine 8 contract знаком — см. Pattern D в StatusBar section выше. Handler-stack рекомендуется идентичный IconBookmark из MessageItem. |
| `Intl.NumberFormat` или `Number.toLocaleString()` для tokens | utility | n/a | `Date.toLocaleString()` используется в `HistoryPage.tsx:76`, но это для дат. Для чисел нет анchor'а; рекомендация — простой `value.toLocaleString()` (без аргументов, locale по `navigator.language`) — это D-05 Claude's Discretion. |

---

## Metadata

**Analog search scope:**
- `src/components/chat/*.tsx` (StatusBar, ChatPanel, MessageItem, PromptInput, ToolUseBlock, MessageList)
- `src/components/SessionTabs.tsx`, `src/components/DualPanelLayout.tsx` (header/tooltip patterns)
- `src/__tests__/*.test.tsx` (test conventions, особенно ChatPanel/PromptInput/StatusBar/MessageItem)
- `src/utils/safeListener.ts` (Tauri listener pattern, Phase 4 invariant)
- `src/types/claude.ts` (existing type shapes)
- `src/i18n/locales/{en,ru}.json` (i18n namespace structure)
- `setup.ts` (test mocks)

**Files scanned:** 14 production + 5 test + 2 locale + 1 type = 22 файла прочитано.

**Pattern extraction date:** 2026-05-18

**Key invariants для планнера:**
1. Backend (`src-tauri/`, `crates/`) НЕ трогать (CONTEXT.md `<domain>` constraint).
2. Публичные API `@uni-fw/*` НЕ менять (v1.0 compatibility).
3. `useTauriListener` (Phase 4) гарантирует, что подписки переживают navigation — accumulator продолжает копить даже когда панель неактивна (specifics truth #10 + `<deferred>` anti-test).
4. Em-dash («—») как universal placeholder для null (D-05-12, layout-shift mitigation).
5. `disabled={isRunning}` для Clear — единственный технический guard (D-05-10).

## PATTERN MAPPING COMPLETE
