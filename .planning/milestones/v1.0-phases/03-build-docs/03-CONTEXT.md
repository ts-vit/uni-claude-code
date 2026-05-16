# Phase 3: Build & Docs — Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Финальная зачистка milestone «убрать приватные зависимости»: написать top-level README с инструкциями сборки из чистого клона; обновить CLAUDE.md и `.planning/codebase/*` под вендорированное состояние (удалить упоминания приватного npm-реестра `npm.ts-vit.com` и git-репо `github.com/ts-vit/ai-chat`); подтвердить, что `npm run dev`, `npm run build`, `npm run test:all` работают без приватной сети через end-to-end прогон чистого клона в temp-каталоге.

Покрывает требования **BUILD-01 ... BUILD-06** из REQUIREMENTS.md.

**Что НЕ входит в фазу (из PROJECT.md Out of Scope и решений Phase 1/2):**
- Установка/настройка CI (GitHub Actions, любой внешний CI) — milestone оставляет CI как локальные npm-скрипты
- Чистка метаданных пакетов (`repository=github.com/ts-vit/ai-chat`, `homepage=…` в `packages/uni-fw-*/package.json` и `crates/uni-*/Cargo.toml`) — D-07 Phase 2 явно зафиксировал «snapshot побайтная, метаданные как есть»
- Стабилизация спящих тестов внутри `packages/uni-fw-*/src/__tests__/` (D-05/D-06 Phase 2)
- Обратная синхронизация с `ai-chat`, замена `uni-*` на OSS-аналоги, изменение публичных API
- Cross-platform поддержка скриптов (`set TAURI_CONFIG=…` остаётся Windows-only — D-S1 ниже)

</domain>

<decisions>
## Implementation Decisions

### README (BUILD-04)

- **D-R1:** Top-level README создаётся **на русском языке**, охват **quickstart-only** (~40-60 строк). Не overview/architecture/troubleshooting — публичный фасад репо не требуется (личный инструмент автора).
- **D-R2:** README **обязан** содержать:
  - Краткое описание (1-2 строки): «UNI Claude Code — Tauri 2 + React 19 + Rust IDE-ассистент на базе Claude Code CLI».
  - Prerequisites (явный список):
    1. Node.js + npm (без фиксированной версии — `.nvmrc` отсутствует, формулировка «свежая LTS»)
    2. Rust toolchain (stable, edition 2021) через rustup
    3. Claude CLI на PATH — runtime-зависимость для чат-сессий
    4. Tauri платформенные prerequisites — **со ссылкой на оф. Tauri docs**, не дублировать список (WebView2 на Windows / webkit2gtk на Linux / Xcode на macOS)
  - Команды сборки и проверки: `npm ci`, `npm run dev`, `npm run build`, `npm run typecheck`, `npm run test`, `npm run test:rust`, `npm run test:all` — по одной строке каждая с краткой расшифровкой.
- **D-R3:** README **не упоминает** приватный реестр `npm.ts-vit.com` и приватный git-источник `github.com/ts-vit/ai-chat`. Никаких follow-up инструкций «настроить .npmrc» или «получить доступ к ai-chat» — их не существует после вендоринга.
- **D-R4:** README **не описывает** `.planning/`, `.claude/`, .agents/ — это внутренние инструменты разработки, не часть build-инструкций.

### CLAUDE.md и `.planning/codebase/*` (BUILD-06 — расширено пользователем до полной ревизии)

- **D-C1:** Полная ревизия `.planning/codebase/` — не только CLAUDE.md. В scope правок:
  - `CLAUDE.md:53` — параграф «External Dependencies… come from a private registry» → переписать в «Vendored Dependencies» (uni-* как `crates/uni-*` workspace path-зависимости; `@uni-fw/*` как `packages/uni-fw-*` npm workspaces; обратная синхронизация не поддерживается)
  - `.planning/codebase/STACK.md` lines 58, 73, 97 — упоминания «private registry npm.ts-vit.com» и «git https://github.com/ts-vit/ai-chat branch dev» → переписать на «vendored as workspace package/crate, source `D:\work-ai\ai-chat` (snapshot)»
  - `.planning/codebase/INTEGRATIONS.md` lines 66, 133, 134 — те же фразы → vendored
  - `.planning/codebase/ARCHITECTURE.md` line 94 — Layer 4 «Location: github.com/ts-vit/ai-chat branch dev» → «Location: `crates/uni-*` (workspace path-зависимости) и `packages/uni-fw-*` (npm workspaces)»
