---
phase: 01-rust-vendoring
plan: 03
subsystem: infra
tags: [rust, cargo, lockfile, build, test, vendoring]

# Dependency graph
requires:
  - phase: 01-rust-vendoring
    provides: 6 крейтов uni-* зарегистрированы в workspace (Plan 01-01) + 7 git=ai-chat ссылок заменены на path (Plan 01-02)
provides:
  - Регенерированный Cargo.lock без ссылок на github.com/ts-vit/ai-chat — все uni-* пакеты как path-deps (без source-строки)
  - Подтверждённая зелёная сборка `cargo build --workspace` (exit 0) без сетевого доступа к ai-chat
  - Подтверждённый зелёный `cargo test --workspace` — 97 passed / 0 failed / 1 pre-existing ignored
  - TEST-NOTES.md фиксирует «Все тесты прошли без правок» (TODO trail для MAINT-02 пустой)
affects: [phase 02-npm-vendoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [cargo generate-lockfile для регенерации Cargo.lock после смены источника зависимостей, path-deps в lockfile через отсутствие source-строки]

key-files:
  created:
    - .planning/phases/01-rust-vendoring/01-03-TEST-NOTES.md
  modified:
    - Cargo.lock
    - src-tauri/gen/schemas/acl-manifests.json
    - src-tauri/gen/schemas/desktop-schema.json
    - src-tauri/gen/schemas/windows-schema.json

key-decisions:
  - "Регенерация через `rm Cargo.lock && cargo generate-lockfile` — самый чистый способ убрать stale git-source записи; `cargo update --workspace` поверх старого lock мог бы оставить кэш"
  - "Никаких `#[ignore]` правок в исходниках uni-* крейтов не потребовалось — все тесты прошли с первого запуска `cargo test --workspace`. Это благоприятный исход: MAINT-02 (v2) останется пустым по этой фазе"
  - "Tauri ACL-схемы (3 JSON файла в src-tauri/gen/schemas/) перегенерированы автоматически tauri-build при пересборке; включены в commit Task 2 как side-effect lockfile-регена (новая минорная версия Tauri добавила core:app:allow-supports-multiple-windows и подобные)"

patterns-established:
  - "Lockfile регенерация: удалить файл, выполнить `cargo generate-lockfile`, верифицировать через `grep`-пустоту + `cargo metadata --format-version 1` exit 0"
  - "Test verification gate фазы вендоринга: `cargo test -p <critical-pkg>` для каждого критического крейта по отдельности (src-tauri, claude-code-core), затем `cargo test --workspace` для покрытия всех. Если последний падает только в uni-*, помечаем `#[ignore]` с TODO; критические остаются неприкосновенными"

requirements-completed: [RUST-08, RUST-09, RUST-10]

# Metrics
duration: 4min
completed: 2026-05-16
---

# Phase 01 Plan 03: Regenerate Lock and Verify Summary

**`Cargo.lock` регенерирован без ссылок на `github.com/ts-vit/ai-chat`, `cargo build --workspace` exit 0 и `cargo test --workspace` зелёный (97 passed / 0 failed) — никаких `#[ignore]` правок в вендорированных uni-* крейтах не потребовалось. Фаза 1 (Rust Vendoring) завершена.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-16T08:34:25Z
- **Completed:** 2026-05-16T08:38:36Z
- **Tasks:** 2
- **Files modified:** 5 (Cargo.lock + 3 Tauri ACL schemas + 1 created TEST-NOTES.md)

## Accomplishments

- `Cargo.lock` пересоздан через `cargo generate-lockfile` — 6 старых записей `source = "git+https://github.com/ts-vit/ai-chat?branch=dev#..."` исчезли; все 6 uni-* пакетов теперь как path-deps (без `source`-строки в `[[package]]`)
- `grep "github.com/ts-vit/ai-chat" Cargo.lock` → 0 совпадений
- `cargo metadata --format-version 1` exit 0 — lockfile валиден, workspace полностью разрешим
- `cargo build --workspace` exit 0 за ~55s — все 8 членов workspace (src-tauri, claude-code-core, 6 uni-*) компилируются
- `cargo test -p uni-claude-code` — **21 passed / 0 failed / 0 ignored** (src-tauri тесты)
- `cargo test -p claude-code-core` — **16 passed / 0 failed / 0 ignored**
- `cargo test --workspace` — **97 passed / 0 failed / 1 pre-existing ignored** (разбивка ниже)
- TEST-NOTES.md создан с записью «Все тесты прошли без правок» — TODO trail для MAINT-02 пустой
- Покрыты требования **RUST-08**, **RUST-09**, **RUST-10**

### Разбивка `cargo test --workspace`

| Крейт | Passed | Failed | Ignored |
|-------|--------|--------|---------|
| claude-code-core | 16 | 0 | 0 |
| uni-claude-code (src-tauri) | 21 | 0 | 0 |
| uni-common | 5 | 0 | 0 |
| uni-db | 28 | 0 | 0 |
| uni-process | 7 | 0 | 0 |
| uni-settings | 7 | 0 | 0 |
| uni-ssh | 7 | 0 | 0 |
| uni-terminal | 6 | 0 | 1 (pre-existing PTY-test) |
| **Итого** | **97** | **0** | **1** |

## Task Commits

Каждая задача закоммичена атомарно:

1. **Task 1: Regenerate Cargo.lock without ai-chat git source** — `660034e` (chore)
2. **Task 2: Verify cargo build + cargo test --workspace зелёные** — `e7bef36` (test)

## Files Created/Modified

**Created:**

- `.planning/phases/01-rust-vendoring/01-03-TEST-NOTES.md` — Отчёт о тестах: «Все тесты прошли без правок», pre-existing `#[ignore]` в uni-terminal унаследован из snapshot, TODO trail для MAINT-02 пустой

**Modified:**

- `Cargo.lock` — полностью пересоздан (534 строк insertions, 823 deletions): уходят 6 git-source записей для uni-*, добавляются path-deps записи, версии транзитивных зависимостей обновлены до latest compatible (635 packages locked)
- `src-tauri/gen/schemas/acl-manifests.json` — авто-регенерация tauri-build (минорная версия Tauri 2.x подросла, новые ACL permissions добавлены)
- `src-tauri/gen/schemas/desktop-schema.json` — авто-регенерация (то же)
- `src-tauri/gen/schemas/windows-schema.json` — авто-регенерация (то же)

## Decisions Made

- **Регенерация через `rm Cargo.lock && cargo generate-lockfile`** — план перечислял три варианта (`cargo generate-lockfile`, `cargo update --workspace`, `cargo metadata`). Выбран первый: гарантированно убирает stale git-source записи без риска residual cache. `cargo update` поверх старого lock мог бы сохранить старые refs до полного rebuild; `cargo metadata` зависит от поведения «no-lock → generate», что менее предсказуемо.
- **Никаких `#[ignore]` правок не потребовалось** — все 6 вендорированных uni-* крейтов прошли тесты с первого запуска. Это благоприятный исход для milestone v1: PROJECT.md Constraints разрешали `#[ignore]` для нестабильных тестов, но это не понадобилось. MAINT-02 (v2 «причесать тесты вендорированных пакетов») остаётся открытым как общая гигиена, но без конкретных кандидатов из этой фазы.
- **Tauri ACL-схемы закоммичены в составе Task 2** — `tauri-build` автоматически перегенерировал три JSON-схемы при пересборке после регена lockfile (новые permissions из обновлённой минорной версии Tauri 2.x). Эти файлы исторически tracked в git (не gitignored), поэтому intentional commit. Diff показывает добавление `core:app:allow-supports-multiple-windows` и подобных — стандартное minor-version-bump поведение Tauri.

## Deviations from Plan

None — plan executed exactly as written.

Все acceptance criteria обеих задач выполнены без отклонений. Никаких Rule 1/2/3 auto-fix-ов не потребовалось. Tauri-схемы (`src-tauri/gen/schemas/*.json`) — не deviation, а ожидаемый side-effect перекомпиляции, отражённый в commit-message Task 2 для прозрачности.

## Issues Encountered

- **`cargo metadata --offline` падает с HTTP-ошибкой** — первая попытка валидировать lockfile через `cargo metadata --format-version 1 --offline` упала: ряд транзитивных crates.io пакетов (`crc-catalog v2.5.0` и др.) не были скачаны в локальный cargo cache до пересборки. Решение: выполнить `cargo metadata --format-version 1` без `--offline` (online registry access — допустим по PROJECT.md Constraints: запрещён только доступ к `github.com/ts-vit/ai-chat` и `npm.ts-vit.com`, публичные registry разрешены). Полная offline-сборка — это задача BUILD-05 в Phase 3 после прогрева cargo cache.

## User Setup Required

None.

## Next Phase Readiness

**Phase 1 (Rust Vendoring) полностью завершена.**

End-to-end проверка фазы пройдена:

1. `grep -F 'github.com/ts-vit/ai-chat' Cargo.toml src-tauri/Cargo.toml crates/claude-code-core/Cargo.toml Cargo.lock` → **0 совпадений во всех 4 файлах** (RUST-08 ✓)
2. `cargo build --workspace` → **exit 0** (RUST-09 ✓)
3. `cargo test --workspace` → **97 passed / 0 failed** (RUST-10 ✓)
4. Никаких изменений в `src/`, `src-tauri/src/`, `crates/claude-code-core/src/` (compatibility constraint выполнен — публичные API не менялись)

**Ready for Phase 2 (npm Vendoring):**

- Rust workspace стабилен и self-contained
- Никаких блокеров для перехода к фронтенду
- Cargo.lock зафиксирован — последующие фазы не должны его трогать

**Blockers/concerns:** None.

## Self-Check: PASSED

**Files verified to exist on disk:**

- FOUND: `Cargo.lock` (regenerated)
- FOUND: `.planning/phases/01-rust-vendoring/01-03-TEST-NOTES.md`
- FOUND: `src-tauri/gen/schemas/acl-manifests.json` (modified)
- FOUND: `src-tauri/gen/schemas/desktop-schema.json` (modified)
- FOUND: `src-tauri/gen/schemas/windows-schema.json` (modified)

**Commits verified to exist:**

- FOUND: `660034e` — chore(01-03): regenerate Cargo.lock without ai-chat git source
- FOUND: `e7bef36` — test(01-03): verify cargo build + cargo test --workspace зелёные

**Verification commands run:**

- `grep "github.com/ts-vit/ai-chat" Cargo.lock` → 0 matches
- `grep "github.com/ts-vit/ai-chat" Cargo.toml src-tauri/Cargo.toml crates/claude-code-core/Cargo.toml Cargo.lock` → 0 matches in all 4 files (exit 1)
- `grep -E '^name = "uni-(common|process|settings|db|ssh|terminal)"' Cargo.lock` → 6 matches (по одному на крейт)
- `cargo metadata --format-version 1` → exit 0
- `cargo build --workspace` → exit 0 (~55s)
- `cargo test -p uni-claude-code` → exit 0 (21/0/0)
- `cargo test -p claude-code-core` → exit 0 (16/0/0)
- `cargo test --workspace` → exit 0 (97/0/1 pre-existing)

---

*Phase: 01-rust-vendoring*
*Completed: 2026-05-16*
