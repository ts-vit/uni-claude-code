# Phase 5: Chat Visibility & Controls — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Source:** advisor-mode `/gsd-discuss-phase 5` — 4 параллельных gsd-advisor-researcher агента + delegation decisions от пользователя («Прими все решения сам. Раскладка StatusBar» — см. DISCUSSION-LOG.md).

<domain>
## Phase Boundary

Фаза добавляет постоянную видимость метаданных Claude-сессии в `StatusBar` и UI-кнопку Clear в шапке `ChatPanel`. Никакой новой бизнес-логики, никаких изменений backend (`crates/claude-code-core`, `src-tauri/src/commands/claude.rs`) — все источники данных уже летят с CLI через stream-JSON и парсятся в `crates/claude-code-core/src/parser.rs`. Изменения исключительно во frontend: `src/components/chat/StatusBar.tsx`, `src/components/chat/ChatPanel.tsx`, `src/types/claude.ts` (расширение типа `SessionResult` или добавление нового), `src/i18n/locales/{en,ru}.json` (новые ключи), тесты в `src/__tests__/`.

**В scope:**
- VIS-01: имя активной модели Claude видно постоянно в StatusBar — после первого `system` event берётся `model` оттуда, до этого fallback на `projectModel` prop.
- VIS-02: `session_id` активной сессии видим в StatusBar — префикс 8 символов + click-to-copy полного значения.
- VIS-03: накопленное token usage (input / output / cache) видно в StatusBar — обновляется по `assistant.message.usage` events.
- UI-01: явная UI-кнопка Clear в шапке `ChatPanel` — эквивалентна текстовой команде `/clear` (сброс messages, sessionResult, hasSessionRef, archivedMessagesRef, стриминг-состояния + новых полей session metadata).
- Phase 5 success criterion #5: метаданные корректно сбрасываются при пересоздании сессии (Clear / новая сессия с другой моделью) — никакой sticky-state.

**Вне scope:**
- `--continue` Claude CLI integration (PERSIST-CONTINUE-01 в Future).
- DB-персистентность переписки между запусками (PERSIST-DB-01 в Future).
- Context-window % с per-model лимитами (VIS-CTX-01 в Future) — token usage показываем абсолютным числом, без процента от лимита.
- Осмысленные лейблы табов (UI-TAB-01).
- ConfirmModal при закрытии running-таба (UI-CLOSE-01).
- Кликабельный mode-badge для смены режима (UI-MODE-01).
- Любые изменения backend `claude-code-core` / `src-tauri/`.
- Любые изменения публичных API `@uni-fw/*` / `uni-*` крейтов (compatibility-инвариант с milestone v1.0).
- ConfirmModal перед Clear — решение «инстант, без подтверждения» (см. D-05-09).
- Per-turn vs session-cumulative переключатель — фиксируем только session-cumulative (см. D-05-04).

</domain>

<decisions>
## Implementation Decisions

Все нижеперечисленные решения приняты Claude по делегации пользователя («Прими все решения сам. Упор на качество», см. [[feedback-discuss-phase-delegation]] и DISCUSSION-LOG.md). Каждое D-XX имеет явный rationale и закрывает один или несколько success criteria фазы.

### Раскладка StatusBar

#### D-05-01: Flat single-row layout с Tooltip-раскрытием cache (LOCKED)

`StatusBar` остаётся одним горизонтальным `Group` от Mantine (как сейчас). Field order слева направо:

```
[Running/Idle badge] · model · session_prefix [CopyButton] · ΣTokens (tooltip → in / out / cache_creation / cache_read) · $cost · dur · turns
```

