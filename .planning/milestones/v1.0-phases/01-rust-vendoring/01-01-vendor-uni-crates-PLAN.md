---
phase: 01-rust-vendoring
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Cargo.toml
  - crates/uni-common/Cargo.toml
  - crates/uni-common/README.md
  - crates/uni-common/src/error.rs
  - crates/uni-common/src/id.rs
  - crates/uni-common/src/lib.rs
  - crates/uni-common/src/text.rs
  - crates/uni-common/src/time.rs
  - crates/uni-process/Cargo.toml
  - crates/uni-process/README.md
  - crates/uni-process/src/config.rs
  - crates/uni-process/src/events.rs
  - crates/uni-process/src/lib.rs
  - crates/uni-process/src/process.rs
  - crates/uni-settings/Cargo.toml
  - crates/uni-settings/README.md
  - crates/uni-settings/src/keys.rs
  - crates/uni-settings/src/lib.rs
  - crates/uni-settings/src/store.rs
  - crates/uni-db/Cargo.toml
  - crates/uni-db/src/error.rs
  - crates/uni-db/src/helpers.rs
  - crates/uni-db/src/lib.rs
  - crates/uni-db/src/migrate.rs
  - crates/uni-db/src/pool.rs
  - crates/uni-db/src/transaction.rs
  - crates/uni-ssh/Cargo.toml
  - crates/uni-ssh/README.md
  - crates/uni-ssh/src/forward.rs
  - crates/uni-ssh/src/handler.rs
  - crates/uni-ssh/src/lib.rs
  - crates/uni-ssh/src/manager.rs
  - crates/uni-ssh/src/proxy.rs
  - crates/uni-ssh/src/socks5.rs
  - crates/uni-ssh/src/types.rs
  - crates/uni-terminal/Cargo.toml
  - crates/uni-terminal/src/lib.rs
  - crates/uni-terminal/src/manager.rs
  - crates/uni-terminal/src/shell.rs
  - crates/uni-terminal/src/types.rs
autonomous: true
requirements: [RUST-01, RUST-02, RUST-03, RUST-04, RUST-05, RUST-06]

must_haves:
  truths:
    - "Каталог `crates/uni-common/` существует и содержит snapshot-копию исходника из `D:\\work-ai\\ai-chat\\crates\\uni-common/`"
    - "Каталог `crates/uni-process/` существует и содержит snapshot-копию исходника"
    - "Каталог `crates/uni-settings/` существует и содержит snapshot-копию исходника"
    - "Каталог `crates/uni-db/` существует и содержит snapshot-копию исходника"
    - "Каталог `crates/uni-ssh/` существует и содержит snapshot-копию исходника"
    - "Каталог `crates/uni-terminal/` существует и содержит snapshot-копию исходника"
    - "Корневой `Cargo.toml` объявляет все 6 новых крейтов в `[workspace] members`"
    - "Внутренние path-зависимости вендорированных крейтов (`uni-process` → `uni-common`, `uni-settings` → `uni-common`, `uni-db` → `uni-common`) резолвятся в новые локальные каталоги"
  artifacts:
    - path: "crates/uni-common/Cargo.toml"
      provides: "Манифест вендорированного uni-common"
      contains: "name = \"uni-common\""
    - path: "crates/uni-common/src/lib.rs"
      provides: "Точка входа крейта uni-common"
    - path: "crates/uni-process/Cargo.toml"
      provides: "Манифест вендорированного uni-process"
      contains: "uni-common"
    - path: "crates/uni-settings/Cargo.toml"
      provides: "Манифест вендорированного uni-settings"
      contains: "uni-common"
    - path: "crates/uni-db/Cargo.toml"
      provides: "Манифест вендорированного uni-db"
      contains: "uni-common"
    - path: "crates/uni-ssh/Cargo.toml"
      provides: "Манифест вендорированного uni-ssh"
      contains: "name = \"uni-ssh\""
    - path: "crates/uni-terminal/Cargo.toml"
      provides: "Манифест вендорированного uni-terminal"
      contains: "name = \"uni-terminal\""
    - path: "Cargo.toml"
      provides: "Обновлённый workspace-манифест с 6 новыми членами"
      contains: "crates/uni-common"
  key_links:
    - from: "Cargo.toml [workspace] members"
      to: "crates/uni-common, crates/uni-process, crates/uni-settings, crates/uni-db, crates/uni-ssh, crates/uni-terminal"
      via: "Список путей в workspace.members"
      pattern: "crates/uni-common"
    - from: "crates/uni-process/Cargo.toml"
      to: "crates/uni-common"
      via: "path = \"../uni-common\""
      pattern: "path = \"../uni-common\""
    - from: "crates/uni-settings/Cargo.toml"
      to: "crates/uni-common"
      via: "path = \"../uni-common\""
      pattern: "path = \"../uni-common\""
    - from: "crates/uni-db/Cargo.toml"
      to: "crates/uni-common"
      via: "path = \"../uni-common\""
      pattern: "path = \"../uni-common\""
