# Requirements: UNI Claude Code — Inline Private Dependencies

**Defined:** 2026-05-16
**Core Value:** Чистый клон без сети полностью собирается — `npm ci` и `cargo build` проходят, тесты `uni-claude-code` зелёные.

## v1 Requirements

Требования текущей milestone «убрать внешние приватные зависимости». Каждое требование маппится ровно на одну фазу роадмапа.

### Rust Vendoring

- [x] **RUST-01**: Крейт `uni-common` вкопирован в `crates/uni-common/` (snapshot из `D:\work-ai\ai-chat`) и добавлен в `[workspace] members` корневого `Cargo.toml`
- [x] **RUST-02**: Крейт `uni-process` вкопирован в `crates/uni-process/` и добавлен в workspace
- [x] **RUST-03**: Крейт `uni-settings` вкопирован в `crates/uni-settings/` и добавлен в workspace
- [x] **RUST-04**: Крейт `uni-db` вкопирован в `crates/uni-db/` и добавлен в workspace
- [x] **RUST-05**: Крейт `uni-ssh` вкопирован в `crates/uni-ssh/` и добавлен в workspace
- [x] **RUST-06**: Крейт `uni-terminal` вкопирован в `crates/uni-terminal/` и добавлен в workspace
- [x] **RUST-07**: Все ссылки `git = "https://github.com/ts-vit/ai-chat", branch = "dev"` в `src-tauri/Cargo.toml` и `crates/claude-code-core/Cargo.toml` заменены на `path = "../<crate>"` / workspace-зависимости
- [x] **RUST-08**: `Cargo.lock` не содержит ссылок на `github.com/ts-vit/ai-chat`
- [x] **RUST-09**: `cargo build --workspace` проходит без сетевого доступа к git-репозиторию ai-chat
- [x] **RUST-10**: `cargo test --workspace` либо проходит, либо неудачи внутри `uni-*` крейтов изолированы (`#[ignore]` с TODO-комментарием) — тесты `src-tauri` и `claude-code-core` зелёные

### npm Vendoring

- [x] **NPM-01**: Пакет `@uni-fw/ui` вкопирован в `packages/uni-fw-ui/` (snapshot из `D:\work-ai\ai-chat`) с собственным `package.json`
- [x] **NPM-02**: Пакет `@uni-fw/ssh-ui` вкопирован в `packages/uni-fw-ssh-ui/`
- [x] **NPM-03**: Пакет `@uni-fw/terminal-ui` вкопирован в `packages/uni-fw-terminal-ui/`
- [x] **NPM-04**: В корневой `package.json` добавлено `"workspaces": ["packages/*"]`
- [x] **NPM-05**: `dependencies` в корневом `package.json` для `@uni-fw/*` либо удалены, либо заменены на `"workspace:*"` (как требует npm workspaces)
- [x] **NPM-06**: Файл `.npmrc` с приватным реестром `npm.ts-vit.com` удалён
- [x] **NPM-07**: Существующие импорты `import { ... } from "@uni-fw/ui"` (и аналогичные) в `src/` продолжают работать без правок
- [x] **NPM-08**: `npm ci` проходит без сетевого доступа к `npm.ts-vit.com`
- [x] **NPM-09**: `npm run typecheck` проходит — типы из вендорированных пакетов резолвятся корректно
- [x] **NPM-10**: `npm run test` зелёный (vitest)

### Build & Documentation

- [ ] **BUILD-01**: `npm run dev` (Tauri dev) запускается из чистого клона без сетевого доступа к приватным сервисам
- [ ] **BUILD-02**: `npm run build` (Tauri prod) проходит из чистого клона без сети
- [ ] **BUILD-03**: `npm run test:all` (typecheck + vitest + cargo test) зелёный
- [x] **BUILD-04**: README обновлён — инструкция «как собрать из чистого клона», без упоминания приватного реестра или git-источника ai-chat
- [ ] **BUILD-05**: Финальная end-to-end проверка: новый каталог, `git clone <local-repo>`, отключённая сеть к ai-chat/npm.ts-vit.com, `npm ci && cargo build --workspace && npm run test:all` — всё зелёное
- [ ] **BUILD-06**: `CLAUDE.md` обновлён — упоминание `@uni-fw/*` и `uni-*` как внешних зависимостей удалено или переписано на «вендорированные внутри репо»