- **Status badge** — без изменений (left-anchor, самый часто меняющийся signal).
- **model** — `Text size="xs" c="dimmed"`. Источник: `sessionModel ?? projectModel ?? "—"` (см. D-05-12).
- **session_id** — префикс 8 символов (как уже сейчас в `system-info` сообщении: `claudeEvent.session_id.slice(0, 8)...`). Рядом — `CopyButton` от Mantine + `ActionIcon size="xs" variant="subtle"` с `IconCopy` (tabler). При null показывается `"—"`, ActionIcon не рендерится.
- **ΣTokens** — единственное число для накопленных токенов: `Text` с агрегатом по правилу VIS-03 (см. D-05-04). `Tooltip` от Mantine оборачивает Text — на hover показывается breakdown в 4 строки: `Input: N`, `Output: N`, `Cache creation: N`, `Cache read: N`.
- **$cost / dur / turns** — без изменений, как сейчас, после metadata.

**Rationale:** zero-state-management Tooltip (purely presentational), минимальный diff с существующим `Group`, респектит constraint dual-panel layout (до 5 параллельных вкладок × до 3 проектов), читается «как одна строка статуса» в стиле VS Code status bar. Альтернатива «Popover на click» отвергнута: лишняя `useState(opened)` без явной выгоды для соло-пользователя.

**Не выбраны:**
- Two-line StatusBar (Option D advisor table) — ломает существующую высоту в `Stack gap={0}` ChatPanel; не оправдано для соло-пользователя.
- Popover (Option C) — лишняя state machine, click-friction.

#### D-05-02: session_id отображается префиксом 8 символов + полный через CopyButton (LOCKED)

Совпадает с уже работающим паттерном в `system-info` сообщении (`ChatPanel.tsx:142`). Полный session_id копируется через `Mantine.CopyButton` (render-prop wrapping ActionIcon с `IconCopy` / `IconCheck` toggle). Tooltip на иконке: `t("chat.copySessionId")`.

**Rationale:** короткий префикс читается, полный нужен только для grep по `~/.claude/projects/`. Click-to-copy — индустриальный стандарт (VS Code, GitHub UI). Никакой alternative «full UUID inline» — не помещается в StatusBar при 5 чатах.

#### D-05-03: cache_creation + cache_read объединены в отображении, но раздельно в state (LOCKED)

Per VIS-03 wording: «cache (cache_creation + cache_read)» — в StatusBar показываем сумму. Однако внутренний accumulator в `ChatPanel` хранит оба значения отдельно (`cache_creation_input_tokens`, `cache_read_input_tokens`) — это даёт будущей фазе (VIS-CTX-01 / cost calculation с per-model multipliers) точные данные без миграции state.

В Tooltip-breakdown показываем обе строки отдельно (см. D-05-01).

**Rationale:** raw data preservation для будущих фаз, compliant с явным wording VIS-03 для UI.

### Источник и агрегация usage

#### D-05-04: Source of truth — только `assistant.message.usage` event (LOCKED)

Накопление usage идёт **исключительно** из `assistant` events (`ClaudeEvent.type === "assistant"`). Per phase wording VIS-03: «обновляется по мере получения assistant-событий с полем usage» — формулировка сама фиксирует источник.

- `result.usage` — **НЕ читаем** (typed `unknown` в TS, double-count risk — в одной CLI-инвокации `result` несёт ту же usage, что и финальный `assistant`).
- `stream_event.message_delta.usage` — **НЕ читаем** (typed `unknown` в TS; usage в `message_delta` cumulative per-message и переписывает себя несколько раз за стрим; усложнение без явной UX-выгоды).

**Rationale:** `Usage { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens }` уже строго типизирован в `MessageInfo.usage` (см. `src/types/claude.ts:54-61`); никаких `serde_json::Value` гимнастик, никакого парсинга в runtime, никакого double-count. UX-цена — нет «real-time tick» во время стриминга одного длинного ответа; цена приемлема, так как обновление происходит каждые ~5-30 сек (intervalmessage boundary) для типичного chat-use.

#### D-05-05: Накопление на уровне «вкладки до Reset», не «процесса CLI» (LOCKED)

