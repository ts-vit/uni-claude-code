# Phase 2: npm Vendoring — Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Перенести 3 npm-пакета (`@uni-fw/ui`, `@uni-fw/ssh-ui`, `@uni-fw/terminal-ui`) snapshot-копией из `D:\work-ai\ai-chat\packages\{uni-ui,uni-ssh-ui,uni-terminal-ui}` внутрь репозитория в каталоги `packages/uni-fw-*`, объявить их npm workspaces, удалить `.npmrc` с приватным реестром. Импорты `@uni-fw/*` в `src/` продолжают работать без правок. `npm ci` проходит без сетевого доступа к `npm.ts-vit.com`. Поведение приложения не меняется — меняется только источник кода зависимостей.

Покрывает требования NPM-01 ... NPM-10 из REQUIREMENTS.md.

</domain>

<decisions>
## Implementation Decisions

### Build-стратегия артефактов пакетов

- **D-01:** Source-direct — без `dist/`. Каждый вендорированный пакет ссылается на TypeScript-исходники напрямую через `main` / `exports` в `package.json` (`./src/index.ts` / `./src/index.tsx`). Vite и `tsc --noEmit` потребляют TS-источники через workspace-symlink в `node_modules/@uni-fw/*`. Никакого build step (`tsup`), никакого commit бинарных артефактов в git.
- **D-02:** `tsup.config.ts`, `tsconfig.build.json`, `prepublishOnly`-скрипт остаются физически скопированными в `packages/uni-fw-*/` как часть snapshot, но не используются текущей сборкой `uni-claude-code` — это «спящие» артефакты на случай возврата к публикации (см. v2 MAINT-01).
- **D-03:** CSS-импорт `@uni-fw/ui/src/styles/markdown.css` из `src/main.tsx` продолжает работать как есть — поле `exports` пакета уже публикует `./src/styles/*`, при source-direct пути это не меняется.

### Ссылки на `@uni-fw/*` в корневом `package.json`

- **D-04:** В `dependencies` корневого `package.json` каждая `@uni-fw/*` запись заменена на `"workspace:*"` (например, `"@uni-fw/ui": "workspace:*"`). Канон npm workspaces 7+, явный сигнал «локальная привязка», устойчив к bump-у `version` внутри пакетов и защищает от случайного `npm publish`.

### Запуск тестов вендорированных пакетов

- **D-05:** Тесты внутри `packages/uni-fw-*/src/__tests__/` копируются «как есть» из ai-chat для архива и будущей работы (см. v2 MAINT-02), но НЕ запускаются ни в `npm run test`, ни в `npm run test:all`. Корневой `npm run test` остаётся `vitest run` в cwd — только тесты `src/__tests__/`. `npm run test:all` — без изменений в части workspaces (typecheck + vitest корня + `cargo test --workspace`).
- **D-06:** Конфиги `vitest.config.ts` внутри пакетов остаются скопированными как часть snapshot, но не подключаются в корневой test runner. Если кто-то захочет вручную прогнать тесты пакета — это делается `npm test -w packages/uni-fw-ui` точечно, не блокирует DoD.

### Структура и метаданные snapshot (унаследовано из Phase 1 решений)

- **D-07:** Snapshot побайтная — `repository=https://github.com/ts-vit/ai-chat` и `homepage=...` в `package.json` каждого пакета НЕ правим (полная аналогия с Phase 1 / Plan 01-01 для крейтов). Цель фазы — устранить fetch-зависимость, а не санитизировать метаданные.
- **D-08:** Каталоги пакетов именуются `packages/uni-fw-ui`, `packages/uni-fw-ssh-ui`, `packages/uni-fw-terminal-ui` — зеркалит `crates/uni-*` (по одному явному каталогу на пакет, без вложенных scope-каталогов вида `packages/@uni-fw/ui`). Имена пакетов внутри (`"name": "@uni-fw/ui"` и т.д.) остаются без изменений.
- **D-09:** Что копируется: всё содержимое каждого `D:\work-ai\ai-chat\packages\<pkg>/` КРОМЕ `node_modules/` и `dist/` (последнего там уже нет). Включая `README.md`, `.npmignore`, `tsconfig*.json`, `vitest.config.ts`, `tsup.config.ts`, `src/__tests__/`.
- **D-10:** Корневой `package.json` получает `"workspaces": ["packages/*"]`. Никакого hoist-override, никаких `nohoist` — поведение npm по умолчанию.
- **D-11:** `.npmrc` удаляется из репо полностью (а не оставляется пустым / закомментированным). Приватный реестр `npm.ts-vit.com` больше не нужен — оставлять любую запись = оставлять SPOF.

### Совместимость импортов

- **D-12:** Существующие импорты `import { ... } from "@uni-fw/ui"` / `@uni-fw/ssh-ui` / `@uni-fw/terminal-ui` в `src/` ТРЕБУЮТ работать без правок исходников `uni-claude-code`. Это hard-constraint из PROJECT.md, не подлежит ослаблению при выборе source-direct. Если выявится конфликт (например, нерезолвящийся подпуть) — правка идёт в `package.json` пакета, не в потребителя.

