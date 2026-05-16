---
phase: 01-rust-vendoring
plan: 03
type: execute
wave: 3
depends_on: [01-01, 01-02]
files_modified:
  - Cargo.lock
  - crates/uni-common/src/lib.rs
  - crates/uni-process/src/process.rs
  - crates/uni-settings/src/store.rs
  - crates/uni-db/src/migrate.rs
  - crates/uni-db/src/pool.rs
  - crates/uni-db/src/transaction.rs
  - crates/uni-db/src/helpers.rs
  - crates/uni-ssh/src/manager.rs
  - crates/uni-terminal/src/manager.rs
  - crates/uni-terminal/src/shell.rs
autonomous: true
requirements: [RUST-08, RUST-09, RUST-10]

must_haves:
  truths:
    - "`Cargo.lock` не содержит ни одной подстроки `github.com/ts-vit/ai-chat` (regen прошёл)"
    - "В `Cargo.lock` для пакетов uni-common/uni-process/uni-settings/uni-db/uni-ssh/uni-terminal отсутствует поле `source = ...`, либо `source` указывает на локальный путь — это признак path-dependency"
    - "Команда `cargo build --workspace` завершается с exit code 0 без сетевого доступа к `github.com/ts-vit/ai-chat`"
    - "Команда `cargo test -p uni-claude-code` (тесты src-tauri) завершается с exit code 0"
    - "Команда `cargo test -p claude-code-core` завершается с exit code 0"
    - "Тесты внутри `uni-*` крейтов, которые падают по unrelated к нашему репо причинам, помечены атрибутом `#[ignore]` с комментарием `// TODO: re-enable after vendoring`; либо `cargo test --workspace` зелёный без правок"
    - "`cargo test --workspace` завершается с exit code 0 (после возможных `#[ignore]` правок)"
  artifacts:
    - path: "Cargo.lock"
      provides: "Регенерированный lockfile без git-источников ai-chat"
    - path: ".planning/phases/01-rust-vendoring/01-03-TEST-NOTES.md"
      provides: "Лог: какие тесты были помечены #[ignore] и почему (TODO trail)"
  key_links:
    - from: "Cargo.lock"
      to: "вендорированные uni-* крейты"
      via: "отсутствие source = git+... строк для uni-* пакетов"
      pattern: "^name = \"uni-(common|process|settings|db|ssh|terminal)\""
---

<objective>
Финальный шаг фазы Rust Vendoring: регенерировать `Cargo.lock` (чтобы он перестал ссылаться на `git+https://github.com/ts-vit/ai-chat`), запустить полную проверку сборки и тестов, и при необходимости пометить нестабильные тесты внутри вендорированных `uni-*` крейтов как `#[ignore]` с TODO-комментарием.

Покрывает требования RUST-08 (Cargo.lock чистый), RUST-09 (`cargo build --workspace` зелёный), RUST-10 (`cargo test --workspace` зелёный, либо нестабильные uni-* тесты изолированы).

Purpose: Установить Definition of Done всей фазы — репозиторий собирается и тестируется без сетевого доступа к ai-chat. Зафиксировать в `01-03-TEST-NOTES.md` точный список изменённых тестов (если такие будут), чтобы трассировать TODO в milestone v2 (см. MAINT-02 в REQUIREMENTS.md).

Output: Регенерированный `Cargo.lock` без git-источников ai-chat; зелёные `cargo build --workspace` и `cargo test --workspace`; TEST-NOTES.md (если применялся `#[ignore]`).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md

# Манифесты должны уже быть переписаны (Plan 02)
@Cargo.toml
@src-tauri/Cargo.toml
@crates/claude-code-core/Cargo.toml

# PROJECT.md → Constraints: «Тесты внутри вендорированных пакетов копируются "как есть";
# если они зависят от инфраструктуры ai-chat и падают по unrelated причинам — помечаются
# #[ignore] (Rust) с комментарием TODO». Это и есть авторизация на ignore-правки.

