---
phase: 05-chat-visibility-controls
verified: 2026-05-18T10:45:00Z
status: verified
score: 5/5 must-haves verified + 5/5 human-UAT scenarios passed (см. 05-HUMAN-UAT.md, resolved 2026-05-18T06:57:42Z)
overrides_applied: 0
human_verification_resolved: 2026-05-18T06:57:42Z
human_verification:
  - test: "Запустить приложение, открыть чат, начать сессию Claude и убедиться что имя модели появляется в StatusBar сразу после первого system-события"
    expected: "В нижней строке ChatPanel появляется текст «Model: claude-sonnet-4-6» (или другая активная модель)"
    why_human: "Требует живого Tauri-процесса с настроенным Claude CLI; unit-тесты проверяют передачу prop, но не реальный поток событий от CLI"
  - test: "В той же сессии убедиться что session_id отображается в StatusBar как prefix 8 символов + «...», и что кнопка-иконка Copy рядом копирует полный UUID в буфер обмена"
    expected: "StatusBar показывает «Session: abc12345...», клик по иконке копирует полный UUID, иконка переключается на галочку на ~1.5 сек"
    why_human: "Поведение CopyButton (clipboard.writeText) недоступно в jsdom; реальный Clipboard API нужен браузерному WebView"
  - test: "Отправить несколько сообщений в рамках одной сессии и наблюдать за счётчиком токенов в StatusBar"
    expected: "Поле «Tokens» обновляется после каждого assistant-ответа, Tooltip при наведении показывает breakdown по Input/Output/Cache creation/Cache read"
    why_human: "Tooltip в Mantine рендерится лениво — только при hover; unit-тест проверяет сумму, но не открытие Tooltip-а"
  - test: "Нажать кнопку Clear (иконка ластика в шапке ChatPanel) и убедиться что переписка исчезает, model/session/tokens сбрасываются в em-dash"
    expected: "После клика: поле сообщений пустое, StatusBar показывает «Model: —», «Session: —», «Tokens: —»"
    why_human: "Поведение подтверждается unit-тестом, но визуальный результат и правильное положение кнопки в header требуют ручного осмотра"
  - test: "Запустить новую сессию после Clear и убедиться что StatusBar показывает данные новой сессии (нет «прилипших» значений)"
    expected: "После первого system-события новой сессии StatusBar обновляется на имя модели и новый session_id; токены начинаются с 0"
    why_human: "SC #5 (no sticky-state) покрыт unit-тестом на смену session_id, но end-to-end сценарий Clear + новый запуск требует live-сессии"
---

# Phase 05: Chat Visibility & Controls — Отчёт верификации

**Цель фазы:** В каждом моменте чата видно, с какой моделью идёт диалог, какой session_id корреспондирует с логами Claude и сколько токенов потрачено; базовая операция /clear доступна через явную кнопку в UI, а не только через текстовую команду.

**Верифицировано:** 2026-05-18T10:45:00Z
**Статус:** verified (5/5 SC + 5/5 human-UAT сценариев подтверждены пользователем 2026-05-18T06:57:42Z)
**Повторная верификация:** Нет — начальная верификация

---

## Достижение цели

### Наблюдаемые истины (Success Criteria из ROADMAP.md)

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| SC-1 | Пользователь видит имя активной модели Claude постоянно в StatusBar | VERIFIED | `StatusBar.tsx:51` — `<Text>{t("chat.model")}: {model ?? "—"}</Text>`; state `sessionModel` обновляется в `case "system"` при каждом system-событии (`ChatPanel.tsx:148-150`); прокидывается через `model={sessionModel ?? projectModel ?? null}` (`ChatPanel.tsx:569`) |
| SC-2 | Пользователь видит session_id в StatusBar и может скопировать его | VERIFIED | `StatusBar.tsx:53-70` — Text с prefix 8 символов + `CopyButton value={sessionId} timeout={1500}` с render-prop pattern; `sessionId` state обновляется в `case "system"` functional updater (`ChatPanel.tsx:142-147`) |
| SC-3 | Пользователь видит накопленное token usage — отдельно input/output/cache, обновляется по assistant-events | VERIFIED | `StatusBar.tsx:72-89` — Tooltip с 4-строчным breakdown (`tokensTooltip.input/.output/.cacheCreation/.cacheRead`), сумма через `tokenSum`; accumulator `setAccumulatedUsage` в `case "assistant"` с functional updater (`ChatPanel.tsx:265-277`) |
| SC-4 | Пользователь нажимает явную кнопку в шапке ChatPanel и очищает переписку | VERIFIED | `ChatPanel.tsx:503-514` — `ActionIcon ml="auto" variant="subtle" onClick={handleClear} disabled={isRunning}` с `IconEraser`; `handleClear` (`ChatPanel.tsx:419-428`) атомарно сбрасывает все 8 полей состояния |
| SC-5 | Метаданные StatusBar корректно обновляются при пересоздании сессии — нет прилипших значений | VERIFIED | `handleClear` сбрасывает `sessionModel/sessionId/accumulatedUsage` в null; смена `session_id` в `case "system"` вызывает `setAccumulatedUsage(null)` через functional updater (`ChatPanel.tsx:143-145`); unit-тест `resets accumulator when session_id changes via system event` проходит |