### Claude's Discretion

- Точная форма поля `exports` каждого пакета при source-direct: использовать ли только `main`/`types`, или составной `exports` с условиями `import`/`types` — на усмотрение planner/researcher после проверки совместимости с Vite 7 + tsc.
- Декларация peer-dependencies, которые после удаления `.npmrc` должны попасть в корневой `package.json` (`@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`, `react-markdown`, `rehype-highlight`, `remark-gfm` и любые другие transitive deps, которые npm workspaces не подтянет автоматически) — researcher определит полный список из `peerDependencies` трёх пакетов и текущего `package-lock.json` корня.
- Стратегия регенерации `package-lock.json` (полный `rm package-lock.json && npm install` vs. инкрементальный `npm install`) — на усмотрение planner. По аналогии с Phase 1 / Plan 01-03 (где `Cargo.lock` регенерировался полностью) — допустим полный rebuild lockfile.
- Нужен ли отдельный TypeScript path mapping в `tsconfig.json` корня — на усмотрение researcher. Скорее всего НЕ нужен (npm workspace symlinks + стандартное module resolution справятся), но проверить надо.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level (locked decisions)

- `.planning/PROJECT.md` — Key Decisions table (Snapshot vs subtree, source path, npm workspaces, .npmrc removal), Constraints (compatibility, build determinism, source `D:\work-ai\ai-chat`), Out of Scope (CI, обратная синхронизация, замена на OSS)
- `.planning/REQUIREMENTS.md` — требования NPM-01 ... NPM-10 для этой фазы (полный список acceptance criteria)
- `.planning/ROADMAP.md` §«Phase 2: npm Vendoring» — Success Criteria и Goal
- `.planning/STATE.md` — Decisions log с решениями Phase 1, которые служат прецедентом (snapshot semantics, метаданные «как есть»)

### Phase 1 precedent (для аналогий)

- `.planning/phases/01-rust-vendoring/01-01-vendor-uni-crates-PLAN.md` — паттерн «вкопировать snapshot в `crates/*` и зарегистрировать в workspace.members»
- `.planning/phases/01-rust-vendoring/01-02-rewrite-cargo-manifests-PLAN.md` — паттерн замены приватного источника (git → path) в манифестах
- `.planning/phases/01-rust-vendoring/01-03-regenerate-lock-and-verify-PLAN.md` — паттерн регенерации lockfile + verify через сборку и тесты
- `.planning/phases/01-rust-vendoring/01-VERIFICATION.md` — формат итоговой верификации фазы

### Codebase maps

- `.planning/codebase/STRUCTURE.md` — текущая layout `src/`, `src-tauri/`, `crates/`; куда добавляются `packages/`
- `.planning/codebase/STACK.md` — версии React 19, Mantine 8.3, Vite 7, Vitest 4, TypeScript 5.8, текущие записи про `@uni-fw/*` и приватный реестр
- `.planning/codebase/INTEGRATIONS.md` — где и как `src/` потребляет `@uni-fw/*` API (`UniProvider`, `useSettings`, `TerminalPanel`, `SshTunnelSettings`)
- `.planning/codebase/TESTING.md` — текущая конфигурация Vitest + Mantine/i18n/Tauri mocks в `src/__tests__/setup.ts`

### Source-of-truth для snapshot

