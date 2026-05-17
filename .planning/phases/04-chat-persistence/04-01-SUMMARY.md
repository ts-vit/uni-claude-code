---
phase: 04-chat-persistence
plan: 01
subsystem: frontend
tags: [react, persistence, refactor, frontend, dom]
requires: []
provides:
  - "Always-mounted DualPanelLayout per opened project в src/App.tsx"
  - "Sibling-overlay рендер не-main views (display:flex/none вместо unmount)"
  - "Удалённый module-level Map projectLayoutState"
affects:
  - "src/App.tsx"
tech-stack:
  added: []
  patterns:
    - "Always-mounted рендер с CSS display:none/flex для скрытия (вместо conditional unmount)"
key-files:
  created: []
  modified:
    - "src/App.tsx — AppShell.Main переписан в три sibling-блока (main / view-overlay / welcome); удалён projectLayoutState Map; удалён импорт типа DualPanelLayoutState; props initialState/onStateChange в JSX <DualPanelLayout> убраны"
decisions:
  - "Применена sibling-структура (D-04-03 рекомендация): три параллельных div с display:flex/none вместо overlay через z-index — проще, безопаснее, никакого coupling focus/z-index."
  - "Welcome-блок вынесен в отдельный sibling вместо ladder-ветки — соответствует структуре, описанной в action (c)."
  - "Каждый DualPanelLayout рендерится внутри отдельного key={project.id} обёрточного div — гарантирует identity при изменениях openedProjects."
metrics:
  duration: "3m18s"
  completed: "2026-05-17T19:47:13Z"
---

# Phase 04 Plan 01: Always-mount DualPanelLayout Summary

Однострочное описание: переписан `AppShell.Main` в `src/App.tsx` так, что `DualPanelLayout` для каждого `openedProject` остаётся всегда смонтированным, а не-main views рендерятся sibling-блоком — фикс root cause потери чата при навигации.

## Изменённые блоки в `src/App.tsx`

| Что | Было (диапазон до правок) | Стало (диапазон после правок) |
|-----|---------------------------|-------------------------------|
| Импорт `DualPanelLayout` | строка 16: `import { DualPanelLayout, type DualPanelLayoutState } from "./components/DualPanelLayout";` | строка 16: `import { DualPanelLayout } from "./components/DualPanelLayout";` (тип убран) |
| Module-level Map | строка 31: `const projectLayoutState = new Map<string, DualPanelLayoutState>();` | удалена полностью (после `type View = …` сразу `export function App() {`) |
| `<AppShell.Main>` body | строки 245-302: одна большая ladder `view === "settings" ? … : view === "pipeline" ? … : … : activeProject ? <…openedProjects.filter().map()…/> : <WelcomeScreen/>` (фильтр размонтировал всё, что не activeProject.id ИЛИ не main view) | строки 243-320: ровно три sibling-блока внутри корневого div `height:calc(100vh - 50px)`:<br>(a) main-блок `display: view === "main" ? "flex" : "none"` — обёртка `openedProjects.map()` БЕЗ фильтра, внутренний div с `display: project.id === activeProject.id && view === "main" ? "flex" : "none"` для скрытия неактивных проектов<br>(b) view-overlay блок `display: view !== "main" ? "flex" : "none"` — ladder рендера SettingsPage / PipelinePage / ClaudeMdEditor / DiffViewer / FileTreePanel / HistoryPage<br>(c) welcome-блок: `!activeProject && view === "main" ? <WelcomeScreen/> : null` |
| Props в JSX `<DualPanelLayout>` | передавались `initialState={projectLayoutState.get(project.id)}` + `onStateChange={(state) => projectLayoutState.set(project.id, state)}` | передаются только `cwd`, `projectId`, `projectModel`, `projectPermissionMode` — `initialState`/`onStateChange` исключены |

**Файловые статистики коммита:** `1 file changed, 55 insertions(+), 37 deletions(-)`.

## Подтверждение удаления `projectLayoutState` и `DualPanelLayoutState`

