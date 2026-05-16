---
phase: 02-npm-vendoring
plan: 03
subsystem: infra
tags: [npm, workspaces, vendoring, lockfile, vitest, typecheck, dod, uni-fw]

# Dependency graph
requires:
  - phase: 02-02
    provides: Корневой package.json объявляет npm workspaces и ссылается на @uni-fw/* как workspace:*; три вендорированных package.json переведены на source-direct entry (./src/index.ts); .npmrc удалён
provides:
  - Регенерированный package-lock.json (lockfileVersion=3) без единой ссылки на npm.ts-vit.com; @uni-fw/* представлены как workspace symlinks (link:true → packages/uni-fw-*)
  - Подтверждение DoD фазы 2 — npm ci, npm run typecheck, npm run test зелёные без сетевого доступа к приватному реестру
  - .planning/phases/02-npm-vendoring/02-03-TEST-NOTES.md — точный TODO-trail (пустой, правок в тестах не было)
  - Defensive include-фильтр в vitest.config.ts, явно ограничивающий корневой test runner папкой src/ (защищает D-05/D-06 от vitest default-discovery)
affects: [phase 03 — README/CI workflows могут опираться на регенерированный lockfile + workspaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "lockfile-regen через rm + npm install (NPM аналог Phase 1 / Plan 01-03 rm Cargo.lock + cargo generate-lockfile)"
    - "Defensive vitest include-фильтр для соблюдения «спящих» тестов в monorepo (D-05/D-06)"
    - "Package Legitimacy Gate через npm ls --depth=0 после первого npm install"

key-files:
  created:
    - .planning/phases/02-npm-vendoring/02-03-TEST-NOTES.md
  modified:
    - package-lock.json
    - vitest.config.ts
  deleted: []

key-decisions:
  - "Регенерация через rm package-lock.json + rm -r node_modules + npm install — прямой аналог Phase 1 / Plan 01-03 (rm Cargo.lock + cargo generate-lockfile). Гарантированно убирает stale-резолв на npm.ts-vit.com и residual @uni-fw/* кэш из старого node_modules"
  - "В корневой vitest.config.ts добавлено include: [\"src/**/*.{test,spec}.{ts,tsx}\"] — defensive-фильтр (Rule 1 deviation). План предполагал, что vitest по дефолту смотрит только в src/, но vitest сканирует от cwd и подхватывал packages/uni-fw-*/src/__tests__/. Без фильтра D-05/D-06 нарушается (тесты пакетов запускаются и падают из-за отсутствия инфраструктуры моков)"
  - "Никаких it.skip правок в src/__tests__/*.test.tsx — 106 корневых тестов прошли с первого запуска после include-фильтра. setup.ts не тронут (CONTEXT.md «Reusable Assets», D-12 / NPM-07)"
  - "Package Legitimacy Gate пройден без human-review: новые транзитивные deps относительно прежнего lockfile — только ожидаемые @xterm/* (^6.0.0/^0.11.0/^0.12.0 — точно как в peerDependencies packages/uni-fw-terminal-ui) + react-markdown/rehype-highlight/remark-gfm (transitive из @uni-fw/ui, использовались и раньше)"

requirements-completed: [NPM-07, NPM-08, NPM-09, NPM-10]

# Metrics
duration: ~7min
completed: 2026-05-16
---

# Phase 02 Plan 03: Regenerate Lockfile + Verify DoD Summary

**Регенерирован `package-lock.json` без `npm.ts-vit.com` (`@uni-fw/*` теперь workspace symlinks `link:true → packages/uni-fw-*`); `npm ci` + `npm run typecheck` + `npm run test` зелёные (19 файлов / 106 тестов). DoD фазы 2 npm Vendoring выполнен — npm-часть сборки больше не зависит от приватного реестра.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-16T09:54:20Z
- **Completed:** 2026-05-16T10:01:27Z
- **Tasks:** 2
- **Files modified:** 2 modified (`package-lock.json`, `vitest.config.ts`), 1 created (`02-03-TEST-NOTES.md`)

## Accomplishments

