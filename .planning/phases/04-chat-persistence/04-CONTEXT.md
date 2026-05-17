# Phase 4: Chat Persistence — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Source:** Inline capture from milestone v1.1 scoping conversation (no separate /gsd:discuss-phase run — все ключевые решения зафиксированы при `/gsd-new-milestone`).

<domain>
## Phase Boundary

Эта фаза закрывает корневую причину потери переписки чата при навигации между view и активным проектом в `src/App.tsx`. Поведение приложения для пользователя меняется только в одном измерении: «переписка не пропадает». Никаких новых компонентов, никакого нового рендеринга, никакого изменения IPC/backend.

**В scope:**
- `src/App.tsx` — заменить condition-based рендер `DualPanelLayout` (только при `view === "main"` и `project.id === activeProject.id`) на always-mounted рендер с управлением видимостью через CSS (`display: none` для неактивного view / неактивного проекта).
- Поведение в пределах `ui.maxOpenProjects` (по умолчанию 3) — все открытые проекты держим смонтированными, переключение между ними не размонтирует панели.
- Frontend state, который раньше терялся при unmount: `ChatPanel.messages`, `ChatPanel.sessionResult`, `ChatPanel.hasSessionRef`, `ChatPanel.archivedMessagesRef`, `ChatPanel.toolJsonBuffersRef`, `ChatPanel.streamBufferRef`, `ChatPanel.currentBlockIndexRef`, `ChatPanel.nextMessageIdRef`, `DualPanelLayout.discussTabs`, `DualPanelLayout.discussActiveTab`.
- Backend state остаётся **без изменений**: `claude_start` / `claude_stop` IPC уже идемпотентны через `panelId`; runners в `ClaudeManager` уже переживают любые frontend-перемонтирования (они никогда от них и не зависели).

**Вне scope:**
- DB-персистентность переписки между запусками приложения (REQ: PERSIST-DB-01 в Future).
- Интеграция с `--continue` Claude CLI (REQ: PERSIST-CONTINUE-01 в Future).
- Любые изменения backend `claude-code-core` или `src-tauri/src/commands/claude.rs`.
- Любые изменения публичных API `@uni-fw/*` / `uni-*` (compatibility-инвариант с milestone v1.0).
- Любые изменения визуального дизайна, лейблов табов, статус-бара (это Phase 5).
</domain>

<decisions>
## Implementation Decisions

### D-04-01: Keep-mounted via CSS `display: none` (LOCKED)

`DualPanelLayout` для всех `openedProjects` рендерится одновременно. Активный проект показывается через `display: flex`; неактивные — `display: none`. То же самое для не-`main` views: контент основного режима (DualPanelLayout) остаётся смонтированным, поверх него условно рендерятся компоненты `SettingsPage` / `FileTreePanel` / `DiffViewer` / `ClaudeMdEditor` / `HistoryPage` / `PipelinePage`.

**Rationale:**
- Самый дешёвый фикс, не требует ни DB, ни state-management библиотек.
- React state не теряется → автоматически закрывает оба REQ-ID (PERSIST-01, PERSIST-02) без лифтинга `messages` куда-либо выше.
- Backend Claude-runners уже переживают frontend перемонтирование — это исправление приводит frontend в соответствие с уже работающим backend поведением.
- Зеркалит подход VS Code / Cursor / IntelliJ — открытые редакторы не размонтируются при смене активного.

**Альтернативы рассмотрены и отвергнуты:**
- Лифтинг `messages` в App.tsx-уровневую Map (по аналогии с `projectLayoutState`) — больше работы, тот же эффект для пользователя, легче упустить subscriber-state (стриминг, ref-buffers).
- DB-персистентность — out of scope.

### D-04-02: Все open projects в DOM одновременно (LOCKED)

В пределах `ui.maxOpenProjects` (default 3, верхний предел задаётся `useSettings("ui.maxOpenProjects")`) — все `openedProjects` имеют свой `<DualPanelLayout />` в DOM одновременно. Активный отображается, неактивные скрыты `display: none`. Это означает до 3 параллельных смонтированных layouts × до 5 табов чата = до 15 параллельных `<ChatPanel />` в DOM.

**Rationale:**
- `maxOpenProjects` уже жёстко ограничивает количество (см. `App.tsx:58-79` — оттеснение старого проекта при превышении).
- 15 ChatPanel — приемлемая нагрузка; рендер тяжёлой переписки уже виртуализирован через `@tanstack/react-virtual` (см. `MessageList.tsx`).
- Альтернатива «кешировать messages, но рендерить только активный» теряет state стриминга у неактивных вкладок.

**Подтверждение:** существующий `ChatPanel.isActive` prop уже различает активную и неактивную вкладки внутри одной layout (`renderedMessages = isActive ? messages : messages.slice(-INACTIVE_VISIBLE_MESSAGES)` — `ChatPanel.tsx:456`). Этот же паттерн надо распространить на projects/view-level: проп `isActive` должен учитывать «активный ли этот проект в данный момент И находимся ли мы во view main».