- `D:\work-ai\ai-chat\packages\uni-ui\` — источник `@uni-fw/ui` (`MarkdownRenderer`, `useSettings`, `UniProvider`, `ConfirmModal`, `TauriSettingsAdapter`, CSS-стили, theme, modules)
- `D:\work-ai\ai-chat\packages\uni-ssh-ui\` — источник `@uni-fw/ssh-ui` (`SshTunnelSettings`, `useSshTunnel`)
- `D:\work-ai\ai-chat\packages\uni-terminal-ui\` — источник `@uni-fw/terminal-ui` (`TerminalPanel`, themes)

### Repo files, которые будут затронуты

- `package.json` (корень) — добавить `workspaces`, заменить `@uni-fw/*` на `workspace:*`, возможно добавить transitive peer-deps
- `package-lock.json` — регенерация после удаления `.npmrc` и переключения на workspaces
- `.npmrc` — удалить
- `CLAUDE.md` — обновление упоминаний `@uni-fw/*` как внешних (это уже частично покрыто требованием BUILD-06 в фазе 3, но контекст для planner полезен)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Phase 1 pattern (`crates/uni-*`)** — точная аналогия для npm части: snapshot-копия в дочерний каталог + регистрация в workspace + path-семантика. Применим тот же mindset: minimum disturbance, маршрутизация резолва через workspace, не трогать поведение пакетов.
- **`src/__tests__/setup.ts`** — уже содержит `vi.mock("@uni-fw/ui", ...)`, `vi.mock("@uni-fw/terminal-ui", ...)`, `vi.mock("@uni-fw/ssh-ui", ...)` (на уровне имени модуля). Эти моки работают независимо от того, откуда резолвится пакет (npm registry vs workspace symlink) — менять их при vendoring не нужно.
- **Workspace pattern в `Cargo.toml`** — единый `[workspace]` блок с явными `members` — отличный mental model для frontend части (`"workspaces": ["packages/*"]`).

### Established Patterns

- **Path-style минимальной магии** — Phase 1 / Plan 01-02 явно решил «не переходим на `[workspace.dependencies]` + `.workspace = true`», то есть остаёмся на плоских path-зависимостях. По аналогии: для npm не используем сложные конфигурации `overrides`, `peerDependenciesMeta` без необходимости — простой `workspace:*` reference + явные deps на root.
- **Snapshot побайтная, метаданные «как есть»** — задано в Plan 01-01 для Rust крейтов; применяем тот же принцип ко всем трём npm-пакетам.
- **CSS-импорт через source-путь** — `src/main.tsx:7` уже импортирует `@uni-fw/ui/src/styles/markdown.css`. Это значит, что consumer уже ожидает `src/`-структуру внутри пакета, не только `dist/`. Source-direct стратегия органично продолжает этот паттерн.

### Integration Points

- **Vite 7 resolver** — должен подхватить TS-источники через workspace symlink. Потенциальный риск: Vite по умолчанию пре-бандлит зависимости из `node_modules`, что для TS-source может потребовать `optimizeDeps.include` или `server.fs.allow`. Researcher должен проверить.
- **`tsc --noEmit`** в `npm run typecheck` — должен корректно резолвить типы из `packages/uni-fw-*/src/`. Workspace symlink + `moduleResolution: "bundler"` в `tsconfig.json` (см. STACK.md) делает это естественным образом.
- **Vitest 4** — runner ловит модули через тот же резолвер, что и Vite, поэтому моки `vi.mock("@uni-fw/...")` продолжают работать.
- **Cross-package peer**: `@uni-fw/ssh-ui` имеет `peerDependencies: "@uni-fw/ui": "*"`. После vendoring это разрешается через тот же workspace — ничего дополнительно настраивать не нужно.
- **`@xterm/*` и markdown peerDeps** — после удаления `.npmrc` npm перестанет автоматически тащить транзитивные peer-deps пакетов; они должны быть явно в корневом `package.json` (или в `dependencies` соответствующего вендорированного пакета).

</code_context>

<specifics>
## Specific Ideas

- **Пользовательский акцент: «если их доработать надо будет»** — выбор `workspace:*` именно с прицелом на live-правки. Любые изменения в `packages/uni-fw-*/src/` подхватываются Vite/tsc через symlink без `npm install`. Bump `version` внутри пакета не ломает резолв. Если потом понадобится править API какого-либо пакета — это plain editing TS-файла, не требует rebuild-цикла.
- **Аналогия с Phase 1 — приоритет** — пользователь подтвердил решения Phase 1 через успешное завершение (см. Decisions log в STATE.md). Принимаем те же принципы (snapshot побайтная, метаданные «как есть», минимум магии в манифестах, lockfile регенерируем) для npm части без переспроса.

</specifics>

<deferred>
## Deferred Ideas

- **MAINT-01 (v2): Автоматический скрипт ресинхронизации с ai-chat** — не в этой фазе. Если когда-то понадобится подтянуть updates из upstream `D:\work-ai\ai-chat`, отдельная задача.
- **MAINT-02 (v2): Стабилизировать тесты внутри `packages/uni-fw-*/src/__tests__/`** — тесты скопированы, но не запускаются. Когда понадобится — отдельная работа, не блокирует milestone.
- **CLEAN-01 (v2): Удалить неиспользуемые компоненты из вендорированных пакетов** — теоретически `@uni-fw/ui` может содержать компоненты, которые `uni-claude-code` не использует (`EmptyState`, `StatusBadge`, `KeyValueEditor`, `ResizablePanel` — подтвердить usage в planner). Не трогаем в этой фазе.
- **CLEAN-02 (v2): Слить пакеты в `src/`** — окончательный отказ от концепции пакета, если решено, что они уже не «библиотеки». Отдельная milestone.
- **BUILD-06 (Phase 3): Обновление `CLAUDE.md`** — упоминание о `@uni-fw/*` и `uni-*` как «внешних» переписать на «вендорированные внутри репо». Запланировано на Phase 3, не делаем здесь.
- **Удаление `tsup` / `tsconfig.build.json` / `prepublishOnly`** — оставлены как «спящие» артефакты на случай возврата к публикации пакетов в реестр. Если будет уверенность, что это никогда не понадобится — отдельная cleanup-задача.

</deferred>

---

*Phase: 2-npm-vendoring*
*Context gathered: 2026-05-16*