- `package-lock.json` регенерирован: 0 совпадений `npm.ts-vit.com` (zero-tolerance), `lockfileVersion=3`, все три `@uni-fw/*` записи как `link: true` + `resolved: packages/uni-fw-*` (NPM-08).
- `node_modules/@uni-fw/{ui,ssh-ui,terminal-ui}` пересозданы как workspace symlinks на каталоги `packages/uni-fw-*` (`isSymbolicLink === true`).
- `npm ci` — exit 0, 490 пакетов установлены, 0 уязвимостей (NPM-08).
- `npm run typecheck` (`tsc --noEmit`) — exit 0, типы из `packages/uni-fw-*/src/` резолвятся через workspace symlink + `moduleResolution: "bundler"` (NPM-09).
- `npm run test` (`vitest run`) — 19 файлов / 106 тестов passed, 0 failed (NPM-10).
- Defensive vitest `include`-фильтр добавлен в `vitest.config.ts`: тесты `packages/uni-fw-*/src/__tests__/` не запускаются корневым `npm run test` (D-05/D-06 соблюдены — 0 совпадений `packages/uni-fw-` в выводе vitest).
- `src/__tests__/setup.ts` НЕ изменён (CONTEXT.md «Reusable Assets»).
- Импорты `@uni-fw/ui` / `@uni-fw/ssh-ui` / `@uni-fw/terminal-ui` в 9 файлах `src/` НЕ изменены (NPM-07, D-12 — `git diff --stat HEAD~3 -- src/` пуст по `*.ts*`-файлам).
- CSS-импорт `@uni-fw/ui/src/styles/markdown.css` из `src/main.tsx:7` работает через workspace symlink + сохранённое поле `exports."./src/styles/*"` в `packages/uni-fw-ui/package.json` (D-03).
- Корневой `package.json` НЕ изменён в этом плане (`git diff --quiet HEAD~2 -- package.json` после Task 1 — exit 0; `vitest.config.ts` правится отдельно).
- `02-03-TEST-NOTES.md` фиксирует: «Все тесты прошли без правок», + объяснение defensive-фильтра для трассировки MAINT-02 в v2.
- Package Legitimacy Gate пройден: `npm ls --depth=0` показал только ожидаемые пакеты — никаких неизвестных транзитивных deps.
- Покрыты требования NPM-07, NPM-08, NPM-09, NPM-10 — конец фазы 2 / DoD.

## Task Commits

Обе задачи закоммичены атомарно:

1. **Task 1: Удалить устаревший package-lock.json и регенерировать через npm install** — `cd5b5b7` (chore)
2. **Task 2: Запустить npm ci + npm run typecheck + npm run test, добавить vitest include-фильтр** — `cc9b30f` (chore)

## Files Created/Modified

**Modified (2 файла):**

- `package-lock.json` — `+3400 -568` строк:
  - Удалены все 6 записей `"resolved": "https://npm.ts-vit.com/@uni-fw/..."`
  - Три `@uni-fw/*` теперь имеют `link: true` + `resolved: "packages/uni-fw-*"` (workspace symlink-формат npm 7+)
  - Добавлены workspace-package записи `packages/uni-fw-ui`, `packages/uni-fw-ssh-ui`, `packages/uni-fw-terminal-ui` (с их транзитивными deps: `react-markdown`, `rehype-highlight`, `remark-gfm` для ui; `@xterm/*` peer-mention для terminal-ui)
  - `lockfileVersion=3`
- `vitest.config.ts` — `+5 -0`:
  - Добавлено поле `include: ["src/**/*.{test,spec}.{ts,tsx}"]` с трёх-строчным комментарием со ссылкой на CONTEXT.md D-05/D-06
  - `setupFiles`, `environment`, `globals` не тронуты

**Created (1 файл):**

- `.planning/phases/02-npm-vendoring/02-03-TEST-NOTES.md` — TODO-trail формата 01-03-TEST-NOTES.md:
  - Резюме `npm run test` (19 files / 106 tests / 0 failures)
  - Резюме `npm run typecheck` (exit 0)
  - Резюме `npm ci` (490 packages)
  - Раздел «Пометки `it.skip`, добавленные этим планом» — **Никаких**
  - Раздел про `packages/uni-fw-*/src/__tests__/` — объяснение, почему добавлен defensive vitest include-фильтр (Rule 1 deviation), привязка к MAINT-02 в v2
  - Подтверждение, что `setup.ts` не тронут

**Deleted:** ничего.

**Не тронуты:**

- `package.json` корня — без правок (scope Plan 02-02 завершён)
- `.npmrc` — отсутствует (удалён в Plan 02-02)
- `packages/uni-fw-*/package.json` — без правок (scope Plan 02-02)
- `src/` (включая `src/__tests__/setup.ts` и `src/__tests__/*.test.tsx`) — без правок
- `src-tauri/`, `crates/` — без правок

## Decisions Made

