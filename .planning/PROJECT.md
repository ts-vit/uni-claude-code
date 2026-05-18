# UNI Claude Code

## What This Is

Десктоп-приложение на Tauri 2 (React 19 + TypeScript + Rust) — IDE-ассистент на базе Claude Code CLI с многосессионным чатом, встроенным терминалом, SSH-туннелированием, управлением MCP-серверами и пайплайном задач. Используется автором как личный инструмент разработки.

После milestones v1.0 (Vendoring) и v1.1 (Chat UX): репозиторий собирается из чистого клона без приватной сети; переписка чата переживает навигацию между view и проектами; в StatusBar постоянно видны модель, session_id и накопленные токены; есть UI-кнопка Clear.

## Core Value

Чистый клон репозитория без доступа к сети полностью собирается: `npm ci` и `cargo build` проходят, тесты `uni-claude-code` зелёные.

## Current State

**Shipped:** v1.1 Chat UX (2026-05-18)
**Next:** Планируется (`/gsd-new-milestone`)

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
- ✓ **6 крейтов `uni-*` вендорированы в `crates/`** как path-зависимости workspace; git-источник `github.com/ts-vit/ai-chat` удалён из `Cargo.toml`/`Cargo.lock`; `cargo build --workspace` проходит без сети — Validated in Phase 1: Rust Vendoring
- ✓ **3 npm-пакета `@uni-fw/*` вендорированы в `packages/`** как npm workspaces со ссылкой `workspace:*`; `.npmrc` с приватным реестром `https://npm.ts-vit.com` удалён; `npm ci` проходит без сети — Validated in Phase 2: npm Vendoring
- ✓ **README.md и CLAUDE.md приведены в соответствие с вендорированной структурой** — top-level README на русском (quickstart-only); `.planning/codebase/*` зачищены от упоминаний приватного реестра и git-источника `ai-chat`; секция «Supply Chain Risk» удалена из `CONCERNS.md` — Validated in Phase 3: Build & Docs
- ✓ **End-to-end проверка чистого клона** — в свежем temp-каталоге `git clone --no-local` + 5 grep-инвариантов (0 hits) + `npm ci` + `cargo build --workspace` + `npm run test:all` + `npm run build` отрабатывают exit 0 без приватной сети — Validated in Phase 3: Build & Docs
- ✓ **PERSIST-01: view-switch не теряет переписку** — `DualPanelLayout` для каждого `openedProject` всегда смонтирован; видимость через CSS `display: flex/none`; `ChatPanel.messages`/refs/стриминг-буферы физически переживают переключение main ↔ settings/files/diff/history/claude-md/pipeline — Validated in Phase 4: Chat Persistence
- ✓ **PERSIST-02: project-switch не теряет переписку** — `openedProjects.map` без фильтра в `App.tsx`; до 3 параллельных `DualPanelLayout` одновременно в DOM; переписка каждого проекта сохраняется при переключении A → B → C → A в пределах `ui.maxOpenProjects` — Validated in Phase 4: Chat Persistence
- ✓ **VIS-01: имя модели постоянно в StatusBar** — `<Text>{t("chat.model")}: {model ?? "—"}</Text>` в `StatusBar.tsx`; state `sessionModel` обновляется в `case "system"` через ref-based comparison; прокидывается через `model={sessionModel ?? projectModel ?? null}` — Validated in Phase 5: Chat Visibility & Controls
- ✓ **VIS-02: session_id с CopyButton в StatusBar** — 8-символьный prefix + Mantine `CopyButton` render-prop с `IconCopy/IconCheck`-toggle; functional updater для `sessionId` state — Validated in Phase 5: Chat Visibility & Controls
- ✓ **VIS-03: накопленные токены в StatusBar с Tooltip-breakdown** — accumulator `setAccumulatedUsage` в `case "assistant"` (functional updater); `Tooltip` с 4-строчным breakdown (input/output/cache_creation/cache_read); reset при смене `session_id` — Validated in Phase 5: Chat Visibility & Controls
- ✓ **UI-01: кнопка Clear в шапке ChatPanel** — `ActionIcon` с `IconEraser`, `ml="auto"`, `disabled={isRunning}`; единый `handleClear` атомарно сбрасывает 8 полей состояния; эквивалент текстовой команды `/clear` — Validated in Phase 5: Chat Visibility & Controls

### Active

<!-- Milestone v1.1 завершена и архивирована. Следующая milestone планируется через /gsd-new-milestone. -->

_Активных требований нет — milestone v1.1 «Chat UX» shipped 2026-05-18. Следующая milestone будет создана через `/gsd-new-milestone`; до этого `.planning/REQUIREMENTS.md` отсутствует (удалён при архивации; история сохранена в `.planning/milestones/v1.1-REQUIREMENTS.md`)._

