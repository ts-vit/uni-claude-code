---
phase: 04-chat-persistence
plan: 02
subsystem: frontend
tags: [react, refactor, cleanup, dead-code-removal, typescript]
requires:
  - "04-01 (always-mount DualPanelLayout + удаление projectLayoutState Map из App.tsx)"
provides:
  - "Упрощённый публичный API DualPanelLayout: ровно 4 props (cwd, projectId, projectModel, projectPermissionMode)"
  - "Удалён экспортируемый тип DualPanelLayoutState"
  - "Удалён внутренний state-lifting механизм (onStateChangeRef + сериализующий useEffect)"
affects:
  - "src/components/DualPanelLayout.tsx"
tech-stack:
  added: []
  patterns:
    - "Cleanup мёртвого state-lifting API после рефактора компонента в always-mounted режим"
key-files:
  created: []
  modified:
    - "src/components/DualPanelLayout.tsx — удалён interface DualPanelLayoutState (7 строк); из interface DualPanelLayoutProps убраны 2 поля initialState/onStateChange; из сигнатуры функции убрана деструктуризация тех же 2 полей; 5 useState инициализаторов переведены на статические дефолты; удалён const onStateChangeRef = useRef(...) + повторное присваивание onStateChangeRef.current; удалён serializing useEffect с массивом зависимостей [activePanel, discussActiveTab, discussTabs, layoutMode, splitPosition]"
decisions:
  - "D-04-05 закрыт полностью: weaпон cleanup-only — никаких архитектурных изменений, никаких изменений поведения. Просто приведение публичного API к фактическому использованию (после 04-01 эти props не передаются)."
  - "useState<TabInfo[]> теперь возвращает массив длины 1 безусловно — это позволяет инициализатору discussActiveTab безопасно обращаться к discussTabs[0].id без проверки на undefined."
  - "Импорт useRef из react СОХРАНЁН — нужен для containerRef (drag-resize). Импорт useEffect СОХРАНЁН — нужен для двух остальных useEffect (mousemove/mouseup и body cursor)."
metrics:
  duration: "≈12 минут (включая recovery после изначального cwd-drift incident)"
  completed: "2026-05-18T00:55:54Z"
---

# Phase 04 Plan 02: Remove DualPanelLayoutState API Summary

Однострочное описание: из `src/components/DualPanelLayout.tsx` удалён ставший мёртвым state-lifting API (`DualPanelLayoutState` тип, `initialState`/`onStateChange` props, `onStateChangeRef`, сериализующий useEffect) — публичный API компонента приведён в соответствие с фактическим использованием после плана 04-01.

## Удалённые блоки в `src/components/DualPanelLayout.tsx`

| Что | Расположение до | Что было | Что стало |
|-----|-----------------|----------|-----------|
| `export interface DualPanelLayoutState` | строки 24-30 (7 строк включая пустую следующую) | 6-полевой интерфейс state-lifting контракта | **Полностью удалён** — больше не экспортируется, идентификатор `DualPanelLayoutState` отсутствует в файле |
| `initialState?: DualPanelLayoutState;` поле | строка 47 в `interface DualPanelLayoutProps` | optional prop для гидратации state из родителя | **Удалено** |
| `onStateChange?: (state: DualPanelLayoutState) => void;` поле | строка 48 в `interface DualPanelLayoutProps` | optional callback для синхронизации state с родителем | **Удалено** |
| Деструктуризация `initialState`, `onStateChange` в сигнатуре `DualPanelLayout({...})` | строки 56-57 | использовались внутри инициализаторов state и onStateChangeRef | **Удалены** |
| `useState<LayoutMode>` инициализатор | строка 60 | `initialState?.layoutMode ?? "single"` | `"single"` (статический дефолт) |
| `useState<ActivePanel>` инициализатор | строка 61 | `initialState?.activePanel ?? "architect"` | `"architect"` (статический дефолт) |
| `useState(splitPosition)` инициализатор | строка 62 | `initialState?.splitPosition ?? 50` | `50` (статический дефолт) |
| `useState<TabInfo[]>` инициализатор для discussTabs | строки 70-77 (8 строк с условной веткой) | условная ветка `if (initialState?.discussTabs.length)` со spread + fallback | unconditional fallback (массив длины 1) |
| `useState(discussActiveTab)` инициализатор | строки 78-80 | `() => initialState?.discussActiveTab ?? discussTabs[0].id` | `() => discussTabs[0].id` |
| `const onStateChangeRef = useRef(onStateChange);` + `onStateChangeRef.current = onStateChange;` | строки 66-67 | ref + повторное присваивание для безопасной передачи callback внутрь useEffect | **Удалены полностью** |
| `useEffect(() => { onStateChangeRef.current?.({...}); }, [activePanel, discussActiveTab, discussTabs, layoutMode, splitPosition])` | строки 113-121 (9 строк) | сериализация всего state наружу при любом изменении | **Удалён полностью** |

