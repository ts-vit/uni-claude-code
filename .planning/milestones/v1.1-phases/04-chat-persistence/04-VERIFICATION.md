---
phase: 04-chat-persistence
verified: 2026-05-18T01:20:00Z
status: human_needed
score: 12/12 must-haves verified (4/4 Success Criteria, 6/6 truths, 2/2 PERSIST требований)
overrides_applied: 0
re_verification: null
human_verification:
  - test: "Терминал переживает window-resize при невидимой панели (WR-02)"
    expected: "После: открыть проект A → view main, ресайзить окно → settings → ресайзить окно ещё раз → вернуться в main. Терминал в DualPanelLayout должен корректно подогнаться (cols/rows совпадают с фактической шириной), курсор не смещён, ввод пишется в правильную колонку."
    why_human: "Регрессионный риск в keep-mounted TerminalPanel из xterm/FitAddon при display:none → display:flex без вызова triggerTerminalRefit. UAT-чек-лист 26-пунктовый НЕ содержит явного теста «ресайз окна пока активный проект в фоновом view» — D-04-04 указано в плане как сохранённое, но фактически triggerTerminalRefit вызывается только в handleProjectSelect / handleProjectCreated, не на view-switch. Может проявиться визуально (обрезанные строки терминала / смещение курсора) после реального использования."
---

# Phase 04: Chat Persistence — Verification Report

**Phase Goal:** Переписка во всех вкладках чата сохраняется при любых навигационных переключениях (view ↔ view, project ↔ project в пределах `maxOpenProjects`) — состояние не теряется ни визуально, ни в DOM, ни в памяти React.
**Verified:** 2026-05-18T01:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification (исходная)
**Decision basis:** все 4 Success Criteria формально верифицированы (автоматика + ручной UAT). Найден один WR-02-уровня риск, не относящийся напрямую к 4 SC фазы, но требующий ручной верификации.

## Goal Achievement

### Observable Truths (Success Criteria + plan must_haves)

| #   | Truth                                                                                                                                                              | Status     | Evidence                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC-1 | View ↔ view: переписка сохраняется при main → settings/files/diff/history/claude-md/pipeline и обратно                                                              | ✓ VERIFIED | `src/App.tsx:243-319` — три sibling-блока, main-блок (a) с DualPanelLayout по openedProject рендерится always (display:flex/none). Тест `keeps active project layout mounted when switching views` PASS. UAT 4-7 approved.   |
| SC-2 | Project ↔ project: переписка каждого проекта сохраняется при переключениях в пределах maxOpenProjects                                                                | ✓ VERIFIED | `src/App.tsx:257-275` — `openedProjects.map((project) => ...)` БЕЗ фильтра — все openedProjects держатся в DOM. Тест `keeps previously active project layout mounted when switching projects` PASS. UAT 8-12 approved.       |
| SC-3 | Активная сессия в фоне: claude-event продолжают приходить при невидимой панели                                                                                       | ✓ VERIFIED | ChatPanel не размонтируется (т.к. оборачивающие блоки используют display:none, а не conditional unmount) → `useTauriListener("claude-event")` в `ChatPanel.tsx` и `DualPanelLayout.tsx:94-121` остаётся живым. UAT 13-17 approved. |
| SC-4 | panelId стабильны: НЕТ «Session already running» при возврате на running-таб                                                                                          | ✓ VERIFIED | `discussTabs` state живёт в `DualPanelLayout`, который не размонтируется; React `key={tab.id}` в map гарантирует identity. UAT 18-19 approved — пользователь подтвердил отсутствие notification.                                |
| T-1  | Module-level Map `projectLayoutState` полностью удалена из `src/App.tsx`                                                                                            | ✓ VERIFIED | `Grep projectLayoutState src/` → 0 matches.                                                                                                                                                                          |
| T-2  | Импорт `DualPanelLayoutState` удалён из `src/App.tsx`; тип удалён из `DualPanelLayout.tsx`                                                                            | ✓ VERIFIED | `Grep DualPanelLayoutState src/` → 0 matches.                                                                                                                                                                        |
| T-3  | Передача props `initialState` / `onStateChange` в JSX `<DualPanelLayout>` убрана; сами props удалены из API                                                            | ✓ VERIFIED | `Grep "initialState=\|onStateChange=" src/` → 0 matches. `DualPanelLayout.tsx:34-39` — интерфейс из ровно 4 полей.                                                                                                          |
| T-4  | `panelId` каждой вкладки остаётся стабильным при view ↔ view и project ↔ project переключениях; ChatPanel не размонтируется                                            | ✓ VERIFIED | Структура `App.tsx:243-319` обеспечивает always-mounted; `DualPanelLayout.tsx:238-258` рендерит ChatPanel через map по discussTabs с `key={tab.id}` и display:none — компонент не размонтируется.                                |
| T-5  | Старый размонтирующий фильтр `project.id === activeProject.id && view === "main"` в `.filter()` исключён                                                              | ✓ VERIFIED | `Grep ".filter\(\(project\) => project.id === activeProject.id && view === \"main\"\)"` → 0 matches.                                                                                                                |
| T-6  | Внутренний onStateChangeRef + сериализующий useEffect удалены из DualPanelLayout                                                                                     | ✓ VERIFIED | `Grep "onStateChangeRef" src/components/DualPanelLayout.tsx` → 0 matches. useState инициализаторы — статические дефолты (`"single"`, `"architect"`, `50`).                                                                  |
| T-7  | `triggerTerminalRefit` сохранён (D-04-04)                                                                                                                            | ✓ VERIFIED | `src/App.tsx:41-45` — функция объявлена; вызывается в `handleProjectSelect` (строка 86) и `handleProjectCreated` (строка 94).                                                                                                |
| T-8  | Backend Claude-runner (D-04-06) не задет                                                                                                                             | ✓ VERIFIED | `git show --name-only` для всех 3 production-code commits (45ba4ba, 22c1e58, 8e0ab7e) показывает только `src/App.tsx`, `src/components/DualPanelLayout.tsx`, `src/__tests__/App.test.tsx`.                                       |

