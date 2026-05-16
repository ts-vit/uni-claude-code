---
phase: 01-rust-vendoring
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - Cargo.toml
  - src-tauri/Cargo.toml
  - crates/claude-code-core/Cargo.toml
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
---

# Фаза 01: Rust Vendoring — отчёт code review

**Reviewed:** 2026-05-16
**Depth:** standard
**Files Reviewed:** 3
**Status:** clean

## Summary

Прорецензированы три манифеста, изменённые в Фазе 01 (workspace `Cargo.toml`, `src-tauri/Cargo.toml`, `crates/claude-code-core/Cargo.toml`). Цель фазы — заменить 7 git-зависимостей с приватного `github.com/ts-vit/ai-chat` на локальные `path = "..."` ссылки внутри одного workspace, после копирования 6 крейтов в `crates/uni-*/`.

Все изменения корректны и непротиворечивы:

- **`Cargo.toml` (workspace root)** — список `members` расширен с 2 до 8 крейтов; добавлены 6 vendored `uni-*` крейтов, при этом сохранены оба исходных члена (`src-tauri`, `crates/claude-code-core`) и поле `resolver = "2"`. Проверено: все 8 директорий существуют, у каждой есть `Cargo.toml`, имена пакетов в `[package].name` совпадают с именами директорий, что гарантирует корректное разрешение workspace.
- **`src-tauri/Cargo.toml`** — все 5 ранее git-зависимостей (`uni-common`, `uni-settings`, `uni-ssh`, `uni-terminal`, `uni-db`) переписаны на относительные пути `../crates/<crate>`. Пути корректны для текущей структуры (sibling-директория `src-tauri/` ↔ `crates/`). Решение не объявлять `uni-process` прямой зависимостью обосновано — в `src-tauri/src/` нет ни одного `use uni_process` (используется только транзитивно через `claude-code-core`). Существовавшая ранее workspace-зависимость `claude-code-core = { path = "../crates/claude-code-core" }` сохранена без изменений.
- **`crates/claude-code-core/Cargo.toml`** — обе git-зависимости (`uni-common`, `uni-process`) переписаны на sibling-пути `../uni-common` и `../uni-process`. Пути корректны (соседние директории внутри `crates/`).

**Cross-cutting check:** в трёх in-scope файлах нет ни одного остаточного упоминания `github.com/ts-vit/ai-chat`. Оставшиеся 12 совпадений (`Grep` показал) — это все либо строки `repository = ...` / `homepage = ...` в vendored `crates/uni-*/Cargo.toml`, либо `README.md` vendored крейтов. Эти файлы согласно `<scope_note>` находятся вне области ревью (vendored "as-is"), и поля метаданных не влияют на разрешение зависимостей при сборке из чистого клона.

Constraint "сборка из чистого клона без сетевого доступа к приватному git" из CLAUDE.md формально выполнен на уровне манифестов: ни один из трёх файлов не требует обращения к `github.com/ts-vit/ai-chat`.

## Info

### IN-01: workspace `Cargo.toml` не использует `[workspace.dependencies]` для общих версий

**File:** `Cargo.toml:1-12`

**Issue:** Несколько крейтов в workspace используют одинаковые версии общих зависимостей (`serde = "1"`, `tokio = "1"`, `serde_json = "1"`, `tracing = "0.1"`, `log = "0.4"`). В корневом `Cargo.toml` не объявлена секция `[workspace.dependencies]`, которая позволила бы централизованно фиксировать минимальные совместимые версии и устранить дрейф (например, `uni-terminal` использует `dirs = "5"`, а `src-tauri` — `dirs = "6"`; при расхождениях мажорной версии это может привести к двум разным копиям зависимости в `Cargo.lock`).

Замечание имеет смысл рассмотреть отдельной задачей по гигиене workspace — не блокер для текущей фазы. Цель фазы (избавиться от git-зависимостей) достигнута; унификация версий — следующий уровень.

**Fix:** Опционально, в будущей итерации добавить в корневой `Cargo.toml`:

```toml
[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
tracing = "0.1"
log = "0.4"
```

И в крейтах workspace заменить прямые версии на `serde = { workspace = true }` и т. д. Дрейф `dirs = "5"` vs `dirs = "6"` между `uni-terminal` и `src-tauri` следует разрешить отдельно, проверив, не сломается ли API `uni-terminal` при переходе на `dirs = "6"` (это уже выходит за рамки чистого vendoring и должно идти в отдельной фазе/задаче).

---

_Reviewed: 2026-05-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