**Итог по diff:** 1 file changed, 4 insertions(+), 34 deletions(-). Файл сократился с 334 до 304 строк.

## Подтверждение: остальная логика НЕ задета

| Сохранённый блок | Расположение после правок | Подтверждение |
|------------------|---------------------------|---------------|
| `containerRef = useRef<HTMLDivElement>(null)` | строка 53 | сохранён — нужен для drag-resize, поэтому импорт `useRef` остаётся в строке 1 |
| Drag-resize: `isDragging`/`dividerHover` state | строки 51-52 | без изменений |
| `handleMouseDown` callback | строки 124-127 | без изменений |
| `useEffect` для mousemove/mouseup при `isDragging` | строки 129-149 | без изменений |
| `useEffect` для body cursor при `isDragging` | строки 151-158 | без изменений |
| `handleAddTab` callback | строки 63-72 | без изменений |
| `handleTabModeChange` callback | строки 74-78 | без изменений |
| `handleCloseTab` callback | строки 80-91 | без изменений |
| `useTauriListener<PanelEvent>("claude-event", ...)` | строки 94-121 | без изменений (1 вызов) |
| Type aliases `LayoutMode`, `ActivePanel`, `TabMode` | строки 12-15 | без изменений |
| `interface TabInfo` | строки 17-22 | без изменений |
| `const MAX_TABS_PER_PANEL = 5` | строка 24 | без изменений |
| Module-level `let tabCounter = 0` | строка 25 | без изменений |
| `nextTabId`, `nextTabLabel` функции | строки 26-32 | без изменений |
| JSX: Toolbar / Architect panel / Divider / Terminal panel / SessionTabs / ChatPanel map | строки 162-303 | без изменений |
| Импорт `useTauriListener` из safeListener | строка 10 | без изменений |
| Импорт `useRef`, `useEffect` из react | строка 1 | без изменений (нужны для containerRef и двух drag-resize useEffect) |

**grep-подтверждение сохранения логики:** `grep -nEc 'containerRef|isDragging|handleMouseDown|handleAddTab|handleCloseTab' src/components/DualPanelLayout.tsx` → **18** (≥ 5 по acceptance-критерию).

## Результат `npm run typecheck`

```
> uni-claude-code@0.1.0 typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

Чистый pass без warnings. Strict mode (`strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`) проходит. Импорт `DualPanelLayoutState` в `src/App.tsx` уже отсутствует (удалён в плане 04-01) → дополнительных правок не потребовалось.

## Результат `npm run test -- DualPanelLayout`

```
> uni-claude-code@0.1.0 test
> vitest run DualPanelLayout

 RUN  v4.1.6 D:/work-ai/uni-claude-code/.claude/worktrees/agent-a8454499346657fad

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  00:55:54
   Duration  3.33s