| Проверка | Команда | Результат | Ожидалось |
|----------|---------|-----------|-----------|
| `projectLayoutState` в `src/App.tsx` | `grep -c projectLayoutState src/App.tsx` | **0** | 0 ✓ |
| `DualPanelLayoutState` в `src/App.tsx` | `grep -c DualPanelLayoutState src/App.tsx` | **0** | 0 ✓ |
| `initialState=` в JSX `src/App.tsx` | `grep -c "initialState=" src/App.tsx` | **0** | 0 ✓ |
| `onStateChange=` в JSX `src/App.tsx` | `grep -c "onStateChange=" src/App.tsx` | **0** | 0 ✓ |
| Старый размонтирующий фильтр | `grep -c '.filter((project) => project.id === activeProject.id && view === "main")' src/App.tsx` | **0** | 0 ✓ |
| Backend safety (D-04-06) | `grep -rn "DualPanelLayoutState\|projectLayoutState" src-tauri crates` | **0** | 0 ✓ |
| display:flex/none переключение видимости | `grep -nE "display:\s*['\"](flex\|none)['\"]\|display:\s*view\s*[!=]==" src/App.tsx` | **2** | ≥ 2 ✓ |

Импорт `DualPanelLayoutState` удалён, потому `noUnusedLocals` не срабатывает — `npm run typecheck` чист. Сам тип `DualPanelLayoutState` остаётся экспортируемым в `src/components/DualPanelLayout.tsx` (план 04-02 уберёт его и связанные props/state-initialization после `npm run test`-fix в 04-03).

## Подтверждение `triggerTerminalRefit` сохранён (D-04-04)

- Объявление: `src/App.tsx:41-45` — функция `triggerTerminalRefit` с `window.dispatchEvent(new Event("resize"))` через 100мс не изменена.
- Вызовы: `handleProjectSelect` (строка 86) и `handleProjectCreated` (строка 94) — оба сохранены без изменений.
- `grep -c triggerTerminalRefit src/App.tsx` → **3** (объявление + 2 вызова), ≥ 2 — критерий выполнен.

Это нужно потому что терминалы теперь не размонтируются при смене проекта (вкладки `terminal-embed` сосуществуют в DOM), но xterm всё ещё требует resize-event для перерасчёта ширины при смене видимого узла.

## Результат `npm run typecheck`

```
> uni-claude-code@0.1.0 typecheck
> tsc --noEmit

EXIT_CODE=0
```

Чистый pass без warnings. Strict mode (`strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`) проходит после удаления импорта `DualPanelLayoutState`.

## Ожидаемое падение `npm run test -- App` (правится в 04-03)

`npm run test -- App` сейчас **должен** упасть — это известный и запланированный side-effect. Конкретные ожидаемые fail-causes:

1. Тест `does not render inactive project layout` (либо аналогичное название в `src/__tests__/App.test.tsx`) утверждает, что DualPanelLayout неактивного проекта **не** появляется в DOM. После этого плана он **появляется** (просто `display:none`) — семантика инвертирована.
2. Мок DualPanelLayout мог проверять передачу `initialState` / `onStateChange` props — мы их больше не передаём.
3. Тесты, проверяющие unmount-поведение при `view !== "main"`, окажутся неверными по той же причине.

Это **не** Rule-1 баг и **не** блокирует завершение 04-01. Тесты `App.test.tsx` целевым образом обновляются в плане 04-03 (новые ожидания: «активный DualPanelLayout присутствует с `display:flex`, неактивные присутствуют с `display:none`, messages переживают view ↔ view»).

Тесты, не связанные с `App`, не задеты — `ChatPanel.test.tsx`, `DualPanelLayout.test.tsx` (если есть), `MessageList.test.tsx`, и т.п. должны продолжать проходить (план 04-01 не менял `DualPanelLayout.tsx` / `ChatPanel.tsx` / другие файлы).

## Статус 6 truths из CONTEXT.md specifics §3

Все 6 truths закрыты **на уровне DOM-структуры**, потому что компонент больше физически не размонтируется. Формальная run-time верификация (RTL-тесты) — план 04-03.