Аккумулятор `accumulatedUsage: Usage | null` живёт в локальном `useState` `ChatPanel`. Reset происходит в:

1. **Clear button / `/clear` text command** → `accumulatedUsage = null`.
2. **Новый `system` event с другим `session_id`** чем текущий `sessionId` → `accumulatedUsage = null`, затем начинаем копить с нуля.
3. **При `accumulatedUsage === null` и приходе `assistant` с `usage`** — инициализируем от значения этого события.
4. **При `accumulatedUsage !== null` и приходе `assistant` с `usage`** — `next = { input: prev.input + curr.input, ... }`.

Каждое из 4 полей `Usage` суммируется независимо.

**Rationale:** требование VIS-03 «накопленное за сессию». «Сессия» в UNI = период до следующего Clear или смены `session_id`. Если пользователь жмёт Clear → новая логическая сессия → счётчик с нуля. Если CLI продлевает session_id через `continueSession=true` (multiple `claude_start` invocations подряд) → продолжаем копить. Это совпадает с интуицией пользователя «сколько я пожёг за этот разговор».

#### D-05-06: Reset accumulator при изменении session_id, не при `claude_start` (LOCKED)

`claude_start` сам по себе НЕ сбрасывает accumulator — каждый prompt в той же вкладке зовёт `claude_start` отдельно, но `continueSession=true` сохраняет session_id. Сбрасываем только когда `system.session_id !== prev sessionId`. Это покрывает случаи:
- Пользователь жмёт Clear → `hasSessionRef=false` → следующий prompt пойдёт без `continueSession` → CLI создаст новый session_id → reset.
- Пользователь меняет проект / model в Settings (если бы это форсило reset session — на текущий момент не форсит, но дизайн готов).

**Rationale:** session_id есть единственный канонический маркер «логической сессии»; всё остальное (process lifecycle, panelId) — implementation detail.

### Clear-button UX

#### D-05-07: Icon-only ActionIcon, размещение `ml="auto"` справа в header'е (LOCKED)

Кнопка добавляется в существующий `Group` шапки `ChatPanel.tsx:460-469`. Layout:

```tsx
<Group px="xs" py={4} gap="xs" style={{ borderBottom: ... }}>
  <Badge ... /* mode-badge как сейчас */ />
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
</Group>
```

С `Tooltip label={t("chat.clearChat")}` оборачивающим `ActionIcon`.

**Rationale:** match indstry pattern VS Code Copilot / Cursor / Cline — header-уровневая иконка справа, tooltip, icon-only. `ml="auto"` пространственно отделяет Clear от mode-badge → исключает Google AI Studio anti-pattern (clear adjacent to action). Размер `xs` + variant `subtle` совпадает с существующим bookmark-button в `MessageItem.tsx:46-63`.

#### D-05-08: Иконка — `IconEraser` от tabler-icons (LOCKED)

`@tabler/icons-react` уже в депенденс. `IconEraser` семантически точнее, чем альтернативы:
- `IconTrash` подразумевает «удаление с риском навсегда» — создаёт ненужную anxiety.
- `IconRefresh` подразумевает «перезагрузить состояние того же объекта» — не подходит для «начать новую переписку».
- `IconClearAll` — приемлемо, но `IconEraser` более distinct visual.
- `IconPlus` / IconMessage+ (new chat) — нерелевантно: у нас Clear-в-табе, а не New-Tab.

#### D-05-09: Никакого ConfirmModal — instant clear (LOCKED)

Кнопка сразу вызывает `handleClear` без подтверждения. Match precedent: текстовая команда `/clear` уже работает instant (см. `ChatPanel.tsx:396-403`); никакого diff в UX между «напечатал /clear» и «нажал кнопку».

**Rationale:**
- Личный инструмент, accidental cost = «напечатать prompt заново» (низкий).
- Industry pattern: VS Code Copilot, Cursor, Continue.dev — все instant.
- Существующий `/clear` text command — без confirm.
- Google AI Studio anti-pattern (clear adjacent to Run → accidental click) митигирован через `ml="auto"` + tooltip + размер `xs` (=18px target — далеко от PromptInput и от mode-badge).

