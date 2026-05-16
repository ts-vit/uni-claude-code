---
phase: 01-rust-vendoring
plan: 02
subsystem: infra
tags: [rust, cargo, workspace, vendoring, path-deps]

# Dependency graph
requires:
  - phase: 01-rust-vendoring
    provides: 6 крейтов uni-* в crates/ и зарегистрированы в workspace.members (Plan 01-01)
provides:
  - src-tauri/Cargo.toml без git=ai-chat зависимостей — 5 uni-* теперь резолвятся через path = "../crates/uni-<name>"
  - crates/claude-code-core/Cargo.toml без git=ai-chat зависимостей — uni-common, uni-process резолвятся через path = "../uni-<name>"
  - Workspace полностью разрешим через cargo metadata --no-deps без сетевого доступа к github.com/ts-vit/ai-chat
affects: [01-03-regenerate-lock-and-verify]

# Tech tracking
tech-stack:
  added: []
  patterns: [cargo path-dependencies, workspace-local resolution, byte-identical replacement без структурных изменений TOML]

key-files:
  created: []
  modified:
    - src-tauri/Cargo.toml
    - crates/claude-code-core/Cargo.toml

key-decisions:
  - "Path-стиль (плоский) сохранён — НЕ переходим на [workspace.dependencies] + .workspace=true; это соответствует стилю существующей claude-code-core path-зависимости и минимизирует diff"
  - "Документационные поля repository=/homepage=ai-chat в манифестах вендорированных uni-* крейтов оставлены без правок — это metadata, а не источник зависимости (решение унаследовано из Plan 01-01)"
  - "Cargo.lock НЕ регенерировался в этом плане — это scope Plan 01-03; lock сейчас всё ещё ссылается на git-source, что ожидаемо до cargo update/build"

patterns-established:
  - "Замена `git = \"...ai-chat\", branch = \"dev\"` на `path = \"<relative>\"` через прямой Edit (без перестройки TOML структуры)"
  - "Verification gate: cargo metadata --no-deps --format-version 1 + grep на отсутствие 'github.com/ts-vit/ai-chat' в *.toml"

requirements-completed: [RUST-07]

# Metrics
duration: 1min
completed: 2026-05-16
---

# Phase 01 Plan 02: Rewrite Cargo Manifests Summary

**7 git-зависимостей `github.com/ts-vit/ai-chat#dev` в `src-tauri/Cargo.toml` (5 ссылок) и `crates/claude-code-core/Cargo.toml` (2 ссылки) заменены на локальные `path = "../<...>"`; workspace полностью разрешим без сетевого доступа к приватному git-репо.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-16T13:30:03Z
- **Completed:** 2026-05-16T13:31:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- В `src-tauri/Cargo.toml` все 5 `uni-*` зависимостей (`uni-common`, `uni-settings`, `uni-ssh`, `uni-terminal`, `uni-db`) теперь резолвятся через `path = "../crates/uni-<name>"`
- В `crates/claude-code-core/Cargo.toml` обе `uni-*` зависимости (`uni-common`, `uni-process`) теперь резолвятся через `path = "../uni-<name>"`
- `cargo metadata --no-deps --format-version 1` для всего workspace завершается с exit code 0
- Поиск `git = "https://github.com/ts-vit/ai-chat"` по всем `**/Cargo.toml` репозитория возвращает **ноль** совпадений
- Все остальные строки манифестов (секции `[package]`, `[lib]`, `[build-dependencies]`, прочие `[dependencies]`, `claude-code-core = { path = "../crates/claude-code-core" }`) сохранены без изменений
- Покрыто требование RUST-07

## Task Commits

Каждая задача закоммичена атомарно:

1. **Task 1: Replace 5 git=ai-chat deps with path in src-tauri/Cargo.toml** — `e89cf52` (refactor)
2. **Task 2: Replace 2 git=ai-chat deps with path in crates/claude-code-core/Cargo.toml** — `23886e3` (refactor)

_Note: `Cargo.lock` всё ещё содержит ссылки на `github.com/ts-vit/ai-chat` — это ожидаемо до Plan 01-03, который регенерирует lock через `cargo update`/`cargo build`._

## Files Created/Modified

**Modified:**

- `src-tauri/Cargo.toml` — 5 строк изменены: `uni-common`, `uni-settings`, `uni-ssh`, `uni-terminal`, `uni-db` переведены на path
- `crates/claude-code-core/Cargo.toml` — 2 строки изменены: `uni-common`, `uni-process` переведены на path