**Счёт:** 5/5 истин верифицированы

---

### Покрытие артефактов

| Артефакт | Назначение | Уровень 1 (существует) | Уровень 2 (содержательный) | Уровень 3 (подключён) | Статус |
|----------|-----------|----------------------|--------------------------|----------------------|--------|
| `src/types/claude.ts` | Тип `SessionMetadata` + сохранение `Usage`/`SessionResult` | PASSED | `export interface SessionMetadata { model: string \| null; sessionId: string \| null; usage: Usage \| null }` на строке 266 | Используется как шаблон для state в ChatPanel; `Usage` импортируется в StatusBar и ChatPanel | VERIFIED |
| `src/i18n/locales/en.json` | EN-ключи: `chat.model`, `chat.session`, `chat.tokens`, `chat.copySessionId`, `chat.copied`, `chat.clearChat`, `chat.tokensTooltip.*` | PASSED | 6 flat keys + nested объект `tokensTooltip` с 4 sub-keys добавлены в конце `chat.*` блока | Используются через `useTranslation().t(...)` в `StatusBar.tsx` и `ChatPanel.tsx` | VERIFIED |
| `src/i18n/locales/ru.json` | RU-зеркало en.json | PASSED | Структурный parity подтверждён: `node -e "..."` → `parity OK` (29 ключей в `chat.*` идентичны в обоих файлах) | Та же цепочка useTranslation | VERIFIED |
| `src/components/chat/StatusBar.tsx` | Расширенный StatusBar с 3 новыми props + рендер model/session+CopyButton/ΣTokens+Tooltip | PASSED | 105 строк, `CopyButton` используется на строке 55, полный Tooltip-breakdown на строках 72-89 | Рендерится в `ChatPanel.tsx:566-572` с 3 новыми props | VERIFIED |
| `src/__tests__/StatusBar.test.tsx` | Unit-тесты новых props StatusBar (15 тестов) | PASSED | 119 строк, 15 `it(...)` блоков, includes model/em-dash/session-prefix/CopyButton-presence/absence/tokens-sum/tokens-em-dash | Запускается в общем `npm run test` → 119/119 passed | VERIFIED |
| `src/components/chat/ChatPanel.tsx` | State-источник для StatusBar: sessionModel/sessionId/accumulatedUsage; handleClear; Clear-button | PASSED | 575 строк, 3 новых `useState`, `handleClear` на строке 419, Clear-button в header на строках 503-514 | Все 3 state прокидываются в `<StatusBar />` на строках 566-572; `handleClear` вызывается при onClick и через `/clear` text | VERIFIED |
| `src/__tests__/ChatPanel.test.tsx` | Unit-тесты accumulator, reset, disabled/click (11 тестов) | PASSED | 444 строки, 11 `it(...)` блоков (6 регрессионных + 5 новых) | `npm run test -- ChatPanel` → 11/11 passed | VERIFIED |

---

### Верификация ключевых связей

