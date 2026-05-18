---
phase: 05-chat-visibility-controls
plan: 03
subsystem: ui
tags: [typescript, react, mantine, testing, chatpanel, accumulator, clear-button]

# Dependency graph
requires:
  - "05-01 (SessionMetadata тип + chat.* i18n-keys, включая chat.clearChat)"
  - "05-02 (StatusBar с расширенными props model/sessionId/usage)"
provides:
  - "ChatPanel с тремя новыми useState: sessionModel, sessionId, accumulatedUsage"
  - "Accumulator usage из assistant.message.usage (D-05-04/05)"
  - "Reset accumulator при смене session_id (D-05-06)"
  - "handleClear callback — единый DRY reset (D-05-11)"
  - "UI-кнопка Clear: ActionIcon IconEraser ml='auto' disabled={isRunning} (D-05-07/08/09/10)"
  - "StatusBar получает реальные данные: model/sessionId/usage из ChatPanel state (D-05-12)"
  - "5 новых unit-тестов в ChatPanel.test.tsx (11 total)"
affects:
  - "DualPanelLayout: ChatPanel теперь отображает полные метаданные сессии в StatusBar"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Functional setState updater с setSessionId((prevId) => ...) для atomic side-effect (reset accumulator)"
    - "handleClear useCallback с зависимостью [resetStreamingState] — DRY callback pattern"
    - "Defensive copy { ...curr } при инициализации accumulator из event payload"
    - "ml='auto' ActionIcon в header Group — spatial separation от mode-badge"

key-files:
  created: []
  modified:
    - "src/components/chat/ChatPanel.tsx"
    - "src/__tests__/ChatPanel.test.tsx"

key-decisions:
  - "D-05-04: только assistant.message.usage — source of truth; case 'result' не читает usage"
  - "D-05-05: накопление за жизнь вкладки до Clear/reset; functional updater prev => prev===null ? {...curr} : {...}"
  - "D-05-06: reset accumulator внутри setSessionId functional updater при session_id !== prevId"
  - "D-05-07: ActionIcon ml='auto' — прижат вправо, пространственно отделён от mode-badge"
  - "D-05-08: IconEraser size={14} stroke={1.5} — выбран по семантической точности (не Trash/Refresh)"
  - "D-05-09: никакого ConfirmModal — instant clear"
  - "D-05-10: disabled={isRunning} — Clear заблокирован во время стрима"
  - "D-05-11: handleClear выделен в useCallback до handleSend (порядок важен для hoisting)"
  - "D-05-12: model={sessionModel ?? projectModel ?? null} — fallback резолвится в caller ChatPanel"
  - "D-05-13: sessionModel перебивает projectModel; реактивное обновление при смене настроек"
  - "D-05-14: handleClear silent — никакого notifications.show; chat.cleared dead-key не используется"

patterns-established:
  - "handleClear объявляется ДО handleSend (const не hoistится — порядок определения важен)"
  - "setSessionId functional updater с побочным setAccumulatedUsage(null) как атомарный паттерн"

requirements-completed:
  - VIS-01
  - VIS-02
  - VIS-03
  - UI-01

# Metrics
duration: ~15min
completed: 2026-05-18
---

# Phase 05 Plan 03: Интеграция ChatPanel — state accumulator, handleClear, Clear-button, props в StatusBar Summary

**Завершение Phase 5: ChatPanel получает 3 новых state-поля, accumulator usage из assistant events, handleClear callback и UI-кнопку Clear — соединяет event pipeline со StatusBar-видимостью**

## Performance

- **Duration:** ~15 мин
- **Started:** 2026-05-18T10:05:00Z
- **Completed:** 2026-05-18T10:20:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

### Task 1 — Расширен ChatPanel.tsx

**Новые импорты:**
- `@mantine/core`: добавлены `ActionIcon`, `Tooltip` к существующим `Stack, Group, Text, Badge`
- `@tabler/icons-react`: добавлен `IconEraser`
- `../../types/claude`: добавлен `Usage` (import type)

**Три новых useState (рядом с sessionResult):**
```tsx
const [sessionModel, setSessionModel] = useState<string | null>(null);
const [sessionId, setSessionId] = useState<string | null>(null);
const [accumulatedUsage, setAccumulatedUsage] = useState<Usage | null>(null);
```

**Case 'system' расширен:**
- `setSessionId` с functional updater — сравнивает prevId и при смене вызывает `setAccumulatedUsage(null)` (D-05-06)
- `setSessionModel(claudeEvent.model)` при не-null model
- Существующая inline system-info message логика сохранена без изменений

**Case 'assistant' расширен:**
- Accumulator с defensive copy `{ ...curr }` при инициализации (prev === null)
- Суммирование всех 4 полей Usage через functional updater
- Существующая textBlocks / updateMessages / resetStreamingState логика не изменена

**Case 'result' — НЕ модифицирован (D-05-04):** никакого чтения `claudeEvent.usage`

**handleClear useCallback** (объявлен ДО handleSend):
```tsx
const handleClear = useCallback(() => {
  setMessages([]);
  setSessionResult(null);
  setSessionModel(null);
  setSessionId(null);
  setAccumulatedUsage(null);
  hasSessionRef.current = false;
  archivedMessagesRef.current = [];
  resetStreamingState();
}, [resetStreamingState]);
```

**handleSend /clear ветка** делегирована в `handleClear()` (D-05-11, DRY)

**Header Group — Clear-button:**
```tsx
<Tooltip label={t("chat.clearChat")} withArrow position="bottom">
  <ActionIcon ml="auto" size="xs" variant="subtle" onClick={handleClear}
    disabled={isRunning} aria-label={t("chat.clearChat")}>
    <IconEraser size={14} stroke={1.5} />
  </ActionIcon>
</Tooltip>
```

