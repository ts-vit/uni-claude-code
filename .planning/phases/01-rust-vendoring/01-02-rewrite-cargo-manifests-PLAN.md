---
phase: 01-rust-vendoring
plan: 02
type: execute
wave: 2
depends_on: [01-01]
files_modified:
  - src-tauri/Cargo.toml
  - crates/claude-code-core/Cargo.toml
autonomous: true
requirements: [RUST-07]

must_haves:
  truths:
    - "В `src-tauri/Cargo.toml` нет ни одной строки с `git = \"https://github.com/ts-vit/ai-chat\"`"
    - "В `crates/claude-code-core/Cargo.toml` нет ни одной строки с `git = \"https://github.com/ts-vit/ai-chat\"`"
    - "Каждая `uni-*` зависимость в `src-tauri/Cargo.toml` записана как `path = \"../crates/<crate>\"`"
    - "Каждая `uni-*` зависимость в `crates/claude-code-core/Cargo.toml` записана как `path = \"../<crate>\"`"
    - "Публичные имена крейтов в зависимостях не меняются — импорты `use uni_common::...`, `use uni_settings::...` и пр. в `src-tauri/src/` и `crates/claude-code-core/src/` продолжают резолвиться"
  artifacts:
    - path: "src-tauri/Cargo.toml"
      provides: "Манифест tauri-приложения с path-зависимостями на 5 крейтов uni-*"
      contains: "path = \"../crates/uni-common\""
    - path: "crates/claude-code-core/Cargo.toml"
      provides: "Манифест claude-code-core с path-зависимостями на 2 крейта uni-*"
      contains: "path = \"../uni-common\""
  key_links:
    - from: "src-tauri/Cargo.toml"
      to: "crates/uni-common, crates/uni-settings, crates/uni-ssh, crates/uni-terminal, crates/uni-db"
      via: "path = \"../crates/<crate>\""
      pattern: "path = \"../crates/uni-"
    - from: "crates/claude-code-core/Cargo.toml"
      to: "crates/uni-common, crates/uni-process"
      via: "path = \"../uni-common\" и path = \"../uni-process\""
      pattern: "path = \"../uni-"
---

<objective>
Заменить в двух манифестах все 7 ссылок `git = "https://github.com/ts-vit/ai-chat", branch = "dev"` на локальные `path = "../<...>/<crate>"` зависимости. После этого ни один манифест workspace не должен ссылаться на приватный git-репозиторий.

Покрывает требование RUST-07.

Purpose: Зависимости теперь резолвятся в локальные крейты, вкопированные на шаге Plan 01. Это финальное звено в графе «копия → workspace member → path-зависимость» для устранения SPOF приватного git-репо.

Output: Два отредактированных манифеста — `src-tauri/Cargo.toml` (5 ссылок заменены) и `crates/claude-code-core/Cargo.toml` (2 ссылки заменены). `Cargo.lock` пока не трогаем — его регенерация в Plan 03.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md

# Текущие манифесты с git-ссылками (нужно прочитать ПЕРЕД редактированием — чтобы видеть точные строки)
@src-tauri/Cargo.toml
@crates/claude-code-core/Cargo.toml

# Корневой workspace должен уже содержать новые crate paths (создан в Plan 01)
@Cargo.toml

<interfaces>
<!-- Маппинг git-зависимостей на path-замены.
     Относительные пути считаются ОТ КАТАЛОГА, где лежит редактируемый Cargo.toml. -->

src-tauri/Cargo.toml (находится в src-tauri/, относительный путь к crates/ — "../crates/")
  uni-common    = { git = "...ai-chat", branch = "dev" }  →  uni-common    = { path = "../crates/uni-common" }
  uni-settings  = { git = "...ai-chat", branch = "dev" }  →  uni-settings  = { path = "../crates/uni-settings" }
  uni-ssh       = { git = "...ai-chat", branch = "dev" }  →  uni-ssh       = { path = "../crates/uni-ssh" }
  uni-terminal  = { git = "...ai-chat", branch = "dev" }  →  uni-terminal  = { path = "../crates/uni-terminal" }
  uni-db        = { git = "...ai-chat", branch = "dev" }  →  uni-db        = { path = "../crates/uni-db" }