### Out of Scope

<!-- Явные исключения. Без причины не реинтродьюсить. -->

**Из v1.0 (Vendoring) — постоянные исключения:**

- **Публикация пакетов uni-* и @uni-fw/* как отдельных артефактов** — после вендоринга это копии-снапшоты внутри monorepo. Если в будущем потребуется выносить как библиотеку — отдельная milestone.
- **Обратная синхронизация с приватным `ai-chat` репозиторием** — uni-claude-code остаётся единственным потребителем uni-*; общая разработка фреймворка прекращена. Если фреймворк понадобится в другом проекте — отдельная milestone.
- **Сохранение git-истории вендорированных пакетов** — взят snapshot; общая история ai-chat не нужна.
- **Установка внешнего CI (GitHub Actions / GitLab)** — кодовая база остаётся без CI; контроль качества через локальные `npm run test:all`. Введение CI = отдельная milestone.
- **Замена зависимостей на open-source аналоги** — берём существующий код «как есть».

**Из v1.1 (Chat UX) — отложено до отдельной milestone:**

- **DB-персистентность переписки между запусками приложения** — текущая реализация делает только in-memory сохранение при навигации. Запись сообщений в SQLite, восстановление при старте, миграции схемы — отдельная будущая milestone (кандидат: v1.2). Существующий `history_save` (explicit «сохранить эту переписку») не расширяется до auto-persist.
- **Интеграция с `--continue` Claude CLI** — флаг `continueSession` в `claude_start` управляется через `hasSessionRef`. Подгрузка ранее завершённой сессии Claude из CLI-кэша при открытии проекта — отдельная фича.
- **Осмысленные лейблы табов** — вместо «Session 1/2/3» показывать модель или первый промпт. Кандидат на UI-полировку.
- **Подтверждение закрытия running-таба** — `handleCloseTab` сейчас моментально убивает runner без ConfirmModal. Кандидат на UI-полировку.
- **Кликабельный mode-badge в шапке ChatPanel** — переключение architect/developer прямо из бейджа вместо выпадающего меню таба. Кандидат на UI-полировку.
- **Точный context-window % с per-model лимитами** — token usage показываем абсолютным числом (input/output/cache). Расчёт «% от лимита модели» требует справочника лимитов для каждой модели Claude и обновления при их смене.
- **WR-02: terminal refit на view-switch** — после keep-mounted рендера `triggerTerminalRefit()` не вызывается при `display:none → display:flex`. Решение пользователя на момент закрытия v1.1: «старый баг пока править не будем». Трекается в `.planning/todos/pending/wr-02-terminal-refit-view-switch.md`; может быть подобран в любой будущей milestone.

## Context

**Состояние после v1.1:**

- **Vendoring (v1.0):** 6 крейтов `uni-*` в `crates/` как path-зависимости workspace; 3 npm-пакета `@uni-fw/*` в `packages/uni-fw-*` через npm workspaces со ссылкой `workspace:*`; `.npmrc` удалён. Чистый клон собирается без приватной сети — `npm ci` + `cargo build --workspace` + `npm run test:all` + `npm run build` отрабатывают exit 0.
- **Chat UX (v1.1):** Переписка чата keep-mounted при любой навигации; StatusBar показывает Model / Session (с CopyButton) / Σ Tokens (с Tooltip-breakdown); UI-кнопка Clear в шапке ChatPanel.

**Tech stack:** Tauri 2 (Rust 2021 + Tokio + SQLx) + React 19 (TypeScript 5.8 strict) + Mantine 8 + Vite 7 + Vitest 4. Frontend ~10 файлов компонентов чата (`src/components/chat/`); backend ~40 IPC-команд в `src-tauri/src/commands/`. 119/119 vitest passing.

**Codebase карта:**
- `.planning/codebase/` — `ARCHITECTURE.md`, `STACK.md`, `INTEGRATIONS.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `CONCERNS.md` (актуальные после v1.0).
- `Cargo.toml` workspace: `src-tauri` + `crates/claude-code-core` + 6 `crates/uni-*`.
- `package.json` workspaces: `packages/*` (3 `@uni-fw/*` пакета).

**Known technical debt:**
- `WR-02: terminal refit на view-switch` — `triggerTerminalRefit()` не вызывается при `display:none → display:flex` после keep-mounted рендера; xterm/FitAddon может показывать обрезанные строки. Трекается в `.planning/todos/pending/wr-02-terminal-refit-view-switch.md`.
- `pipeline_tasks` — пайплайн задач реализован, но реального использования в текущей сессии минимально; качество UI не валидировано в milestone.

## Constraints

- **Tech stack**: Tauri 2 + React 19 + Rust 2021 + Mantine 8 — стек заморожен. Любая будущая milestone работает внутри этих рамок; миграция фреймворков — отдельное стратегическое решение.
- **Build determinism**: сборка из чистого клона без приватной сети остаётся инвариантом (валидировано в v1.0). Сетевой доступ к публичным реестрам `npm` и `crates.io` допустим; приватные реестры и git-источники запрещены.
- **Vendored compatibility**: публичные API вендорированных пакетов (`uni-*` крейты, `@uni-fw/*` npm) не модифицируются. Если функциональность нужна — обсуждается отдельная milestone «un-vendoring» или внутренняя обёртка.
- **Тесты**: Definition of Done гарантирует зелёный `npm run test:all` (vitest + cargo test workspace). Тесты внутри вендорированных пакетов могут быть `#[ignore]`/`it.skip` (унаследовано из v1.0); fixing внутренних тестов вендора — вне scope любой будущей milestone, если только не выводится отдельная цель.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **v1.0** Snapshot, не git subtree | uni-claude-code — единственный потребитель; общая история ai-chat не нужна. Subtree раздул бы репозиторий и усложнил структуру | ✓ Good — v1.0 shipped, history clean, обратная синхронизация исключена |
| **v1.0** Источник: локальный клон `D:\work-ai\ai-chat` | У автора уже есть рабочий клон; не требует сетевого доступа во время вендоринга | ✓ Good — фазы 1-3 прошли без приватной сети |
| **v1.0** Rust: path-зависимости в существующем workspace | `crates/claude-code-core` уже path-зависимость; такая же схема для `crates/uni-*` — минимум изменений и минимум магии | ✓ Good — `cargo build --workspace` зелёный |
| **v1.0** npm: workspaces в `packages/uni-fw-*` со ссылкой `workspace:*` | Каждый пакет в своём каталоге со своим `package.json` — импорты `@uni-fw/*` не меняются, npm ставит локальные symlink | ✓ Good — `npm ci` зелёный без `.npmrc` |
| **v1.0** Удалить `.npmrc` полностью | После вендоринга приватный реестр не нужен; оставлять его — оставлять реальную SPOF | ✓ Good — реестр недоступен, сборка не страдает |
| **v1.0** Внешние тесты переносим «как есть» | Снапшот — это снапшот; переписывать чужие тесты под наш CI — отдельная работа | ✓ Good — 97 cargo-тестов passed, 1 ignored задокументированный |
| **v1.0** CI не добавляется как новый сервис | Текущий проект не имеет `.github/`; качество через локальные `npm run test:all` | ✓ Good — никаких внешних зависимостей; принято как постоянная политика |
| **v1.1** Keep-mounted рендер вместо conditional unmount | `display: none/flex` на sibling-блоках — единственный способ физически сохранить React tree чата при навигации; DB-persistence отложена | ✓ Good — PERSIST-01/02 validated, переписка не теряется |
| **v1.1** До 3 `DualPanelLayout` одновременно в DOM | Граница `ui.maxOpenProjects = 3` достаточна для рабочих сценариев; больше — рост памяти и риск перфоманса при многих xterm-инстансах | ✓ Good — UAT 8-12 одобрен; 3 проекта в DOM одновременно — приемлемо |
| **v1.1** Token usage как абсолютное число (не % от лимита) | Расчёт «% от контекста» требует справочника per-model лимитов и поддержания его актуальности | ✓ Good — отложено в VIS-CTX-01; absolute breakdown пользователю достаточно |
| **v1.1** Ref-based comparison для reset accumulator (CR-01 fix) | Impure `setState` в `case "system"` нарушал чистоту event-handler'а; ref-сравнение даёт ту же семантику без side-effects в render-path | ✓ Good — CR-01 закрыт коммитом `ce93e73`; unit-тест `resets accumulator when session_id changes via system event` passing |
| **v1.1** WR-02 (terminal refit) accepted as deferred | Phase 4 закрылась с открытой регрессией; пользователь явно выбрал отложить как «старый баг» | ⚠️ Revisit — трекается в `todos/pending/`; должен быть подобран в одной из будущих UI-милестоунов |

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
*Last updated: 2026-05-18 after v1.1 Chat UX milestone — все 6 требований Validated (PERSIST-01/02, VIS-01/02/03, UI-01); v1.0+v1.1 решения переведены в ✓ Good outcomes; v1.1-specific out-of-scope items организованы в подразделы; Context отражает текущее состояние кода после двух milestones.*
