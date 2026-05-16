# Phase 3: Build & Docs — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `03-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 03-build-docs
**Areas discussed:** README, CLAUDE.md, package.json scripts, BUILD-05 методика

---

## README (D-R1..D-R4)

### Охват

| Option | Description | Selected |
|--------|-------------|----------|
| Quickstart-only | Сборка из чистого клона + dev/test/build команды + prerequisites. ~40-60 строк. Минимум для BUILD-04. | ✓ |
| Quickstart + overview | + 1-2 абзаца описания + краткий layout. ~80-120 строк. | |
| Полный README | + features + architecture + dev workflow + troubleshooting. 150-250+ строк. | |

**Notes:** Репо личный инструмент автора, публичный фасад не требуется.

### Язык

| Option | Description | Selected |
|--------|-------------|----------|
| Русский | Соответствует общему стилю `.planning/` и языку общения. | ✓ |
| Английский | Как CLAUDE.md и комментарии в коде. Единый стиль для публичного фасада. | |
| RU + EN (две версии) | Дороже в поддержке. | |

### Prerequisites (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| Node.js + npm | Без фиксированной версии. | ✓ |
| Rust toolchain (stable, 2021 edition) | Через rustup. | ✓ |
| Claude CLI на PATH | Runtime-зависимость для чата. | ✓ |
| Tauri платформенные prerequisites | Ссылка на оф. Tauri docs вместо подробного списка. | ✓ |

**User's choice:** Все четыре.

---

## CLAUDE.md (D-C1..D-C4)

### Степень правки

| Option | Description | Selected |
|--------|-------------|----------|
| Точечно — только CLAUDE.md | Переписать External Dependencies (line 53) + очевидные следы. `.planning/codebase/*` не трогать. | |
| CLAUDE.md + STACK/INTEGRATIONS точечно | + 5-10 точечных правок в `.planning/codebase/STACK.md` и `INTEGRATIONS.md`. | |
| Полная ревизия `.planning/codebase/` | + STACK + INTEGRATIONS + ARCHITECTURE + CONCERNS — всё под вендорированное состояние. | ✓ |

**User's choice:** Полная ревизия. Расширяет BUILD-06 scope, но `.planning/codebase/` будет актуальной без map-codebase прогона.

### CONCERNS.md «Supply Chain Risk» секция (line 51-69)

| Option | Description | Selected |
|--------|-------------|----------|
| Удалить полностью | Риск устранён, секция не описывает реальное состояние. История в Phase 1/2 артефактах. | ✓ |
| Пометить как Resolved | Переписать в `**Resolved (Phase 1/2):** …` со ссылками. | |
| Переписать в «Vendored Dependencies» | Краткое описание без формы risk/fix-approach. | |

**User's choice:** Удалить полностью.

---

## package.json scripts (D-S1, D-S2)

| Option | Description | Selected |
|--------|-------------|----------|
| Оставить как есть | Никаких правок в package.json. BUILD-01..03 уже зелёные. | ✓ |
| + cross-env для dev | Cross-platform `set TAURI_CONFIG` → `cross-env TAURI_CONFIG`. +1 devDependency. | |
| + вспомогательные скрипты | test:packages, verify:offline. | |
| cross-env + вспомогательные | Обе правки сразу. | |

**Notes:** Репо личный инструмент на Windows; cross-platform не обязателен. DoD Phase 2 уже решил, что тесты вендорированных пакетов не запускаются, повторяющая инфраструктура не нужна.

---

## BUILD-05 методика (D-V1..D-V4)

### Блокировка сети

| Option | Description | Selected |
|--------|-------------|----------|
| Windows Firewall outbound rule | Временные правила netsh/New-NetFirewallRule. Воспроизводимый, чистый изолят. | |
| hosts-файл заглушки | `127.0.0.1 npm.ts-vit.com`. github.com заблокировать нельзя без побочек. | |
| Упрощённо: доверие lockfile | git clone + grep + npm ci/cargo build без блокировки. | |
| Hybrid: grep + Firewall для npm.ts-vit.com | Grep-инварианты + Firewall block только на npm.ts-vit.com. | |
| **Other:** «Не блокируем» (свободный ответ) | Сеть не блокируем; уточнено как «Grep-инварианты + прогон». | ✓ |

**User's choice (clarified):** Сеть физически не блокируем. Доказательство «офлайн-достаточности» через grep-инварианты (lockfile / Cargo.lock / Cargo.toml / .npmrc — 0 совпадений `npm.ts-vit.com` / `github.com/ts-vit/ai-chat`) + полный прогон `npm ci && cargo build --workspace && npm run test:all` в чистом temp каталоге.

**Notes:** ROADMAP success criterion 4 буквально требует «сеть заблокирована». В `03-CONTEXT.md` это переформулировано как «фактическая независимость от приватной сети через grep-инварианты + прогон». Planner должен явно отметить отклонение в PLAN.md.

### Артефакт результата

| Option | Description | Selected |
|--------|-------------|----------|
| 03-VERIFICATION.md | Структурированный verification по аналогии с Phase 1/2. | |
| 03-XX-TEST-NOTES.md | Технические заметки в плане (живые команды, exit codes). | |
| Оба | TEST-NOTES внутри плана + 03-VERIFICATION.md по итогу фазы. | ✓ |

**User's choice:** Оба. Максимум traceability.

---

## Claude's Discretion

- Точное количество планов фазы (1 объединённый vs 2 vs 3) — решит planner.
- BUILD-02 (`npm run build` Tauri prod) vs ROADMAP success criterion 4 (только `cargo build --workspace`) — planner определит, включать ли полный Tauri prod build в BUILD-05 или ограничиться cargo workspace build.
- Точные grep-команды и regex'ы для инвариантов BUILD-05 — синтаксис на усмотрение planner/executor.
- Формулировка нового параграфа «Vendored Dependencies» в CLAUDE.md (отдельный заголовок vs встроить в Architecture) — на усмотрение doc-writer.
- Tauri docs URL для prerequisites в README — допустимо использовать живой URL Tauri 2 docs, planner подтвердит при написании.

## Deferred Ideas

См. `03-CONTEXT.md` `<deferred>` секцию — 9 пунктов (MAINT-01/02, CLEAN-01/02, метаданные пакетов, cross-env, вспомогательные scripts, CI, pre-commit hook).