crates/claude-code-core/Cargo.toml (находится в crates/claude-code-core/, относительный путь к sibling crates — "../")
  uni-common  = { git = "...ai-chat", branch = "dev" }  →  uni-common  = { path = "../uni-common" }
  uni-process = { git = "...ai-chat", branch = "dev" }  →  uni-process = { path = "../uni-process" }
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Заменить 5 git-ссылок на path в src-tauri/Cargo.toml</name>
  <files>src-tauri/Cargo.toml</files>
  <read_first>
    - D:\work-ai\uni-claude-code\src-tauri\Cargo.toml (текущее содержимое — секции `# UNI Framework — core` и `# UNI Framework — modules`, строки с `git = "https://github.com/ts-vit/ai-chat", branch = "dev"`)
    - D:\work-ai\uni-claude-code\Cargo.toml (убедиться, что workspace.members уже содержит 6 новых крейтов — это предусловие)
  </read_first>
  <action>
    В `src-tauri/Cargo.toml` отредактировать 5 строк, заменив `git = "https://github.com/ts-vit/ai-chat", branch = "dev"` на корректный `path` относительно каталога `src-tauri/`:

    Строка `uni-common = { git = "https://github.com/ts-vit/ai-chat", branch = "dev" }` → `uni-common = { path = "../crates/uni-common" }`

    Строка `uni-settings = { git = "https://github.com/ts-vit/ai-chat", branch = "dev" }` → `uni-settings = { path = "../crates/uni-settings" }`

    Строка `uni-ssh = { git = "https://github.com/ts-vit/ai-chat", branch = "dev" }` → `uni-ssh = { path = "../crates/uni-ssh" }`

    Строка `uni-terminal = { git = "https://github.com/ts-vit/ai-chat", branch = "dev" }` → `uni-terminal = { path = "../crates/uni-terminal" }`

    Строка `uni-db = { git = "https://github.com/ts-vit/ai-chat", branch = "dev" }` → `uni-db = { path = "../crates/uni-db" }`

    Сохранить:
    - все остальные строки файла без изменений (включая `[package]`, `[lib]`, `[build-dependencies]`, остальные `[dependencies]`, `tauri = ...`, `sqlx = ...`, `claude-code-core = { path = "../crates/claude-code-core" }` — последняя строка уже path-зависимость, её НЕ трогать)
    - комментарии-заголовки `# UNI Framework — core` и `# UNI Framework — modules`

    НЕ вводить `[workspace.dependencies]` и не переоформлять зависимости через `.workspace = true` — придерживаемся плоского path-стиля, как у `claude-code-core` (последняя строка файла).
  </action>
  <verify>
    <automated>powershell -NoProfile -Command "(Select-String -Path src-tauri/Cargo.toml -Pattern 'github.com/ts-vit/ai-chat' | Measure-Object).Count" — должно вернуть 0; и powershell -NoProfile -Command "(Select-String -Path src-tauri/Cargo.toml -Pattern 'path = \"../crates/uni-' | Measure-Object).Count" — должно вернуть 5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -F 'github.com/ts-vit/ai-chat' src-tauri/Cargo.toml` exits non-zero (нет совпадений)
    - `grep -F 'path = "../crates/uni-common"' src-tauri/Cargo.toml` exits 0
    - `grep -F 'path = "../crates/uni-settings"' src-tauri/Cargo.toml` exits 0
    - `grep -F 'path = "../crates/uni-ssh"' src-tauri/Cargo.toml` exits 0
    - `grep -F 'path = "../crates/uni-terminal"' src-tauri/Cargo.toml` exits 0
    - `grep -F 'path = "../crates/uni-db"' src-tauri/Cargo.toml` exits 0
    - Строка `claude-code-core = { path = "../crates/claude-code-core" }` сохранена без изменений
    - Строки `tauri = { version = "2"`, `tauri-plugin-shell = "2"`, `tauri-plugin-dialog = "2"`, `serde = `, `serde_json = `, `tokio = `, `sqlx = `, `dirs = `, `arboard = `, `image = `, `chrono = ` присутствуют (общий состав зависимостей не изменён)
    - `cargo metadata --no-deps --format-version 1 --manifest-path src-tauri/Cargo.toml` завершается с exit code 0
  </acceptance_criteria>
  <done>В `src-tauri/Cargo.toml` 5 git-зависимостей превращены в path-зависимости с корректным относительным путём `../crates/uni-<name>`; `cargo metadata` без ошибок.</done>
</task>

<task type="auto">
  <name>Task 2: Заменить 2 git-ссылки на path в crates/claude-code-core/Cargo.toml</name>
  <files>crates/claude-code-core/Cargo.toml</files>
  <read_first>
    - D:\work-ai\uni-claude-code\crates\claude-code-core\Cargo.toml (текущее содержимое — строки с `uni-common` и `uni-process`, обе через git)
  </read_first>
  <action>
    В `crates/claude-code-core/Cargo.toml` отредактировать 2 строки, заменив `git = "https://github.com/ts-vit/ai-chat", branch = "dev"` на корректный `path` относительно каталога `crates/claude-code-core/`:

    Строка `uni-common = { git = "https://github.com/ts-vit/ai-chat", branch = "dev" }` → `uni-common = { path = "../uni-common" }`

    Строка `uni-process = { git = "https://github.com/ts-vit/ai-chat", branch = "dev" }` → `uni-process = { path = "../uni-process" }`

    Сохранить:
    - `[package]` секцию (name, version, edition, description, license)
    - остальные строки `[dependencies]`: `serde`, `serde_json`, `tracing`
  </action>
  <verify>
    <automated>powershell -NoProfile -Command "(Select-String -Path crates/claude-code-core/Cargo.toml -Pattern 'github.com/ts-vit/ai-chat' | Measure-Object).Count" — должно вернуть 0; и powershell -NoProfile -Command "(Select-String -Path crates/claude-code-core/Cargo.toml -Pattern 'path = \"../uni-' | Measure-Object).Count" — должно вернуть 2</automated>
  </verify>
  <acceptance_criteria>
    - `grep -F 'github.com/ts-vit/ai-chat' crates/claude-code-core/Cargo.toml` exits non-zero
    - `grep -F 'path = "../uni-common"' crates/claude-code-core/Cargo.toml` exits 0
    - `grep -F 'path = "../uni-process"' crates/claude-code-core/Cargo.toml` exits 0
    - Строки `serde = { version = "1", features = ["derive"] }`, `serde_json = "1"`, `tracing = "0.1"` сохранены
    - `[package]` секция (name = "claude-code-core", version = "0.1.0", edition = "2021") сохранена
    - `cargo metadata --no-deps --format-version 1 --manifest-path crates/claude-code-core/Cargo.toml` завершается с exit code 0
  </acceptance_criteria>
  <done>В `crates/claude-code-core/Cargo.toml` обе git-зависимости превращены в path-зависимости (`../uni-common`, `../uni-process`); `cargo metadata` без ошибок.</done>
</task>

</tasks>

<verification>
- В обоих манифестах нет ни одной строки с `github.com/ts-vit/ai-chat`
- Все 7 замен на `path = "../..."` присутствуют и указывают на существующие каталоги (созданные в Plan 01)
- `cargo metadata --no-deps --format-version 1` для всего workspace (запускать из корня) завершается с exit code 0
- Команда `grep -r "github.com/ts-vit/ai-chat" Cargo.toml src-tauri/Cargo.toml crates/` возвращает совпадения ТОЛЬКО внутри `Cargo.lock` (его обновим в Plan 03) — ни одного `.toml` манифеста среди матчей быть не должно
</verification>

<success_criteria>
Покрытие требований:
- RUST-07: Все 7 git-ссылок (5 в src-tauri + 2 в claude-code-core) заменены на path ✓

Workspace разрешается через `cargo metadata --no-deps` полностью оффлайн. Сборка и тесты — задача Plan 03.
</success_criteria>

<output>
Создать `.planning/phases/01-rust-vendoring/01-02-SUMMARY.md` по завершении.
</output>