---

<objective>
Перенести (snapshot-копией из `D:\work-ai\ai-chat\crates\<crate>\`) 6 крейтов `uni-*` в `crates/<crate>/` текущего репо и зарегистрировать их в `[workspace] members` корневого `Cargo.toml`.

Покрывает требования RUST-01..RUST-06 (по одному на каждый крейт).

Purpose: Создать локальные источники для path-зависимостей, которые в Plan 02 заменят git-ссылки в `src-tauri/Cargo.toml` и `crates/claude-code-core/Cargo.toml`. Без этого шага path-замены ссылались бы в пустоту.

Output: 6 каталогов `crates/uni-*/` со скопированным исходником и обновлённый корневой `Cargo.toml` с 8 членами workspace (было 2 — `src-tauri`, `crates/claude-code-core`; стало 8).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md

# Текущее состояние workspace
@Cargo.toml

# Source-of-truth манифесты вендорируемых крейтов (читать ПЕРЕД копированием — чтобы понимать, какие cross-deps на `uni-common` уже есть и в каком виде)
@D:\work-ai\ai-chat\crates\uni-common\Cargo.toml
@D:\work-ai\ai-chat\crates\uni-process\Cargo.toml
@D:\work-ai\ai-chat\crates\uni-settings\Cargo.toml
@D:\work-ai\ai-chat\crates\uni-db\Cargo.toml
@D:\work-ai\ai-chat\crates\uni-ssh\Cargo.toml
@D:\work-ai\ai-chat\crates\uni-terminal\Cargo.toml

<interfaces>
<!-- Cross-dep map внутри вендорируемых крейтов (выяснено из source Cargo.toml в ai-chat).
     Все внутренние ссылки уже используют path = "../uni-common" — относительная
     раскладка `crates/uni-*` в нашем репо совпадает с источником, поэтому копия
     валидна без правок этих path-ссылок. -->

uni-common      → нет uni-* зависимостей (лист графа)
uni-terminal    → нет uni-* зависимостей (лист графа)
uni-ssh         → нет uni-* зависимостей (лист графа)
uni-process     → uni-common (path = "../uni-common")
uni-settings    → uni-common (path = "../uni-common")
uni-db          → uni-common (path = "../uni-common")
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Скопировать 6 крейтов uni-* snapshot-ом из ai-chat</name>
  <files>crates/uni-common/, crates/uni-process/, crates/uni-settings/, crates/uni-db/, crates/uni-ssh/, crates/uni-terminal/</files>
  <read_first>
    - D:\work-ai\ai-chat\crates\uni-common\Cargo.toml
    - D:\work-ai\ai-chat\crates\uni-process\Cargo.toml
    - D:\work-ai\ai-chat\crates\uni-settings\Cargo.toml
    - D:\work-ai\ai-chat\crates\uni-db\Cargo.toml
    - D:\work-ai\ai-chat\crates\uni-ssh\Cargo.toml
    - D:\work-ai\ai-chat\crates\uni-terminal\Cargo.toml
    - D:\work-ai\uni-claude-code\Cargo.toml (текущая раскладка workspace)
  </read_first>
  <action>
    Рекурсивно скопировать (snapshot) содержимое каждого исходного каталога в целевой:

    1. `D:\work-ai\ai-chat\crates\uni-common\`     → `D:\work-ai\uni-claude-code\crates\uni-common\`
    2. `D:\work-ai\ai-chat\crates\uni-process\`    → `D:\work-ai\uni-claude-code\crates\uni-process\`
    3. `D:\work-ai\ai-chat\crates\uni-settings\`   → `D:\work-ai\uni-claude-code\crates\uni-settings\`
    4. `D:\work-ai\ai-chat\crates\uni-db\`         → `D:\work-ai\uni-claude-code\crates\uni-db\`
    5. `D:\work-ai\ai-chat\crates\uni-ssh\`        → `D:\work-ai\uni-claude-code\crates\uni-ssh\`
    6. `D:\work-ai\ai-chat\crates\uni-terminal\`   → `D:\work-ai\uni-claude-code\crates\uni-terminal\`

    Копировать ВСЁ содержимое: `Cargo.toml`, `README.md` (где есть), весь `src/`. Исключить (если присутствует в источнике): `target/`, `Cargo.lock`, `.git/`, `node_modules/` — этих артефактов в текущих исходных каталогах нет согласно Glob-инспекции, но защита остаётся.

    Использовать на Windows PowerShell `Copy-Item -Recurse -Force` либо аналог в Bash (`cp -R`). Не модифицировать содержимое файлов на этом шаге — копирование строго побайтное.

    После копирования НЕ менять `path = "../uni-common"` внутренние ссылки в `crates/uni-process/Cargo.toml`, `crates/uni-settings/Cargo.toml`, `crates/uni-db/Cargo.toml` — они уже корректны, так как относительная раскладка `crates/uni-*` сохранена (см. секцию interfaces выше).
  </action>
  <verify>
    <automated>powershell -NoProfile -Command "Get-ChildItem crates/uni-common,crates/uni-process,crates/uni-settings,crates/uni-db,crates/uni-ssh,crates/uni-terminal -Filter Cargo.toml | Measure-Object | Select-Object -ExpandProperty Count" — должно вернуть 6</automated>
  </verify>
  <acceptance_criteria>
    - Файл `crates/uni-common/Cargo.toml` существует и содержит строку `name = "uni-common"`
    - Файл `crates/uni-common/src/lib.rs` существует
    - Файл `crates/uni-process/Cargo.toml` существует, содержит `name = "uni-process"` и `path = "../uni-common"`
    - Файл `crates/uni-settings/Cargo.toml` существует, содержит `name = "uni-settings"` и `path = "../uni-common"`
    - Файл `crates/uni-db/Cargo.toml` существует, содержит `name = "uni-db"` и `path = "../uni-common"`
    - Файл `crates/uni-ssh/Cargo.toml` существует и содержит `name = "uni-ssh"`
    - Файл `crates/uni-terminal/Cargo.toml` существует и содержит `name = "uni-terminal"`
    - Каждая директория `crates/uni-*/src/` содержит как минимум `lib.rs`
    - В скопированных файлах нет ни одной ссылки `git = "https://github.com/ts-vit/ai-chat"` (проверка: `grep -r "github.com/ts-vit/ai-chat" crates/uni-common crates/uni-process crates/uni-settings crates/uni-db crates/uni-ssh crates/uni-terminal` возвращает пусто)
  </acceptance_criteria>
  <done>6 каталогов `crates/uni-*/` существуют, в каждом валидный `Cargo.toml` с правильным `name`, исходники в `src/` присутствуют, внутренние path-ссылки на `uni-common` сохранены.</done>
</task>

<task type="auto">
  <name>Task 2: Зарегистрировать 6 крейтов в workspace members корневого Cargo.toml</name>
  <files>Cargo.toml</files>
  <read_first>
    - D:\work-ai\uni-claude-code\Cargo.toml (текущий контент: members = ["src-tauri", "crates/claude-code-core"])
  </read_first>
  <action>
    Отредактировать корневой `Cargo.toml`: расширить массив `[workspace] members` так, чтобы он содержал ровно 8 элементов в следующем порядке:

    1. `src-tauri`
    2. `crates/claude-code-core`
    3. `crates/uni-common`
    4. `crates/uni-process`
    5. `crates/uni-settings`
    6. `crates/uni-db`
    7. `crates/uni-ssh`
    8. `crates/uni-terminal`

    Сохранить существующую строку `resolver = "2"`. Никаких других правок в этом файле НЕ делать — `[workspace.dependencies]` не вводить (источник в `ai-chat` тоже не использовал его, см. контекст).

    После сохранения убедиться, что файл синтаксически валидный TOML (например, через `cargo metadata --no-deps --format-version 1 --offline` либо `cargo metadata --no-deps --format-version 1`; код возврата 0 = TOML валидный и workspace разрешается).
  </action>
  <verify>
    <automated>cargo metadata --no-deps --format-version 1 --manifest-path Cargo.toml 1>NUL 2>NUL — exit code 0; и powershell -NoProfile -Command "(Select-String -Path Cargo.toml -Pattern 'crates/uni-common|crates/uni-process|crates/uni-settings|crates/uni-db|crates/uni-ssh|crates/uni-terminal' | Measure-Object).Count" вернёт 6</automated>
  </verify>
  <acceptance_criteria>
    - Файл `Cargo.toml` корня содержит подстроку `"crates/uni-common"` (внутри массива members)
    - Файл `Cargo.toml` содержит подстроки `"crates/uni-process"`, `"crates/uni-settings"`, `"crates/uni-db"`, `"crates/uni-ssh"`, `"crates/uni-terminal"`
    - Файл `Cargo.toml` сохраняет существующие записи `"src-tauri"` и `"crates/claude-code-core"`
    - Файл `Cargo.toml` сохраняет строку `resolver = "2"`
    - Команда `cargo metadata --no-deps --format-version 1` завершается с exit code 0 (workspace разрешается без ошибок)
    - В выводе `cargo metadata --no-deps --format-version 1` присутствуют пакеты с `"name": "uni-common"`, `"uni-process"`, `"uni-settings"`, `"uni-db"`, `"uni-ssh"`, `"uni-terminal"` (по одному вхождению на крейт)
  </acceptance_criteria>
  <done>Корневой `Cargo.toml` содержит 8 членов workspace; `cargo metadata --no-deps` успешно разрешает workspace и видит все 6 новых крейтов как локальные пакеты.</done>
</task>

</tasks>

<verification>
- Все 6 каталогов `crates/uni-*/` существуют и содержат `Cargo.toml` + хотя бы `src/lib.rs`
- Корневой `Cargo.toml` перечисляет все 6 новых крейтов в `members`
- `cargo metadata --no-deps --format-version 1` завершается с exit code 0
- Команда `grep -r "github.com/ts-vit/ai-chat" crates/uni-*` (для 6 новых крейтов) ничего не находит — внутренние ссылки уже корректные path-зависимости
- `src-tauri/Cargo.toml` и `crates/claude-code-core/Cargo.toml` пока НЕ изменены — это задача Plan 02
</verification>

<success_criteria>
Покрытие требований:
- RUST-01: `crates/uni-common/` существует + в workspace.members ✓
- RUST-02: `crates/uni-process/` существует + в workspace.members ✓
- RUST-03: `crates/uni-settings/` существует + в workspace.members ✓
- RUST-04: `crates/uni-db/` существует + в workspace.members ✓
- RUST-05: `crates/uni-ssh/` существует + в workspace.members ✓
- RUST-06: `crates/uni-terminal/` существует + в workspace.members ✓

Workspace разрешается через `cargo metadata --no-deps` без ошибок (но НЕ выполняем `cargo build` — `src-tauri` и `claude-code-core` пока ссылаются на git-источник, build будет в Plan 03).
</success_criteria>

<output>
Создать `.planning/phases/01-rust-vendoring/01-01-SUMMARY.md` по завершении.
</output>