- **D-C2:** `.planning/codebase/CONCERNS.md` секция **«Supply Chain Risk»** (lines 51-69, включая «Private npm registry», «Private git repo», «No integrity enforcement») **удаляется полностью** — риск устранён вендорингом, секция больше не описывает реальное состояние. История фиксируется в Phase 1/2 артефактах (VERIFICATION.md, ROADMAP.md).
- **D-C3:** Прочие файлы `.planning/codebase/` (CONVENTIONS.md, TESTING.md) — точечно проверить grep'ом на `npm.ts-vit.com` / `ts-vit/ai-chat` / `private registry` / «git dependency»; если совпадения есть — править аналогично, если нет — не трогать.
- **D-C4:** Маркеры GSD-блоков в CLAUDE.md (`<!-- GSD:project-start source:PROJECT.md -->` и т.п.) **не трогаются** — содержимое между ними поддерживается отдельным процессом (generate-claude-profile). Правки идут только в «свободные» части CLAUDE.md.

### package.json scripts (BUILD-01..03)

- **D-S1:** Scripts в `package.json` **остаются как есть**. Все `BUILD-01..03` уже фактически зелёные по итогам Phase 2 (`npm run typecheck`, `npm run test`, `npm run dev`, `npm run build` работают на Windows). Cross-platform правка `dev`-скрипта (`set TAURI_CONFIG=` → `cross-env TAURI_CONFIG=`) **не делается** — репо личный инструмент автора на Windows, добавление `cross-env` как devDependency не оправдано.
- **D-S2:** Вспомогательные скрипты (`test:packages`, `verify:offline`) **не добавляются** — DoD Phase 2 уже определил, что тесты вендорированных пакетов не запускаются (D-05/D-06), а offline-проверка делается one-off в составе BUILD-05, не повторно.

### BUILD-05 — методика end-to-end проверки