| От | До | Через | Статус | Детали |
|----|----|-------|--------|--------|
| `ChatPanel.tsx case "system"` | `setSessionModel` + `setSessionId` с side-effect на `setAccumulatedUsage(null)` | functional updater pattern | WIRED | `claudeEvent.session_id !== prevId` → `setAccumulatedUsage(null)` на строке 143-145 |
| `ChatPanel.tsx case "assistant"` | `setAccumulatedUsage` functional updater | `claudeEvent.message.usage` | WIRED | строки 265-277; formula: `prev.input_tokens + curr.input_tokens` и т.д. |
| `ChatPanel.tsx handleClear` | все 8 reset-сеттеров | `useCallback([resetStreamingState])` | WIRED | строки 419-428: `setMessages([])`, `setSessionResult(null)`, `setSessionModel(null)`, `setSessionId(null)`, `setAccumulatedUsage(null)`, `hasSessionRef.current = false`, `archivedMessagesRef.current = []`, `resetStreamingState()` |
| `ChatPanel.tsx header ActionIcon` | `handleClear` callback | `onClick={handleClear}` + `disabled={isRunning}` | WIRED | строки 503-514; `aria-label={t("chat.clearChat")}` — тест находит кнопку через getByRole |
| `/clear` text-команда в handleSend | `handleClear()` (DRY) | `text.trim() === "/clear"` | WIRED | строки 434-436; inline `setMessages([])` удалён, делегирован в handleClear |
| `ChatPanel.tsx <StatusBar />` | StatusBar props `model/sessionId/usage` | `model={sessionModel ?? projectModel ?? null} sessionId={sessionId} usage={accumulatedUsage}` | WIRED | строки 566-572; fallback `sessionModel ?? projectModel ?? null` резолвится в caller (D-05-12) |
| `StatusBar.tsx CopyButton` | `sessionId` state из ChatPanel | `value={sessionId}` prop | WIRED | строка 55; копирует полный UUID в clipboard |

---

### Трассировка потока данных (Level 4)

| Артефакт | Переменная | Источник | Реальные данные | Статус |
|----------|------------|----------|-----------------|--------|
| `StatusBar.tsx` (model field) | prop `model` | `sessionModel` state в ChatPanel, обновляется от `claudeEvent.model` в `case "system"` | Claude CLI → Tauri `claude-event` → PanelEvent → ClaudeEvent.model → setSessionModel | FLOWING |
| `StatusBar.tsx` (sessionId field) | prop `sessionId` | `sessionId` state в ChatPanel, обновляется от `claudeEvent.session_id` в `case "system"` | Claude CLI → Tauri → ClaudeEvent.session_id → functional setSessionId | FLOWING |
| `StatusBar.tsx` (ΣTokens field) | prop `usage` | `accumulatedUsage` state в ChatPanel, accumulates от `claudeEvent.message.usage` в `case "assistant"` | Claude CLI → AssistantEvent.message.usage → setAccumulatedUsage functional updater (суммирует 4 поля) | FLOWING |

---

### Поведенческие spot-checks

| Поведение | Проверка | Результат | Статус |
|----------|---------|---------|--------|
| `npm run typecheck` проходит с нулём ошибок | `npm run typecheck` → exit 0 | `tsc --noEmit` без ошибок | PASS |
| Все 119 тестов проходят | `npm run test` | `Tests 119 passed (119)` | PASS |
| `SessionMetadata` присутствует в `claude.ts` | grep `export interface SessionMetadata` | строка 266 | PASS |
| handleClear не вызывает notifications | node-script grep в блоке handleClear | `silent clear OK` | PASS |
| `case "result"` не читает `.usage` | node-script grep в блоке case "result" | `result.usage absent OK` | PASS |
| StatusBar получает реальные props | node-script regex на `<StatusBar ... usage={accumulatedUsage}` | `StatusBar wired OK` | PASS |
| Structural parity chat.* ключей en/ru | node -e parity check | `parity OK: 29 ключей идентичны` | PASS |
| Backend не задет | `git diff --name-only src-tauri crates packages` | (нет вывода — нет изменений) | PASS |

---

### Покрытие требований

| Требование | PLAN | Описание | Статус | Доказательство |
|-----------|------|----------|--------|----------------|
| VIS-01 | 05-01, 05-02, 05-03 | Имя активной модели постоянно в StatusBar | SATISFIED | `sessionModel` state → `model` prop → `StatusBar` render; тест `shows model when model prop is set` PASS |
| VIS-02 | 05-01, 05-02, 05-03 | session_id в StatusBar с возможностью копирования | SATISFIED | `sessionId` state → `sessionId` prop → `CopyButton value={sessionId}`; тест `renders copy button when sessionId is set` PASS |
| VIS-03 | 05-01, 05-02, 05-03 | Накопленный token usage — input/output/cache раздельно, обновляется | SATISFIED | `accumulatedUsage` accumulator в `case "assistant"` → `usage` prop → ΣTokens + Tooltip breakdown; тест `shows sum of usage tokens when usage is set` PASS |
| UI-01 | 05-01, 05-03 | Кнопка Clear в шапке ChatPanel | SATISFIED | ActionIcon `aria-label={t("chat.clearChat")}` `onClick={handleClear}` `disabled={isRunning}`; тесты `disables Clear button while isRunning` и `clicking Clear resets messages...` PASS |

---

