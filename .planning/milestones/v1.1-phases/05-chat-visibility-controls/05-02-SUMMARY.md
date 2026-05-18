---
phase: 05-chat-visibility-controls
plan: 02
subsystem: ui
tags: [typescript, react, mantine, testing, statusbar]

# Dependency graph
requires:
  - "05-01 (SessionMetadata тип + chat.* i18n-keys)"
provides:
  - "StatusBar с тремя новыми полями: model, session+CopyButton, ΣTokens+Tooltip"
  - "StatusBarProps расширен model/sessionId/usage (required nullable)"
  - "15 unit-тестов StatusBar (8 регрессионных + 7 новых)"
affects:
  - "05-03 (ChatPanel): должен передать реальные значения вместо null-заглушек"

# Tech tracking
tech-stack:
  added:
    - "Mantine CopyButton (render-prop pattern) — первое использование в проекте"
  patterns:
    - "CopyButton render-prop: {({ copied, copy }) => ...} с IconCopy/IconCheck-toggle"
    - "Tooltip с JSX-label (Stack + 4 Text) для breakdown данных"
    - "Em-dash placeholder для null-значений (D-05-12)"

key-files:
  created: []
  modified:
    - "src/components/chat/StatusBar.tsx"
    - "src/__tests__/StatusBar.test.tsx"
    - "src/components/chat/ChatPanel.tsx"

key-decisions:
  - "D-05-01: flat single-row layout сохранён — Stack только внутри Tooltip.label"
  - "D-05-02: CopyButton копирует полный UUID, в DOM показывается только prefix 8 символов"
  - "D-05-03: Σ токены = сумма всех 4 полей Usage, раздельные значения только в Tooltip-breakdown"
  - "D-05-12: em-dash '—' для model/session/tokens при null"
  - "ChatPanel.tsx: временные null-заглушки для новых props — план 05-03 прокинет реальные данные"

patterns-established:
  - "CopyButton render-prop pattern (новый для проекта): value={sessionId} timeout={1500}"
  - "renderBar options-object helper с null-defaults — удобен для частичных fixture"

requirements-completed:
  - VIS-01
  - VIS-02
  - VIS-03

# Metrics
duration: 4min
completed: 2026-05-18
---

# Phase 05 Plan 02: Расширение StatusBar — model, session+CopyButton, ΣTokens+Tooltip Summary

**Три новых поля в StatusBar (model, session_id с CopyButton, накопленный token usage с Tooltip-breakdown) — закрывает VIS-01, VIS-02, VIS-03 на уровне рендера**

## Performance

- **Duration:** ~4 мин
- **Started:** 2026-05-18T05:07:44Z
- **Completed:** 2026-05-18T05:11:01Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

### Task 1 — Расширен StatusBar.tsx

**Новые импорты:**
- `@mantine/core`: добавлены `ActionIcon`, `Tooltip`, `CopyButton`, `Stack` к существующим `Group`, `Text`, `Badge`
- `@tabler/icons-react`: `IconCopy`, `IconCheck`
- `../../types/claude`: добавлен `Usage` к существующему `SessionResult`

**Расширение StatusBarProps:**
```tsx
interface StatusBarProps {
  isRunning: boolean;
  sessionResult: SessionResult | null;
  model: string | null;      // новое, required
  sessionId: string | null;  // новое, required
  usage: Usage | null;       // новое, required
}
```

**Три новых поля в render (между Badge и существующим sessionResult-блоком):**
1. **model** — `<Text size="xs" c="dimmed">{t("chat.model")}: {model ?? "—"}</Text>`
2. **session** — `<Text>` с prefix 8 символов + `CopyButton` (render-prop) при non-null sessionId; em-dash при null
3. **ΣTokens** — `<Tooltip label={<Stack gap={2}>4 строки breakdown</Stack>}><Text>Σ.toLocaleString()</Text></Tooltip>` при non-null usage; em-dash при null

**Порядок полей (D-05-01):** Badge → model → session+CopyButton → ΣTokens → cost → duration → turns

**ChatPanel.tsx:** добавлены null-заглушки `model={null} sessionId={null} usage={null}` для typecheck (план 05-03 заменит реальными данными)

### Task 2 — Обновлён StatusBar.test.tsx