- **D-V1:** Сеть к `npm.ts-vit.com` / `github.com/ts-vit/ai-chat` **физически не блокируем** (никаких Windows Firewall outbound rules, никаких hosts-заглушек). Вместо блокировки доказываем «фактическую независимость от приватной сети» через grep-инварианты.
- **D-V2:** **Reformulation BUILD-05** в planning: текст ROADMAP «сеть к npm.ts-vit.com и github.com/ts-vit/ai-chat заблокирована, и последовательность … отрабатывает без ошибок» **интерпретируется** как «фактическая независимость от приватной сети демонстрируется через grep-инварианты + полный прогон». Это решение должно быть явно отмечено в PLAN.md и VERIFICATION.md как deviation/clarification относительно буквы ROADMAP. Если verifier фазы решит, что это не покрывает букву требования — fallback: применить Windows Firewall outbound block по `npm.ts-vit.com` (github.com по DNS блокировать нельзя без побочек).
- **D-V3:** Шаги BUILD-05:
  1. Создать temp-каталог вне `D:\work-ai\` (например, `%TEMP%\uni-claude-code-verify-<ts>`).
  2. `git clone --no-local D:\work-ai\uni-claude-code <temp>` — гарантирует, что нет hardlinks к исходному рабочему дереву.
  3. **Grep-инварианты** (все должны вернуть 0 совпадений / 0 файлов):
     - `package-lock.json` не содержит подстроки `npm.ts-vit.com`
     - Корневой `package.json` не содержит ключа `"@uni-fw"` со значением, отличным от `"workspace:*"`
     - `Cargo.lock` не содержит подстроки `github.com/ts-vit/ai-chat`
     - `**/Cargo.toml` (только наши: `Cargo.toml`, `src-tauri/Cargo.toml`, `crates/*/Cargo.toml`) не содержат `git = "https://github.com/ts-vit/ai-chat"`
     - Файл `.npmrc` отсутствует в корне репозитория
  4. Прогон команд (live exec, фиксируем exit codes и time):
     - `npm ci` (ожидаем exit 0, `@uni-fw/*` линкуются как symlinks)
     - `cargo build --workspace` (ожидаем exit 0)
     - `npm run test:all` (ожидаем exit 0 — typecheck + vitest + cargo test --workspace)
  5. **Опционально (Claude's Discretion в плане):** `npm run build` (Tauri prod bundle) — см. ниже про BUILD-02 vs ROADMAP success criterion 4.
- **D-V4:** Артефакт результата — **оба**: 
  - `03-XX-TEST-NOTES.md` внутри плана BUILD-05 — живые команды, вывод, exit codes, durations (как `02-03-TEST-NOTES.md`).
  - `03-VERIFICATION.md` по итогу всей фазы — структурированный отчёт truths/evidence/links (как `01-VERIFICATION.md`/`02-VERIFICATION.md`).

### Claude's Discretion

- **Точное количество планов фазы.** Возможные варианты: (a) 3 плана — `03-01-readme-and-claude-md`, `03-02-codebase-revision`, `03-03-end-to-end-verify`; (b) 2 плана — `03-01-docs` (README + CLAUDE.md + codebase) и `03-02-verify`; (c) 1 объединённый план. Planner решит исходя из связности задач и наличия параллельных правок.
- **BUILD-02 vs ROADMAP success criterion 4.** REQUIREMENTS.md BUILD-02 требует «`npm run build` (Tauri prod) проходит из чистого клона без сети». ROADMAP success criterion 4 ограничивается «`npm ci && cargo build --workspace && npm run test:all`» и **не упоминает** `npm run build`. Решение, делать ли `npm run build` в составе BUILD-05 или ограничиться `cargo build --workspace`, planner определит исходя из стоимости (полный Tauri prod build на Windows — несколько минут, требует подписи bundle и т.п.). Минимум обязателен `cargo build --workspace`; полный `npm run build` — желательно, если не уводит фазу в overrun.
- **Точные grep-команды и regex'ы для инвариантов.** D-V3 фиксирует семантику; точная форма (PowerShell `Select-String` vs Bash `grep -r` vs `git grep`) — на усмотрение planner/executor.
- **Renaming строки `External Dependencies` в CLAUDE.md.** Точная формулировка нового параграфа (заголовок «Vendored Dependencies» vs встроить в существующую Architecture) — на усмотрение doc-writer'а в составе плана.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level (locked decisions)

- `.planning/PROJECT.md` — Key Decisions (CI не добавляется, snapshot, source `D:\work-ai\ai-chat`); Constraints (build determinism «без `.npmrc`, без `cargo` git-credentials, без сетевого доступа к приватным»); Out of Scope (GitHub Actions/CI, обратная синхронизация, замена на OSS).
- `.planning/REQUIREMENTS.md` §«Build & Documentation» — BUILD-01..BUILD-06, полный текст acceptance criteria.
- `.planning/ROADMAP.md` §«Phase 3: Build & Docs» — Goal и Success Criteria 1-4. **Note:** success criterion 4 сформулировано как «сеть … заблокирована»; D-V2 reformulates это как «фактическая независимость от приватной сети через grep-инварианты + прогон» — отметить в PLAN.md как осознанное отклонение.
- `.planning/STATE.md` — Decisions log; релевантны Init-решения «CI как сервис не добавляется», «`.npmrc` удалить полностью», и Phase 2 решения о метаданных «как есть» (D-07 — `repository=ts-vit/ai-chat` не правим).

### Phase 1/2 precedent (для аналогий)

- `.planning/phases/01-rust-vendoring/01-VERIFICATION.md` — формат итоговой верификации фазы (truths/evidence/links/artifacts); D-V4 берёт за образец.
- `.planning/phases/02-npm-vendoring/02-VERIFICATION.md` — свежий формат с метаданными в YAML frontmatter (`phase`, `verified`, `status`, `score`); рекомендуется применить тот же шаблон в 03-VERIFICATION.md.
- `.planning/phases/02-npm-vendoring/02-03-TEST-NOTES.md` — формат TEST-NOTES внутри плана (живые команды + exit codes + duration); D-V4 берёт за образец.
- `.planning/phases/02-npm-vendoring/02-CONTEXT.md` — паттерн принятия решений «оставить как есть, не править» (snapshot побайтная, D-S1 наследует тот же принцип).

### Файлы, которые правятся в Phase 3

- `README.md` — **создаётся** (top-level отсутствует сейчас). См. D-R1, D-R2, D-R3, D-R4.
- `CLAUDE.md` — line 53 (External Dependencies → Vendored). См. D-C1, D-C4.
- `.planning/codebase/STACK.md` — lines 58, 73, 97 (private registry/git → vendored).
- `.planning/codebase/INTEGRATIONS.md` — lines 66, 133-134.
- `.planning/codebase/ARCHITECTURE.md` — line 94 (Layer 4 location).
- `.planning/codebase/CONCERNS.md` — lines 51-69 удалить (Supply Chain Risk секция).
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/TESTING.md` — точечно проверить grep'ом, править если есть совпадения (D-C3).

### Codebase maps

- `.planning/codebase/STRUCTURE.md` — текущий layout репо после Phase 1/2 (crates/, packages/, src/, src-tauri/).
- `.planning/codebase/STACK.md` — текущие версии Node/Rust/Tauri/Vite — нужны для prerequisites в README (Tauri 2, React 19.1, Rust 2021, TypeScript 5.8.3, Node — без фиксации).
- `.planning/codebase/TESTING.md` — текущая конфигурация vitest + cargo test (нужно для расшифровки команд в README).

### External references (для README prerequisites D-R2)

- Tauri prerequisites: https://v2.tauri.app/start/prerequisites/ (Tauri 2 docs; точный URL planner подтвердит при написании README — допустимо использовать живой URL Tauri 2 docs).
- rustup: https://rustup.rs (стандартный установочный URL).
- Claude Code CLI: упомянуть как «Claude CLI by Anthropic», без жёсткой ссылки на установку (она может меняться).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Phase 1/2 VERIFICATION.md формат** — точный образец для 03-VERIFICATION.md (truths-table, evidence-column, score-line, YAML frontmatter в Phase 2).
- **Phase 2 TEST-NOTES.md формат** — образец для TEST-NOTES внутри плана BUILD-05 (живые команды + exit codes + duration + replication steps).
- **Phase 1 паттерн grep-инвариантов** — Plan 01-03 уже использовал grep на `Cargo.lock` чтобы подтвердить отсутствие `github.com/ts-vit/ai-chat`. Phase 2 продолжил тот же паттерн с `npm.ts-vit.com` в `package-lock.json`. BUILD-05 распространяет тот же подход на ВСЮ совокупность артефактов одним проходом.

### Established Patterns

- **«Если работает — не трогаем».** D-S1 (scripts) и D-V1 (без firewall) — прямые наследники этого принципа из Phase 1/2 (snapshot побайтная, метаданные как есть, lockfile регенерируем но не санитизируем).
- **Minimum surface area.** Phase 1/2 явно избегали `[workspace.dependencies]` синтаксиса в Cargo, `overrides`/`peerDependenciesMeta` в npm. Та же дисциплина в Phase 3: без cross-env, без verify:offline скрипта, без CI yaml.
- **GSD-блоки в CLAUDE.md.** Между маркерами `<!-- GSD:project-start source:PROJECT.md -->` и `<!-- GSD:project-end -->` (см. CLAUDE.md строки 59+) содержимое синхронизируется автоматически. D-C4 запрещает ручные правки между маркерами — если содержимое внутри блока устарело, оно правится правкой `source` (PROJECT.md, REQUIREMENTS.md) и регенерацией, не точечной правкой.

### Integration Points

- **README → CLAUDE.md.** README пишется для людей; CLAUDE.md пишется для Claude Code CLI. README не должен дублировать CLAUDE.md (разные аудитории), но quickstart-команды совпадают — допустимо повторение.
- **CLAUDE.md → `.planning/codebase/STACK.md`.** CLAUDE.md «Tech Stack» секция между GSD-маркерами генерируется из `.planning/codebase/STACK.md` или PROJECT.md. Правки в STACK.md автоматически попадут в CLAUDE.md при следующей регенерации.
- **`npm run build` (Tauri prod).** Если planner решит добавить в BUILD-05 (см. Claude's Discretion), нужно учесть: на Windows Tauri prod bundle включает code signing (если настроен в `tauri.conf.json`) — проверить, что сейчас signing **не** настроен (быстрый grep по `tauri.conf.json`), иначе BUILD-05 потребует ключей.

</code_context>

<specifics>
## Specific Ideas

- **Пользовательский акцент: «оставить как есть, где можно».** D-S1 и D-V1 — это сознательный выбор не делать лишних правок. Phase 3 — это «зачистка» не «улучшение». Planner должен резать любые предложения «заодно поправим X», если X не закрыт ни одним BUILD-* требованием.
- **Полная ревизия `.planning/codebase/` (а не только CLAUDE.md).** Пользователь явно расширил BUILD-06 scope. Это означает, что любой будущий map-codebase прогон должен идти от уже-очищенного состояния, не дубля работы.
- **Удаление «Supply Chain Risk» в CONCERNS.md.** Пользователь предпочёл полное удаление вместо «mark as resolved». Логика: CONCERNS.md описывает **текущее** состояние кода, не историю; история живёт в `phases/`. После Phase 3 чтение CONCERNS.md не должно вызывать ощущения «эти риски ещё актуальны».
- **«Не блокируем сеть» — это не отступление от безопасности, а смена доказательной модели.** Grep-инварианты + Phase 1/2 VERIFICATION (которые уже подтвердили `npm ci` и `cargo build` без сети) дают эквивалентную гарантию: если в lockfile нет приватных URL, сеть к приватным серверам не нужна по построению. Активная блокировка добавила бы только защиту от регресса в lockfile/manifest, что лучше ловится в CI/pre-commit (out of scope этой milestone).

</specifics>

<deferred>
## Deferred Ideas

- **MAINT-01 (v2): Скрипт ресинхронизации с upstream `D:\work-ai\ai-chat`** — не в этой milestone. Если когда-то понадобится пуллить updates — отдельная задача.
- **MAINT-02 (v2): Стабилизация спящих тестов в `packages/uni-fw-*/src/__tests__/`** — не в этой фазе.
- **CLEAN-01 (v2): Удалить неиспользуемые компоненты из вендорированных пакетов** — не в этой фазе.
- **CLEAN-02 (v2): Слить пакеты в `src/`** — отдельная milestone, если решено окончательно отказаться от концепции пакета.
- **Чистка метаданных пакетов (`repository=ts-vit/ai-chat`, `homepage=…`)** — D-07 Phase 2 явно зафиксировал «не правим». Если в будущем потребуется санитизация (например, перед публикацией репо в public) — отдельная задача, не часть устранения приватных зависимостей.
- **Cross-platform `dev`-скрипт через `cross-env`** — отклонено в этой фазе (D-S1). Если когда-то репо понадобится собирать на macOS/Linux разработчику кроме автора — отдельная задача.
- **Вспомогательные скрипты `test:packages` / `verify:offline`** — отклонены в этой фазе (D-S2). Если со временем понадобится регулярная offline-валидация (например, в CI после ввода MAINT-01) — отдельная задача.
- **GitHub Actions / любой внешний CI** — устойчиво out-of-scope milestone'а (PROJECT.md, REQUIREMENTS.md). Будет отдельная milestone, если когда-то появится.
- **Pre-commit hook на grep-инварианты (lockfile / Cargo.toml без приватных URL)** — был бы хорошим guardrail против регресса вендоринга, но добавление новой инфраструктуры hooks выходит за scope «зачистки». Future v2 идея.

</deferred>

---

*Phase: 03-build-docs*
*Context gathered: 2026-05-16*
