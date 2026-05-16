# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Vendoring

**Shipped:** 2026-05-16
**Phases:** 3 | **Plans:** 9 | **Tasks:** 18

### What Was Built

- 6 Rust-крейтов `uni-*` внесены в `crates/` как path-зависимости workspace; git-источник `github.com/ts-vit/ai-chat#dev` устранён полностью; `cargo build --workspace` проходит без сети.
- 3 npm-пакета `@uni-fw/*` внесены в `packages/uni-fw-*` через npm workspaces (`workspace:*`); `.npmrc` с приватным реестром `npm.ts-vit.com` удалён; `npm ci` проходит без сети.
- Top-level `README.md` создан (RU, quickstart, 37 строк); `CLAUDE.md` и `.planning/codebase/*` зачищены от приватных URL; «Supply Chain Risk» секция удалена из `CONCERNS.md`.
- End-to-end проверка чистого клона: `git clone --no-local` + 5 grep-инвариантов (0 hits) + `npm ci` + `cargo build --workspace` + `npm run test:all` + `npm run build` — всё exit 0 без приватной сети.

### What Worked

- **Snapshot-вендоринг с принципом «байт-в-байт, метаданные как есть»** (D-07 Phase 2): не правили `repository=ts-vit/ai-chat` поля в `Cargo.toml`/`package.json` метаданных, не санитизировали `homepage`. Результат — снижение surface-area правок и нулевые регрессии в публичных API.
- **Grep-инварианты вместо физической блокировки сети** (D-V2 Phase 3): фактическая независимость доказана 5 grep-проверками в свежем `git clone --no-local`, а не Windows Firewall outbound rules. Доказательная модель эквивалентна, побочки нулевые.
- **Trilateral plan-partition (3 плана на фазу)** — Phase 1 и Phase 3 разбиты на 3 параллельно/последовательно-исполняемых плана с disjoint `files_modified`. Каждый план атомарно коммитится; верифицировано Wave-моделью workflow.
- **«Если работает — не трогаем»** (D-S1 Phase 3): `package.json` scripts оставлены как есть (`set TAURI_CONFIG=...` Windows-only), `cross-env` не добавлен, новых helper-скриптов не введено. Это сэкономило время на бесполезную «улучшайзинг»-работу.

### What Was Inefficient

- **Тесты внутри вендорированных `@uni-fw/*` пакетов остались `it.skip`** (D-05/D-06 Phase 2): копия тестов зависит от инфраструктуры `ai-chat` (MSW моки, тестовые фикстуры). Не блокировали milestone (DoD гарантирует только тесты `uni-claude-code`), но создают тех-долг (MAINT-02 в Deferred Ideas).
- **GSD-генератор-блоки в CLAUDE.md** содержат три устаревших упоминания после вендоринга (lines 77, 143, 247); D-C4 запретил ручную правку. Регенерация требует отдельного прогона `generate-claude-profile` — он не запускался автоматически в составе фазы 3. Минорный дефект документации: знающий читатель увидит, что свободные части и source-файлы (STACK.md) уже зачищены, а GSD-блоки — нет.
- **Codebase-drift gate** в `/gsd:execute-phase` 3 показал warn-уровень (104 новых структурных элемента из-за `crates/uni-*` и `packages/uni-fw-*` после Phase 1/2). `.planning/codebase/` карта не обновлялась автоматически; refresh через `/gsd:map-codebase` отложен.

### Patterns Established

- **VERIFICATION.md формат с YAML frontmatter** (`phase`, `verified`, `status`, `score`) — введён в Phase 2, унаследован Phase 3. Стал каноническим для milestone — будущие milestone'ы должны его придерживаться.
- **TEST-NOTES.md как отдельный live-протокол внутри plan-папки** — формат таблица с командами/cwd/exit-code/duration. Парный артефакт к VERIFICATION.md (TEST-NOTES = доказательная база, VERIFICATION = truths-сводка).
- **Grep-инварианты как доказательная модель** для refactoring-фаз: вместо «firewall и попробуем сборку», вводим N grep-checks по lockfile/manifest/конфигам с 0-hit acceptance criteria. Применимо для любого «убрать X» milestone в будущем.
- **CONTEXT.md `Claude's Discretion` секция** — разделение «жёстко зафиксированных решений» (D-*) и «решает планировщик при разборе задачи». Снизило ping-pong между discuss-phase и plan-phase.

### Key Lessons

1. **«Не блокируем — доказываем grep'ом» работает для refactoring-milestone'ов**, где цель — устранение зависимости от инфраструктуры. Активная блокировка добавляет complexity (firewall config, DNS-заглушки, теневые проверки) без выигрыша в гарантии.
2. **GSD-генератор-маркеры — отдельный pipeline.** Если milestone правит свободные части документов, помеченных как auto-managed, нужно либо (a) явно регенерировать блоки в составе фазы, либо (b) фиксировать факт устаревших блоков как acknowledged deviation в VERIFICATION.md и оставлять до следующей регенерации. В этой milestone выбран вариант (b); для будущих milestone-ов стоит добавить шаг (a) в pipeline через `/gsd:capture` или хук post-phase.
3. **Trilateral plan-partition (Wave 1 disjoint + Wave 2 verify) — стабильный шаблон** для milestone'ов с разделимым изменением. Worked для Phase 1 (Cargo edits + path migration + verify) и Phase 3 (README + codebase docs + verify). Phase 2 имел более сильные зависимости (lockfile регенерация после manifest rewrite) — линейная цепочка `01 → 02 → 03` подошла лучше.

### Cost Observations

- **Model mix:** plan-phase opus (планирование), execute-plan sonnet (исполнение), plan-checker sonnet, code-reviewer sonnet. Оркестратор остаётся на opus.
- **Execution wall-clock:** Phase 1 ~8 мин, Phase 2 ~? (не зафиксировано), Phase 3 ~15 мин (3 плана × 1-8 мин/план + 7 мин на финальный `npm run build`).
- **Notable:** Самая дорогая операция milestone — `npm run build` в Phase 3 (212.1s). Если будущий milestone не требует полного Tauri-prod-build для verification, минимум `cargo build --workspace` достаточен (89.4s).

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 Vendoring | ~4-5 | 3 | Введён `CONTEXT.md` Claude's Discretion; VERIFICATION.md YAML frontmatter формат; grep-инварианты как verify-стратегия |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 Vendoring | vitest 106 passed / cargo test 97 passed | n/a (нет coverage runner) | 0 новых runtime-зависимостей; -1 (`.npmrc`); -7 git-источников |

### Top Lessons (Verified Across Milestones)

_Будут заполнены после v1.1+ когда появится cross-milestone валидация._

1. (TBD после v1.1)
