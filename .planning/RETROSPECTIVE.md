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

## Milestone: v1.1 — Chat UX

**Shipped:** 2026-05-18
**Phases:** 2 | **Plans:** 6 | **Tasks:** 9
**Code diff:** 10 files, +497 / −110 (frontend only)
**Timeline:** ~12 часов 2026-05-18 (single-day milestone)

### What Was Built

- **PERSIST-01/02:** `App.tsx` переписан в три sibling-блока (`main` / view-overlay / welcome) с `display: flex/none`; `DualPanelLayout` всегда смонтирован на каждый opened project. Удалён `projectLayoutState Map` и публичный API `DualPanelLayoutState`. Переписка переживает любую навигацию.
- **VIS-01/02/03:** `StatusBar` обогащён тремя полями — Model, Session (8-char prefix + Mantine `CopyButton` render-prop с `IconCopy/IconCheck`-toggle), Σ Tokens (с `Tooltip`-breakdown по input / output / cache_creation / cache_read).
- **UI-01:** Кнопка Clear (`ActionIcon` с `IconEraser`, `ml="auto"`, `disabled={isRunning}`) в шапке `ChatPanel`; единый `handleClear` атомарно сбрасывает 8 полей состояния.
- **CR-01 fix:** Impure `setState` в `case "system"` заменён на ref-based comparison — без side-effects в event handler.
- 15 unit-тестов StatusBar (7 новых), 5 новых ChatPanel тестов, `App.test.tsx` инвертирован под keep-mounted семантику. 119/119 vitest passing.

### What Worked

- **Discuss-phase decisions замораживались до plan-phase** — D-04-01..05 и D-05-04..14 LOCKED-решения позволили plan-checker и execute-phase идти без ping-pong. Особенно мощно — D-05-04/05 (functional updater + accumulator pattern) и D-05-11 (DRY reset через единый `handleClear`).
- **Keep-mounted с sibling-блоками вместо z-index overlay** (D-04-03) — простое решение через `display: none/flex`; никаких focus/keyboard-trap проблем, никакого z-index-управления.
- **Em-dash placeholder для null-значений** (D-05-12) — `model ?? "—"` единый паттерн вместо optional rendering. Тривиально, но дисциплинирует UI; читателю всегда понятно, что StatusBar здесь.
- **Single-day milestone** — discuss → plan → execute → review → verify за ~12 часов. Фокусированный scope (6 требований, 2 фазы) + отсутствие research-фазы (frontend-only, all stack knowledge in `.planning/codebase/`) сделали milestone быстрым.

### What Was Inefficient

- **Артефакты не sync'нулись автоматически в конце milestone.** На close обнаружено: (a) `REQUIREMENTS.md` traceability показывал PERSIST-01/02 как Pending, хотя они validated в Phase 4; (b) `05-VERIFICATION.md` frontmatter остался `status: human_needed`, хотя HUMAN-UAT уже `resolved`. Пришлось делать manual fix в `/gsd-complete-milestone`. **Lesson:** workflow `/gsd-transition` (или эквивалентный hook) должен после `*-VERIFICATION.md → resolved` автоматически: (1) flip checkbox + Status в REQUIREMENTS.md, (2) flip frontmatter в VERIFICATION.md.
- **CR-01 найден на code-review, не на plan-checker** — impure `setState` в `case "system"` это типичная React-антипатченрн. Plan-checker (sonnet) пропустил, code-reviewer (sonnet) поймал. Возможно, plan-checker нужно подтолкнуть на проверку «всех `setState`-вызовов в event handlers».
- **WR-02 (terminal refit) выявлен только в HUMAN-UAT** — Phase 4 plan не учёл взаимодействие keep-mounted рендера с xterm/FitAddon `ResizeObserver` при `display:none`. D-04-04 в плане упоминал «terminals need resize-events», но конкретный путь `display:none → display:flex` без `triggerTerminalRefit` не был помечен в plan must-haves.

### Patterns Established

- **HUMAN-UAT.md как отдельный артефакт** для live-сценариев, не покрываемых jsdom (Clipboard API, Tooltip hover, real WebView rendering). Структура: numbered tests + frontmatter `status: deferred/resolved`. Симметрично VERIFICATION.md для автоматики.
- **Mantine CopyButton render-prop pattern** — первое использование в проекте. `{({ copied, copy }) => <ActionIcon onClick={copy}>{copied ? <IconCheck/> : <IconCopy/>}</ActionIcon>}`. Кандидат на повторное использование везде, где нужно «копировать в clipboard с feedback».
- **Functional updater для accumulator из stream-events** (D-05-04/05) — `setAccumulatedUsage(prev => ...)` в `case "assistant"` гарантирует корректность при concurrent events; без functional updater можно потерять увеличение, если два события приходят подряд.
- **Ref-based comparison вместо `setState` в `case` statements** — для reset-логики при смене ID/session, ref-сравнение чище: `if (sessionIdRef.current !== newId) { sessionIdRef.current = newId; setAccumulatedUsage(null); }`. Не нарушает чистоту event-handler'а.

