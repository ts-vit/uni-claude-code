---
phase: 02-npm-vendoring
plan: 02
subsystem: infra
tags: [npm, workspaces, package-json, uni-fw, xterm, source-direct, npmrc-removal]

# Dependency graph
requires:
  - phase: 02-01
    provides: 3 каталога packages/uni-fw-*/ со snapshot-копией исходников (package.json + src/) — локальные источники готовы под "workspace:*" зависимости
provides:
  - Корневой package.json объявляет "workspaces": ["packages/*"] и ссылается на все три @uni-fw/* через "workspace:*" (NPM-04, NPM-05)
  - Корневой package.json явно перечисляет три транзитивных peer-deps @xterm/* (xterm, addon-fit, addon-web-links) — необходимо после удаления .npmrc, потому что npm не ставит peerDependencies автоматически
  - 3 вендорированных package.json переведены на source-direct entry (./src/index.ts) для main/types/exports — TS-резолв через workspace symlink без build step (часть NPM-09)
  - .npmrc с приватным реестром npm.ts-vit.com удалён полностью (NPM-06) — никаких следов SPOF в репо
affects: [02-03-regenerate-lock-and-verify]

# Tech tracking
tech-stack:
  added:
    - "@xterm/xterm ^6.0.0 (явная dep в root, поднята из terminal-ui peerDependencies)"
    - "@xterm/addon-fit ^0.11.0 (явная dep в root)"
    - "@xterm/addon-web-links ^0.12.0 (явная dep в root)"
    - "npm workspaces декларация (packages/*)"
  patterns:
    - "workspace:* ссылки в root package.json вместо ^semver — прямой аналог git=... → path=... из Plan 01-02 (Cargo)"
    - "source-direct entry в манифестах вендорированных пакетов — main/types/exports указывают на ./src/index.ts вместо dist/, никакого build step"
    - "Явное поднятие peer-deps вендорированного пакета в корневые dependencies (после удаления приватного реестра npm перестаёт тащить peer'ы транзитивно через старые версии)"

key-files:
  created: []
  modified:
    - package.json
    - packages/uni-fw-ui/package.json
    - packages/uni-fw-ssh-ui/package.json
    - packages/uni-fw-terminal-ui/package.json
  deleted:
    - .npmrc

key-decisions:
  - "Source-direct entry: main/types/exports каждого вендорированного package.json указывают на ./src/index.ts (D-01). Vite/tsc резолвят TS-исходник напрямую через workspace symlink, никакого `tsup` build step не нужно. dist/ полностью убран из манифестов"
  - "@uni-fw/ui exports.\"./src/styles/*\" сохранён без изменений (D-03) — поддерживает CSS-импорт `src/main.tsx:7` (`@uni-fw/ui/src/styles/markdown.css`)"
  - "workspace:* ссылки в root package.json (D-04) — npm 7+ канон для локальных зависимостей; защищает от случайного `npm publish` и устойчив к bump-у версий внутри пакетов"
  - "Минимум магии в манифесте (D-10) — никаких overrides/peerDependenciesMeta/resolutions/nohoist. Просто \"workspaces\": [\"packages/*\"] + \"workspace:*\" reference + явные xterm-deps"
  - "@xterm/xterm/addon-fit/addon-web-links подняты в root dependencies явно (Claude's Discretion §2) — npm не устанавливает peerDependencies автоматически, а src/main.tsx:8 уже импортирует @xterm/xterm/css/xterm.css напрямую. Версии (^6.0.0, ^0.11.0, ^0.12.0) совпадают с peerDependencies из packages/uni-fw-terminal-ui/package.json"
  - "Cross-package peer @uni-fw/ssh-ui → @uni-fw/ui НЕ переписан на workspace:* (D-09) — оставлен как \"*\" в peerDependencies, npm workspaces резолвят на sibling-пакет автоматически. Прямой аналог Phase 1, где path = \"../uni-common\" внутри uni-process не правился"
  - "Метаданные repository/homepage в пакетных package.json НЕ тронуты (D-07) — это документационные поля, не источник зависимости"
  - "package-lock.json НЕ регенерировался — это явный scope Plan 02-03"

patterns-established:
  - "Edit-with-context для JSON-манифестов: предоставлять old_string с минимальным окружающим контекстом (например, поле + следующая строка) для гарантии уникальности — без регулярок и sed"
  - "Verification gate без install: `npm pkg get workspaces` + `node -e \"JSON.parse(...)\"` — валидирует структуру манифеста без вызова npm install; запуск установки отложен до Plan 02-03"
  - "Defensive auth-scan перед удалением .npmrc: `Select-String -Pattern '_authToken|always-auth|password|auth='` — гарантия, что секреты не утекут в git history через незамеченные директивы (T-02-03 mitigated)"

requirements-completed: [NPM-04, NPM-05, NPM-06]

# Metrics
duration: 2min
completed: 2026-05-16
---

# Phase 02 Plan 02: Rewrite npm Manifests Summary

**Корневой `package.json` объявил npm workspaces и переключил все три `@uni-fw/*` на `"workspace:*"`; три вендорированных манифеста перевелись на source-direct entry (`./src/index.ts`); `.npmrc` с приватным реестром `npm.ts-vit.com` удалён. После этого плана ни одна часть конфигурации сборки не указывает на `npm.ts-vit.com` — остался только `package-lock.json` для регенерации в Plan 02-03.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-16T09:48:20Z
- **Completed:** 2026-05-16T09:50:26Z
- **Tasks:** 3
- **Files modified:** 4 (4 modified, 1 deleted, 0 created)

## Accomplishments

- Корневой `package.json` теперь содержит `"workspaces": ["packages/*"]` — npm workspaces декларация на месте (NPM-04).
- Три записи `@uni-fw/{ui,ssh-ui,terminal-ui}` в `dependencies` корневого `package.json` заменены с `^0.1.x` на `"workspace:*"` — единственная теперь корректная ссылка на локальные снапшоты (NPM-05).
- Файл `.npmrc` удалён из репо целиком; в индексе git нет ни одного `.npmrc` файла; в `package.json` отсутствуют упоминания `npm.ts-vit.com` (NPM-06).
- В корневом `dependencies` явно перечислены три новых записи: `"@xterm/addon-fit": "^0.11.0"`, `"@xterm/addon-web-links": "^0.12.0"`, `"@xterm/xterm": "^6.0.0"` — версии скопированы из `peerDependencies` пакета `packages/uni-fw-terminal-ui/package.json` (D-09).
- В каждом из трёх вендорированных `package.json` поля `main`, `types` и `exports."."."import".{types,default}` переписаны с `dist/index.js`|`dist/index.d.ts` на `./src/index.ts` — итого 12 совпадений `./src/index.ts` (3 пакета × 4 поля).
- В `packages/uni-fw-ui/package.json` поле `exports."./src/styles/*"` сохранено без изменений (D-03) — CSS-импорт `src/main.tsx:7` продолжит работать.
- В `packages/uni-fw-ssh-ui/package.json` запись `peerDependencies."@uni-fw/ui": "*"` сохранена (D-09) — workspace symlink резолвит peer на sibling-пакет автоматически.
- В `packages/uni-fw-terminal-ui/package.json` все три `peerDependencies."@xterm/*"` остались без изменений (источник правды для версий, поднятых в root).
- Никаких сложных npm-конструкций (`overrides`/`peerDependenciesMeta`/`resolutions`/`nohoist`) не введено — минимум магии (D-10).
- Файл `package-lock.json` НЕ тронут — это явный scope Plan 02-03 (`git diff --quiet HEAD -- package-lock.json` exits 0).
- Никаких изменений в `src/`, `src-tauri/`, `crates/` (compatibility-constraint D-12 выполнен) — `git diff --quiet HEAD~3 HEAD -- src/ src-tauri/ crates/` exits 0.
- Покрыты требования NPM-04, NPM-05, NPM-06; источниковая часть NPM-09 (типы через source-direct) подготовлена.

## Task Commits

Все три задачи закоммичены атомарно:

1. **Task 1: Переписать три пакетных package.json на source-direct entry** — `e83dfac` (refactor)
2. **Task 2: Объявить workspaces, переписать @uni-fw/* на workspace:*, поднять xterm peer-deps** — `b1ddae9` (refactor)
3. **Task 3: Удалить .npmrc с приватным реестром npm.ts-vit.com** — `49f3f84` (chore)

## Files Modified

**Modified (4 файла):**

- `package.json` — `+9 -3` строк:
  - Добавлено поле `"workspaces": ["packages/*"]` после `"type": "module"`
  - Заменены `@uni-fw/ssh-ui ^0.1.2` → `workspace:*`, `@uni-fw/terminal-ui ^0.1.5` → `workspace:*`, `@uni-fw/ui ^0.1.0` → `workspace:*`
  - Добавлены `@xterm/addon-fit ^0.11.0`, `@xterm/addon-web-links ^0.12.0`, `@xterm/xterm ^6.0.0` в `dependencies` (по алфавиту между `@uni-fw/ui` и `i18next`)
- `packages/uni-fw-ui/package.json` — `+4 -4`: `main`, `types`, `exports."."."import"."types"`, `exports."."."import"."default"` переключены на `./src/index.ts`; `exports."./src/styles/*"` сохранён
- `packages/uni-fw-ssh-ui/package.json` — `+4 -4`: те же 4 поля, без CSS sub-export
- `packages/uni-fw-terminal-ui/package.json` — `+4 -4`: те же 4 поля

**Deleted (1 файл):**

- `.npmrc` — удалён целиком (одна строка `@uni-fw:registry=https://npm.ts-vit.com`)

**Created:** ничего.

## Decisions Made

- **Source-direct entry для каждого вендорированного package.json** (D-01) — `main`/`types`/`exports` указывают на `./src/index.ts`. Vite 7 + tsc через workspace symlink + `moduleResolution: "bundler"` (см. tsconfig.json корня) резолвят TS-исходник напрямую без `tsup` build step. dist/-references из всех трёх манифестов полностью убраны (0 совпадений `dist/index` после правки).
- **`@uni-fw/ui` exports.`./src/styles/*` сохранён** (D-03) — CSS-импорт `src/main.tsx:7` (`@uni-fw/ui/src/styles/markdown.css`) продолжает резолвиться через тот же sub-export. Сохранение происходит через `replace_all=false` Edit с явным сохранением ключа в `new_string`.
- **workspace:* ссылки вместо `^semver` для трёх `@uni-fw/*`** (D-04) — npm 7+ канон для локальных зависимостей. Явный сигнал «локальная привязка», устойчив к bump-у `version` внутри пакета, защищает от случайного `npm publish`. Прямой аналог Phase 1 / Plan 01-02 (`git=...` → `path=...` для Cargo).
- **Никаких сложных npm-конструкций** (D-10, Established Patterns) — без `overrides`, `peerDependenciesMeta`, `resolutions`, `nohoist`. Поведение npm по умолчанию. Минимизирует diff и удерживает контракт «vendoring = просто заменить источник, не переделывать стек».
- **Явное поднятие @xterm/* в root dependencies** (Claude's Discretion §2) — `peerDependencies` пакета `@uni-fw/terminal-ui` указывает `@xterm/xterm ^6.0.0`, `@xterm/addon-fit ^0.11.0`, `@xterm/addon-web-links ^0.12.0`. npm НЕ устанавливает peerDependencies автоматически (это спецификация npm 7+), а `src/main.tsx:8` уже импортирует `@xterm/xterm/css/xterm.css` напрямую. После удаления `.npmrc` транзитивный resolve через старый registry-version `@uni-fw/terminal-ui` перестаёт работать — поэтому версии подняты в root явно, точно соответствуют peer-spec из источника (D-09 — версии не меняем).
- **Cross-package peer `@uni-fw/ui` в `@uni-fw/ssh-ui` НЕ переписан** (D-09) — оставлен как `"*"` в `peerDependencies`. Workspace symlink резолвит на sibling-пакет автоматически. Прямой аналог Phase 1: `path = "../uni-common"` в `crates/uni-process/Cargo.toml` тоже не правился.
- **Метаданные `repository`/`homepage` пакетных манифестов НЕ тронуты** (D-07) — оставлены как в snapshot из ai-chat (6 совпадений `github.com/ts-vit/ai-chat` сохранены).
- **`package-lock.json` НЕ регенерировался** — это явный scope Plan 02-03 (где `npm install`/`npm ci` плюс установка Package Legitimacy Gate).

## Deviations from Plan

None — plan executed exactly as written.

Все acceptance criteria трёх задач выполнены без отклонений. Никаких Rule 1/2/3 auto-fix-ов не потребовалось — структура была прозрачной благодаря тщательной подготовке плана.

## Issues Encountered

- **Размещение `@xterm/*` в алфавитном порядке** — пришлось проверить ASCII-порядок: `@m` < `@t` < `@u` < `@x`, поэтому `@xterm/*` встают ПОСЛЕ `@uni-fw/*` (а не между `@tauri-apps/*` и `@uni-fw/*`). Initial intuition «xterm идёт раньше» была неверна; быстрая проверка lexicographic order дала корректное место — между `@uni-fw/ui` и `i18next`. Без последствий — текущий порядок в финальном файле корректный.

## User Setup Required

None — никаких внешних сервисов или конфигурации не требуется. `npm install`/`npm ci` в этом плане НЕ запускались — это исключает срабатывание Package Legitimacy Gate (T-02-SC из threat-model). Установка пакетов начинается в Plan 02-03.

## Next Phase Readiness

**Ready for Plan 02-03 (`regenerate-lock-and-verify`):**

- Корневой `package.json` объявляет workspaces, ссылается на все три `@uni-fw/*` через `workspace:*`, явно перечисляет три `@xterm/*` peer-deps.
- Все три вендорированных `package.json` указывают entry-point на `./src/index.ts` — Vite/tsc смогут резолвить TS-исходник напрямую через `node_modules/@uni-fw/*` workspace symlink.
- `.npmrc` физически удалён — npm 11+ перестанет пытаться обращаться к `npm.ts-vit.com` для `@uni-fw:` scope.
- `package-lock.json` всё ещё содержит старые `resolved`-URL на приватный реестр для `@uni-fw/*` — Plan 02-03 должен:
  - Удалить `package-lock.json` целиком
  - Запустить `npm install` (npm 7+ при отсутствии lockfile создаёт новый, подхватывает workspaces, симлинкует `@uni-fw/*` в `node_modules`)
  - Проверить, что в новом `package-lock.json` нет `npm.ts-vit.com` и нет registry-resolved `@uni-fw/*` записей (должны быть `link:packages/uni-fw-*` или эквивалент npm workspace symlink-формы)
  - Запустить полный verify gate: `npm run typecheck` + `npm run test` + проверка `npm ci` (зелёный)
  - Активировать Package Legitimacy Gate (T-02-SC) ПЕРЕД первым `npm install`/`npm ci` — `@xterm/*` пакеты теперь поднимаются из публичного `registry.npmjs.org` явно (раньше шли транзитивно)

**Blockers/concerns:** None.

## Threat Model Verification

- **T-02-03 (Information Disclosure, .npmrc auth):** mitigated — перед удалением подтверждено, что `.npmrc` содержал ровно одну строку `@uni-fw:registry=https://npm.ts-vit.com` без `_authToken`/`always-auth`/`password`/`auth=` директив. `Select-String -Pattern '_authToken|always-auth|password|auth='` вернул 0.
- **T-02-04 (Tampering, registry-substitution):** mitigated — все три `@uni-fw/*` теперь привязаны к `workspace:*` (локальный каталог). npm физически не может скачать другую версию пакета. После Plan 02-03 это закрепится в `package-lock.json` через `link:` или эквивалент.
- **T-02-05 (Tampering, @xterm/*):** accepted — три `@xterm/*` пакета теперь явные dep'ы из публичного `registry.npmjs.org`. Версии (`^6.0.0`, `^0.11.0`, `^0.12.0`) точно соответствуют peerDependencies из snapshot — тот же код, который уже работал транзитивно. Дополнительной mitigation на этом плане не требовалось.
- **T-02-SC (npm install/ci):** mitigated — `npm install`/`npm ci` в этом плане НЕ запускались. Package Legitimacy Gate активируется в Plan 02-03 перед install-командой.

## Self-Check: PASSED

**Files verified to exist on disk:**

- FOUND: `package.json` (modified — содержит `"workspaces": ["packages/*"]` и `"workspace:*"` для всех трёх `@uni-fw/*`)
- FOUND: `packages/uni-fw-ui/package.json` (modified — `main`/`types`/`exports."."."import"` на `./src/index.ts`)
- FOUND: `packages/uni-fw-ssh-ui/package.json` (modified — те же поля)
- FOUND: `packages/uni-fw-terminal-ui/package.json` (modified — те же поля)
- NOT FOUND: `.npmrc` (deleted — это ожидаемо)

**Commits verified to exist:**

- FOUND: `e83dfac` — refactor(02-02): switch vendored @uni-fw/* packages to source-direct entry (./src/index.ts)
- FOUND: `b1ddae9` — refactor(02-02): declare npm workspaces and switch @uni-fw/* to workspace:* in root package.json
- FOUND: `49f3f84` — chore(02-02): remove .npmrc with private registry npm.ts-vit.com

**Verification commands run:**

- `Select-String -Path packages/uni-fw-*/package.json -Pattern 'dist/index' | Measure-Object` → 0 (старые ссылки убраны)
- `Select-String -Path packages/uni-fw-*/package.json -Pattern '"\./src/index\.ts"' | Measure-Object` → 12 (3 пакета × 4 поля)
- `Select-String -Path packages/uni-fw-ui/package.json -Pattern '"\./src/styles/\*"' | Measure-Object` → 1 (CSS sub-export сохранён, D-03)
- `Select-String -Path packages/uni-fw-ssh-ui/package.json -Pattern '"@uni-fw/ui": "\*"' | Measure-Object` → 1 (cross-package peer сохранён, D-09)
- `Select-String -Path packages/uni-fw-terminal-ui/package.json -Pattern '@xterm/' | Measure-Object` → 3 (xterm peer-deps сохранены)
- `Select-String -Path package.json -Pattern '"workspaces"' | Measure-Object` → 1
- `Select-String -Path package.json -Pattern '"@uni-fw/' | Measure-Object` → 3
- `Select-String -Path package.json -Pattern '"workspace:\*"' | Measure-Object` → 3
- `Select-String -Path package.json -Pattern '"@xterm/' | Measure-Object` → 3
- `Select-String -Path package.json -Pattern '"overrides"|"peerDependenciesMeta"|"resolutions"|"nohoist"' | Measure-Object` → 0 (минимум магии)
- `Select-String -Path package.json -Pattern '\^0\.1\.[025]' | Measure-Object` → 0 (старые версии убраны)
- `Select-String -Path package.json -Pattern 'npm\.ts-vit\.com' | Measure-Object` → 0 (приватный реестр не утёк в package.json)
- `node -e "...JSON.parse validation..."` → `ok` (программная проверка структуры)
- `npm pkg get workspaces` → `"packages/*"` (workspace декларация читается npm-ом)
- `node -e "JSON.parse..."` для каждого из 3 пакетных package.json → `JSON OK` (валидные JSON)
- `Test-Path .npmrc` → False (файл удалён)
- `git ls-files '**/.npmrc' | Measure-Object` → 0 (нет других .npmrc в индексе)
- `git diff --quiet HEAD -- package-lock.json` → exit 0 (lockfile не тронут, scope Plan 02-03)
- `git diff --quiet HEAD~3 HEAD -- src/ src-tauri/ crates/` → exit 0 (D-12 compatibility: consumer-код не тронут)

---

*Phase: 02-npm-vendoring*
*Completed: 2026-05-16*