TEST_EXIT=0
```

**6/6 зелёных** без модификаций к тестам:
1. `renders single mode by default with Terminal panel` ✓
2. `switches to dual mode showing both panels` ✓
3. `switches active panel in single mode` ✓
4. `renders SessionTabs with Session 1 for architect panel` ✓
5. `adds a new tab when + is clicked` ✓
6. `closes a tab when x is clicked` ✓

Тесты в `src/__tests__/DualPanelLayout.test.tsx` передают только `cwd="D:\test-project"` и `projectId="proj-1"` — никогда не использовали `initialState`/`onStateChange` props, поэтому удаление этих props не сломало ни одного теста. Это и было инвариантом плана 04-02 (см. acceptance criteria: «существующие тесты не используют удалённые props»).

## Список файлов в `git diff`

```
$ git diff --name-only HEAD~1 HEAD
src/components/DualPanelLayout.tsx
```

**Ровно один файл изменён.** Backend (`src-tauri/`, `crates/`) и vendored пакеты (`packages/uni-fw-*`) не задеты — `git diff --name-only -- src-tauri crates packages` → 0 строк.

Финальная статистика коммита Task 1 (`22c1e58`):
```
src/components/DualPanelLayout.tsx | 38 ++++----------------------------------
1 file changed, 4 insertions(+), 34 deletions(-)
```

## Грep-инварианты после правок

| Проверка | Команда | Результат | Ожидание |
|----------|---------|-----------|----------|
| Запрещённые идентификаторы | `grep -nE "DualPanelLayoutState\|initialState\|onStateChange\|onStateChangeRef" src/components/DualPanelLayout.tsx` | 0 | 0 ✓ |
| Статический LayoutMode дефолт | `grep -nc 'useState<LayoutMode>("single")'` | 1 | ≥ 1 ✓ |
| Статический ActivePanel дефолт | `grep -nc 'useState<ActivePanel>("architect")'` | 1 | ≥ 1 ✓ |
| Статический splitPosition дефолт | `grep -nc 'useState(50)'` | 1 | ≥ 1 ✓ |
| Один interface DualPanelLayoutProps | `grep -nc 'interface DualPanelLayoutProps'` | 1 | = 1 ✓ |
| Тело props без forbidden полей | `grep -A 6 'interface DualPanelLayoutProps' \| grep -cE 'initialState\|onStateChange'` | 0 | 0 ✓ |
| Listener claude-event сохранён | `grep -nE 'useTauriListener<' \| wc -l` | 1 | ≥ 1 ✓ |
| Сохранённая логика | `grep -nEc 'containerRef\|isDragging\|handleMouseDown\|handleAddTab\|handleCloseTab'` | 18 | ≥ 5 ✓ |

## Deviations from Plan

**Никаких отклонений от плана по содержанию правок** — все 8 пунктов из `<action>` плана 04-02 выполнены ровно как описано.

### Inframiscale incident (recovery, не отклонение от плана)

Замечено и устранено: первая попытка применить правки прошла по абсолютному пути `D:\work-ai\uni-claude-code\src\components\DualPanelLayout.tsx`, который **внутри Windows-окружения resolveится в main repo**, а не в worktree (`D:\work-ai\uni-claude-code\.claude\worktrees\agent-a8454499346657fad\src\components\DualPanelLayout.tsx`). Это известная ловушка из `worktree-path-safety.md` (#3099). Recovery:

1. В main repo выполнен `git checkout -- src/components/DualPanelLayout.tsx` — единственный sanctioned restore (per destructive_git_prohibition: разрешён точечный `git checkout -- specific/file`).
2. В worktree выполнен `git checkout -- src/components/DualPanelLayout.tsx` для сброса локального edit (он там тоже был, потому что Read tool вернул копию из main repo при работе по неправильному пути и Edit писал в main).
3. Worktree branch fast-forwarded на `main`: `git merge --ff-only main` — без потери коммитов, так как worktree branch был спавнен от устаревшего commit `bb7b1e6` и не включал план 04-01 (тот успел смерджиться в main в коммитах `45ba4ba`, `d4fc301`, `1a05007`, `aaa58ea`). Fast-forward не destructive: переписывания истории нет, ветка просто продвигается вперёд по существующим коммитам.
4. Правки заново применены к корректному worktree-пути (с `.claude/worktrees/agent-…/` префиксом). Финальный коммит и весь diff content идентичны тому, что планировалось — recovery не оставил следов в результирующем артефакте.

Этот incident **не повлиял на содержание изменений** — финальный diff в `DualPanelLayout.tsx` соответствует плану 1-в-1. Запись остаётся здесь для аудита.

### Pre-existing наблюдение

Worktree-ветка `worktree-agent-a8454499346657fad` была спавнена от commit `bb7b1e6` ("Убрал кирилицу") — это commit задолго до старта milestone v1.1. Между этим коммитом и `main` накопились 9+ коммитов milestone v1.1 и v1.0 (вендоринг). Fast-forward merge на main принёс в worktree всё, что было запланировано как precondition (план 04-01 → ветка `45ba4ba`). После FF состояние `App.tsx` ровно такое, как ожидала спецификация плана 04-02 (`import { DualPanelLayout } from "./components/DualPanelLayout";` без типа, `grep -c projectLayoutState src/App.tsx` = 0). Это **не отклонение** — это нормализация состояния worktree через FF, чтобы dependency precondition `depends_on: 04-01` действительно был активным.

## Threat Flags

Нет. План — чистый cleanup мёртвого кода в `src/`, без новых сетевых эндпоинтов, auth-путей, файлового доступа, схем БД, изменений trust-boundary поверхности. Compatibility-инвариант с milestone v1.0 (вендорированные `@uni-fw/*`/`uni-*` не модифицируются) соблюдён — git diff не содержит ничего из `packages/` или `crates/uni-*`.

## Self-Check: PASSED

- FOUND: `src/components/DualPanelLayout.tsx` (модифицирован, верифицировано Read + md5sum)
- FOUND: commit `22c1e58 refactor(04-02): remove dead DualPanelLayoutState API from DualPanelLayout` (verified `git log --oneline -3`)
- typecheck PASSED (exit 0)
- tests PASSED (6/6 зелёных в `DualPanelLayout.test.tsx`)
- backend файлы НЕ задеты (`git diff --name-only -- src-tauri crates packages` → 0 строк)
- worktree HEAD на `worktree-agent-a8454499346657fad` (pre-commit assertion passed)
- SUMMARY.md создан по правильному worktree пути `.planning/phases/04-chat-persistence/04-02-SUMMARY.md`

## Commits

| Task | Type | Hash | Files |
|------|------|------|-------|
| 1 — Удалить устаревший state-lifting API DualPanelLayout | refactor(04-02) | `22c1e58` | `src/components/DualPanelLayout.tsx` |

Финальный коммит SUMMARY будет создан следующим шагом (он покрывает только этот SUMMARY.md, без STATE.md/ROADMAP.md — те обновляет orchestrator после merge worktree).
