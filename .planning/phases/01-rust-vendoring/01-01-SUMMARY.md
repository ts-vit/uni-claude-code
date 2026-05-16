---
phase: 01-rust-vendoring
plan: 01
subsystem: infra
tags: [rust, cargo, workspace, vendoring, uni-framework]

# Dependency graph
requires:
  - phase: init
    provides: Базовый workspace с членами src-tauri и crates/claude-code-core
provides:
  - 6 каталогов crates/uni-*/ со snapshot-копией исходников uni-common, uni-process, uni-settings, uni-db, uni-ssh, uni-terminal из D:\work-ai\ai-chat
  - Расширенный [workspace] members в корневом Cargo.toml (8 членов: src-tauri + claude-code-core + 6 uni-*)
  - Локальные path-источники для Plan 02 (замена git-зависимостей в src-tauri и claude-code-core)
affects: [01-02-rewrite-cargo-manifests, 01-03-regenerate-lock-and-verify]

# Tech tracking
tech-stack:
  added: [uni-common, uni-process, uni-settings, uni-db, uni-ssh, uni-terminal]
  patterns: [snapshot-vendoring, workspace path dependencies, byte-identical copy без правки исходников]

key-files:
  created:
    - crates/uni-common/Cargo.toml
    - crates/uni-common/src/lib.rs
    - crates/uni-process/Cargo.toml
    - crates/uni-settings/Cargo.toml
    - crates/uni-db/Cargo.toml
    - crates/uni-ssh/Cargo.toml
    - crates/uni-terminal/Cargo.toml
  modified:
    - Cargo.toml

key-decisions:
  - "Snapshot-копия побайтная — не редактируем repository=/homepage= метаданные крейтов, только source-of-truth манифестов и кода"
  - "Внутренние path = \"../uni-common\" в uni-process/uni-settings/uni-db оставлены без изменений — относительная раскладка crates/uni-* совпадает с источником ai-chat"
  - "cargo build НЕ запускался в этом плане — src-tauri и claude-code-core всё ещё ссылаются на git, build пойдёт в Plan 01-03 после Plan 01-02"

patterns-established:
  - "Vendoring workflow: PowerShell Copy-Item -Recurse -Force из D:\\work-ai\\ai-chat\\crates\\<name> → crates/<name>"
  - "Verification gate: cargo metadata --no-deps --format-version 1 для проверки workspace TOML без полного билда"

requirements-completed: [RUST-01, RUST-02, RUST-03, RUST-04, RUST-05, RUST-06]

# Metrics
duration: 3min
completed: 2026-05-16
---

# Phase 01 Plan 01: Vendor uni-* Crates Summary

**6 крейтов uni-* (uni-common, uni-process, uni-settings, uni-db, uni-ssh, uni-terminal) скопированы snapshot-ом из D:\work-ai\ai-chat и зарегистрированы как члены workspace в корневом Cargo.toml**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-16T08:24:13Z
- **Completed:** 2026-05-16T08:26:22Z
- **Tasks:** 2
- **Files modified:** 40 (39 created в crates/uni-*, 1 модифицирован — корневой Cargo.toml)

## Accomplishments

- Все 6 каталогов `crates/uni-*/` существуют со скопированным исходником (Cargo.toml + src/ + README.md где был в источнике)
- Корневой `Cargo.toml` теперь объявляет 8 членов workspace (было 2: `src-tauri`, `crates/claude-code-core`)
- `cargo metadata --no-deps --format-version 1` завершается с exit code 0 и резолвит все 6 новых крейтов как локальные пакеты
- Внутренние path-зависимости `uni-process → uni-common`, `uni-settings → uni-common`, `uni-db → uni-common` сохранены и валидно резолвятся в локальные каталоги
- `src-tauri/Cargo.toml` и `crates/claude-code-core/Cargo.toml` остались нетронутыми (это scope Plan 02)
- Покрыты требования RUST-01..RUST-06 (по одному на каждый крейт)

## Task Commits

Каждая задача закоммичена атомарно:

1. **Task 1: Copy 6 uni-* crates snapshot from ai-chat** — `6c9f8ee` (feat)
2. **Task 2: Register 6 crates in workspace.members** — `1ed009d` (feat)

_Note: Cargo.lock в этом плане НЕ регенерировался — это работа Plan 01-03 после того, как Plan 01-02 перепишет git-ссылки в src-tauri и claude-code-core на path._

## Files Created/Modified

**Created (39 файлов):**

