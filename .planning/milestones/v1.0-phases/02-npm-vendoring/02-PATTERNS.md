# Phase 02: npm Vendoring — Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 7 групп файлов / правок (3 snapshot-копии пакетов + 3 правки конфигов корня + 1 файл-удаление)
**Analogs found:** 7 / 7 (все паттерны имеют точный прецедент в Phase 1)

## File Classification

Все файлы Phase 2 — это infrastructure / build-config артефакты, не runtime-код. Классификация по «role» использует категории `snapshot-copy`, `manifest-edit`, `lockfile-regen`, `config-delete`; по «data flow» — `build-time-resolution` (как файлы участвуют в резолве зависимостей при сборке).

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/uni-fw-ui/**` (snapshot целиком) | snapshot-copy (npm package) | build-time-resolution (workspace symlink) | `crates/uni-common/**` (Plan 01-01) | exact (snapshot побайтная из ai-chat в дочерний каталог) |
| `packages/uni-fw-ssh-ui/**` | snapshot-copy (npm package) | build-time-resolution | `crates/uni-ssh/**` (Plan 01-01) | exact |
| `packages/uni-fw-terminal-ui/**` | snapshot-copy (npm package) | build-time-resolution | `crates/uni-terminal/**` (Plan 01-01) | exact |
| `package.json` (корень) — `"workspaces"` + `"@uni-fw/*": "workspace:*"` | manifest-edit (workspace declaration + dep rewrite) | build-time-resolution | `Cargo.toml` (Plan 01-01, Task 2) + `src-tauri/Cargo.toml` (Plan 01-02, Task 1) | exact (комбинация двух Rust-паттернов) |
| `package-lock.json` (регенерация) | lockfile-regen | build-time-resolution | `Cargo.lock` (Plan 01-03, Task 1) | exact |
| `.npmrc` (удалить) | config-delete | build-time-resolution | (нет аналога в Phase 1 — Rust git-source жил только в манифестах, не в отдельном конфиге) | role-match через семантику «убрать SPOF-источник» |
| `CLAUDE.md` (упоминание `@uni-fw/*`) | doc-edit (отложено в Phase 3 / BUILD-06) | n/a | n/a — out of scope текущей фазы | n/a |

**Read-only анализ:** для каждой строки таблицы извлечён конкретный excerpt из аналога ниже, planner копирует его 1-в-1 в action соответствующего плана.

## Pattern Assignments

### `packages/uni-fw-ui/**` (snapshot-copy, build-time-resolution)

**Analog:** `crates/uni-common/**` (Plan 01-01, Task 1)

**Source-of-truth копирование** — `01-01-vendor-uni-crates-PLAN.md` lines 166-179:

```text
Рекурсивно скопировать (snapshot) содержимое каждого исходного каталога в целевой:

  1. `D:\work-ai\ai-chat\crates\uni-common\`     → `D:\work-ai\uni-claude-code\crates\uni-common\`
  2. `D:\work-ai\ai-chat\crates\uni-process\`    → `D:\work-ai\uni-claude-code\crates\uni-process\`
  ...

Копировать ВСЁ содержимое: `Cargo.toml`, `README.md` (где есть), весь `src/`.
Исключить (если присутствует в источнике): `target/`, `Cargo.lock`, `.git/`, `node_modules/` —
этих артефактов в текущих исходных каталогах нет согласно Glob-инспекции, но защита остаётся.

Использовать на Windows PowerShell `Copy-Item -Recurse -Force` либо аналог в Bash (`cp -R`).
Не модифицировать содержимое файлов на этом шаге — копирование строго побайтное.
```

**Применить для Phase 2** (по аналогии):

```text
1. `D:\work-ai\ai-chat\packages\uni-ui\`          → `D:\work-ai\uni-claude-code\packages\uni-fw-ui\`
2. `D:\work-ai\ai-chat\packages\uni-ssh-ui\`      → `D:\work-ai\uni-claude-code\packages\uni-fw-ssh-ui\`
3. `D:\work-ai\ai-chat\packages\uni-terminal-ui\` → `D:\work-ai\uni-claude-code\packages\uni-fw-terminal-ui\`

Копировать ВСЁ: package.json, README.md, .npmignore, tsconfig.json, tsconfig.build.json,
tsup.config.ts, vitest.config.ts, весь src/ (включая __tests__/, styles/, components/, modules/, ...).
Исключить: node_modules/, dist/ — этих каталогов в источнике нет (CONTEXT.md D-09 подтверждает).

Snapshot побайтная — НЕ редактировать repository/homepage поля в package.json (CONTEXT.md D-07).
```

**Состав каталогов источника** (проверено `Get-ChildItem` 2026-05-16):

```text
D:\work-ai\ai-chat\packages\uni-ui\
  src/  (components/ modules/ settings/ styles/ theme/ __tests__/ index.ts)
  .npmignore  package.json  README.md
  tsconfig.build.json  tsconfig.json
  tsup.config.ts  vitest.config.ts

D:\work-ai\ai-chat\packages\uni-ssh-ui\
  src/  (__tests__/ index.ts SshTunnelSettings.tsx types.ts useSshTunnel.ts)
  .npmignore  package.json  README.md
  tsconfig.build.json  tsconfig.json
  tsup.config.ts  vitest.config.ts

D:\work-ai\ai-chat\packages\uni-terminal-ui\
  src/  (__tests__/ index.ts TerminalPanel.tsx themes.ts types.ts)
  .npmignore  package.json  README.md
  tsconfig.build.json  tsconfig.json
  tsup.config.ts  vitest.config.ts
```

**Метаданные «как есть»** — `01-01-SUMMARY.md` Decisions Made, lines 107:

```text
Snapshot-копия побайтная — метаданные `repository = "https://github.com/ts-vit/ai-chat"`
и `homepage = "..."` в исходных манифестах оставлены как есть. Это документационные поля
(rustdoc/crates.io метадата), не источник зависимости — `git = "..."` записей в манифестах
вендорированных крейтов НЕТ.
```

Для npm-пакетов те же поля присутствуют (см. `D:\work-ai\ai-chat\packages\uni-ui\package.json` lines 8-13):

```json
"repository": {
  "type": "git",
  "url": "https://github.com/ts-vit/ai-chat",
  "directory": "packages/uni-ui"
},
"homepage": "https://github.com/ts-vit/ai-chat/tree/main/packages/uni-ui",
```

— оставить «как есть» (CONTEXT.md D-07).

**Verification pattern** — копировать из `01-01-PLAN.md` Task 1 `<verify>` lines 182:

```text
Перенести на npm-структуру:
powershell -NoProfile -Command "Get-ChildItem packages/uni-fw-ui,packages/uni-fw-ssh-ui,packages/uni-fw-terminal-ui -Filter package.json | Measure-Object | Select-Object -ExpandProperty Count" — должно вернуть 3
```

**PowerShell от Bash-tool — workaround** (унаследовано из `01-01-SUMMARY.md` lines 119):

```text
Issues Encountered: PowerShell `$`-переменные в Bash-обёртке — первая попытка скопировать
крейты через inline `powershell -Command "...$var..."` была съедена Git Bash. Workaround:
записал PowerShell-скрипт во временный файл `.tmp-copy-crates.ps1`, выполнил его через
`powershell -ExecutionPolicy Bypass -File`, потом удалил.
```

Planner Phase 2 должен ЗАРАНЕЕ инструктировать executor использовать temp-script подход (или `cp -R` под Bash, поскольку в WSL/Git Bash доступен).

---

### `packages/uni-fw-ssh-ui/**` (snapshot-copy, build-time-resolution)

**Analog:** `crates/uni-ssh/**` (Plan 01-01, Task 1)

Полная аналогия с предыдущим разделом. Дополнительная специфика: `@uni-fw/ssh-ui` имеет `peerDependencies."@uni-fw/ui": "*"` — cross-package peer внутри workspace, разрешается тем же symlink-механизмом (CONTEXT.md «Cross-package peer»).

**Прецедент для cross-deps между вендорированными артефактами** — `01-01-PLAN.md` interfaces (lines 138-148):

```text
uni-process     → uni-common (path = "../uni-common")
uni-settings    → uni-common (path = "../uni-common")
uni-db          → uni-common (path = "../uni-common")
```

`01-01-PLAN.md` Task 1 action lines 178-179:

```text
После копирования НЕ менять `path = "../uni-common"` внутренние ссылки в
`crates/uni-process/Cargo.toml`, `crates/uni-settings/Cargo.toml`, `crates/uni-db/Cargo.toml`
— они уже корректны, так как относительная раскладка `crates/uni-*` сохранена.
```

**Для Phase 2:** аналогично — не править `peerDependencies."@uni-fw/ui"` внутри `packages/uni-fw-ssh-ui/package.json`; workspace npm 7+ резолвит peer на sibling-пакет автоматически.

---

### `packages/uni-fw-terminal-ui/**` (snapshot-copy, build-time-resolution)

**Analog:** `crates/uni-terminal/**` (Plan 01-01, Task 1)

Полная аналогия. Специфика: peer-deps `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links` (см. `D:\work-ai\ai-chat\packages\uni-terminal-ui\package.json` lines 51-53) — это transitive-зависимости публичного npm-реестра, не приватного. После удаления `.npmrc` они продолжат тянуться из public npm (CONTEXT.md: «Сетевой доступ к публичным реестрам npm/crates.io остаётся допустимым»). Researcher должен проверить, надо ли поднимать их в `dependencies` корневого `package.json` явно.

---

### `package.json` (корень) — добавить `"workspaces"` + переписать `@uni-fw/*` на `"workspace:*"`

Это **два паттерна в одном файле**: (a) объявить workspace; (b) переписать deps на локальный источник. Phase 1 разносила эти два шага по разным манифестам (`Cargo.toml` корня vs. `src-tauri/Cargo.toml`), но семантически они идентичны.

#### Паттерн (a): объявление workspace

**Analog:** корневой `Cargo.toml` (Plan 01-01, Task 2)

**Current state корневого `Cargo.toml`** (после Phase 1, lines 1-12):

```toml
[workspace]
members = [
    "src-tauri",
    "crates/claude-code-core",
    "crates/uni-common",
    "crates/uni-process",
    "crates/uni-settings",
    "crates/uni-db",
    "crates/uni-ssh",
    "crates/uni-terminal",
]
resolver = "2"
```

**Action excerpt** — `01-01-PLAN.md` Task 2 lines 204-218:

```text
Отредактировать корневой `Cargo.toml`: расширить массив `[workspace] members` так,
чтобы он содержал ровно 8 элементов в следующем порядке:
  1. `src-tauri`
  2. `crates/claude-code-core`
  3. `crates/uni-common`
  4. `crates/uni-process`
  ...

Сохранить существующую строку `resolver = "2"`. Никаких других правок в этом файле НЕ делать —
`[workspace.dependencies]` не вводить (источник в `ai-chat` тоже не использовал его).
```

**Для Phase 2** (по аналогии, target форма корневого `package.json`):

```json
{
  "name": "uni-claude-code",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  ...
}
```

Никаких `nohoist`/`hoist`-overrides, поведение npm по умолчанию (CONTEXT.md D-10). Это прямая параллель «никаких `[workspace.dependencies]` не вводим» из Phase 1.

#### Паттерн (b): переписать deps на локальный источник

**Analog:** `src-tauri/Cargo.toml` (Plan 01-02, Task 1)

**Current state `src-tauri/Cargo.toml`** lines 21-28 (после Phase 1):

```toml
# UNI Framework — core
uni-common = { path = "../crates/uni-common" }
uni-settings = { path = "../crates/uni-settings" }

# UNI Framework — modules
uni-ssh = { path = "../crates/uni-ssh" }
uni-terminal = { path = "../crates/uni-terminal" }
uni-db = { path = "../crates/uni-db" }
```

**Action excerpt** — `01-02-PLAN.md` Task 1 lines 92-108:

```text
В `src-tauri/Cargo.toml` отредактировать 5 строк, заменив
`git = "https://github.com/ts-vit/ai-chat", branch = "dev"`
на корректный `path` относительно каталога `src-tauri/`:

Строка `uni-common = { git = "...", branch = "dev" }` → `uni-common = { path = "../crates/uni-common" }`
...

НЕ вводить `[workspace.dependencies]` и не переоформлять зависимости через `.workspace = true` —
придерживаемся плоского path-стиля, как у `claude-code-core` (последняя строка файла).
```

**Current state корневого `package.json`** lines 17-33 (до Phase 2):

```json
"dependencies": {
  "@mantine/core": "^8.3.15",
  ...
  "@uni-fw/ssh-ui": "^0.1.2",
  "@uni-fw/terminal-ui": "^0.1.5",
  "@uni-fw/ui": "^0.1.0",
  ...
}
```

**Для Phase 2** — переписать 3 строки (CONTEXT.md D-04):

```json
"dependencies": {
  ...
  "@uni-fw/ssh-ui": "workspace:*",
  "@uni-fw/terminal-ui": "workspace:*",
  "@uni-fw/ui": "workspace:*",
  ...
}
```

Это полный аналог `git=...` → `path=...` замены из Plan 01-02, в npm-терминологии: внешний-registry-versioned-spec → `workspace:*` локальный-spec.

**Minimum-disturbance принцип** — `01-02-SUMMARY.md` Decisions, lines 83:

```text
Плоский path-стиль сохранён — план явно запрещал переход на `[workspace.dependencies]`
+ `.workspace = true`. Это разумно: соответствует существующей строке `claude-code-core`,
минимизирует diff и не затрагивает структуру TOML.
```

Для Phase 2 эквивалент: НЕ использовать сложные `overrides`/`peerDependenciesMeta` без необходимости (CONTEXT.md «Established Patterns»). Просто `workspace:*`, ничего больше.

**Verification pattern** — `01-02-PLAN.md` Task 1 verify lines 111:

```text
powershell -NoProfile -Command
  "(Select-String -Path src-tauri/Cargo.toml -Pattern 'github.com/ts-vit/ai-chat' | Measure-Object).Count"
— должно вернуть 0;
и
  "(Select-String -Path src-tauri/Cargo.toml -Pattern 'path = \"../crates/uni-' | Measure-Object).Count"
— должно вернуть 5
```

**Для Phase 2** (по аналогии):

```text
powershell -NoProfile -Command "(Select-String -Path package.json -Pattern '@uni-fw/' | Measure-Object).Count" — должно вернуть 3
powershell -NoProfile -Command "(Select-String -Path package.json -Pattern 'workspace:\\*' | Measure-Object).Count" — должно вернуть 3
powershell -NoProfile -Command "(Select-String -Path package.json -Pattern '\"workspaces\"' | Measure-Object).Count" — должно вернуть 1
```

---

### `package-lock.json` (lockfile-regen)

**Analog:** `Cargo.lock` (Plan 01-03, Task 1)

**Action excerpt** — `01-03-PLAN.md` Task 1 lines 102-113:

```text
Принудительно регенерировать `Cargo.lock` так, чтобы старые `git+https://github.com/ts-vit/ai-chat`
записи исчезли и появились новые path-based записи (без `source = ...` для локальных крейтов).

Способ:
1. Удалить корневой `Cargo.lock` файл.
2. Выполнить `cargo generate-lockfile` (или `cargo update --workspace`, или просто
   `cargo metadata --format-version 1` — любая из этих команд при отсутствии lockfile создаст новый).

После генерации проверить, что в новом `Cargo.lock` нет подстроки `github.com/ts-vit/ai-chat`
ни в одной строке.

Если по какой-то причине регенерация не убирает старые ссылки (например, transitive cache),
выполнить `cargo clean` затем повторить.
```

**Decision rationale** — `01-03-SUMMARY.md` Decisions Made, lines 108:

```text
Регенерация через `rm Cargo.lock && cargo generate-lockfile` — план перечислял три варианта.
Выбран первый: гарантированно убирает stale git-source записи без риска residual cache.
`cargo update` поверх старого lock мог бы сохранить старые refs до полного rebuild;
`cargo metadata` зависит от поведения «no-lock → generate», что менее предсказуемо.
```

**Для Phase 2** (по аналогии — CONTEXT.md Discretion §3 разрешает полный rebuild):

```text
1. Удалить `package-lock.json` (rm package-lock.json).
2. Выполнить `npm install` — npm 7+ при отсутствии lockfile создаёт новый,
   подхватывает workspaces из package.json, симлинкует @uni-fw/* в node_modules.
3. Проверить, что в `package-lock.json` нет подстроки `npm.ts-vit.com`
   ни `@uni-fw/*` записей с `resolved`-URL на приватный реестр.
```

Альтернатива `npm install --workspaces` или `npm ci` после генерации — на усмотрение planner.

**Verification pattern** — `01-03-PLAN.md` Task 1 verify lines 115:

```text
powershell -NoProfile -Command
  "(Select-String -Path Cargo.lock -Pattern 'github.com/ts-vit/ai-chat' | Measure-Object).Count"
— должно вернуть 0
```

**Для Phase 2**:

```text
powershell -NoProfile -Command "(Select-String -Path package-lock.json -Pattern 'npm.ts-vit.com' | Measure-Object).Count" — должно вернуть 0
```

Acceptance criteria — `01-03-PLAN.md` Task 1 lines 117-123 (адаптировать на npm):
- Файл `package-lock.json` существует
- 0 совпадений `npm.ts-vit.com` в нём
- Записи для `@uni-fw/ui`, `@uni-fw/ssh-ui`, `@uni-fw/terminal-ui` присутствуют как `link:packages/uni-fw-*` (npm workspace symlink-format) — НЕ `"resolved": "https://npm.ts-vit.com/..."`
- `npm ci` exit 0

---

### `.npmrc` (config-delete)

**Analog:** Прямого аналога в Phase 1 нет — Rust git-source жил inline в `*.toml` манифестах, не в отдельном конфиг-файле. Семантический паттерн: «убрать SPOF-источник полностью, не оставлять закомментированным».

**Текущее содержимое `.npmrc`** (одна строка):

```text
@uni-fw:registry=https://npm.ts-vit.com
```

**Phase 2 решение** — CONTEXT.md D-11:

```text
`.npmrc` удаляется из репо полностью (а не оставляется пустым / закомментированным).
Приватный реестр `npm.ts-vit.com` больше не нужен — оставлять любую запись = оставлять SPOF.
```

**Прецедент из Phase 1 на «не оставлять half-references»** — Plan 01-02 verify lines 164:

```text
Команда `grep -r "github.com/ts-vit/ai-chat" Cargo.toml src-tauri/Cargo.toml crates/` возвращает
совпадения ТОЛЬКО внутри `Cargo.lock` (его обновим в Plan 03) — ни одного `.toml` манифеста
среди матчей быть не должно
```

Тот же принцип zero-tolerance к приватному источнику.

**Action для Phase 2**: один `rm .npmrc` (PowerShell `Remove-Item .npmrc -Force`) + verify `Test-Path .npmrc` → False.

**Verification**:

```text
powershell -NoProfile -Command "Test-Path .npmrc" — должно вернуть False
```

---

## Shared Patterns

Cross-cutting паттерны Phase 1, применяемые к ВСЕМ планам Phase 2.

### Snapshot побайтная, метаданные «как есть»

**Source:** `01-01-SUMMARY.md` Decisions Made, lines 107 + CONTEXT.md D-07
**Apply to:** Все 3 snapshot-копии (`packages/uni-fw-*`)

```text
Snapshot-копия побайтная — метаданные `repository = "https://github.com/ts-vit/ai-chat"`
и `homepage = "..."` в исходных манифестах оставлены как есть. Это документационные поля
(rustdoc/crates.io метадата для Rust; npmjs.com для npm), не источник зависимости.
```

Для npm: НЕ править `"repository"`, `"homepage"`, `"author"`, `"keywords"`, `"version"` в `packages/uni-fw-*/package.json`. Очистка метаданных, если нужна, — отдельная v2 задача.

### Минимум магии в манифестах

**Source:** `01-02-SUMMARY.md` Decisions, lines 83 + CONTEXT.md «Established Patterns»
**Apply to:** Правка корневого `package.json` (план manifest-edit)

```text
Плоский path-стиль (Rust) / простой workspace:* reference (npm) — без `[workspace.dependencies]`,
без `overrides`, без `peerDependenciesMeta`. Соответствует существующему стилю (один прецедент:
claude-code-core path-dep в src-tauri/Cargo.toml сохранён как плоская строка), минимизирует diff,
не затрагивает структуру.
```

### Verification gate: metadata-check без полного build

**Source:** `01-01-PLAN.md` Task 2 verify (line 221) + `01-02-PLAN.md` verify (line 162)
**Apply to:** Все планы Phase 2 — промежуточный gate между snapshot и lockfile-regen

```text
Для Rust: `cargo metadata --no-deps --format-version 1` exit 0 = TOML валидный + workspace разрешается.
Аналог npm: `npm ls --workspaces --depth 0` (или `npm pkg get workspaces`) exit 0 = package.json валидный
и workspaces зарегистрированы.
```

Этот gate отделяет ошибки структуры манифеста (быстрое падение) от ошибок резолва зависимостей (медленное падение в `npm ci`), позволяя верифицировать промежуточные планы быстро.

### Test verification gate

**Source:** `01-03-PLAN.md` Task 2 step C + `01-03-SUMMARY.md` patterns-established line 39
**Apply to:** Финальный план Phase 2 (lockfile-regen + verify)

```text
Phase 1 паттерн: cargo test -p <critical-pkg> для каждого критического крейта отдельно
(src-tauri, claude-code-core), затем cargo test --workspace для покрытия всех. Если последний
падает только в uni-*, помечаем #[ignore] с TODO; критические остаются неприкосновенными.