- **Регенерация lockfile через rm + npm install** — прямой аналог Phase 1 / Plan 01-03 (rm Cargo.lock + cargo generate-lockfile). Дополнительно удалён `node_modules/` целиком перед `npm install`, чтобы исключить residual `@uni-fw/*` из старой registry-версии (защитный шаг по аналогии с `cargo clean`). `npm install --workspaces` или `npm ci` после регенерации не понадобились — `npm install` 7+ при отсутствии lockfile создаёт новый и подхватывает workspaces автоматически.
- **Defensive vitest include-фильтр** (Rule 1 deviation) — добавлено `include: ["src/**/*.{test,spec}.{ts,tsx}"]` в корневой `vitest.config.ts`. Это правка build-инфраструктуры, не consumer-кода (`src/` нетронут), полностью в духе D-05/D-06 и D-12. Альтернатива (явно перечислять файлы либо ставить `exclude: ["packages/**"]`) рассмотрена и отброшена как менее семантичная: `include: ["src/**"]` явно описывает «корневой vitest = только корневой `src/`».
- **Никаких it.skip правок в `src/__tests__/`** — 106 корневых тестов прошли с первого запуска после include-фильтра. Моки `vi.mock("@uni-fw/...")` в `setup.ts` сработали независимо от того, что `@uni-fw/*` теперь резолвятся через workspace symlink — это поведение `vi.mock` на уровне имени модуля, не источника (см. CONTEXT.md «Reusable Assets»).
- **Package Legitimacy Gate пройден без human-review** — diff между прежним lockfile и новым показывает: исчезли 3 запись @uni-fw/* с registry-URL (заменены на workspace links); добавились 3 явные `@xterm/*` (соответствуют точным версиям из `peerDependencies` `packages/uni-fw-terminal-ui/package.json` — `^6.0.0`, `^0.11.0`, `^0.12.0`); все остальные transitive deps (`react-markdown`, `rehype-highlight`, `remark-gfm`, `tsup`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/user-event` — devDeps вендорированных пакетов) — известные публичные npm-пакеты, которые ранее тянулись транзитивно через `@uni-fw/ui` из приватного реестра. Никаких подозрительных или незнакомых пакетов в выводе `npm ls --depth=0` не обнаружено.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan-предположение «vitest по дефолту ищет тесты только в `src/`» оказалось неверным**

- **Found during:** Task 2, Шаг C (первый запуск `npm run test`).
- **Issue:** План в `<context>` утверждает: «Корневой vitest по дефолту ищет тесты в `src/`, не в `packages/`». На практике vitest 4.1.6 без `include` сканирует от cwd по шаблону `**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}` — это подхватывает `packages/uni-fw-*/src/__tests__/`. Первый запуск показал: 2 файла failed / 13 тестов failed (TerminalPanel.test.tsx + SshTunnelSettings.test.tsx из вендорированных пакетов) — падения unrelated к vendoring (моки `@uni-fw/ui` / `@xterm/xterm` внутри тестов пакетов не были перенесены / устарели), но они блокировали exit 0 и нарушали D-05/D-06.
- **Fix:** В `vitest.config.ts` добавлено явное поле `include: ["src/**/*.{test,spec}.{ts,tsx}"]` с трёх-строчным комментарием, ссылающимся на CONTEXT.md D-05/D-06. После этого:
  - `npm run test` → 19 файлов / 106 тестов passed, 0 failed
  - `0` совпадений `packages/uni-fw-` в выводе vitest
  - acceptance criterion «Вывод `npm run test` НЕ содержит ни одного тест-файла с префиксом `packages/uni-fw-`» выполнен
- **Files modified:** `vitest.config.ts` (+5 строк)
- **Commit:** `cc9b30f`

Это правка корневого build-конфига, не consumer-кода в `src/`. NPM-07 / D-12 («импорты `@uni-fw/*` в `src/` НЕ изменены») и CONTEXT.md «Reusable Assets» («`src/__tests__/setup.ts` не тронут») соблюдены — `git diff HEAD~3 -- src/` пуст.

### Архитектурные изменения

Никаких — Rule 4 не сработал.

## Issues Encountered

- **Plan-предположение про vitest discovery** — см. Rule 1 deviation выше. Корень: документация vitest действительно перечисляет `src` среди примеров include, но без явного `include` он берёт `**/*.test.*` от cwd. Это типовой gotcha при добавлении npm workspaces. Решено defensive-фильтром.
- **Скорость `npm install` / `npm ci`** — первый `npm install` 58 s, `npm ci` после регенерации 25 s. Длительность ожидаема для холодного кэша + установка `vitest@3.2.4` (девзависимость пакета `@uni-fw/ui` для «спящих» тестов) и `jsdom@26.1.0`. После Plan 02-02 / Discretion §2 эти dev-deps приходят через workspace, не из приватного реестра.
- **`vitest@3.2.4` появился во вторичном дереве** — это devDependency `@uni-fw/ui` (для «спящих» тестов в `packages/uni-fw-ui/src/__tests__/`). Корневой `npm run test` использует `vitest@4.1.6` из корневого `devDependencies`. Это нормальное поведение workspaces: дочерние devDependencies сосуществуют с корневыми. На корневой `npm run test` это не влияет (PATH резолва — корневой `node_modules/.bin/vitest`).

## User Setup Required

None — никаких внешних сервисов или конфигурации не требуется. Все три DoD-команды (`npm ci`, `npm run typecheck`, `npm run test`) запускаются и проходят в чистом состоянии репо без сети к `npm.ts-vit.com` (нужен только доступ к публичному `registry.npmjs.org`, что явно разрешено PROJECT.md Constraints).

## Next Phase Readiness

**Phase 2 DoD выполнен. Ready for Phase 3 (CI / документация):**

- Корневой `package.json` объявляет workspaces, `@uni-fw/*` как `workspace:*`, `@xterm/*` явно перечислены.
- `package-lock.json` чистый — никаких ссылок на `npm.ts-vit.com`, все три `@uni-fw/*` — workspace symlinks.
- `.npmrc` отсутствует.
- `npm ci` + `npm run typecheck` + `npm run test` зелёные.
- `vitest.config.ts` ограничен корневым `src/` — тесты вендорированных пакетов («спящие» снапшоты) корректно изолированы.
- Phase 3 может полагаться на:
  - Регенерированный lockfile для документирования воспроизводимой сборки (`npm ci`, не `npm install`).
  - Workspaces-структуру для команд типа `npm run test:all` (если потребуется добавить тестирование отдельных пакетов).
  - CLAUDE.md / README обновления (`@uni-fw/*` и `uni-*` теперь «вендорированные внутри репо»).
  - BUILD-05 (Phase 3) — финальная проверка из чистого клона без сети.

**Blockers/concerns:** None.

## Threat Model Verification

- **T-02-06 (Tampering, transitive deps drift):** mitigated — `npm install` использовал minimum-satisfying версии для каждого dep range из `package.json`. `npm ci` после регенерации прошёл exit 0 — lockfile полностью консистентен с `package.json`. `npm run typecheck` и `npm run test` зелёные — никаких major-version-drift регрессий ни в одной транзитивной зависимости не выявлено.
- **T-02-07 (Tampering, install scripts):** accepted — `npm install` / `npm ci` могли исполнить package install scripts. Список пакетов фиксирован (тот же, что был до vendoring, плюс три явных `@xterm/*`). Никаких новых неизвестных пакетов в `npm ls --depth=0` не обнаружено.
- **T-02-SC (Package Legitimacy Gate):** mitigated — после первого `npm install` `npm ls --depth=0` показал ожидаемое дерево: `@uni-fw/*` → `.\packages\uni-fw-*` (workspace), три явных `@xterm/*`, остальные deps идентичны прежнему lockfile. Никаких ASSUMED/SUS-кандидатов. Gate пройден автоматически (без human-review).

## Self-Check: PASSED

**Files verified to exist on disk:**

- FOUND: `package-lock.json` (3 совпадения `link.*true` для @uni-fw/*; 0 совпадений `npm.ts-vit.com`)
- FOUND: `vitest.config.ts` (содержит `include: ["src/**/*.{test,spec}.{ts,tsx}"]`)
- FOUND: `.planning/phases/02-npm-vendoring/02-03-TEST-NOTES.md` (содержит «Все тесты прошли без правок» + раздел про D-05/D-06)
- FOUND: `node_modules/@uni-fw/ui` (workspace symlink, `isSymbolicLink === true`)
- FOUND: `node_modules/@uni-fw/ssh-ui` (workspace symlink)
- FOUND: `node_modules/@uni-fw/terminal-ui` (workspace symlink)
- NOT FOUND: `.npmrc` (deleted в Plan 02-02 — это ожидаемо)