### D-04-03: Не размонтировать DualPanelLayout при view ≠ "main" (LOCKED)

Сейчас при переключении на settings/files/diff/history/claude-md/pipeline вся ветка `{activeProject ? <DualPanelLayout /> : <WelcomeScreen />}` уходит из DOM. Это надо заменить на одновременный рендер «main»-ветки + overlay-ветки нужного view с управлением видимостью через `display`.

**Что это технически значит:**
- `AppShell.Main` всегда содержит `<DualPanelLayout />` (по одному на каждый opened project) даже когда view ≠ "main".
- Поверх (или вместо — управляется `display`) показывается компонент текущего view.
- `WelcomeScreen` рендерится, когда `activeProject === null`. Здесь поведение не меняется — некого «не размонтировать».

**Open для планнера:** конкретная DOM-стратегия — overlay (один поверх другого с z-index) или sibling (два контейнера, один скрыт display:none). Sibling проще и безопаснее (нет coupling z-index/focus), и достаточно для требования.

### D-04-04: `triggerTerminalRefit` поведение сохраняется (LOCKED)

`App.tsx:43-47` дёргает `window.dispatchEvent(new Event("resize"))` через 100мс после `handleProjectSelect`. Это нужно xterm/terminal-panel компонентам для перерасчёта размеров. После рефактора смены проекта — терминалы НЕ перемонтируются, поэтому им всё ещё нужен resize-evt, чтобы скорректировать ширину при появлении/исчезновении другого видимого DOM-узла. Поведение сохраняем.

### D-04-05: `projectLayoutState` Map становится излишним (Claude's Discretion)

После того как `DualPanelLayout` всегда смонтирован, `projectLayoutState` Map (хранение layout state между перемонтированиями) становится бесполезным — нечего восстанавливать. Решение «убрать или оставить как dead code» — на усмотрение планнера. Рекомендация: удалить полностью (включая prop `initialState` / `onStateChange` у `DualPanelLayout`), чтобы не вводить в заблуждение будущих читателей кода. Тесты обновить.

### D-04-06: Backend Claude-runner поведение не трогаем (LOCKED)

`src-tauri/src/commands/claude.rs::ClaudeManager` уже использует `Arc<Mutex<HashMap<String, ClaudeCodeRunner>>>` с ключом `panelId`. Runners живут независимо от того, видна ли соответствующая вкладка во frontend, — они всегда писали `claude-event` через `app.emit`, а frontend подписывался через `useTauriListener`. После фикса frontend подписки не теряются → события не пропускаются. **Никаких backend-изменений в этой фазе.**

### D-04-07: События `claude-event` приходят даже при невидимой панели (LOCKED, проверено)