ConfirmModal оставляем доступным в `@uni-fw/ui` — но не вяжем сюда. Если в будущей фазе появится auto-save → можно пересмотреть.

#### D-05-10: `disabled={isRunning}` — Clear НЕ работает во время стрима (LOCKED)

Когда `isRunning === true`, кнопка disabled. Пользователь должен сначала нажать Stop (уже существующий в `PromptInput`), потом Clear.

**Rationale:**
- Технический риск: clear во время стрима оставляет Rust runner в inconsistent state (PromptInput игнорирует `isRunning` для send, но Stop корректно завершает stream → runner cleanup; clear без Stop теряет ссылку на streaming buffers).
- UX: Stop+Clear — 2 жеста, но ясная mental model. Альтернатива «Stop+Clear одним нажатием» (compound action) усложняет — пользователь может захотеть Stop без Clear (продолжить с тем же контекстом, отправив другой prompt).
- Matching the existing PromptInput state machine: Send disabled при running, Stop активен при running.

#### D-05-11: handleClear выделить как переиспользуемый callback (LOCKED, Claude's discretion)

Текущая логика `/clear` (`ChatPanel.tsx:396-403`) inline в `handleSend`. Для DRY выделить:

```tsx
const handleClear = useCallback(() => {
  setMessages([]);
  setSessionResult(null);
  setSessionModel(null);  // new
  setSessionId(null);     // new
  setAccumulatedUsage(null); // new
  hasSessionRef.current = false;
  archivedMessagesRef.current = [];
  resetStreamingState();
}, [resetStreamingState]);
```

`handleSend` для `text.trim() === "/clear"` зовёт `handleClear()` вместо inline-копии. Кнопка тоже зовёт `handleClear`. Notification `t("chat.cleared")` — НЕ показываем (`/clear` сейчас не показывает; для consistency не добавляем).

**Rationale:** single source of truth для reset-логики; легко расширять при добавлении новых полей state в будущем.

### Lifecycle метаданных

#### D-05-12: Em-dash placeholders + model fallback на projectModel (LOCKED)

State в `ChatPanel`:
- `sessionModel: string | null` — заполняется из `system.model`, сбрасывается на Clear.
- `sessionId: string | null` — заполняется из `system.session_id`, сбрасывается на Clear.
- `accumulatedUsage: Usage | null` — см. D-05-05.

`StatusBar` принимает новые props и рендерит:
- **model**: `sessionModel ?? projectModel ?? "—"`. То есть: пока CLI не прислал `system`, показываем то что пользователь выбрал в проекте (или global model setting если project.model null). После `system` — реальную модель из CLI subprocess'а.
- **session_id**: если `sessionId === null` — `"—"`, CopyButton скрыт. Иначе — префикс 8 символов + CopyButton.
- **usage**: если `accumulatedUsage === null` — `"—"`. Иначе — отображаемое число (input+output+cache в Tooltip).

**Rationale:**
- Closes phase success criterion #5 («нет прилипших значений») — все runtime поля очищаются на Clear до прихода новых данных.
- Асимметрия model vs session/usage отражает источник данных: model — config attribute (`project.model`, передаваемая в `claude_start`), session/usage — runtime artifact. Показывать model даже в pre-session состоянии — корректное поведение, не stale.
- Em-dash («—») — более явный signal «нет данных», чем пустота / hidden field, и избегает layout-shift при появлении/исчезновении полей. Это VS Code status bar convention.

#### D-05-13: Mid-session model change — projectModel меняется реактивно, sessionModel перебивает (LOCKED, Claude's discretion)

