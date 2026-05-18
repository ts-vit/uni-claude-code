# Phase 5: Chat Visibility & Controls — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 05-chat-visibility-controls
**Mode:** advisor (USER-PROFILE.md present) + delegation override (см. memory [[feedback-discuss-phase-delegation]])
**Areas discussed:** Раскладка StatusBar, Источник и агрегация usage, Clear-кнопка UX, Lifecycle метаданных

---

## Контекст ввода

User answer на `AskUserQuestion` (multiSelect, present_gray_areas):

> «Раскладка StatusBar, Прими все решения сам»

Интерпретация (см. [[feedback-discuss-phase-delegation]]):
- Все 4 gray areas «выбраны» (delegate-broad).
- Per-area follow-up через AskUserQuestion НЕ задаём — пользователь делегировал.
- Research-фазу выполняем (4 параллельных gsd-advisor-researcher агента) — иначе decisions без grounding.
- Decisions фиксируются в CONTEXT.md с обоснованиями («Claude's discretion» где явно делегировано).

---

## Раскладка StatusBar

Synthesis от gsd-advisor-researcher (agent a62a962548e8de56b, claude-sonnet, 107s, 37k tokens).

| Option | Description | Selected |
|--------|-------------|----------|
| A. Flat inline row | Все поля в одном Group без hover/click | |
| B. Flat row + Tooltip breakdown | Inline primary fields, Tooltip раскрывает cache breakdown | ✓ |
| C. Popover для usage | Click на token chip → Popover с full breakdown table | |
| D. Two-line StatusBar | line1: model+session, line2: metrics | |

**Selected:** B (Flat row + Tooltip breakdown).

**Field order:** `[Running/Idle badge] · model · session_prefix [CopyButton] · ΣTokens (Tooltip → in/out/cache_creation/cache_read) · $cost · dur · turns`.

**Reasoning:** zero-state-management (Tooltip presentational), минимальный diff с существующим `Group`, респектит up-to-5-tabs × 3-projects constraint, VS Code status bar idiom. Popover (C) требует useState(opened) без явной выгоды для соло-пользователя. Two-line (D) ломает существующую высоту в `Stack gap={0}` ChatPanel. Pure flat (A) overflow risk при cache отдельно.

**Locked in CONTEXT.md:** D-05-01, D-05-02, D-05-03.

---

## Источник и агрегация usage

Synthesis от gsd-advisor-researcher (agent a2a141361b738e92f, claude-sonnet, 150s, 39k tokens).

| Option | Description | Selected |
|--------|-------------|----------|
| 1. `assistant` event only (per-turn accumulation) | Накапливаем по completed turns | ✓ |
| 2. `stream_event.message_delta.usage` real-time | In-flight update во время стрима | |
| 3. `result.usage` only (per-invocation cumulative) | Single event на process exit | |
| 4. Hybrid: assistant settled + message_delta in-flight | Best-of-both | |

**Selected:** 1 (assistant event only).

**Key rules:**
- Read only `claudeEvent.type === "assistant"` + `message.usage` (строго типизирован `Usage` со всеми 4 полями).
- Skip `stream_event.message_delta.usage` (`unknown` type, double-count risk, real-time усложнение).
- Skip `result.usage` (`unknown` type, double-count с assistant в той же CLI-инвокации).
- Accumulator: per-tab `useState<Usage | null>`, reset на (a) Clear, (b) изменение `system.session_id`.

**Reasoning:** VIS-03 wording «обновляется по мере получения assistant-событий» сам резолвит источник. `Usage` уже строго типизирован → нет `serde_json::Value` гимнастик. Cache_creation и cache_read хранятся отдельно во внутреннем state (для будущей фазы cost calculation), отображаются суммой для UI per VIS-03 wording.

**Locked in CONTEXT.md:** D-05-04, D-05-05, D-05-06.

---

## Clear-button UX

Synthesis от gsd-advisor-researcher (agent abc861f180a45be7e, claude-sonnet, 92s, 27k tokens).

| Option | Description | Selected |
|--------|-------------|----------|
| 1. Icon-only top-right, instant clear, no confirm | Industry default, match `/clear` text command | |
| 2. Icon-only top-right, disabled when isRunning, no confirm | + защита от corruption mid-stream | ✓ |
| 3. Icon + ConfirmModal + disabled when isRunning | Safety-first | |

**Selected:** 2 (Icon-only, `ml="auto"` right-aligned, disabled при running, no confirm).

**Specifics:**
- Иконка: `IconEraser` (tabler) — семантически чище, чем IconTrash (anxiety) / IconRefresh (неправильная mental model).
- `ActionIcon size="xs" variant="subtle"` — match existing `MessageItem.tsx` bookmark-button pattern.
- `Tooltip label={t("chat.clearChat")}`.
- `disabled={isRunning}` — пользователь должен Stop сначала, потом Clear.
- Никакого ConfirmModal — match precedent `/clear` text command (тоже instant).

**Reasoning:** Industry pattern (VS Code Copilot, Cursor, Cline, Continue.dev — все instant icon-only). Google AI Studio anti-pattern митигирован через `ml="auto"` пространственное отделение от mode-badge и PromptInput. Личный инструмент → cost ошибки = «напечатать prompt заново», низкий. `disabled` при running — корректность state machine (Stop = ясное действие, не compound).

**Locked in CONTEXT.md:** D-05-07, D-05-08, D-05-09, D-05-10, D-05-11.

---

## Lifecycle метаданных

Synthesis от gsd-advisor-researcher (agent a6f14ad1bfe2b9f4c, claude-sonnet, 84s, 29k tokens).

| Option | Description | Selected |
|--------|-------------|----------|
| A. Immediate clear + em-dash placeholders | На Clear: model←projectModel fallback, session/usage→"—" | ✓ |
| B. Progressive population, hide missing fields | Полностью скрываем field пока нет данных | |
| C. Config-sourced model always, session→"—", usage→0 | Зеро semantically «fresh start» | |
| D. Keep last values until next system event | Zero flicker, но sticky-state | ✗ (violates criterion #5) |

**Selected:** A (Immediate clear + em-dash placeholders).

**Lifecycle rules:**
- State: `sessionModel`, `sessionId`, `accumulatedUsage` — все `null` initially.
- Display model: `sessionModel ?? projectModel ?? "—"` (config attribute fallback).
- Display session_id: `null → "—"` (CopyButton скрыт), else 8-char prefix + CopyButton.
- Display usage: `null → "—"`, else accumulated число + Tooltip breakdown.
- Reset triggers: Clear button / `/clear` text command → всё null. `system` event с другим session_id → accumulator null.

**Mid-session model change:** projectModel реактивно обновляется (App.tsx ре-рендер); sessionModel НЕ меняется (running CLI subprocess уже работает со старой моделью). StatusBar показывает `sessionModel ?? projectModel`, то есть отражает реальную модель.

**Reasoning:** Closes criterion #5 («нет sticky-state»). Em-dash — VS Code status bar idiom, явный signal «нет данных», избегает layout-shift. Model — config attribute (project setting), survives Clear; session/usage — runtime artifacts, очищаются. D отвергнут — sticky session_id видим при пустом messages list = contradiction.

**Locked in CONTEXT.md:** D-05-12, D-05-13, D-05-14.

---

## Claude's Discretion (зафиксировано в CONTEXT.md, planner может уточнить)

- Точные имена i18n keys (рекомендация: `chat.model`, `chat.session`, `chat.tokens`, `chat.tokensTooltip.*`, `chat.copySessionId`, `chat.copied`, `chat.clearChat`).
- Шаг отступа / точный font-size — follow existing `gap="md" / size="xs" / c="dimmed"`.
- Форматирование чисел в ΣTokens (рекомендация: `Intl.NumberFormat()` абсолютные числа с разделителями).
- Shape нового типа: новый `SessionMetadata` (рекомендация) vs расширение `SessionResult` — на усмотрение планнера.
- Имена test-cases для StatusBar.test.tsx / ChatPanel.test.tsx.
- D-05-13 (eager projectModel display) и D-05-14 (no notification) — рекомендации Claude, но не critical для phase goal.

## Deferred Ideas (см. CONTEXT.md `<deferred>`)

- Per-turn breakdown в StatusBar (last turn vs cumulative).
- Cost-per-turn расчёт с per-model multipliers.
- Context-window % (VIS-CTX-01, Future).
- Real-time usage update во время стриминга через `stream_event.message_delta.usage`.
- Toast с Undo при Clear.
- Reset accumulator при view-switch (явно противоречит Phase 4 invariant).
- WR-02 (terminal refit на view-switch) — reviewed-but-not-folded, остаётся в `.planning/todos/pending/`.

---

## Agent invocation summary

| Gray area | Agent ID | Model | Duration | Tokens | Tool uses |
|-----------|----------|-------|----------|--------|-----------|
| StatusBar layout | a62a962548e8de56b | sonnet | 108s | 37475 | 13 |
| Usage aggregation | a2a141361b738e92f | sonnet | 150s | 38914 | 22 |
| Clear UX | abc861f180a45be7e | sonnet | 92s | 27114 | 17 |
| Lifecycle | a6f14ad1bfe2b9f4c | sonnet | 84s | 29304 | 9 |

Total: ~434s sequential / runtime было параллельно (~150s wall clock), 132807 tokens, 61 tool uses. Все 4 агента вернули structured 4-option comparison tables с Recommendation column.

---

*Discussion completed: 2026-05-18*
*Mode: advisor + delegation override*
