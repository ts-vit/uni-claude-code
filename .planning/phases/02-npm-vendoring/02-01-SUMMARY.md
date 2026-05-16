---
phase: 02-npm-vendoring
plan: 01
subsystem: infra
tags: [npm, workspaces, vendoring, uni-fw, react, mantine, tauri, snapshot]

# Dependency graph
requires:
  - phase: init
    provides: Текущая раскладка проекта uni-claude-code (src/ потребляет @uni-fw/* через приватный реестр npm.ts-vit.com), CLAUDE.md упоминает @uni-fw/* как внешние
provides:
  - 3 каталога packages/uni-fw-*/ со snapshot-копией исходников @uni-fw/ui, @uni-fw/ssh-ui, @uni-fw/terminal-ui из D:\work-ai\ai-chat\packages\
  - Локальные источники для будущих "workspace:*" зависимостей в корневом package.json (Plan 02-02)
  - Снимок «спящих» build-артефактов (tsup.config.ts, tsconfig.build.json, vitest.config.ts, src/__tests__/) на случай возврата к публикации пакетов
affects: [02-02-rewrite-npm-manifests, 02-03-regenerate-lock-and-verify]

# Tech tracking
tech-stack:
  added: ["@uni-fw/ui (vendored)", "@uni-fw/ssh-ui (vendored)", "@uni-fw/terminal-ui (vendored)"]
  patterns: [snapshot-vendoring (npm), byte-identical copy без правки манифестов, зеркалирование структуры crates/uni-* на packages/uni-fw-*]

key-files:
  created:
    - packages/uni-fw-ui/package.json
    - packages/uni-fw-ui/src/index.ts
    - packages/uni-fw-ui/src/styles/markdown.css
    - packages/uni-fw-ui/src/components/ConfirmModal.tsx
    - packages/uni-fw-ui/src/components/MarkdownRenderer.tsx
    - packages/uni-fw-ui/src/components/UniProvider.tsx
    - packages/uni-fw-ui/src/settings/useSettings.ts
    - packages/uni-fw-ui/src/settings/TauriSettingsAdapter.ts
    - packages/uni-fw-ssh-ui/package.json
    - packages/uni-fw-ssh-ui/src/index.ts
    - packages/uni-fw-ssh-ui/src/SshTunnelSettings.tsx
    - packages/uni-fw-ssh-ui/src/useSshTunnel.ts
    - packages/uni-fw-terminal-ui/package.json
    - packages/uni-fw-terminal-ui/src/index.ts
    - packages/uni-fw-terminal-ui/src/TerminalPanel.tsx
  modified: []

key-decisions:
  - "Snapshot-копия побайтная — repository=/homepage= и `peerDependencies.\"@uni-fw/ui\": \"*\"` в манифестах пакетов оставлены как есть (D-07, D-09). Это документационные/peer-поля, не источник зависимости"
  - "Корневой package.json, .npmrc, package-lock.json НЕ изменены — это явный scope Plan 02-02 и Plan 02-03. Текущий план только копирует"
  - "tsup.config.ts, tsconfig.build.json, vitest.config.ts, src/__tests__/ скопированы как «спящие» артефакты (D-02, D-05, D-06) — корневой сборкой uni-claude-code не активируются, оставлены на случай возврата к публикации пакетов"

patterns-established:
  - "Snapshot workflow (npm): PowerShell-скрипт через temp-файл (.tmp-copy-packages.ps1) — копирует Get-ChildItem-Recurse с defensive-исключением node_modules/dist/coverage/.git/.turbo, потом удаляется"
  - "Verification gate (npm): метаданные-проверка без запуска npm install — Get-ChildItem на 3 package.json + Test-Path на src/index.ts + Select-String на сохранённые имена/repository-метаданные"

requirements-completed: [NPM-01, NPM-02, NPM-03]

# Metrics
duration: 1.5min
completed: 2026-05-16
---

# Phase 02 Plan 01: Vendor @uni-fw/* npm Packages Summary

**3 npm-пакета (@uni-fw/ui, @uni-fw/ssh-ui, @uni-fw/terminal-ui) скопированы snapshot-ом из D:\work-ai\ai-chat\packages\ в packages/uni-fw-*/ — локальные источники готовы под будущую регистрацию workspace в Plan 02-02**

## Performance

- **Duration:** ~1.5 min
- **Started:** 2026-05-16T09:43:29Z
- **Completed:** 2026-05-16T09:44:59Z
- **Tasks:** 1
- **Files modified:** 89 (89 created в packages/uni-fw-*, 0 modified — корневые конфиги не тронуты)

## Accomplishments

- Все 3 каталога `packages/uni-fw-*/` существуют со скопированным исходником: `package.json` + `README.md` + `.npmignore` + `tsconfig.json` + `tsconfig.build.json` + `tsup.config.ts` + `vitest.config.ts` + весь `src/` (включая `__tests__/`, `styles/`, `components/`, `modules/`, `settings/`, `theme/`).
- Имена пакетов внутри сохранены: `"name": "@uni-fw/ui"`, `"name": "@uni-fw/ssh-ui"`, `"name": "@uni-fw/terminal-ui"` (D-08).
- Метаданные `repository`/`homepage` остались с исходными `https://github.com/ts-vit/ai-chat` URL во всех 3 манифестах (D-07) — итого 6 совпадений (по 2 в каждом: `repository.url` + `homepage`).
- Cross-package peer `"@uni-fw/ui": "*"` в `packages/uni-fw-ssh-ui/package.json` НЕ изменён — workspace npm 7+ резолвит на sibling-пакет автоматически (аналог Phase 1: `path = "../uni-common"` в `crates/uni-process/Cargo.toml` тоже оставили без правок).
- «Спящие» артефакты на месте во всех 3 пакетах: `tsup.config.ts`, `tsconfig.build.json`, `vitest.config.ts`, каталог `src/__tests__/`. Они скопированы как часть snapshot, но не подключаются корневой сборкой `uni-claude-code` (D-02, D-05, D-06).
- Корневой `package.json` НЕ изменён: `git diff --quiet -- package.json` exits 0.
- Файл `.npmrc` НЕ изменён: `git diff --quiet -- .npmrc` exits 0 (его удаление — задача Plan 02-02).
- В `packages/` отсутствуют `node_modules/`, `dist/`, `coverage/` — defensive-исключения сработали (хотя в источнике этих каталогов и не было).
- Покрыты требования NPM-01..NPM-03 (по одному на каждый пакет).

## Task Commits

Все задачи закоммичены атомарно:

1. **Task 1: Скопировать 3 пакета @uni-fw/* snapshot-ом из ai-chat в packages/uni-fw-*** — `6a7411b` (feat)

_Note: Файл `package-lock.json` в этом плане НЕ регенерировался — это работа Plan 02-03. Корневой `package.json` и `.npmrc` тоже не тронуты — это явный scope Plan 02-02._

## Files Created/Modified

**Created (89 файлов):**

`packages/uni-fw-ui/` (62 файла):
- `package.json` — манифест с `"name": "@uni-fw/ui"`, `repository`/`homepage` указывают на `github.com/ts-vit/ai-chat` (snapshot побайтная)
- `README.md`, `.npmignore`
- `tsconfig.json`, `tsconfig.build.json` («спящий»), `tsup.config.ts` («спящий»), `vitest.config.ts` («спящий»)
- `src/index.ts` — публичная точка входа пакета
- `src/styles/markdown.css` — нужен для импорта `src/main.tsx:7` (`@uni-fw/ui/src/styles/markdown.css`)
- `src/components/` — 9 файлов: `ConfirmModal`, `EmptyState`, `KeyValueEditor`, `MarkdownRenderer`, `ResizablePanel`, `SessionTabs`, `StatusBadge`, `UniProvider`, `index.ts`
- `src/modules/` — 7 модулей: `budget`, `generation`, `interface`, `ollama` (включая `OllamaModels.tsx`, `useOllamaApi.ts`, `types.ts`), `openrouter` (включая `ModelCatalog.tsx`, `useOpenRouterModels.ts`, `types.ts`), `terminal`, `web-search` + общий `index.ts`
- `src/settings/` — `SettingsContext.tsx`, `TauriSettingsAdapter.ts`, `useSettings.ts`, `types.ts`, `index.ts`
- `src/theme/` — `brandPalette.ts`, `cssResolver.ts`, `uniTheme.ts`, `index.ts`
- `src/__tests__/` — 14 тестов («спящие» по D-05, не запускаются корневым vitest)

`packages/uni-fw-ssh-ui/` (13 файлов):
- `package.json` — манифест с `"name": "@uni-fw/ssh-ui"`, `peerDependencies."@uni-fw/ui": "*"` сохранён как есть
- `README.md`, `.npmignore`
- `tsconfig.json`, `tsconfig.build.json`, `tsup.config.ts`, `vitest.config.ts`
- `src/index.ts`, `SshTunnelSettings.tsx`, `types.ts`, `useSshTunnel.ts`
- `src/__tests__/setup.ts`, `SshTunnelSettings.test.tsx`

`packages/uni-fw-terminal-ui/` (13 файлов):
- `package.json` — манифест с `"name": "@uni-fw/terminal-ui"`, peerDeps на `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links` сохранены
- `README.md`, `.npmignore`
- `tsconfig.json`, `tsconfig.build.json`, `tsup.config.ts`, `vitest.config.ts`
- `src/index.ts`, `TerminalPanel.tsx`, `themes.ts`, `types.ts`
- `src/__tests__/setup.ts`, `TerminalPanel.test.tsx`

**Modified:** ничего из существующих файлов репо — `package.json`, `.npmrc`, `package-lock.json`, `src/`, `src-tauri/` нетронуты.

## Decisions Made

- **Snapshot-копия побайтная** — `repository = "https://github.com/ts-vit/ai-chat"` и `homepage = "..."` в исходных манифестах оставлены как есть во всех 3 пакетах. Это документационные поля (npmjs.com метадата), не источник зависимости. Аналог Phase 1 / Plan 01-01 для Rust крейтов.
- **`peerDependencies."@uni-fw/ui": "*"` в `packages/uni-fw-ssh-ui/package.json` НЕ переписан** на `"workspace:*"` — раскладка `packages/uni-fw-*` в нашем репо позволит npm workspaces резолвить peer на sibling-пакет автоматически. Аналог Phase 1: `path = "../uni-common"` в `crates/uni-process/Cargo.toml` тоже не правился, потому что относительная раскладка совпадает.
- **Корневой `package.json` и `.npmrc` НЕ модифицированы** — это явный scope Plan 02-02 (объявление `workspaces`, замена `^0.1.x` на `workspace:*`, удаление `.npmrc`). Plan 02-01 фокусируется только на копировании источников.
- **`package-lock.json` НЕ регенерировался** — это явный scope Plan 02-03 (после Plan 02-02 удалит запись приватного реестра из корневого `package.json`/`.npmrc`).
- **`tsup.config.ts`, `tsconfig.build.json`, `vitest.config.ts`, `src/__tests__/` оставлены как «спящие» артефакты** — копия snapshot побайтная (D-02, D-05, D-06). Корневой `npm run test` и `npm run build` их не активируют. Если кому-то понадобится прогнать тесты пакета — это делается `npm test -w packages/uni-fw-ui` точечно (не блокирует DoD).

## Deviations from Plan

None — plan executed exactly as written.

Все acceptance criteria единственной задачи выполнены без отклонений. Никаких Rule 1/2/3 auto-fix-ов не потребовалось.

## Issues Encountered

- **PowerShell `$_`-переменные в Bash-обёртке** — повторение проблемы из Phase 1 / Plan 01-01. Inline `powershell -NoProfile -Command "...$_..."` через Bash-tool интерпретирует `$_` как Bash-переменную (пусто), что ломает `Get-ChildItem | ForEach-Object` пайплайн. Workaround (унаследованный из 01-01-SUMMARY.md): записать PowerShell-скрипт во временный файл (`.tmp-copy-packages.ps1`, `.tmp-verify-artifacts.ps1`), выполнить через `powershell -ExecutionPolicy Bypass -File`, удалить временный файл сразу после. Временные файлы НЕ закоммичены — проверено `git ls-files .tmp-copy-*.ps1` (возвращает пусто).

## User Setup Required

None — никаких внешних сервисов или конфигурации не требуется. `npm install`/`npm ci` в этом плане НЕ запускались — это исключает срабатывание Package Legitimacy Gate (T-02-SC из threat-model).

## Next Phase Readiness

**Ready for Plan 02-02 (`rewrite-npm-manifests`):**

- Все 3 вендорированных пакета доступны как локальные каталоги под `packages/uni-fw-*/`.
- Cross-package peer `@uni-fw/ssh-ui → @uni-fw/ui` уже корректен (workspace npm 7+ резолвит на sibling).
- Plan 02-02 теперь может безопасно:
  - Добавить `"workspaces": ["packages/*"]` в корневой `package.json`.
  - Заменить 3 строки в `dependencies`: `"@uni-fw/ui": "^0.1.0"` → `"workspace:*"`, и аналогично для `ssh-ui`/`terminal-ui` (D-04).
  - Удалить `.npmrc` (D-11) — никаких ссылок на `npm.ts-vit.com` после этого не остаётся ни в одном tracked файле, кроме `package-lock.json` (его перегенерирует Plan 02-03).
  - Добавить transitive peer-deps (`@xterm/*`, `react-markdown`, `rehype-highlight`, `remark-gfm`) в корневой `package.json` если researcher так решит (на усмотрение planner per CONTEXT.md Discretion).

**Blockers/concerns:** None.

## Self-Check: PASSED

**Files verified to exist on disk:**

- FOUND: `packages/uni-fw-ui/package.json`
- FOUND: `packages/uni-fw-ui/src/index.ts`
- FOUND: `packages/uni-fw-ui/src/styles/markdown.css`
- FOUND: `packages/uni-fw-ui/src/components/{ConfirmModal,MarkdownRenderer,UniProvider}.tsx`
- FOUND: `packages/uni-fw-ui/src/settings/{useSettings.ts,TauriSettingsAdapter.ts,SettingsContext.tsx,index.ts}`
- FOUND: `packages/uni-fw-ssh-ui/package.json`
- FOUND: `packages/uni-fw-ssh-ui/src/{index.ts,SshTunnelSettings.tsx,useSshTunnel.ts}`
- FOUND: `packages/uni-fw-terminal-ui/package.json`
- FOUND: `packages/uni-fw-terminal-ui/src/{index.ts,TerminalPanel.tsx}`
- FOUND: «Спящие» артефакты в каждом из 3 пакетов (`tsup.config.ts`, `tsconfig.build.json`, `vitest.config.ts`, `src/__tests__/`)

**Commits verified to exist:**

- FOUND: `6a7411b` — feat(02-01): vendor 3 @uni-fw/* packages from ai-chat as snapshot

**Verification commands run:**

- `Get-ChildItem packages/uni-fw-ui,packages/uni-fw-ssh-ui,packages/uni-fw-terminal-ui -Filter package.json | Measure-Object` → 3
- `Test-Path packages/uni-fw-{ui,ssh-ui,terminal-ui}/src/index.ts` → True (все 3)
- `Select-String -Path packages/uni-fw-ui/package.json -Pattern '"name": "@uni-fw/ui"'` → 1 совпадение
- `Select-String -Path packages/uni-fw-ssh-ui/package.json -Pattern '"name": "@uni-fw/ssh-ui"'` → 1 совпадение
- `Select-String -Path packages/uni-fw-terminal-ui/package.json -Pattern '"name": "@uni-fw/terminal-ui"'` → 1 совпадение
- `Select-String -Path packages/uni-fw-ssh-ui/package.json -Pattern '"@uni-fw/ui": "\*"'` → 1 совпадение (peer сохранён)
- `Select-String -Path packages/uni-fw-*/package.json -Pattern 'github.com/ts-vit/ai-chat'` → 6 совпадений (по 2 в каждом: `repository.url` + `homepage`)
- `Get-ChildItem packages -Recurse -Force -Directory -Include node_modules,dist,coverage` → 0 (defensive исключения сработали)
- `git diff --quiet -- package.json` → exit 0 (UNCHANGED)
- `git diff --quiet -- .npmrc` → exit 0 (UNCHANGED)
- `git ls-files .tmp-copy-*.ps1` → пусто (временные файлы не закоммичены)

---

*Phase: 02-npm-vendoring*
*Completed: 2026-05-16*
