# Phase 01 Plan 03 — Test Notes

Все тесты прошли без правок.

## Резюме `cargo test --workspace`

| Крейт | Passed | Failed | Ignored |
|-------|--------|--------|---------|
| claude-code-core (parser + session) | 16 | 0 | 0 |
| uni-claude-code (src-tauri) | 21 | 0 | 0 |
| uni-common | 5 | 0 | 0 |
| uni-db (helpers + migrate + pool + transaction) | 28 | 0 | 0 |
| uni-process | 7 | 0 | 0 |
| uni-settings | 7 | 0 | 0 |
| uni-ssh | 7 | 0 | 0 |
| uni-terminal | 6 | 0 | 1 (pre-existing) |
| **Итого** | **97** | **0** | **1** |

## Пометки `#[ignore]`, добавленные этим планом

**Никаких.** Все тесты внутри 6 вендорированных `uni-*` крейтов прошли с первого запуска `cargo test --workspace`. Атрибут `#[ignore]` в исходниках не добавлялся.

## Pre-existing `#[ignore]` (унаследованный из snapshot)

| Крейт | Файл | Тест | Причина (из исходного кода ai-chat) |
|-------|------|------|--------------------------------------|
| uni-terminal | `src/manager.rs:209` | `manager::tests::create_and_kill_session` | `// Requires PTY support, may not work in CI` (тест был помечен `#[ignore]` ещё до вендоринга) |

Этот `#[ignore]` НЕ добавлен этим планом — он унаследован «как есть» из snapshot-копии источника (Plan 01-01). Согласно PROJECT.md Constraints («тесты копируются как есть»), исходные `#[ignore]` сохраняются. К MAINT-02 (v2) этот тест не относится — он помечен upstream-автором как PTY-зависимый, а не как failing-due-to-vendoring.

## TODO trail для MAINT-02 (v2)

Пусто. Поскольку ни один тест не был помечен `#[ignore]` из-за вендоринга, в v2 нечего «re-enable». MAINT-02 (см. REQUIREMENTS.md) остаётся открытым как общая гигиена тестов вендорированных крейтов, но без конкретных кандидатов из этой фазы.