Если пользователь меняет `project.model` в Settings во время идущей сессии:
- `projectModel` prop у `ChatPanel` обновляется реактивно (App.tsx ре-рендерит).
- `sessionModel` (текущий running CLI subprocess) — НЕ меняется, потому что CLI уже запущен со старым флагом `--model`.
- В StatusBar показываем `sessionModel ?? projectModel`. Так как `sessionModel !== null` (сессия идёт) — показываем модель, с которой реально работает CLI.
- На следующий prompt `claude_start` пойдёт с новым `projectModel`, CLI создаст новый process с новой моделью, новый `system` event обновит `sessionModel`.

Это поведение consistent: StatusBar показывает «модель, с которой реально идёт диалог сейчас», а не «модель, которая выбрана в настройках для следующего разговора».

**Rationale:** truthfulness > eagerness. Пользователь, увидев в StatusBar старую модель, понимает: «текущий subprocess запущен со старой моделью, для смены надо Clear или Stop+Send». Eager-flip создал бы lie в UI.

#### D-05-14: Не показываем notification на Clear (LOCKED, Claude's discretion)

`/clear` сейчас работает silent (нет notification). Кнопка тоже silent. `chat.cleared` key в i18n существует, но не используется — оставляем как dead-key для возможной будущей фичи (например, Toast с Undo). Не удаляем — оба locale file'а одинаковые, key безвреден.

**Rationale:** consistency с существующим `/clear` поведением; зеро-friction; визуальный feedback и так есть — переписка очистилась, status вернулся в idle.

### Claude's Discretion (planner может уточнить)

- **i18n keys** конкретные имена — на усмотрение планнера. Рекомендованный namespace `chat.*`: `chat.model` («Модель»), `chat.session` («Сессия» или «Session»), `chat.tokens` («Токены»), `chat.tokensTooltip.input`, `chat.tokensTooltip.output`, `chat.tokensTooltip.cacheCreation`, `chat.tokensTooltip.cacheRead`, `chat.copySessionId` («Копировать session ID»), `chat.copied` («Скопировано»), `chat.clearChat` («Очистить чат»). Если в проекте уже есть `common.copy` / `common.copied` — переиспользовать.
- **Точный размер шрифта / отступы** между полями StatusBar — следовать существующему `gap="md" / size="xs" / c="dimmed"`.
- **Точная стратегия форматирования больших чисел** в ΣTokens (например `12_345` vs `12.3k` vs `12,345`) — рекомендация: показывать абсолютные числа с тысячным разделителем по locale (`new Intl.NumberFormat()`), без сокращений (k/M). Тогда легко grep по логам.
- **Точный shape тип `SessionResult` или новый тип `SessionMetadata`** — планнер может либо расширить существующий `SessionResult` (`src/types/claude.ts:257-263`), либо ввести параллельный `SessionMetadata { model, sessionId, usage }`. Рекомендация: новый тип `SessionMetadata`, потому что `SessionResult` сейчас семантически означает «итоги завершённой сессии» (cost, duration, turns), а metadata — текущее состояние live-сессии. Оставит код читабельным.
- **Тесты** — обязательное покрытие в `ChatPanel.test.tsx` / `StatusBar.test.tsx`: (1) после Clear все 3 поля сбрасываются; (2) после `assistant` event с usage — accumulator корректно растёт; (3) при `disabled={isRunning}` Clear не отрабатывает; (4) `system` event с новым session_id обнуляет accumulator. Конкретные имена test-cases — планнер.

### Folded Todos