<interfaces>
<!-- Файлы внутри вендорированных крейтов, где по результатам Grep на #[test]/#[tokio::test]
     находятся тестовые модули. Если cargo test --workspace упадёт, кандидаты на #[ignore] — здесь.
     НЕ помечать #[ignore] превентивно: сначала запустить тесты, посмотреть, что падает, и
     только реально красные пометить. Зелёные не трогать. -->

uni-common      → src/lib.rs  (есть #[test])
uni-process     → src/process.rs  (есть #[test])
uni-settings    → src/store.rs  (есть #[test])
uni-db          → src/migrate.rs, src/pool.rs, src/transaction.rs, src/helpers.rs (есть #[test])
uni-ssh         → src/manager.rs  (есть #[test])
uni-terminal    → src/manager.rs, src/shell.rs  (есть #[test])

src-tauri и claude-code-core тесты ДОЛЖНЫ оставаться зелёными — их править нельзя.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Удалить устаревшие записи uni-* и регенерировать Cargo.lock</name>
  <files>Cargo.lock</files>
  <read_first>
    - D:\work-ai\uni-claude-code\Cargo.lock (текущий — содержит 6 записей `source = "git+https://github.com/ts-vit/ai-chat?branch=dev#..."` для uni-common/process/settings/db/ssh/terminal)
    - D:\work-ai\uni-claude-code\Cargo.toml (обновлённый workspace)
    - D:\work-ai\uni-claude-code\src-tauri\Cargo.toml (после Plan 02 — без git-ссылок)
    - D:\work-ai\uni-claude-code\crates\claude-code-core\Cargo.toml (после Plan 02 — без git-ссылок)
  </read_first>
  <action>
    Принудительно регенерировать `Cargo.lock` так, чтобы старые `git+https://github.com/ts-vit/ai-chat` записи исчезли и появились новые path-based записи (без `source = ...` для локальных крейтов).

    Способ:
    1. Удалить корневой `Cargo.lock` файл.
    2. Выполнить `cargo generate-lockfile` (или `cargo update --workspace`, или просто `cargo metadata --format-version 1` — любая из этих команд при отсутствии lockfile создаст новый).

    После генерации проверить, что в новом `Cargo.lock` нет подстроки `github.com/ts-vit/ai-chat` ни в одной строке.

    Если по какой-то причине регенерация не убирает старые ссылки (например, transitive cache), выполнить `cargo clean` затем повторить.

    НЕ выполнять `cargo build` на этом таске — он будет в Task 2. Цель этого таска — только lockfile.
  </action>
  <verify>
    <automated>powershell -NoProfile -Command "(Select-String -Path Cargo.lock -Pattern 'github.com/ts-vit/ai-chat' | Measure-Object).Count" — должно вернуть 0</automated>
  </verify>
  <acceptance_criteria>
    - Файл `Cargo.lock` существует
    - `grep -F 'github.com/ts-vit/ai-chat' Cargo.lock` exits non-zero (0 совпадений)
    - В `Cargo.lock` присутствуют записи `[[package]]` с `name = "uni-common"`, `"uni-process"`, `"uni-settings"`, `"uni-db"`, `"uni-ssh"`, `"uni-terminal"` (по одному вхождению на крейт)
    - Для этих 6 пакетов в `[[package]]` секциях отсутствует строка `source = "git+...ai-chat..."` (либо нет `source` вообще = path-dep, либо `source` указывает на registry — но не на ai-chat git)
    - `cargo metadata --format-version 1` завершается с exit code 0 (lockfile валидный)
  </acceptance_criteria>
  <done>Cargo.lock регенерирован, ни одной ссылки на `github.com/ts-vit/ai-chat` не осталось, lockfile валиден и `cargo metadata` без ошибок.</done>
</task>

<task type="auto">
  <name>Task 2: Запустить cargo build --workspace и cargo test --workspace, при необходимости пометить нестабильные uni-* тесты #[ignore]</name>
  <files>crates/uni-common/src/lib.rs, crates/uni-process/src/process.rs, crates/uni-settings/src/store.rs, crates/uni-db/src/migrate.rs, crates/uni-db/src/pool.rs, crates/uni-db/src/transaction.rs, crates/uni-db/src/helpers.rs, crates/uni-ssh/src/manager.rs, crates/uni-terminal/src/manager.rs, crates/uni-terminal/src/shell.rs, .planning/phases/01-rust-vendoring/01-03-TEST-NOTES.md</files>
  <read_first>
    - D:\work-ai\uni-claude-code\Cargo.lock (после Task 1 — должен быть чистый)
    - D:\work-ai\uni-claude-code\crates\uni-common\src\lib.rs
    - D:\work-ai\uni-claude-code\crates\uni-process\src\process.rs
    - D:\work-ai\uni-claude-code\crates\uni-settings\src\store.rs
    - D:\work-ai\uni-claude-code\crates\uni-db\src\migrate.rs
    - D:\work-ai\uni-claude-code\crates\uni-db\src\pool.rs
    - D:\work-ai\uni-claude-code\crates\uni-db\src\transaction.rs
    - D:\work-ai\uni-claude-code\crates\uni-db\src\helpers.rs
    - D:\work-ai\uni-claude-code\crates\uni-ssh\src\manager.rs
    - D:\work-ai\uni-claude-code\crates\uni-terminal\src\manager.rs
    - D:\work-ai\uni-claude-code\crates\uni-terminal\src\shell.rs
    - D:\work-ai\uni-claude-code\src-tauri\Cargo.toml (для понимания, что тестируется в src-tauri пакете)
    - D:\work-ai\uni-claude-code\crates\claude-code-core\src\lib.rs (структура claude-code-core, чтобы знать его тесты)
  </read_first>
  <action>
    Шаг A — build:
    1. Выполнить `cargo build --workspace` из корня репозитория. ОЖИДАНИЕ: exit code 0.
    2. Если build падает с ошибкой компиляции, проверить точную причину:
       - Если ошибка в манифесте (resolved path не существует) — это регрессия Plan 01/02, остановиться и сообщить.
       - Если ошибка типа «can't find crate uni_xxx» в `src-tauri/src/` или `crates/claude-code-core/src/` — это указывает на ошибку в Plan 02, остановиться и сообщить.
       - Если ошибка компиляции внутри вендорированного `uni-*` крейта (несовместимость с системными зависимостями) — НЕ маскировать, а сообщить с указанием файла. Эта фаза предполагает, что код собирается «как есть»; компиляционные ошибки — отдельный блокер.

    Шаг B — test src-tauri и claude-code-core (эти ДОЛЖНЫ быть зелёными):
    3. Выполнить `cargo test -p uni-claude-code`. ОЖИДАНИЕ: exit code 0.
    4. Выполнить `cargo test -p claude-code-core`. ОЖИДАНИЕ: exit code 0.
    Если эти упали — это блокер, остановиться и сообщить (PROJECT.md запрещает их править).

    Шаг C — test вендорированных крейтов:
    5. Выполнить `cargo test --workspace`. Если exit code 0 — переходить к Task 3 (без правок).
    6. Если упали тесты внутри `uni-*` крейтов (НЕ внутри `uni-claude-code` или `claude-code-core`):
       - Для каждого упавшего теста добавить ровно перед `#[test]` / `#[tokio::test]` атрибут `#[ignore]` и комментарий-строку:
         `// TODO: re-enable after vendoring — fails due to <короткая причина из вывода cargo test>`
       - Повторить `cargo test --workspace` пока exit code не станет 0.
       - Допустимо помечать `#[ignore]` ТОЛЬКО тесты внутри 6 вендорированных крейтов (файлы перечислены в `<read_first>`). Тесты `src-tauri` и `claude-code-core` помечать `#[ignore]` запрещено.

    Шаг D — фиксация TODO trail:
    7. Создать файл `.planning/phases/01-rust-vendoring/01-03-TEST-NOTES.md` со списком всех изменённых тестов:
       - Если правок не было — единственная строка `Все тесты прошли без правок.`
       - Если правки были — таблица: крейт | файл | имя теста | причина (из вывода cargo test). Это станет источником для MAINT-02 (re-enable in v2).
  </action>
  <verify>
    <automated>cargo build --workspace 1>NUL 2>NUL — exit code 0; cargo test -p uni-claude-code 1>NUL 2>NUL — exit code 0; cargo test -p claude-code-core 1>NUL 2>NUL — exit code 0; cargo test --workspace 1>NUL 2>NUL — exit code 0</automated>
  </verify>
  <acceptance_criteria>
    - `cargo build --workspace` exits 0
    - `cargo test -p uni-claude-code` exits 0
    - `cargo test -p claude-code-core` exits 0
    - `cargo test --workspace` exits 0
    - Если в каком-либо файле `crates/uni-*/src/*.rs` добавлен `#[ignore]`, то ровно над ним присутствует комментарий с подстрокой `TODO: re-enable after vendoring`
    - `#[ignore]` НЕ добавлен ни в один файл под `src-tauri/src/` или `crates/claude-code-core/src/`
    - Файл `.planning/phases/01-rust-vendoring/01-03-TEST-NOTES.md` существует и содержит либо строку `Все тесты прошли без правок.`, либо markdown-таблицу с колонками «Крейт», «Файл», «Тест», «Причина»
    - Команда `cargo build --workspace --offline` после удаления target/ (не обязательно, но проверочно) должна тоже пройти — все зависимости разрешаются локально (по path) или из локального cargo cache; реальной сети к `github.com/ts-vit/ai-chat` не требуется
  </acceptance_criteria>
  <done>`cargo build --workspace` и `cargo test --workspace` оба зелёные. Тесты `src-tauri` и `claude-code-core` прошли без `#[ignore]`-правок. TEST-NOTES.md фиксирует точный список изменённых (или отсутствие изменений).</done>
</task>

</tasks>

<verification>
End-to-end проверка успеха фазы 1:

1. `grep -F 'github.com/ts-vit/ai-chat' Cargo.toml src-tauri/Cargo.toml crates/claude-code-core/Cargo.toml Cargo.lock` — 0 совпадений во всех 4 файлах
2. `cargo build --workspace` — exit 0
3. `cargo test --workspace` — exit 0
4. Никаких изменений в `src/`, `src-tauri/src/`, `crates/claude-code-core/src/` (compatibility constraint: публичные API не менялись, импорты остались прежними)
5. (Опционально, для подтверждения offline-сборки) В отдельной попытке: `cargo clean && cargo build --workspace --offline` — exit 0 (если все registry-зависимости уже скачаны в локальный cargo cache)

Полное end-to-end на чистом клоне без сети — это задача Phase 3 (BUILD-05). Здесь мы доказываем только Rust-часть.
</verification>

<success_criteria>
Покрытие требований:
- RUST-08: `Cargo.lock` не содержит подстроку `github.com/ts-vit/ai-chat` ✓
- RUST-09: `cargo build --workspace` exits 0 без сети к ai-chat ✓
- RUST-10: `cargo test --workspace` exits 0; src-tauri и claude-code-core тесты зелёные без `#[ignore]`-правок; нестабильные `uni-*` тесты (если есть) изолированы через `#[ignore]` + TODO ✓

Фаза 1 завершена: ВСЕ Success Criteria из ROADMAP.md → Phase 1 → Success Criteria выполнены.
</success_criteria>

<output>
Создать `.planning/phases/01-rust-vendoring/01-03-SUMMARY.md` по завершении.
</output>
