# UNI Claude Code

## What This Is

Десктоп-приложение на Tauri 2 (React 19 + TypeScript + Rust) — IDE-ассистент на базе Claude Code CLI с многосессионным чатом, встроенным терминалом, SSH-туннелированием, управлением MCP-серверами и пайплайном задач. Используется автором как личный инструмент разработки.

Текущая milestone-цель — убрать зависимости от приватного npm-реестра и приватной ветки git-репозитория, чтобы репозиторий собирался из чистого клона без доступа к сети.

## Core Value

Чистый клон репозитория без доступа к сети полностью собирается: `npm ci` и `cargo build` проходят, тесты `uni-claude-code` зелёные.

## Requirements

### Validated

<!-- Зашипилось и работает в текущей версии. Унаследовано из brownfield-карты .planning/codebase/. -->

- ✓ **Чат с Claude Code CLI** — `crates/claude-code-core` запускает `claude` CLI как subprocess, парсит stream-JSON, до 5 параллельных сессий — existing
- ✓ **Хранилище проектов** — SQLite через `sqlx`, 4 миграции (projects, saved_messages, pipeline_tasks) — existing
- ✓ **SSH-туннелирование** — `SshTunnelManager` с port-forward и auto-connect, прокси в Claude CLI и PTY — existing
- ✓ **Встроенный терминал** — PTY-сессии через `TerminalManager`, события `pty-data`/`pty-exit` — existing
- ✓ **Управление MCP-серверами** — `mcp_list`/`mcp_add`/`mcp_remove` через `claude mcp list` — existing
- ✓ **Пайплайн задач** — `pipeline_tasks` с состояниями draft → prompt_ready → queued → executing → done/failed — existing
- ✓ **Файловые операции** — read/write/diff, git_branch_info, git_changed_files — existing
- ✓ **Интернационализация** — EN + RU локали через react-i18next — existing
- ✓ **Настройки** — JSON-хранилище через `uni-settings::JsonSettingsStore`, dev-AppData разделён от prod через TAURI_CONFIG — existing

### Active

<!-- Текущая milestone: убрать внешние приватные зависимости. -->

**Rust (фаза 1):**
- [ ] Внести 6 крейтов из `ai-chat/dev` (`uni-common`, `uni-settings`, `uni-ssh`, `uni-terminal`, `uni-db`, `uni-process`) в `crates/` как path-зависимости workspace
- [ ] Убрать git-источник `https://github.com/ts-vit/ai-chat` из `Cargo.toml` и `Cargo.lock`
- [ ] `cargo build --workspace` проходит без сети

**npm (фаза 2):**
- [ ] Внести 3 пакета (`@uni-fw/ssh-ui`, `@uni-fw/terminal-ui`, `@uni-fw/ui`) в `packages/uni-fw-*/` как npm workspaces
- [ ] Убрать `.npmrc` и приватный реестр `https://npm.ts-vit.com`
- [ ] Импорты `@uni-fw/*` в `src/` продолжают работать без правок
- [ ] `npm ci` проходит без сети

**CI/документация (фаза 3):**
- [ ] Обновить `package.json` scripts (workspace-aware команды, если нужно)
- [ ] Обновить README — инструкции по сборке из чистого клона
- [ ] Финальная проверка: чистый клон в новом каталоге, без сети — `npm ci` + `cargo build` + `npm run test:all` зелёные

### Out of Scope

<!-- Явные исключения. Без причины не реинтродьюсить. -->