Phase 2 эквивалент: npm run typecheck + npm run test (корневой vitest run в cwd). По решению
CONTEXT.md D-05/D-06 тесты внутри packages/uni-fw-* НЕ запускаются (vitest корня смотрит только
на src/__tests__/). Если корневой vitest падает на mock-резолве @uni-fw/* — это блокер,
не маскируется. Тесты внутри packages/uni-fw-*/src/__tests__/ остаются спящими (CONTEXT.md D-05).
```

### Compatibility constraint: consumer-код не трогаем

**Source:** PROJECT.md Constraints + `01-VERIFICATION.md` line 116
**Apply to:** Всё, что касается импортов в `src/`

```text
Из Phase 1: «Никаких изменений в src/, src-tauri/src/, crates/claude-code-core/src/
(compatibility constraint выполнен — публичные API не менялись)».

Phase 2 эквивалент: импорты `import { ... } from "@uni-fw/ui"` / `@uni-fw/ssh-ui` /
`@uni-fw/terminal-ui` в `src/` НЕ правим (CONTEXT.md D-12). Если выявится конфликт
(нерезолвящийся подпуть) — правка идёт в `package.json` пакета, не в потребителя.

Особый случай: src/main.tsx:7 содержит `import "@uni-fw/ui/src/styles/markdown.css"` —
CSS-импорт через source-путь. Это уже work-аs-expected при source-direct exports (CONTEXT.md D-03).
```

### Test-mocks остаются нетронутыми

**Source:** `src/__tests__/setup.ts` lines 64-74 + CONTEXT.md «Reusable Assets»
**Apply to:** Все планы — НЕ править setup.ts

`src/__tests__/setup.ts` уже моkает все три `@uni-fw/*` пакета по имени модуля:

```typescript
vi.mock("@uni-fw/terminal-ui", () => ({
  TerminalPanel: () => null,
}));

vi.mock("@uni-fw/ui", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => content,
  useSettings: vi.fn(() => ({ value: "", set: vi.fn() })),
  UniProvider: ({ children }: { children: React.ReactNode }) => children,
  ConfirmModal: ({ opened, title, message }: { opened: boolean; title: string; message: string }) =>
    opened ? `${title}: ${message}` : null,
}));
```

`vi.mock` работает на уровне имени модуля и не зависит от того, откуда резолвится пакет (npm registry vs. workspace symlink). При vendoring менять не нужно. CONTEXT.md явно подтверждает: «эти моки работают независимо от того, откуда резолвится пакет».

### TODO-trail / TEST-NOTES артефакт

**Source:** `01-03-PLAN.md` Task 2 step D + `01-03-SUMMARY.md` lines 96-97
**Apply to:** Финальный verify-план Phase 2 (по аналогии)

```text
Phase 1: создать .planning/phases/01-rust-vendoring/01-03-TEST-NOTES.md со списком
изменённых тестов либо строкой «Все тесты прошли без правок».

Phase 2 эквивалент (если применимо): создать .planning/phases/02-npm-vendoring/02-XX-TEST-NOTES.md
для трассировки решений по тестам vendored-пакетов (CONTEXT.md D-05 — они НЕ запускаются;
если планировщик решит зафиксировать это явно, использовать тот же формат).
```

### Атомарные коммиты per-task

**Source:** `01-01-SUMMARY.md` Task Commits (lines 72-76) + все три summary
**Apply to:** Все планы Phase 2

```text
Каждая задача закоммичена атомарно. Конвенция:
- snapshot-копия пакета = feat-коммит «feat(02-XX): vendor @uni-fw/<name> from ai-chat as snapshot»
- manifest-edit = refactor-коммит «refactor(02-XX): replace @uni-fw/* with workspace:* in package.json»
- lockfile-regen = chore-коммит «chore(02-XX): regenerate package-lock.json without npm.ts-vit.com»
- .npmrc deletion = chore-коммит «chore(02-XX): remove .npmrc with private registry»
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (нет) | — | — | Все 7 групп файлов Phase 2 имеют прямой или role-match аналог в Phase 1 |

`.npmrc` (config-delete) — единственный paтtern без прямого аналога, но семантическая параллель с «zero-tolerance к приватному источнику» из Phase 1 lockfile-regen + manifest-edit достаточно сильная, чтобы считать его покрытым.

`CLAUDE.md` правка (BUILD-06) — вне scope Phase 2 (CONTEXT.md Deferred: «BUILD-06 (Phase 3)»). Не маппится здесь.

---

## Metadata

**Analog search scope:**
- `.planning/phases/01-rust-vendoring/` — 3 PLAN-файла, 3 SUMMARY-файла, 1 VERIFICATION-файл
- `Cargo.toml` (корень), `src-tauri/Cargo.toml`, `crates/claude-code-core/Cargo.toml` — для current-state path-deps
- `package.json` (корень), `.npmrc`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json` — для current-state npm-конфига
- `src/main.tsx`, `src/__tests__/setup.ts` — для consumer-кода (Vite CSS-import + vitest mocks)
- `D:\work-ai\ai-chat\packages\{uni-ui,uni-ssh-ui,uni-terminal-ui}\package.json` + `Get-ChildItem`-листинг каталогов — source-of-truth для snapshot

**Files scanned:** 18

**Pattern extraction date:** 2026-05-16

---

*Phase: 2-npm-vendoring*
*Patterns mapped: 2026-05-16*