Нет — единственный matched todo (`wr-02-terminal-refit-view-switch.md`, score 0.6) тематически не подходит (терминал на view-switch, не chat metadata). См. `<deferred>`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 5 source-of-truth
- `.planning/REQUIREMENTS.md` § Visibility / UI — VIS-01, VIS-02, VIS-03, UI-01 raw acceptance.
- `.planning/ROADMAP.md` § Phase 5 — 5 success criteria (включая criterion #5 «нет sticky-state»).
- `.planning/PROJECT.md` § Current Milestone v1.1 — target features, Out of Scope, key context.
- `.planning/phases/05-chat-visibility-controls/05-DISCUSSION-LOG.md` — полный лог решений и rationale per gray area.

### Phase 4 carry-over (must understand chat persistence inheritance)
- `.planning/phases/04-chat-persistence/04-CONTEXT.md` — D-04-01..07. Особо важно: D-04-01 (keep-mounted), D-04-07 (`useTauriListener` подписки не теряются). Phase 5 строит UI поверх этого инварианта.

### Frontend код — основные правки
- `src/components/chat/StatusBar.tsx` — главное место правок. Расширить props (`model`, `sessionId`, `usage`), добавить новые поля рендера, обернуть ΣTokens в `Tooltip`, CopyButton для session_id.
- `src/components/chat/ChatPanel.tsx` — добавить state (`sessionModel`, `sessionId`, `accumulatedUsage`), обработчики в `handleClaudeEvent` (case `"system"` → set model/sessionId + reset accumulator при смене session_id; case `"assistant"` → accumulate usage), выделить `handleClear`, добавить Clear button в header `Group`, прокинуть новые props в `<StatusBar />`.
- `src/types/claude.ts` — определить `SessionMetadata` (см. D-05 Claude's Discretion); расширить existing типы по необходимости. `Usage` уже строго типизирован — переиспользовать.
- `src/i18n/locales/en.json` и `src/i18n/locales/ru.json` — добавить keys из D-05 (ровно одинаковые keys в обоих файлах).

### Frontend код — прочитать (НЕ менять)
- `src/components/chat/MessageItem.tsx` — паттерн `ActionIcon size="xs" variant="subtle"` для header-кнопок (см. строки 45-64, IconBookmark bookmark-button).
- `src/components/DualPanelLayout.tsx` — multi-tab контекст, panelId pattern.
- `src/utils/safeListener.ts` (`useTauriListener`) — почему подписки не теряются (Phase 4 invariant).
- `crates/claude-code-core/src/types.rs` — Rust shape `MessageInfo` / `Usage` / `AssistantEvent` (для понимания что прилетает).
- `crates/claude-code-core/src/parser.rs` — `parse_event` + тесты (`test_parse_assistant_message` показывает usage shape).

### Packages — переиспользуемые компоненты
- `packages/uni-fw-ui/src/components/ConfirmModal.tsx` — НЕ используется (D-05-09 — instant clear без confirm). Документация для понимания «почему не нужен».
- Mantine docs (внешний ref, через Context7 если нужно): `CopyButton` (render-prop), `Tooltip`, `ActionIcon` — уже все в `@mantine/core` ^8.

### Tests, которые надо обновить / создать
- `src/__tests__/StatusBar.test.tsx` — может не существовать; создать с покрытием новых props (см. D-05 Claude's Discretion список test-cases).
- `src/__tests__/ChatPanel.test.tsx` — обновить под новые state-поля и handleClear; тесты Clear-button click + accumulator.
- `src/__tests__/setup.ts` — мокает `@tauri-apps/api`, `i18next`, Mantine. Скорее всего трогать не надо.

### Codebase maps
- `.planning/codebase/STRUCTURE.md` § «New chat component» — место, куда добавлять (если выделяем helper).
- `.planning/codebase/CONVENTIONS.md` § Component Patterns / Hook Patterns / i18n Usage — naming, useTranslation, namespaced keys.

### Backend — НЕ трогать
- `src-tauri/src/commands/claude.rs` — `ClaudeManager` (доказательство, что backend ничего не теряет; источник `claude-event`).
- `crates/claude-code-core/src/runner.rs` — RunnerEvent wrapping.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Mantine `CopyButton`** (render-prop API, `{(copy, copied)} => ...`) — стандартный паттерн для click-to-copy в Mantine 8. Уже доступен через `@mantine/core`.
- **Mantine `Tooltip`** — уже используется в `MessageItem.tsx:46` для bookmark hint; same pattern для ΣTokens.
- **`@tabler/icons-react`** — `IconCopy`, `IconCheck`, `IconEraser` — все доступны, проект уже использует `IconBookmark`, `IconMessage`, `IconFolderOpen`.
- **`useTranslation()`** — стандартный hook react-i18next, уже в каждом компоненте chat/.
- **CSS variables** — `--ucc-bg-sidebar`, `--ucc-border-subtle` уже используются в StatusBar; новые поля наследуют ту же стилистику.

### Established Patterns
- **State + ref pattern** — value, который нужен в callbacks без re-render, — `useRef`. Render-driving — `useState`. Для accumulator: `useState<Usage | null>` (это render-driving, нужно ре-рендерить StatusBar).
- **Functional state updates** — `setAccumulatedUsage(prev => ...)` при суммировании (избежать stale closure при быстром стриминге).
- **ActionIcon `size="xs" variant="subtle"`** — convention для header-уровневых иконок (см. `MessageItem.tsx:46-63` IconBookmark).
- **i18n namespaced keys** — `chat.*` для всего что относится к ChatPanel; keys в обоих локалях identical.
- **`disabled={isRunning}`** — convention для UI controls, которые могут портить state CLI-runner'а.

### Integration Points
- `system` event handler в `ChatPanel.handleClaudeEvent` (строки 137-156) — расширить: set `sessionModel`, set `sessionId`, reset accumulator при смене session_id. Сейчас этот case формирует `system-info` сообщение — оставить как есть (всё ещё полезно для inline-видимости), просто добавить дополнительные setState.
- `assistant` event handler (строки 251-271) — добавить логику accumulator при наличии `claudeEvent.message.usage`.
- `result` event handler (строки 273-295) — НЕ модифицировать в части usage (D-05-04).
- `handleSend` `/clear` ветка (строки 396-403) — заменить на вызов `handleClear()` (D-05-11).
- `<StatusBar isRunning={isRunning} sessionResult={sessionResult} />` (строка 520) — расширить props: `model`, `sessionId`, `usage`.

</code_context>

<specifics>
## Specific Ideas

### Точные строки кода для интеграции
- `src/components/chat/StatusBar.tsx:5-9` — расширить `StatusBarProps` интерфейс.
- `src/components/chat/StatusBar.tsx:14-55` — добавить новые поля рендера между status-badge и существующими cost/duration/turns. Порядок: badge → model → session+CopyButton → tokens+Tooltip → cost → duration → turns.
- `src/components/chat/ChatPanel.tsx:44-54` — добавить 3 новых state переменных рядом с существующими `useState`/`useRef`.
- `src/components/chat/ChatPanel.tsx:136-156` — расширить case `"system"` ветку switch.
- `src/components/chat/ChatPanel.tsx:251-271` — расширить case `"assistant"` ветку для accumulator.
- `src/components/chat/ChatPanel.tsx:396-403` — заменить inline /clear на `handleClear()`.
- `src/components/chat/ChatPanel.tsx:460-469` — добавить ActionIcon Clear-button в header Group, после Badge с `ml="auto"`.
- `src/components/chat/ChatPanel.tsx:520` — обновить props `<StatusBar />`.

### Конкретные truths, которые планнер должен проверить (планнер или тесты)

1. После первого `system` event StatusBar показывает реальную `model` из CLI; пока не пришло — показывает `projectModel`.
2. После Clear — `sessionModel` сброшен, в StatusBar `projectModel` (fallback) или `"—"` если project.model null.
3. После Clear → новый prompt → новый CLI subprocess → новый `system` event → новый `session_id` — accumulator с нуля.
4. Multiple prompts в одной вкладке без Clear (`continueSession=true`) — `system.session_id` тот же → accumulator продолжает расти.
5. На `assistant` event с usage `{ input: 100, output: 50, cache_creation: 0, cache_read: 200 }` после предыдущего state `{ 200, 100, 0, 100 }` → новый state `{ 300, 150, 0, 300 }`.
6. Click на Clear button при `isRunning === true` — игнорируется (disabled, не отправляет событие).
7. Click на Clear button при `isRunning === false` — мгновенно очищает messages, sessionMetadata, accumulator; никакой ConfirmModal.
8. CopyButton на session_id копирует **полное** значение (не префикс) в clipboard.
9. Tooltip на ΣTokens показывает 4 строки с раздельными значениями.
10. При смене проекта (Phase 4 invariant — keep-mounted, не unmount) — StatusBar показывает metadata именно активного проекта, isActive prop корректно прокидывает.

### Edge cases для планнера
- Race condition: `system` event прилетает ДО first `assistant` event. Между ними StatusBar показывает model/sessionId, но `accumulatedUsage === null` → tokens=`"—"`. Это OK.
- Race condition: пользователь жмёт Clear ровно в момент прилёта `assistant` event — flush уже в очереди. `handleClear` обнуляет state; setMessages([]) выгоняет последнее. Streaming buffers в `streamBufferRef` тоже обнуляются через `resetStreamingState()`. Test: jest fake timers + click Clear в момент scheduleStreamFlush.
- continueSession после Clear: `hasSessionRef = false` → следующий prompt в `claude_start` без `continueSession` → CLI создаёт новый session_id → first `assistant`-usage инициализирует accumulator (а не суммирует с предыдущим, так как accumulator уже null).

### Performance sanity
- `setAccumulatedUsage` на каждом `assistant` event — 1 setState per turn (~5-30 сек). Никакого performance risk.
- `Tooltip` render — Mantine lazy-mount по hover; никакого permanent overhead.
- `CopyButton` — children-функция, рендерится один раз.

</specifics>

<deferred>
## Deferred Ideas

Все идеи ниже — НЕ в этой фазе. Планнер не должен пытаться их подхватить.

- **Per-turn breakdown в StatusBar** (last turn vs cumulative) — не нужно. VIS-03 говорит только «накопленное», single counter.
- **Cost-per-turn расчёт с per-model multipliers** — для cache_creation (×1.25 от input) и cache_read (×0.1) — отдельная фаза. Сейчас показываем `total_cost_usd` из result event как сейчас, без модификации.
- **Context-window %** (например `47k / 200k = 23%` или индикатор «approaching limit») — VIS-CTX-01 в Future REQUIREMENTS.md.
- **Real-time usage update во время стриминга длинного сообщения** через `stream_event.message_delta.usage` — D-05-04 отложил, нужен ровно когда CLI начнёт эмитить очень длинные ответы (минуты). Пока не делаем.
- **Toast с Undo при Clear** — D-05-14. Если в будущем добавится auto-save messages → можно. Сейчас нет.
- **`/clear` text command UX расширения** (например `/clear --soft`, sparing model state) — не нужно.
- **Reset accumulator при view-switch** — НЕТ, Phase 4 invariant именно про «состояние переживает navigation».
- **Изменение Stop button** — outside scope (он уже работает корректно в PromptInput).
- **Display model badge в шапке вкладки** (вместо «Session 1») — UI-TAB-01 в Future. Не делаем.

### Reviewed Todos (not folded)

- `wr-02-terminal-refit-view-switch.md` (score 0.6, area=general) — терминал на view-switch refit. Тематически связан с Phase 4 keep-mounted invariant, но никак не пересекается с chat-metadata visibility или Clear-button UX. Оставлен в `.planning/todos/pending/` как deferred — будет решён в отдельной фазе (или ad-hoc fix) когда у пользователя дойдут руки. См. сам todo для возможного fix.

</deferred>

---

*Phase: 05-chat-visibility-controls*
*Context gathered: 2026-05-18 advisor-mode (4 parallel gsd-advisor-researcher agents + delegated decisions)*