## v2 Requirements

Не планируется в этой milestone, но возможные направления после неё.

### Maintenance

- **MAINT-01**: Автоматический скрипт ресинхронизации с внешним ai-chat (если когда-то понадобится вытаскивать апдейты)
- **MAINT-02**: Юнит-тесты внутри вендорированных пакетов причёсаны и стабильно зелёные

### Cleanup

- **CLEAN-01**: Удалить устаревшие фичи из вендорированных пакетов, которые `uni-claude-code` не использует (уменьшение размера)
- **CLEAN-02**: Перенести вендорированные пакеты в общий `src/` слой, если решено окончательно отказаться от концепции «пакет»

## Out of Scope

| Feature | Reason |
|---------|--------|
| GitHub Actions / любой внешний CI | Текущий проект не имеет CI. Добавление CI — отдельная milestone, не связана с устранением приватных зависимостей. |
| Сохранение `@uni-fw/*` / `uni-*` как публикуемых пакетов | После вендоринга это снапшоты внутри monorepo, не отдельные публикуемые артефакты. |
| git subtree / submodule | Решено snapshot (см. PROJECT.md → Key Decisions). |
| Обратная синхронизация с ai-chat (push изменений из uni-claude-code) | `uni-claude-code` — единственный потребитель; общая разработка фреймворка прекращается. |
| Замена `uni-*` крейтов на open-source аналоги | Не цель milestone — берём существующий код «как есть». |
| Переписывание тестов вендорированных пакетов | См. PROJECT.md → Constraints: тесты копируются «как есть», падающие из-за внешней инфраструктуры помечаются `#[ignore]`. |
| Изменение публичных API `uni-*` или `@uni-fw/*` | Compatibility-constraint: импорты в `src/` и `src-tauri/src/` не должны меняться. |
| Миграция на другой framework, runtime или язык | Tech-stack constraint: Tauri 2 + React 19 + Rust 2021 фиксированы. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RUST-01 | Phase 1 | Done (Plan 01-01) |
| RUST-02 | Phase 1 | Done (Plan 01-01) |
| RUST-03 | Phase 1 | Done (Plan 01-01) |
| RUST-04 | Phase 1 | Done (Plan 01-01) |
| RUST-05 | Phase 1 | Done (Plan 01-01) |
| RUST-06 | Phase 1 | Done (Plan 01-01) |
| RUST-07 | Phase 1 | Done (Plan 01-02) |
| RUST-08 | Phase 1 | Done (Plan 01-03) |
| RUST-09 | Phase 1 | Done (Plan 01-03) |
| RUST-10 | Phase 1 | Done (Plan 01-03) |
| NPM-01 | Phase 2 | Complete |
| NPM-02 | Phase 2 | Complete |
| NPM-03 | Phase 2 | Complete |
| NPM-04 | Phase 2 | Complete |
| NPM-05 | Phase 2 | Complete |
| NPM-06 | Phase 2 | Complete |
| NPM-07 | Phase 2 | Complete |
| NPM-08 | Phase 2 | Complete |
| NPM-09 | Phase 2 | Complete |
| NPM-10 | Phase 2 | Complete |
| BUILD-01 | Phase 3 | Pending |
| BUILD-02 | Phase 3 | Pending |
| BUILD-03 | Phase 3 | Pending |
| BUILD-04 | Phase 3 | Complete (03-01) |
| BUILD-05 | Phase 3 | Pending |
| BUILD-06 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26 (Phase 1: 10 RUST-*, Phase 2: 10 NPM-*, Phase 3: 6 BUILD-*)
- Unmapped: 0

---
*Requirements defined: 2026-05-16*
*Last updated: 2026-05-16 после Plan 01-03 (RUST-08/09/10 закрыты — Phase 1 завершена)*