**Commits verified to exist:**

- FOUND: `cd5b5b7` — chore(02-03): regenerate package-lock.json without npm.ts-vit.com
- FOUND: `cc9b30f` — chore(02-03): verify npm ci + typecheck + vitest after vendoring

**Verification commands run:**

- `(Select-String -Path package-lock.json -Pattern 'npm\.ts-vit\.com').Count` → 0
- `node -e "JSON.parse...@uni-fw/*..."` → `ok` (все три пакета — `link:true → packages/uni-fw-*`)
- `node -e "fs.lstatSync('node_modules/@uni-fw/*').isSymbolicLink()"` → true (все три)
- `npm pkg get workspaces` → `"packages/*"`
- `npm ci` → exit 0 (490 packages, 0 vulnerabilities)
- `npm run typecheck` → exit 0 (нет вывода)
- `npm run test` → 19 файлов / 106 тестов passed, 0 failed, 0 skipped
- `Select-String -Path test-output.txt -Pattern '^\s*packages/uni-fw-|FAIL'` → 0 совпадений
- `git diff --quiet HEAD~2 -- package.json` → exit 0 (корневой package.json не тронут после Task 1)
- `git diff --stat HEAD~2 -- src/` → пусто (compatibility D-12 / NPM-07 — consumer-код не тронут)

---

*Phase: 02-npm-vendoring*
*Completed: 2026-05-16*