## Decisions Made

- **Плоский path-стиль сохранён** — план явно запрещал переход на `[workspace.dependencies]` + `.workspace = true`. Это разумно: соответствует существующей строке `claude-code-core = { path = "../crates/claude-code-core" }` в src-tauri/Cargo.toml, минимизирует diff и не затрагивает структуру TOML. Если в будущем понадобится централизовать версии — это отдельная задача после стабилизации workspace.
- **Документационные поля `repository = "...ai-chat"` и `homepage = "...ai-chat"` в манифестах `crates/uni-*` НЕ правим** — решение унаследовано из Plan 01-01 (snapshot-копия побайтная). Это metadata для rustdoc/crates.io, не источник зависимости. `grep "github.com/ts-vit/ai-chat" **/Cargo.toml` находит их, но это документация, не SPOF — корректность сборки от них не зависит.
- **Cargo.lock не регенерировался** — план явно указывает, что это scope Plan 01-03. Сейчас `Cargo.lock` ещё содержит `source = "git+https://github.com/ts-vit/ai-chat?branch=dev"` записи, и это ожидаемое промежуточное состояние. `cargo metadata --no-deps` это не ломает (не требует resolved версий с git-source), а полный `cargo build` пойдёт после регенерации lock.

## Deviations from Plan

None — plan executed exactly as written.

Все acceptance criteria обеих задач выполнены без отклонений. Никаких Rule 1/2/3 auto-fix-ов не потребовалось.

## Issues Encountered

- **PowerShell-инвокация из Bash tool** — первая попытка запустить `powershell -NoProfile -Command "..."` через Bash tool была интерпретирована Git Bash, и `$gitCount`/`$pathCount` PowerShell-переменные сломали парсинг. Workaround: использовал Grep tool с `output_mode: count` для подсчёта совпадений и плоский bash `>/dev/null 2>&1; echo $?` для cargo metadata. Результаты идентичны тем, что требовали acceptance criteria.

## User Setup Required

None — никаких внешних сервисов и конфигурации не требуется.

## Next Phase Readiness

**Ready for Plan 01-03 (`regenerate-lock-and-verify`):**

- Все 7 манифестных ссылок на git=ai-chat устранены — `cargo update` теперь должен перезаписать `Cargo.lock` так, чтобы `source = "git+..."` записи исчезли в пользу path-зависимостей
- Workspace разрешим через `cargo metadata --no-deps` (exit 0) — структурные ошибки в TOML исключены
- Plan 01-03 может безопасно запускать `cargo update`, `cargo build --workspace`, `cargo test --workspace` для финальной валидации

**Blockers/concerns:** None.

## Self-Check: PASSED

**Files verified to exist on disk:**

- FOUND: `src-tauri/Cargo.toml` (modified — 5 path deps)
- FOUND: `crates/claude-code-core/Cargo.toml` (modified — 2 path deps)

**Commits verified to exist:**

- FOUND: `e89cf52` — refactor(01-02): replace 5 git=ai-chat deps with path in src-tauri/Cargo.toml
- FOUND: `23886e3` — refactor(01-02): replace 2 git=ai-chat deps with path in claude-code-core

**Verification commands run:**

- `grep "github.com/ts-vit/ai-chat" src-tauri/Cargo.toml` → 0 matches
- `grep "path = \"../crates/uni-" src-tauri/Cargo.toml` → 5 matches
- `grep "github.com/ts-vit/ai-chat" crates/claude-code-core/Cargo.toml` → 0 matches
- `grep "path = \"../uni-" crates/claude-code-core/Cargo.toml` → 2 matches
- `cargo metadata --no-deps --format-version 1 --manifest-path src-tauri/Cargo.toml` → exit 0
- `cargo metadata --no-deps --format-version 1 --manifest-path crates/claude-code-core/Cargo.toml` → exit 0
- `cargo metadata --no-deps --format-version 1` (whole workspace) → exit 0
- `grep 'git = "https://github.com/ts-vit/ai-chat"' **/Cargo.toml` → 0 matches (только документационные `repository=/homepage=` поля в crates/uni-*/Cargo.toml — не источник зависимости)

---

*Phase: 01-rust-vendoring*
*Completed: 2026-05-16*