`useTauriListener<PanelEvent>("claude-event", ...)` в `ChatPanel.tsx:124` подписывается на глобальный канал. Сейчас при unmount подписка теряется → события для этого panelId после возврата начинают приходить только новые. После фикса — подписки живут постоянно → пользователь при возврате видит всю догнавшуюся переписку (закрывает Success Criterion #3 фазы).

Никакой буферизации событий на backend-стороне не нужно — мы исправляем именно frontend race.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend код, требующий правок
- `src/App.tsx` — view router, `openedProjects` state, `projectLayoutState` Map. Главное место правки.
- `src/components/DualPanelLayout.tsx` — может быть упрощён после удаления `initialState`/`onStateChange` (см. D-04-05).
- `src/components/chat/ChatPanel.tsx` — local state, который раньше терялся (`messages`, refs, streaming buffers).

### Frontend код, который нужно прочитать (НЕ менять)
- `src/components/SettingsPage.tsx`, `src/components/FileTreePanel.tsx`, `src/components/DiffViewer.tsx`, `src/components/ClaudeMdEditor.tsx`, `src/components/HistoryPage.tsx`, `src/components/PipelinePage.tsx` — view-components, которые сейчас полностью занимают `AppShell.Main`. После фикса они сосуществуют в DOM с DualPanelLayout (но визуально один из них виден).
- `src/components/WelcomeScreen.tsx` — рендерится при `activeProject === null`; поведение не меняется.
- `src/utils/safeListener.ts` (`useTauriListener`) — race-condition-protected listener; нам важно, что после фикса hook вообще не размонтируется, поэтому race не воспроизводится.

### Тесты, которые могут потребовать обновления
- `src/__tests__/ChatPanel.test.tsx` — если меняется set of props (например, `isActive` начинает учитывать активность проекта/view).
- `src/__tests__/setup.ts` — мокает Tauri API; правки скорее всего не нужны.
- Любые тесты App.tsx / DualPanelLayout.tsx, если есть.

### Planning artefacts
- `.planning/REQUIREMENTS.md` — PERSIST-01, PERSIST-02 (raw acceptance criteria).
- `.planning/ROADMAP.md` — Phase 4 success criteria (4 truths).
- `.planning/codebase/ARCHITECTURE.md` — карта frontend↔backend (для контекста разделения).
- `.planning/codebase/CONVENTIONS.md` — naming, React patterns.

### Backend код, который НЕ трогать (но полезно прочитать для контекста)
- `src-tauri/src/commands/claude.rs` — `ClaudeManager` (доказательство, что backend уже выживает).
- `crates/claude-code-core/src/runner.rs` — event-stream wrapper.
</canonical_refs>

<specifics>
## Specific Ideas

### Конкретные строки, по которым root cause локализован

- `src/App.tsx:271` — `openedProjects.filter((project) => project.id === activeProject.id && view === "main")` — фильтр, который размонтирует всё, что не activeProject.id ИЛИ не main view. Это ключевая правка.
- `src/App.tsx:247-300` — большая `view === "settings" ? ... : view === "pipeline" ? ... :` ladder в `AppShell.Main`. Структура должна стать: «всегда рендерим DualPanelLayouts для всех openedProjects, поверх рендерим overlay компонента текущего view (если view ≠ main)».
- `src/App.tsx:31` — `const projectLayoutState = new Map<string, DualPanelLayoutState>();` — module-level Map для сохранения layout state между перемонтированиями. Становится мёртвым кодом после фикса (см. D-04-05).
- `src/components/chat/ChatPanel.tsx:44-54` — все теряемые `useState` и `useRef` (`messages`, `isRunning`, `sessionResult`, `hasSessionRef`, `currentBlockIndexRef`, `toolJsonBuffersRef`, `archivedMessagesRef`, `nextMessageIdRef`, `streamBufferRef`, `rafIdRef`).
- `src/components/DualPanelLayout.tsx:60-80` — `useState` для `layoutMode`, `activePanel`, `splitPosition`, `discussTabs`, `discussActiveTab`, инициализируемые из `initialState`. После фикса инициализация из `initialState` не нужна (state не теряется).

### Конкретные truths, которые планнер должен проверять автоматически или вручную

1. После переключения main → settings → main, массив `messages` в активной вкладке имеет ту же длину, что и до переключения.
2. После переключения проекта A → B → A, массив `messages` в активной вкладке проекта A имеет ту же длину, что и до переключения.
3. Если в момент переключения у проекта A `isRunning === true` и идёт стриминг, после возврата текст продолжает поступать и не теряется ничего из того, что Claude отдал в фоне.
4. Никаких новых subscriptions к `claude-event` не создаётся при возврате на ту же вкладку (`useTauriListener` не размонтировался → не пере-подписался).
5. `panelId` (например `discuss-1`) остаётся тем же для той же визуальной вкладки до и после переключения.
6. При вызове `handleCloseTab` (`DualPanelLayout.tsx:100`) `invoke("claude_stop", { panelId })` отрабатывает корректно — это поведение не меняется.

### Performance sanity checks

- При 3 open projects × 5 tabs × сцена с длинной перепиской — рендер должен оставаться плавным. `@tanstack/react-virtual` уже виртуализирует длинные списки сообщений, поэтому реальная DOM-нагрузка ограничена. Если планнер чует риск, может предложить debug-task с измерением, но это не обязательно — пользователь предупреждён, что любой open project держится в памяти.
- `display: none` контейнеры **не** триггерят layout/paint у потомков — это безопасно.
- Backend подписки `useTauriListener` уже работают параллельно для всех ChatPanel — это not new.
</specifics>

<deferred>
## Deferred Ideas

Перечисление ниже — это явно отложенные «нет, не делаем в этой фазе» решения, чтобы планнер не пытался их подхватить.

- **DB-персистентность** (PERSIST-DB-01) — отдельная будущая milestone (кандидат v1.2). НЕ добавлять записи в `saved_messages` или другие таблицы по ходу этой фазы.
- **`--continue` Claude CLI** (PERSIST-CONTINUE-01) — отдельная фича. `continueSession` флаг сейчас управляется через `hasSessionRef` — оставляем как есть.
- **Любая правка backend `claude-code-core` или `src-tauri/`** — out of scope. Если планнер видит «удобно было бы добавить event-replay на backend», это сигнал, что он переусложняет.
- **Изменение UI / визуала** — это Phase 5. В этой фазе любые видимые пользователю изменения (новые лейблы, новые кнопки, изменение цветов) — bug, а не feature.
- **Лифтинг `messages` state выше `ChatPanel`** — не нужен, потому что компонент не размонтируется → state живёт. Не делать.
- **Удаление `ChatPanel.isActive` prop или его модификация под view/project context** — `isActive` уже служит цели «эта вкладка в фокусе?» (для тонкого рендера inactive); может потребоваться **расширить** определение «active» до «активный таб && активный проект && main view», но это не обязательно — текущий `renderedMessages` slicing для inactive — оптимизация рендера, а не корректности.

</deferred>

---

*Phase: 04-chat-persistence*
*Context gathered: 2026-05-18 inline (no separate discuss-phase run — milestone-scoping conversation captured all decisions)*