- `crates/uni-common/Cargo.toml` — манифест uni-common, depends on uuid/serde/serde_json/thiserror/tokio-util
- `crates/uni-common/README.md`
- `crates/uni-common/src/{lib,error,id,text,time}.rs`
- `crates/uni-process/Cargo.toml` — depends on `uni-common = { path = "../uni-common" }` и tokio/tracing
- `crates/uni-process/README.md`
- `crates/uni-process/src/{lib,config,events,process}.rs`
- `crates/uni-settings/Cargo.toml` — depends on `uni-common` (path), tokio (full), async-trait, serde, dev-deps tempfile
- `crates/uni-settings/README.md`
- `crates/uni-settings/src/{lib,keys,store}.rs`
- `crates/uni-db/Cargo.toml` — depends on `uni-common` (path), sqlx 0.8 (runtime-tokio, sqlite), tokio, serde, log, dev-deps tempfile
- `crates/uni-db/src/{lib,error,helpers,migrate,pool,transaction}.rs`
- `crates/uni-ssh/Cargo.toml` — depends on russh 0.46, russh-keys 0.46, async-trait, tokio, serde, log; uni-* deps НЕТ
- `crates/uni-ssh/README.md`
- `crates/uni-ssh/src/{lib,forward,handler,manager,proxy,socks5,types}.rs`
- `crates/uni-terminal/Cargo.toml` — depends on portable-pty 0.8, dirs 5, serde, log; uni-* deps НЕТ
- `crates/uni-terminal/src/{lib,manager,shell,types}.rs`

**Modified:**

- `Cargo.toml` — `[workspace] members` расширен с 2 до 8 элементов, `resolver = "2"` сохранён

## Decisions Made

- **Snapshot-копия побайтная** — метаданные `repository = "https://github.com/ts-vit/ai-chat"` и `homepage = "..."` в исходных манифестах оставлены как есть. Это документационные поля (rustdoc/crates.io метадата), не источник зависимости — `git = "..."` записей в манифестах вендорированных крейтов НЕТ. Очистка метаданных, если нужна, — отдельная задача вне scope этой milestone.
- **Внутренние path-ссылки `path = "../uni-common"` не правились** — раскладка `crates/uni-*` в нашем репо точно совпадает с `D:\work-ai\ai-chat\crates\uni-*`, поэтому относительные ссылки валидны без изменений.
- **cargo build НЕ запускался** — в этом плане валидируется только разрешимость workspace через `cargo metadata --no-deps`. Полный build пойдёт в Plan 01-03 после того, как Plan 01-02 переписывает `git = "..."` ссылки в `src-tauri/Cargo.toml` и `crates/claude-code-core/Cargo.toml` на `path = "../<crate>"`. Запуск build сейчас гарантированно бы провалился (src-tauri тянет git-источник, который не вкопирован).

## Deviations from Plan

None — plan executed exactly as written.

Все acceptance criteria обеих задач выполнены без отклонений. Никаких Rule 1/2/3 auto-fix-ов не потребовалось.

## Issues Encountered

- **PowerShell `$`-переменные в Bash-обёртке** — первая попытка скопировать крейты через inline `powershell -Command "...$var..."` была съедена Git Bash (переменные `$src`/`$dst` интерпретировались как Bash). Workaround: записал PowerShell-скрипт во временный файл `.tmp-copy-crates.ps1`, выполнил его через `powershell -ExecutionPolicy Bypass -File`, потом удалил. То же для парсинга `cargo metadata` JSON через PowerShell. Файлы временные не закоммичены.

## User Setup Required

None — никаких внешних сервисов и конфигурации не требуется.

## Next Phase Readiness

**Ready for Plan 01-02 (`rewrite-cargo-manifests`):**

- Все 6 вендорированных крейтов доступны как локальные members workspace
- Path-ссылки `path = "../uni-common"` внутри уже работают (валидировано через `cargo metadata`)
- Plan 02 теперь может безопасно заменить `git = "https://github.com/ts-vit/ai-chat", branch = "dev"` ссылки в `src-tauri/Cargo.toml` (5 ссылок: uni-common, uni-settings, uni-ssh, uni-terminal, uni-db) и `crates/claude-code-core/Cargo.toml` (2 ссылки: uni-common, uni-process) на `path = "../<crate>"` — целевые каталоги существуют

**Blockers/concerns:** None.

## Self-Check: PASSED

**Files verified to exist on disk:**

- FOUND: `crates/uni-common/Cargo.toml`
- FOUND: `crates/uni-common/src/lib.rs`
- FOUND: `crates/uni-process/Cargo.toml`
- FOUND: `crates/uni-settings/Cargo.toml`
- FOUND: `crates/uni-db/Cargo.toml`
- FOUND: `crates/uni-ssh/Cargo.toml`
- FOUND: `crates/uni-terminal/Cargo.toml`
- FOUND: `Cargo.toml` (modified — 8 members)

**Commits verified to exist:**

- FOUND: `6c9f8ee` — feat(01-01): vendor 6 uni-* crates from ai-chat as snapshot
- FOUND: `1ed009d` — feat(01-01): register 6 vendored uni-* crates in workspace.members

**Verification commands run:**

- `cargo metadata --no-deps --format-version 1 --manifest-path Cargo.toml` → exit 0, 8 packages
- `(Get-ChildItem crates/uni-*/Cargo.toml).Count` → 6
- `(Select-String Cargo.toml -Pattern 'crates/uni-...').Count` → 6
- `grep -r 'git\s*=\s*"https://github.com/ts-vit/ai-chat"' crates/uni-*` → пусто (только в claude-code-core/Cargo.toml, scope Plan 02)

---

*Phase: 01-rust-vendoring*
*Completed: 2026-05-16*
