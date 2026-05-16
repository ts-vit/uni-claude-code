# Phase 2: npm Vendoring — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 2 — npm-vendoring
**Areas discussed:** Build artifacts, Workspace refs, Package tests

---

## Build artifacts — стратегия артефактов сборки вендорированных пакетов

| Option | Description | Selected |
|--------|-------------|----------|
| Source-direct (без dist/) | Переписать `main` / `exports` каждого пакета на `./src/index.ts`. Vite/tsc консьюмят TS-исходники через workspace-symlink. Никакого build step, никакого commit бинарей. Аналогия с Phase 1 (cargo билдит deps лениво). | ✓ |
| Зафиксировать dist/ в git | Один раз собрать tsup-ом и закоммитить `dist/*.js`, `*.d.ts`, sourcemaps в репо. `npm ci` сразу готов, без build step. Минус: бинарные артефакты в истории git, ручная регенерация при правках исходников. | |
| Build-on-install (postinstall) | Сохранить `tsup` + `tsconfig.build.json`. Корневой `postinstall` гонит `npm run build --workspaces --if-present`. dist/ в `.gitignore`. Минус: усложняет `npm ci`, нужен tsup и его deps в `node_modules`. | |

**User's choice:** Source-direct (без dist/).
**Notes:** Естественное продолжение существующего паттерна — `src/main.tsx` уже импортирует source-CSS `@uni-fw/ui/src/styles/markdown.css`. Никаких build-артефактов в репо, никаких postinstall-усложнений. Прямая аналогия с Phase 1 Rust-крейтами (cargo разбирается с компиляцией сам, мы только указываем path).

---

## Workspace refs — как ссылаться на `@uni-fw/*` в `dependencies` корневого `package.json`

| Option | Description | Selected |
|--------|-------------|----------|
| `workspace:*` | Каноничный синтаксис npm workspaces (npm 7+). Явный сигнал «локальная привязка», ломается на `npm publish` (защита), не зависит от значения `version` в пакетах. | ✓ |
| Удалить из dependencies | Полностью убрать `@uni-fw/*` из `dependencies` — workspaces всё равно резолвят. Минус: неявная зависимость, `npm ls` / `depcheck` теряют сигнал. | |
| Оставить семвер `^0.1.x` | Оставить версии как есть. npm workspaces резолвят локально если version подходит. Минус: хрупкость — при bump `version` внутри пакета (`0.1.x` → `0.2.0`) npm молча пойдёт в реестр. | |

**User's choice:** `workspace:*`.
**Notes:** Пользователь явно подчеркнул мотив «если их доработать надо будет» — `workspace:*` самый прощающий для активной правки пакетов (бамп `version` внутри пакета не ломает резолв), плюс защита от случайной публикации и явная декларация зависимости для IDE/tooling. Пользователь сначала задал уточняющий вопрос («что изменится при доработке?») — после сравнительной таблицы по сценариям (правка кода / bump версии / удаление пакета / `npm ls`) подтвердил выбор.

---

## Package tests — запуск тестов вендорированных пакетов в `npm run test` / `npm run test:all`

| Option | Description | Selected |
|--------|-------------|----------|
| Не запускать (рекомендуется) | `npm run test` остаётся `vitest run` в корне — только тесты `src/__tests__/`. Тесты пакетов копируются для архива/будущей работы (MAINT-02), но не блокируют сборку. Минимум риска fail-by-default при ai-chat-specific инфраструктуре. | ✓ |
| Запускать со skip падающих | Расширить `test:all` до `npm test --workspaces --if-present`. Тесты пакетов гоняются; падающие из-за внешней инфраструктуры ai-chat помечаем `it.skip` с TODO. Больше покрытия, но требует ручного triage при первом запуске. | |
| Отдельная команда `test:packages` | Добавить `npm run test:packages` (работает через workspaces) рядом с `test`, но НЕ включать в `test:all`. Можно гонять при желании, но DoD не зависит. | |

**User's choice:** Не запускать.
**Notes:** Совпадает с DoD из PROJECT.md (зелёные только тесты `uni-claude-code`) и принципом Phase 1 (тесты `uni-*` крейтов копировались, нестабильные планировалось `#[ignore]`-нуть — на практике все прошли, см. STATE.md). Тесты пакетов остаются физически в репо для будущей MAINT-02.

---

## Claude's Discretion

Перечислены в `02-CONTEXT.md` → Implementation Decisions → Claude's Discretion. Кратко:
- Точная форма `exports` при source-direct (`main`/`types` vs составной `exports` с условиями) — на planner/researcher.
- Полный список transitive peer-deps, которые надо поднять на корневой `package.json` (`@xterm/*`, `react-markdown`, и т.п.) — researcher определит из `peerDependencies` трёх пакетов и текущего `package-lock.json`.
- Стратегия регенерации `package-lock.json` (полный rebuild vs инкрементальный install).
- Нужен ли `tsconfig` path mapping в корне (вероятно нет).

## Deferred Ideas

Подробно в `02-CONTEXT.md` → Deferred Ideas. Кратко: MAINT-01 / MAINT-02 / CLEAN-01 / CLEAN-02 из REQUIREMENTS.md v2; обновление `CLAUDE.md` отнесено к Phase 3 (BUILD-06); удаление «спящих» `tsup`/`tsconfig.build.json` — отдельная cleanup-задача.