**Score:** 12/12 truths verified (включая 4 Roadmap Success Criteria + 8 must_have truths из PLAN-фронтматтеров)

### Required Artifacts

| Artifact                                  | Expected                                                                                                                                                                          | Status     | Details                                                                                                                                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                             | View router с always-mounted рендером DualPanelLayout для всех openedProjects и sibling overlay-веткой для не-main views; `openedProjects.map` присутствует; `projectLayoutState` запрещён | ✓ VERIFIED | Найден `openedProjects.map` на строке 257; `projectLayoutState` — 0 matches.                                                                                                                              |
| `src/components/DualPanelLayout.tsx`      | Упрощённый DualPanelLayout без state-lifting API; `initialState`, `onStateChange`, `DualPanelLayoutState` запрещены                                                                  | ✓ VERIFIED | `Grep "DualPanelLayoutState\|initialState\|onStateChange\|onStateChangeRef" src/components/DualPanelLayout.tsx` → 0 matches.                                                                                  |
| `src/__tests__/App.test.tsx`              | Обновлённый App.test.tsx с keep-mounted семантикой; присутствуют оба теста; `initialState`/`onStateChange` запрещены                                                                  | ✓ VERIFIED | Найдены оба теста `keeps previously active project layout mounted when switching projects` (line 63) и `keeps active project layout mounted when switching views` (line 85). Мок упрощён до `{ projectId }`. |

### Key Link Verification