**StatusBar props заменены:**
```tsx
<StatusBar
  isRunning={isRunning}
  sessionResult={sessionResult}
  model={sessionModel ?? projectModel ?? null}
  sessionId={sessionId}
  usage={accumulatedUsage}
/>
```

### Task 2 — Расширен ChatPanel.test.tsx

5 новых тестов добавлены в конец существующего `describe("ChatPanel", ...)`:

| Тест | Покрытие |
|------|---------|
| `accumulates usage tokens from assistant events` | D-05-04/05, specifics truth #5 (sum=750 по двум events) |
| `resets accumulator when session_id changes via system event` | D-05-06, specifics truth #4 |
| `disables Clear button while isRunning` | D-05-10, specifics truth #6 |
| `clicking Clear resets messages, model, sessionId and accumulator` | D-05-09/11, specifics truth #7 |
| `populates sessionModel and sessionId from system event` | specifics truth #1, end-to-end через StatusBar |

Все 6 существующих тестов сохранены и проходят. Итого: 11 тестов.

## Task Commits

1. **Task 1:** `5ab9b48` — feat(05-03): расширить ChatPanel — state/accumulator/handleClear/Clear-button
2. **Task 2:** `57ed56a` — test(05-03): расширить ChatPanel.test.tsx — 5 новых тестов

## Подтверждение D-XX инвариантов

| Decision | Статус |
|----------|--------|
| D-05-04: source of truth только assistant.message.usage | ВЫПОЛНЕНО — case 'result' не читает `.usage` |
| D-05-05: накопление за вкладку до Clear | ВЫПОЛНЕНО — accumulatedUsage в useState, functional updater |
| D-05-06: reset при смене session_id | ВЫПОЛНЕНО — setSessionId functional updater с setAccumulatedUsage(null) |
| D-05-07: ActionIcon ml='auto' | ВЫПОЛНЕНО |
| D-05-08: IconEraser | ВЫПОЛНЕНО |
| D-05-09: no ConfirmModal | ВЫПОЛНЕНО — grep ConfirmModal = 0 |
| D-05-10: disabled={isRunning} | ВЫПОЛНЕНО |
| D-05-11: handleClear useCallback DRY | ВЫПОЛНЕНО — /clear и кнопка оба вызывают handleClear |
| D-05-12: fallback sessionModel ?? projectModel ?? null | ВЫПОЛНЕНО |
| D-05-13: sessionModel перебивает projectModel | ВЫПОЛНЕНО — логически следует из формулы fallback |
| D-05-14: silent clear | ВЫПОЛНЕНО — notifications.show отсутствует в handleClear |

## Phase 4 Invariant

- `useTauriListener<PanelEvent>` registration не изменена
- `renderedMessages = isActive` slicing сохранён
- `handleClaudeEvent` остаётся в useCallback с теми же зависимостями
- Никаких unmount-triggers не добавлено
- Accumulator копится даже когда панель неактивна (только useState, не useEffect)

## Phase 5 Success Criteria

| Criterion | Статус |
|-----------|--------|
| #1: Имя модели Claude постоянно видно в StatusBar | ЗАКРЫТ — sessionModel → StatusBar.model |
| #2: session_id с click-to-copy видим в StatusBar | ЗАКРЫТ — sessionId → StatusBar.sessionId |
| #3: token usage обновляется в StatusBar | ЗАКРЫТ — accumulatedUsage → StatusBar.usage |
| #4: UI-кнопка Clear работает | ЗАКРЫТ — handleClear callback + ActionIcon |
| #5: нет sticky-state на Clear / новый session_id | ЗАКРЫТ — handleClear + D-05-06 reset |

## Покрытие требований

| REQ-ID | Требование | Статус |
|--------|-----------|--------|
| VIS-01 | Постоянная видимость model | ЗАКРЫТ — sessionModel state → model prop → StatusBar.Text |
| VIS-02 | session_id с CopyButton | ЗАКРЫТ — sessionId state → sessionId prop → StatusBar |
| VIS-03 | накопленный token usage | ЗАКРЫТ — accumulatedUsage state → usage prop → StatusBar ΣTokens |
| UI-01 | UI-кнопка Clear | ЗАКРЫТ — ActionIcon с handleClear + disabled={isRunning} |

## Регрессионные инварианты

- Backend (`src-tauri/`, `crates/`) не задет: `git diff --name-only src-tauri crates packages = 0`
- `npm run typecheck` exit 0
- `npm run test` — 119/119 passed (19 test files)
- Phase 4 useTauriListener pattern: сохранён
- SessionResult и handleStop: не изменены

## Deviations from Plan

Нет — план выполнен точно по спецификации. Единственная техническая деталь: порядок объявления `handleClear` перед `handleSend` (const не hoistится в JS — это implementation-level detail, не deviation).

## Threat Flags

Нет новых security-relevant endpoints или auth paths.

## Known Stubs

Нет — все null-заглушки из плана 05-02 заменены реальными значениями state ChatPanel.

## Self-Check

- [x] `src/components/chat/ChatPanel.tsx` содержит `const handleClear = useCallback` — grep подтверждён
- [x] `src/__tests__/ChatPanel.test.tsx` содержит 11 тестов — `npm run test -- ChatPanel` 11 passed
- [x] Коммит `5ab9b48` существует в git log
- [x] Коммит `57ed56a` существует в git log
- [x] `npm run typecheck` exit 0
- [x] `npm run test` 119/119 passed

## Self-Check: PASSED

---
*Phase: 05-chat-visibility-controls*
*Completed: 2026-05-18*