- **Сохранение пакетов uni-* и @uni-fw/* как публикуемых** — после вендоринга это копии-снапшоты внутри monorepo, не отдельные публикуемые артефакты. Если в будущем понадобится снова вынести как библиотеку — это новая milestone, а не часть этой.
- **Поддержка обратной синхронизации с ai-chat** — uni-claude-code остаётся единственным потребителем uni-*; общая разработка фреймворка прекращается на этом этапе. Если фреймворк понадобится в другом проекте — это новая milestone.
- **Сохранение истории git вендорированных пакетов** — берём snapshot, общая история ai-chat не нужна (см. Key Decisions).
- **Установка CI на GitHub Actions / любой внешний CI** — в текущей кодовой базе CI отсутствует и в эту milestone не добавляется. «CI» в фазе 3 = локальные npm-скрипты и инструкции в README.
- **Замена зависимостей на open-source аналоги** — не цель этой milestone. Берём существующий код «как есть», просто переносим внутрь репо.

## Context

**Тип milestone:** конкретный рефакторинг, не новая фича. Поведение приложения не должно измениться — только источник кода зависимостей.

**Проблема, которая запускает milestone:**
- Сборка зависит от приватного npm-реестра `npm.ts-vit.com` (`.npmrc` с `@uni-fw:registry=...`).
- Сборка зависит от Rust-крейтов с мутабельной ветки `dev` приватного git-репо `https://github.com/ts-vit/ai-chat`.
- И то, и другое — единые точки отказа: реестр упал → `npm ci` ломается; ветку `dev` сдвинули → `cargo build` ломается с неожиданными изменениями API.

**Почему вендоринг безопасен:**
- Пакеты `@uni-fw/*` и `uni-*` — собственный экспериментальный код фреймворка автора.
- `uni-claude-code` — его единственный реальный потребитель.
- При инлайне нет риска форкнуть общий код, поскольку «общего» по сути нет.

**Объём:**
- 3 npm-пакета: `@uni-fw/ssh-ui ^0.1.2`, `@uni-fw/terminal-ui ^0.1.5`, `@uni-fw/ui ^0.1.0`
- 6 Rust-крейтов: `uni-common`, `uni-settings`, `uni-ssh`, `uni-terminal`, `uni-db`, `uni-process` (последний — транзитивная зависимость `claude-code-core`)

**Brownfield-состояние:**
- `.planning/codebase/` уже создан (`ARCHITECTURE.md`, `STACK.md`, `INTEGRATIONS.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `CONCERNS.md`) — рассматривать как актуальную карту.
- Workspace `Cargo.toml` сейчас содержит двух членов: `src-tauri` и `crates/claude-code-core`. После фазы 1 в `members` добавятся 6 новых крейтов.
- `package.json` сейчас не использует workspaces. После фазы 2 на корневом уровне появится `"workspaces": ["packages/*"]`.

## Constraints

- **Tech stack**: Tauri 2 + React 19 + Rust 2021 — менять не разрешено. Цель — перенести зависимости, а не переписать стек.
- **Compatibility**: публичные API вендорированных пакетов не должны измениться (импорты в `src-tauri/src/` и `src/` остаются такими же).
- **Build determinism**: после фазы 3 сборка должна работать из чистого клона без `.npmrc`, без `cargo` git-credentials, без сетевого доступа к `npm.ts-vit.com` или `github.com/ts-vit/ai-chat`. Сетевой доступ к публичным реестрам npm/crates.io остаётся допустимым.
- **Источник кода**: `D:\work-ai\ai-chat` (локальный клон ветки `dev`). Никакого `git clone` приватного репо во время исполнения фаз — берём из этого пути.
- **Тесты**: Definition of Done гарантирует только зелёный набор тестов самого `uni-claude-code`. Тесты внутри вендорированных пакетов копируются «как есть»; если они зависят от инфраструктуры ai-chat и падают по unrelated причинам — помечаются `#[ignore]` (Rust) или `it.skip` (Vitest) с комментарием TODO, чтобы не блокировать сборку.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Snapshot, не git subtree | uni-claude-code — единственный потребитель; общая история ai-chat не нужна. Subtree раздул бы репозиторий и усложнил структуру | — Pending |
| Источник: локальный клон `D:\work-ai\ai-chat` | У автора уже есть рабочий клон; не требует сетевого доступа во время вендоринга | — Pending |
| Rust: path-зависимости в существующем workspace | `crates/claude-code-core` уже path-зависимость; такая же схема для `crates/uni-*` — минимум изменений и минимум магии | — Pending |
| npm: workspaces в `packages/uni-fw-*` | Каждый пакет в своём каталоге со своим `package.json` — импорты `@uni-fw/*` не меняются, npm ставит их как локальные symlink через workspaces | — Pending |
| Структура каталогов: `packages/uni-fw-ui`, `packages/uni-fw-ssh-ui`, `packages/uni-fw-terminal-ui` | Зеркалит структуру `crates/uni-*` — каждому пакету свой явный каталог, никаких вложенных scope-каталогов | — Pending |
| Удалить `.npmrc` полностью | После вендоринга приватный реестр не нужен; оставлять его — оставлять реальную SPOF | — Pending |
| Внешние тесты переносим «как есть» | Снапшот — это снапшот; переписывать чужие тесты под наш CI — отдельная работа вне scope этой milestone | — Pending |
| CI как новый сервис не добавляется | Текущий проект не имеет CI (`.github/` отсутствует); фаза 3 — это `package.json` scripts + README | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-16 after initialization*