**renderBar helper переписан на options-object форму:**
```tsx
function renderBar(opts: {
  isRunning?: boolean;
  sessionResult?: SessionResult | null;
  model?: string | null;
  sessionId?: string | null;
  usage?: Usage | null;
} = {}) { ... }
```

**8 существующих тестов конвертированы** под новый API без изменения поведения.

**7 новых тестов:**
| Тест | Покрытие |
|------|---------|
| `shows model when model prop is set` | VIS-01, specifics truth #1 |
| `shows em-dash for model when null` | D-05-12 |
| `shows session_id prefix when sessionId set` | VIS-02, D-05-02 |
| `renders copy button when sessionId is set` | VIS-02, D-05-02 |
| `does not render copy button when sessionId is null` | D-05-02 |
| `shows sum of usage tokens when usage is set` | VIS-03, D-05-03, specifics truth #5 |
| `shows em-dash for tokens when usage is null` | D-05-12 |

## Task Commits

1. **Task 1:** `1daaf2a` — feat(05-02): расширить StatusBar тремя полями — model, session+CopyButton, ΣTokens+Tooltip
2. **Task 2:** `1f434d9` — test(05-02): обновить StatusBar.test.tsx — options-object helper и 7 новых тест-кейсов

## Подтверждение D-XX инвариантов

| Decision | Статус |
|----------|--------|
| D-05-01 flat layout | ВЫПОЛНЕНО — Stack только внутри Tooltip.label, root Group не изменён |
| D-05-02 session prefix + CopyButton + полный UUID | ВЫПОЛНЕНО — `sessionId.slice(0, 8)...` в DOM, `value={sessionId}` в CopyButton |
| D-05-03 Σ display + breakdown в Tooltip | ВЫПОЛНЕНО — sum = все 4 поля, Tooltip с 4 отдельными toLocaleString() |
| D-05-12 em-dash для null | ВЫПОЛНЕНО — `model ?? "—"`, `sessionId ? prefix : "—"`, tokens без Tooltip при null |

## Регрессионные инварианты

- Badge (статус running/idle) — не изменён
- Поля cost, duration, turns из sessionResult — рендерятся ПОСЛЕ новых полей, поведение идентично
- `npm run typecheck` exit 0
- `npm run test` 114/114 passed (было 107, добавлено 7 новых)

## Покрытие требований

| REQ-ID | Требование | Статус |
|--------|-----------|--------|
| VIS-01 | Постоянная видимость model в StatusBar | ВЫПОЛНЕНО (рендер) |
| VIS-02 | session_id с CopyButton в StatusBar | ВЫПОЛНЕНО (рендер) |
| VIS-03 | накопленный token usage с breakdown | ВЫПОЛНЕНО (рендер) |

**Примечание:** StatusBar рендерит данные, но их источник (реальные значения из Claude events) подключается в плане 05-03 (ChatPanel). Phase 5 Success Criteria #1, #2, #3 закрыты на уровне рендера; #4 и #5 — в плане 05-03.

## Deviations from Plan

**1. [Rule 3 - Blocking] Временная заглушка в ChatPanel.tsx**
- **Найдено во время:** Task 1
- **Проблема:** `npm run typecheck` не прошёл бы без обновления ChatPanel.tsx — новые required props вызвали TS2739
- **Исправление:** добавлены null-заглушки `model={null} sessionId={null} usage={null}` в строку StatusBar
- **Файлы:** `src/components/chat/ChatPanel.tsx`
- **Коммит:** `1daaf2a`
- **Примечание:** план 05-03 заменит заглушки реальными данными из state — это ожидаемое поведение

## Threat Flags

Нет новых security-relevant endpoints или auth paths.

## Self-Check

- [x] `src/components/chat/StatusBar.tsx` содержит `CopyButton` — grep проверен
- [x] `src/__tests__/StatusBar.test.tsx` содержит 15 тестов (`grep -c "  it("` = 15)
- [x] Коммит `1daaf2a` существует
- [x] Коммит `1f434d9` существует
- [x] `npm run typecheck` exit 0
- [x] `npm run test` 114/114 passed

## Self-Check: PASSED

---
*Phase: 05-chat-visibility-controls*
*Completed: 2026-05-18*