| # | Truth | Статус 04-01 |
|---|-------|--------------|
| 1 | После переключения main → settings → main, массив `messages` в активной вкладке имеет ту же длину, что и до переключения. | **Реализовано на уровне DOM** — DualPanelLayout активного проекта в режиме main скрыт через `display:none` при view=settings и снова видим при view=main; ChatPanel не размонтировался → React state `messages` живёт. Формальная RTL-верификация: 04-03. |
| 2 | После переключения проекта A → B → A, массив `messages` в активной вкладке проекта A имеет ту же длину, что и до переключения. | **Реализовано на уровне DOM** — `openedProjects.map()` рендерит ВСЕ открытые проекты одновременно (до `maxOpenProjects=3`); неактивный проект A скрыт через `display:none`, его DualPanelLayout + ChatPanel остаются в DOM. Формальная RTL-верификация: 04-03. |
| 3 | Если в момент переключения у проекта A `isRunning === true` и идёт стриминг, после возврата текст продолжает поступать и не теряется ничего из того, что Claude отдал в фоне. | **Реализовано на уровне DOM** — `useTauriListener("claude-event")` в `ChatPanel.tsx:336` не размонтируется → подписка живёт → события для panelId продолжают приходить и буферизоваться в `streamBufferRef`/`messages`. Формальная run-time верификация: 04-03 (RTL не легко моделирует стриминг — может быть «manual smoke» в SUMMARY 04-03). |
| 4 | Никаких новых subscriptions к `claude-event` не создаётся при возврате на ту же вкладку. | **Реализовано на уровне DOM** — `useTauriListener` подписывается один раз при первом монтировании ChatPanel; так как компонент не размонтируется при view/project switch, новых подписок не создаётся. Формальная run-time верификация: 04-03. |
| 5 | `panelId` (например `discuss-1`) остаётся тем же для той же визуальной вкладки до и после переключения. | **Реализовано на уровне DOM** — `panelId` живёт в `discussTabs[].id` стейте DualPanelLayout, который не размонтируется. Также React `key={tab.id}` в map гарантирует identity ChatPanel. Формальная RTL-верификация: 04-03. |
| 6 | При вызове `handleCloseTab` `invoke("claude_stop", { panelId })` отрабатывает корректно — поведение не меняется. | **Не задето** — план 04-01 не трогает `DualPanelLayout.tsx` (handleCloseTab остаётся прежним); 04-01 правит только `src/App.tsx`. |

## Deviations from Plan

**None — плана исполнен ровно как написан.**

Один мелкий «несогласованный» момент в acceptance criteria плана: `grep -c "openedProjects" src/App.tsx ≥ 4` ожидался планнером. Фактически в новом файле — 2 случая (`useState` declaration на строке 35 и render на строке 257). Это не отклонение исполнения, а неточность в acceptance-критерии: оригинальный `src/App.tsx` тоже имел только 2 случая (`useState` на строке 37 + `.filter().map()` на строке 270) — все остальные обращения к state-сеттеру `setOpenedProjects` начинаются с заглавной 'O' и не матчат регистрозависимый паттерн `openedProjects`. Функциональный intent критерия («массив всё ещё используется в state и рендере») выполнен.

## Threat Flags

Нет. План затрагивает только UI-структуру, никаких новых сетевых эндпоинтов, auth-путей, файлового доступа или схем БД.

## Self-Check: PASSED

- FOUND: src/App.tsx (модифицирован, верифицировано Read)
- FOUND: commit 45ba4ba (verified `git log --oneline -3`)
- typecheck PASSED (exit 0)
- backend файлы НЕ задеты (`git diff --name-only` показал только `src/App.tsx`)
- SUMMARY.md создан по правильному пути `.planning/phases/04-chat-persistence/04-01-SUMMARY.md`

## Commits

| Task | Type | Hash | Files |
|------|------|------|-------|
| 1 — Always-mounted DualPanelLayout + projectLayoutState removal | refactor(04-01) | `45ba4ba` | `src/App.tsx` |

Финальный коммит SUMMARY будет создан следующим шагом.