### Anti-patterns

| Файл | Строка | Паттерн | Серьёзность | Влияние |
|------|--------|---------|-------------|---------|
| — | — | — | — | Anti-patterns не обнаружены |

Специально проверено:
- Нет `TBD`, `FIXME`, `XXX` в файлах фазы
- Нет `return null` или заглушек в StatusBar/ChatPanel
- `notifications.show` в ChatPanel присутствует только в `handleSaveMessage` (строки 407, 412) — НЕ в `handleClear`; D-05-14 соблюдён
- `ConfirmModal` в ChatPanel отсутствует; D-05-09 соблюдён

---

### Требуется ручная верификация

Автоматические проверки прошли полностью (5/5 истин верифицированы, 119/119 тестов, typecheck 0 ошибок). Следующие сценарии требуют живого приложения:

#### 1. Отображение модели в StatusBar при реальном запуске сессии

**Тест:** Запустить приложение, открыть чат, начать сессию Claude и убедиться что имя модели появляется в StatusBar сразу после первого system-события.
**Ожидается:** В нижней строке ChatPanel появляется «Model: claude-sonnet-4-6» (или другая активная модель).
**Почему нужен человек:** Требует живого Tauri-процесса с настроенным Claude CLI; unit-тесты проверяют передачу prop, но не реальный поток событий от CLI.

#### 2. Копирование session_id через CopyButton

**Тест:** В той же сессии убедиться что session_id отображается как prefix 8 символов + «...», кнопка-иконка Copy рядом копирует полный UUID в буфер обмена.
**Ожидается:** StatusBar показывает «Session: abc12345...», клик по иконке копирует полный UUID, иконка переключается на галочку на ~1.5 сек.
**Почему нужен человек:** Поведение CopyButton (clipboard.writeText) недоступно в jsdom; реальный Clipboard API нужен браузерному WebView.

#### 3. Обновление счётчика токенов и Tooltip-breakdown

**Тест:** Отправить несколько сообщений в рамках одной сессии и наблюдать за счётчиком токенов в StatusBar.
**Ожидается:** Поле «Tokens» обновляется после каждого assistant-ответа; Tooltip при наведении показывает breakdown по Input/Output/Cache creation/Cache read.
**Почему нужен человек:** Tooltip в Mantine рендерится лениво — только при hover; unit-тест проверяет сумму в DOM, но не открытие Tooltip.

#### 4. Визуальный результат нажатия Clear-кнопки

**Тест:** Нажать кнопку Clear (иконка ластика в шапке ChatPanel) и убедиться что переписка исчезает, model/session/tokens сбрасываются в em-dash.
**Ожидается:** После клика: поле сообщений пустое, StatusBar показывает «Model: —», «Session: —», «Tokens: —».
**Почему нужен человек:** Поведение подтверждается unit-тестом, но визуальный результат и правильное положение кнопки в header требуют ручного осмотра.

#### 5. Отсутствие «прилипших» значений после Clear + новая сессия (SC #5)

**Тест:** Запустить новую сессию после Clear и убедиться что StatusBar показывает данные новой сессии.
**Ожидается:** После первого system-события новой сессии StatusBar обновляется на имя модели и новый session_id; токены начинаются с 0.
**Почему нужен человек:** SC #5 покрыт unit-тестом на смену session_id, но end-to-end сценарий Clear + новый запуск требует live-сессии.

---

## Итоговая оценка

**Все автоматически верифицируемые критерии ПРОЙДЕНЫ:**

- 5/5 ROADMAP Success Criteria верифицированы через код и тесты
- Все 4 требования (VIS-01, VIS-02, VIS-03, UI-01) удовлетворены
- 119/119 тестов проходят (`npm run test`)
- TypeScript typecheck exit 0 (`npm run typecheck`)
- Backend (`src-tauri/`, `crates/`, `packages/`) не задет
- Все D-05-04..14 LOCKED-решения соблюдены
- Phase 4 invariant (`useTauriListener`, keep-mounted рендер) сохранён

**Статус `verified`** — изначально установлен `human_needed` из-за live-UI тестов, которые не могут быть автоматизированы в jsdom (CopyButton clipboard, Tooltip hover, визуальная проверка layout). 5/5 human-UAT сценариев подтверждены пользователем (см. `05-HUMAN-UAT.md`, resolved 2026-05-18T06:57:42Z) — статус повышен до `verified` при закрытии milestone v1.1.

---

_Верифицировано: 2026-05-18T10:45:00Z_
_Верификатор: Claude (gsd-verifier)_