| From                                     | To                                                                                                                                                       | Via                                                                                          | Status   | Details                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx AppShell.Main`              | `src/components/DualPanelLayout.tsx`                                                                                                                     | Always-mounted рендер по одному DualPanelLayout на каждый openedProject; видимость через CSS | ✓ WIRED  | `App.tsx:257` `openedProjects.map((project) => ... <DualPanelLayout cwd projectId projectModel projectPermissionMode />)`   |
| `src/App.tsx AppShell.Main`              | `SettingsPage`/`PipelinePage`/`ClaudeMdEditor`/`DiffViewer`/`FileTreePanel`/`HistoryPage`                                                                  | Sibling-рендер поверх always-mounted main-блока; main скрыта когда view !== "main"            | ✓ WIRED  | `App.tsx:279-311` — sibling-блок с `display: view !== "main" ? "flex" : "none"` и ladder по view.                          |
| `src/__tests__/App.test.tsx`             | `src/App.tsx` (после плана 04-01)                                                                                                                        | Тест проверяет, что переключение проекта НЕ размонтирует DualPanelLayout предыдущего проекта    | ✓ WIRED  | Test line 81-82: `expect(getByText("dual-panel-p1")).toBeInTheDocument()` + `expect(getByText("dual-panel-p2")).toBeInTheDocument()` — оба mounted одновременно. |
| `src/__tests__/App.test.tsx`             | `src/App.tsx`                                                                                                                                            | Тест проверяет, что переключение view !== main НЕ размонтирует DualPanelLayout                  | ⚠️ PARTIAL | Тест line 111 проверяет только `toBeInTheDocument()`, не computed-видимость. См. WR-03 в REVIEW: regression «обёртка осталась display:none» не будет поймана.   |

### Data-Flow Trace (Level 4)

| Artifact                                    | Data Variable           | Source                                                                              | Produces Real Data         | Status        |
| ------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------- | -------------------------- | ------------- |
| `DualPanelLayout` (для каждого openedProject) | `discussTabs`, `cwd`, `projectId` | `useState` static defaults (4-02) + props из `App.openedProjects`                       | Да — реальные projects из DB | ✓ FLOWING     |
| `ChatPanel` внутри DualPanelLayout          | `messages`, `sessionResult`     | `useTauriListener("claude-event")` подписка живёт постоянно благодаря keep-mounted        | Да — backend Claude events | ✓ FLOWING     |
| Always-mounted блок (a)                     | `openedProjects` array          | `App.openedProjects` state, обновляется через `addOpenedProject` / `handleProjectsChange` | Да — реальный array         | ✓ FLOWING     |

### Behavioral Spot-Checks

| Behavior                                           | Command                                  | Result                                                | Status |
| -------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------- | ------ |
| TypeScript strict компилируется без ошибок         | `npm run typecheck`                      | exit 0 (no output)                                    | ✓ PASS |
| Все Vitest тесты зелёные                           | `npm run test`                           | 19 test files, 107/107 passed, 10.61s                 | ✓ PASS |
| App.test.tsx новые keep-mounted тесты PASS         | `npm run test -- App`                    | 1 file, 2 tests passed                                | ✓ PASS |
| DualPanelLayout.test.tsx PASS (D-04-05 cleanup OK) | `npm run test -- DualPanelLayout`        | 1 file, 6 tests passed                                | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| (нет conventional `scripts/*/tests/probe-*.sh` в проекте; PLAN/SUMMARY не содержат явных probe-объявлений — этап пропущен) | — | — | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                              | Status      | Evidence                                                                                                                                    |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| PERSIST-01  | 04-01, 04-02, 04-03 | View-switch не теряет переписку — массив `ChatMessage[]`, стриминг, session_id сохраняются                              | ✓ SATISFIED | Реализация: always-mounted DualPanelLayout (App.tsx:243-319). Автотест: `keeps active project layout mounted when switching views`. UAT: 4-7. |
| PERSIST-02  | 04-01, 04-02, 04-03 | Project-switch не теряет переписку — каждый openedProject держит свой ChatPanel в DOM                                    | ✓ SATISFIED | Реализация: `openedProjects.map()` без фильтра (App.tsx:257). Автотест: `keeps previously active project layout mounted when switching projects`. UAT: 8-12. |

**Orphaned requirements check (REQUIREMENTS.md → Phase 4):** Только PERSIST-01 и PERSIST-02 связаны с Phase 4 (см. Traceability таблицу `.planning/REQUIREMENTS.md:65-71`). Других требований не назначено — orphaned items: 0.

### Anti-Patterns Found

Сканирование 3 production-файлов (src/App.tsx, src/components/DualPanelLayout.tsx, src/__tests__/App.test.tsx) на: TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER, `placeholder`/`coming soon`/`not yet implemented`, empty implementations (`return null`/`{}`/`[]`), hardcoded empty props.

| File                              | Line  | Pattern                                          | Severity | Impact                                                                                                                                                                |
| --------------------------------- | ----- | ------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                     | 252, 284 | `flex: 1` в block-context (sibling-блоки)        | ⚠ Warning | WR-01 из REVIEW: dead style, sibling-блоки не получают эффекта `flex: 1` потому что родитель — `display: block`, видимая регрессия маловероятна (height: 100% работает). |
| `src/App.tsx`                     | —     | Отсутствует `triggerTerminalRefit()` на view-switch | ⚠ Warning | WR-02 из REVIEW: keep-mounted TerminalPanel внутри DualPanelLayout не получает resize-event при display:none → display:flex; xterm cols/rows могут стать устаревшими. См. human_verification ниже. |
| `src/__tests__/App.test.tsx`      | 111, 121 | `getByText("dual-panel-p1")` без assert на display | ⚠ Warning | WR-03: тест не отличает «mounted и visible» от «mounted и display:none». Регрессия типа «обёртка осталась display:none после возврата» проскочила бы.                       |
| `src/__tests__/App.test.tsx`      | 98-100 | `document.querySelector(".tabler-icon-settings")` | ⚠ Warning | WR-04: хрупкий селектор, зависит от внутренней class-naming `@tabler/icons-react` 3.31.0.                                                                                  |

**TBD/FIXME/XXX:** ноль unreferenced markers найдено — phase-gate соблюдён.

**Console.log only / empty handlers:** не обнаружено.

**Hardcoded empty props (stub indicators):** не обнаружено (мок DualPanelLayout в тесте корректно рендерит реальный текст по projectId, не пустой).

### Human Verification Required

Из 4 WARNING-уровня находок REVIEW, **только WR-02 формально не покрыт ни автотестами, ни UAT-чек-листом**. UAT-чек-лист (26 пунктов) проверял chat-persistence в 4 SC-измерениях, но НЕ содержал явного сценария «ресайз окна пока активный проект в фоновом view → возврат в main → состояние терминала».

WR-01 (dead `flex: 1`) — стилевая микро-чистота, нет видимой регрессии.
WR-03 / WR-04 — quality-of-test проблемы, не блокирующие достижение цели фазы.
WR-02 — единственная содержательная регрессия с потенциально видимым визуальным эффектом, не относящаяся напрямую к 4 Success Criteria фазы (chat-persistence), но затрагивающая соседнюю keep-mounted-поверхность (терминалы), которую тот же рефактор сделал always-mounted.

### 1. WR-02: Терминал переживает window-resize при невидимой панели

**Test:**
1. Открыть приложение, выбрать проект A.
2. Подождать, пока терминал в DualPanelLayout появится и зафитится (видны строки prompt, курсор в правильной колонке).
3. Кликнуть на иконку Settings в header → view меняется на settings; DualPanelLayout (включая TerminalPanel) скрывается через `display: none` на родителе (`App.tsx:250`).
4. Ресайзить окно приложения (например, развернуть с 1200px шириной на полный экран или наоборот сжать).
5. Кликнуть Settings снова → возврат в view main; DualPanelLayout снова видим.
6. Посмотреть на терминал — курсор в правильной колонке относительно нового размера окна, ввод пишется в той же колонке, что отображается.

**Expected:** Терминал корректно подогнан под текущую ширину окна (xterm `cols` соответствует фактической ширине, курсор не смещён). Если терминал показывает обрезанные строки или ввод пишется не в той колонке — это регрессия WR-02, и требуется fix (добавить `useEffect` с вызовом `triggerTerminalRefit` при `view === "main" && activeProject` — см. REVIEW WR-02 §Fix).

**Why human:** Грэп / Vitest не моделируют xterm/FitAddon в jsdom; визуальная проверка обрезанных строк терминала и смещения курсора требует реального GPU-рендера. Сценарий window-resize-while-in-settings также не воспроизводится в RTL.

### Gaps Summary

Голы фазы достигнуты: 4/4 Success Criteria из ROADMAP.md и 6/6 truths из CONTEXT.md specifics §3 подтверждены автоматикой + ручным UAT. Production-код модифицирован в скоупе 3 файлов (`src/App.tsx`, `src/components/DualPanelLayout.tsx`, `src/__tests__/App.test.tsx`); backend (`src-tauri/`, `crates/claude-code-core`, `crates/uni-*`) и вендорированные npm-пакеты (`packages/uni-fw-*`) **не задеты** — `git show --name-only` для всех 3 phase-04 commits подтверждает D-04-06.

Единственный неустранённый риск — WR-02 (см. human_verification выше). Он касается соседней keep-mounted-поверхности (TerminalPanel внутри DualPanelLayout), но не chat-persistence. Не блокирует достижение цели фазы, но требует ручной проверки, прежде чем считать фазу полностью закрытой по итогам реального dev-сценария.

**Override-suggestion (на усмотрение пользователя):** если ручной тест WR-02 пройдёт чисто (терминал переживает window-resize при невидимой панели благодаря xterm/ResizeObserver внутри TerminalPanel), можно добавить в frontmatter:

```yaml
overrides:
  - must_have: "Терминал переживает window-resize при невидимой панели (WR-02)"
    reason: "Ручная UAT-проверка показала, что TerminalPanel корректно подгоняется через ResizeObserver самого xterm — явный triggerTerminalRefit на view-switch не нужен."
    accepted_by: "<имя>"
    accepted_at: "<ISO timestamp>"
```

Если же ручной тест выявит видимую регрессию (обрезанные строки / смещение курсора), это становится BLOCKER для закрытия фазы и требует fix-плана.

---

_Verified: 2026-05-18T01:20:00Z_
_Verifier: Claude (gsd-verifier)_