### Key Lessons

1. **Sync milestone артефактов — отдельный pipeline.** REQUIREMENTS.md traceability, VERIFICATION.md frontmatter, HUMAN-UAT status — три параллельные state-машины, которые workflow не sync'ит автоматически между ними. На `/gsd-complete-milestone` это обнаруживается через audit-open, но это запоздалое обнаружение. Кандидат на улучшение workflow: после resolve UAT — auto-flip связанных артефактов или хотя бы warning в `/gsd-progress`.
2. **Phase-level test-coverage gap.** Phase 4 plan описывал PERSIST-01/02 SC и автоматические тесты для них, но не учёл, что Phase 4 рефактор может породить side-effect на terminal-component (WR-02). **Шаблон на будущее:** при рефакторе layout-компонентов плановщик должен явно перечислить все компоненты-потребители и пройтись по их жизненному циклу — что произойдёт, если родитель меняет `display: none ↔ flex` без unmount.
3. **Single-day milestone требует точного pre-discuss scoping.** v1.1 удалось закончить за 12 часов потому, что (a) границы scope были чётко зафиксированы в discuss-phase до старта (DB-persistence явно out-of-scope), (b) Phase 4 → Phase 5 зависимость диктовала линейный порядок без waves, (c) frontend-only — никакой Rust rebuild боли. Если бы scope включал даже один backend-touch — milestone бы растянулся.

### Cost Observations

- **Model mix:** plan-phase + execute-plan sonnet (без opus); orchestrator opus. Меньше opus-калории по сравнению с v1.0 — повторно используемые UI-паттерны не требуют глубокого reasoning.
- **Sessions:** 4 (start-milestone, plan-phase × 2, execute + close). Single-day сеанс — единая context-сессия с минимальной потерей контекста.
- **Notable:** Самые дорогие шаги — это not code generation, а discuss-phase decision-locking (15+ D-* решений × 2 фазы) + manual HUMAN-UAT (live testing требует пользовательского участия). Auto-fixable artefact sync (см. Lesson 1) сэкономил бы ~15 минут на close.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 Vendoring | ~4-5 | 3 | Введён `CONTEXT.md` Claude's Discretion; VERIFICATION.md YAML frontmatter формат; grep-инварианты как verify-стратегия |
| v1.1 Chat UX | ~4 | 2 | Введён `HUMAN-UAT.md` как отдельный артефакт для live-сценариев (Clipboard API, Tooltip hover); single-day milestone подтверждён как рабочий формат для UX-полировки без research; обнаружено: artefact sync (REQUIREMENTS ↔ VERIFICATION ↔ HUMAN-UAT) — пробел в workflow |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 Vendoring | vitest 106 passed / cargo test 97 passed | n/a (нет coverage runner) | 0 новых runtime-зависимостей; -1 (`.npmrc`); -7 git-источников |
| v1.1 Chat UX | vitest 119 passed (+13 новых) / cargo test 97 passed (no change) | n/a | 0 новых runtime-зависимостей; первое использование `Mantine CopyButton` render-prop pattern |

### Top Lessons (Verified Across Milestones)

_Подтверждены в более чем одной milestone. Пересмотрены при каждом закрытии._

1. **«Если работает — не трогаем» (v1.0) + «фокусированный scope = быстрая milestone» (v1.1)** — оба урока про дисциплину границ. v1.0 не добавляла лишних helper-скриптов даже при возможности; v1.1 явно держала DB-persistence/--continue вне scope. Оба раза экономия > час на milestone.
2. **VERIFICATION.md YAML frontmatter формат (v1.0)** прижился и в v1.1, плюс расширился через `human_verification` поле — структурированная связка с HUMAN-UAT.md. Конвенция формат `phase / verified / status / score` стабилизировалась как канон.
3. **Artefact-sync gap (v1.1, новое наблюдение).** REQUIREMENTS traceability / VERIFICATION status / HUMAN-UAT status — три параллельные state-машины без auto-sync. Не верифицировано в v1.0 (одна-milestone-наблюдение), но если v1.2 повторит — стоит считать pattern и добавлять hook в `/gsd-transition` или `/gsd-progress`.
