---
phase: 05-chat-visibility-controls
plan: 01
subsystem: ui
tags: [typescript, i18n, react, types]

# Dependency graph
requires: []
provides:
  - "Тип SessionMetadata { model: string | null; sessionId: string | null; usage: Usage | null } в src/types/claude.ts"
  - "i18n-keys chat.{model,session,tokens,copySessionId,copied,clearChat} в en.json и ru.json"
  - "nested i18n-объект chat.tokensTooltip с sub-keys input/output/cacheCreation/cacheRead"
affects:
  - "05-02 (StatusBar): импортирует Usage, использует chat.* keys"
  - "05-03 (ChatPanel): импортирует SessionMetadata, использует chat.clearChat"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SessionMetadata как отдельный тип для live-runtime state (в отличие от SessionResult для итогов сессии)"
    - "Nullable поля через string | null вместо optional (D-05-12: null = нет данных, а не отсутствие поля)"

key-files:
  created: []
  modified:
    - "src/types/claude.ts"
    - "src/i18n/locales/en.json"
    - "src/i18n/locales/ru.json"

key-decisions:
  - "D-05-12: поля SessionMetadata объявлены через | null, а не через ? (null = явное отсутствие данных)"
  - "D-05-04: usage: Usage | null переиспользует существующий тип без модификаций (SSOT assistant.message.usage)"
  - "D-05-14: chat.cleared dead-key сохранён — не удалять, зарезервирован для будущей Toast/Undo фичи"
  - "Claude's Discretion: SessionMetadata как параллельный тип, не расширение SessionResult (раздельные семантики)"

patterns-established:
  - "Additive-only план: только декларации типов и i18n-строки, никакого runtime-кода"
  - "Структурный parity i18n: chat.* keys идентичны в en.json и ru.json по набору и порядку"

requirements-completed:
  - VIS-01
  - VIS-02
  - VIS-03
  - UI-01

# Metrics
duration: 5min
completed: 2026-05-18
---

# Phase 05 Plan 01: Типы и i18n-фундамент для Chat Visibility Summary

**Новый тип SessionMetadata и 10 i18n-keys в chat.* namespace (6 flat + 4 nested tokensTooltip) — additive фундамент для планов 05-02 (StatusBar) и 05-03 (ChatPanel)**

## Performance

- **Duration:** ~5 мин
- **Started:** 2026-05-18T10:00:00Z
- **Completed:** 2026-05-18T10:05:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Добавлен `export interface SessionMetadata` в `src/types/claude.ts` сразу после `SessionResult` — live-runtime state контейнер с полями `model | null`, `sessionId | null`, `usage: Usage | null`
- Расширен `chat.*` блок в обоих locale-файлах: 6 flat keys + nested объект `tokensTooltip` с 4 sub-keys; structural parity между en и ru
- Существующие `SessionResult`, `Usage`, `chat.cleared` и все прочие chat.* keys не изменены — compatibility-инварианты Phase 4 и D-05-14 сохранены

## Task Commits

Каждая задача зафиксирована атомарно:

1. **Task 1: Добавить интерфейс SessionMetadata** — `3adcd18` (feat)
2. **Task 2: Расширить chat.* i18n-словари** — `b467a75` (feat)

## Files Created/Modified

- `src/types/claude.ts` — новый `export interface SessionMetadata { model: string | null; sessionId: string | null; usage: Usage | null }` после строки 263 (SessionResult)
- `src/i18n/locales/en.json` — 6 flat keys + tokensTooltip объект в конце chat.* блока
- `src/i18n/locales/ru.json` — зеркало en.json по структуре, переведённые значения

## Новые i18n Keys

| Key | EN | RU |
|-----|----|----|
| `chat.model` | "Model" | "Модель" |
| `chat.session` | "Session" | "Сессия" |
| `chat.tokens` | "Tokens" | "Токены" |
| `chat.copySessionId` | "Copy session ID" | "Копировать session ID" |
| `chat.copied` | "Copied" | "Скопировано" |
| `chat.clearChat` | "Clear chat" | "Очистить чат" |
| `chat.tokensTooltip.input` | "Input" | "Вход" |
| `chat.tokensTooltip.output` | "Output" | "Выход" |
| `chat.tokensTooltip.cacheCreation` | "Cache creation" | "Создание кэша" |
| `chat.tokensTooltip.cacheRead` | "Cache read" | "Чтение кэша" |

## Инварианты подтверждены

- `SessionResult` не изменён — Phase 4 compatibility сохранён
- `Usage` не изменён — Rust serde compatibility-инвариант v1.0 сохранён
- `chat.cleared` dead-key присутствует в обоих локалях (D-05-14): EN="Chat cleared", RU="Чат очищен"
- Structural parity chat.* между en.json и ru.json — одинаковый набор ключей
- `npm run typecheck` exit 0
- `npm run test` exit 0 (107/107 passed)

## Покрытие требований и решений

| ID | Тип | Покрытие |
|----|-----|---------|
| VIS-01 | REQ | `chat.model` key + `SessionMetadata.model` |
| VIS-02 | REQ | `chat.session`, `chat.copySessionId`, `chat.copied` + `SessionMetadata.sessionId` |
| VIS-03 | REQ | `chat.tokens`, `chat.tokensTooltip.*` + `SessionMetadata.usage: Usage | null` |
| UI-01 | REQ | `chat.clearChat` key |
| D-05-04 | Decision | `usage: Usage | null` — source of truth assistant.message.usage, тот же Usage shape |
| D-05-12 | Decision | Все поля через `| null`, не через `?` |
| D-05-14 | Decision | `chat.cleared` dead-key сохранён |

## Decisions Made

Никаких новых решений в этом плане — все принципиальные решения (D-05-04, D-05-12, D-05-14, Claude's Discretion о новом типе vs расширении SessionResult) были зафиксированы в 05-CONTEXT.md. План выполнен точно по спецификации.

## Deviations from Plan

Нет — план выполнен ровно как написан.

## Issues Encountered

Нет.

## User Setup Required

Нет — конфигурация внешних сервисов не требуется.

## Next Phase Readiness

- `SessionMetadata` готов к импорту в `StatusBar.tsx` (план 05-02) и `ChatPanel.tsx` (план 05-03)
- Все i18n-keys готовы: `t("chat.model")`, `t("chat.copySessionId")`, `t("chat.clearChat")`, `t("chat.tokensTooltip.input")` и т.д.
- Планы 05-02 и 05-03 могут выполняться параллельно (Wave 2) без cross-file race на типах и i18n

## Self-Check

- [x] `src/types/claude.ts` содержит `export interface SessionMetadata` — `grep -c "export interface SessionMetadata" src/types/claude.ts` = 1
- [x] Коммит `3adcd18` существует в git log
- [x] Коммит `b467a75` существует в git log
- [x] `npm run typecheck` exit 0
- [x] `npm run test` 107/107 passed

## Self-Check: PASSED

---
*Phase: 05-chat-visibility-controls*
*Completed: 2026-05-18*
