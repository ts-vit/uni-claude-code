# Roadmap: UNI Claude Code — Вендоринг приватных зависимостей

## Overview

Рефакторинг milestone: убрать зависимость репозитория от приватного npm-реестра `npm.ts-vit.com` и приватной git-ветки `github.com/ts-vit/ai-chat#dev`. Все 6 Rust-крейтов и 3 npm-пакета переносятся внутрь репозитория snapshot-копией. Поведение приложения не меняется — меняется только источник кода зависимостей. Три последовательных фазы: сначала Rust workspace, затем npm workspaces, затем финальная зачистка скриптов и документации с end-to-end проверкой сборки из чистого клона без сети.

## Phases

**Phase Numbering:**
- Целочисленные фазы (1, 2, 3) — плановая работа milestone
- Десятичные (2.1, 2.2) зарезервированы под срочные вставки между фазами

- [x] **Phase 1: Rust Vendoring** — Внести 6 крейтов `uni-*` в `crates/` как path-зависимости workspace, убрать git-источник `ai-chat` (завершено 2026-05-16)
- [ ] **Phase 2: npm Vendoring** — Внести 3 пакета `@uni-fw/*` в `packages/uni-fw-*` через npm workspaces, удалить `.npmrc`
- [ ] **Phase 3: Build & Docs** — Финальные правки скриптов, README и CLAUDE.md плюс end-to-end проверка сборки из чистого клона без сети

## Phase Details

### Phase 1: Rust Vendoring
**Goal**: Все Rust-зависимости от приватного git-репо `ai-chat` устранены — 6 крейтов `uni-*` живут внутри `crates/` как члены workspace и подключены через path-зависимости
**Depends on**: Nothing (first phase)
**Requirements**: RUST-01, RUST-02, RUST-03, RUST-04, RUST-05, RUST-06, RUST-07, RUST-08, RUST-09, RUST-10
**Success Criteria** (what must be TRUE):
  1. В `crates/` существуют 6 каталогов (`uni-common`, `uni-process`, `uni-settings`, `uni-db`, `uni-ssh`, `uni-terminal`) со скопированным snapshot-исходником из `D:\work-ai\ai-chat`, и все они перечислены в `[workspace] members` корневого `Cargo.toml`
  2. В `src-tauri/Cargo.toml` и `crates/claude-code-core/Cargo.toml` нет ни одной строки с `git = "https://github.com/ts-vit/ai-chat"` — каждая `uni-*` зависимость задана как `path` или workspace-ссылка
  3. `Cargo.lock` не содержит подстроки `github.com/ts-vit/ai-chat` ни в одной секции `[[package]] source`
  4. `cargo build --workspace` проходит из репозитория с заблокированным сетевым доступом к `github.com/ts-vit/ai-chat`
  5. `cargo test --workspace` зелёный для `src-tauri` и `claude-code-core`; нестабильные тесты внутри вендорированных `uni-*` крейтов помечены `#[ignore]` с TODO-комментарием и не блокируют сборку
**Plans**: 3 plans
  - [x] 01-01-vendor-uni-crates-PLAN.md — Вкопировать 6 крейтов uni-* в crates/ и зарегистрировать в workspace.members (выполнено 2026-05-16, см. 01-01-SUMMARY.md)
  - [x] 01-02-rewrite-cargo-manifests-PLAN.md — Заменить 7 git-зависимостей на path в src-tauri/Cargo.toml и crates/claude-code-core/Cargo.toml (выполнено 2026-05-16, см. 01-02-SUMMARY.md)
  - [x] 01-03-regenerate-lock-and-verify-PLAN.md — Регенерировать Cargo.lock, пройти cargo build/test --workspace, при необходимости #[ignore] нестабильные тесты (выполнено 2026-05-16, см. 01-03-SUMMARY.md)

### Phase 2: npm Vendoring
**Goal**: Все frontend-зависимости от приватного npm-реестра устранены — 3 пакета `@uni-fw/*` живут внутри `packages/uni-fw-*` как npm workspaces, `.npmrc` удалён, импорты в `src/` работают без правок
**Depends on**: Phase 1
**Requirements**: NPM-01, NPM-02, NPM-03, NPM-04, NPM-05, NPM-06, NPM-07, NPM-08, NPM-09, NPM-10
**Success Criteria** (what must be TRUE):
  1. В `packages/` существуют каталоги `uni-fw-ui`, `uni-fw-ssh-ui`, `uni-fw-terminal-ui` со snapshot-копией исходников и собственным `package.json` каждого пакета; корневой `package.json` объявляет `"workspaces": ["packages/*"]`, а старые `@uni-fw/*` записи в `dependencies` либо удалены, либо заменены на `"workspace:*"`
  2. Файл `.npmrc` с приватным реестром `npm.ts-vit.com` удалён из репозитория
  3. `npm ci` проходит из чистого клона при заблокированном сетевом доступе к `npm.ts-vit.com` и линкует `@uni-fw/*` через workspace-symlink-и
  4. Существующие импорты `@uni-fw/ui`, `@uni-fw/ssh-ui`, `@uni-fw/terminal-ui` в `src/` продолжают работать без правок исходников
  5. `npm run typecheck` и `npm run test` зелёные — типы вендорированных пакетов резолвятся, vitest-набор не сломан
**Plans**: TBD
**UI hint**: yes

### Phase 3: Build & Docs
**Goal**: Финальная зачистка milestone — npm-скрипты, README и CLAUDE.md приведены в соответствие с вендорированной структурой, и end-to-end проверка подтверждает: чистый клон без приватной сети полностью собирается и проходит все тесты
**Depends on**: Phase 2
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05, BUILD-06
**Success Criteria** (what must be TRUE):
  1. `npm run dev` (Tauri dev) и `npm run build` (Tauri prod) запускаются из чистого клона без сетевого доступа к `npm.ts-vit.com` и `github.com/ts-vit/ai-chat`
  2. `npm run test:all` (typecheck + vitest + cargo test) зелёный из чистого клона без приватной сети
  3. README репозитория содержит инструкцию по сборке из чистого клона и не упоминает приватный реестр или git-источник `ai-chat`; `CLAUDE.md` обновлён — `@uni-fw/*` и `uni-*` описаны как вендорированные внутри репо, а не внешние
  4. End-to-end проверка пройдена: в новом каталоге выполнено `git clone <local-repo>`, сеть к `npm.ts-vit.com` и `github.com/ts-vit/ai-chat` заблокирована, и последовательность `npm ci && cargo build --workspace && npm run test:all` отрабатывает без ошибок
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Rust Vendoring | 3/3 | Complete | 2026-05-16 |
| 2. npm Vendoring | 0/TBD | Not started | - |
| 3. Build & Docs | 0/TBD | Not started | - |
