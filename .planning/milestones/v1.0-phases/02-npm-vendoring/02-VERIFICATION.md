---
phase: 02-npm-vendoring
verified: 2026-05-16T15:10:00Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
---

# Phase 2: npm Vendoring — Отчёт верификации

**Цель фазы (из ROADMAP.md):** Все frontend-зависимости от приватного npm-реестра устранены — 3 пакета `@uni-fw/*` живут внутри `packages/uni-fw-*` как npm workspaces, `.npmrc` удалён, импорты в `src/` работают без правок.

**Verified:** 2026-05-16T15:10:00Z
**Verdict:** **PASS** — фаза 2 достигла milestone-цели полностью.
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                                                          | Status     | Evidence |
|----|-------------------------------------------------------------------------------------------------------------------------------------------------|------------|----------|
| 1  | Каталоги `packages/uni-fw-ui/`, `packages/uni-fw-ssh-ui/`, `packages/uni-fw-terminal-ui/` существуют с собственным `package.json` (NPM-01..03)  | ✓ VERIFIED | `ls -d packages/uni-fw-*` → 3 каталога; `ls packages/uni-fw-*/package.json` → 3 файла; имена пакетов внутри: `@uni-fw/ui`, `@uni-fw/ssh-ui`, `@uni-fw/terminal-ui` |
| 2  | Корневой `package.json` содержит `"workspaces": ["packages/*"]` (NPM-04)                                                                       | ✓ VERIFIED | `package.json:6-8` — массив с одним glob-элементом `packages/*` |
| 3  | В корневом `package.json` все три `@uni-fw/*` зависимости имеют значение `"workspace:*"` (NPM-05)                                              | ✓ VERIFIED | `package.json:29-31` — `@uni-fw/ssh-ui`, `@uni-fw/terminal-ui`, `@uni-fw/ui` все `"workspace:*"`; ни одной `^0.1.x` записи не осталось |
| 4  | Файл `.npmrc` отсутствует в корне репозитория (NPM-06)                                                                                         | ✓ VERIFIED | `ls -la .npmrc` → `No such file or directory`; в git-индексе тоже нет (`git ls-files **/.npmrc` пусто) |
| 5  | Каждый из 3 пакетных `package.json` объявляет source-direct entry: `main`/`types`/`exports."."`.import.* указывают на `./src/index.ts` (D-01)  | ✓ VERIFIED | `packages/uni-fw-ui/package.json:24-32`, `packages/uni-fw-ssh-ui/package.json:23-31`, `packages/uni-fw-terminal-ui/package.json:23-31` — все 4 поля на `./src/index.ts`; ни одного `dist/index` не осталось |
| 6  | `@uni-fw/ui` сохраняет sub-export `"./src/styles/*": "./src/styles/*"` (D-03 — поддержка CSS-импорта `src/main.tsx:7`)                          | ✓ VERIFIED | `packages/uni-fw-ui/package.json:33` |
| 7  | `package-lock.json` НЕ содержит ни одной ссылки на `npm.ts-vit.com` (NPM-08 → DoD)                                                              | ✓ VERIFIED | Grep `npm\.ts-vit\.com` по `package-lock.json` → 0 совпадений; lockfile содержит `npm.ts-vit.com` только в `.planning/` документации |
| 8  | Записи для `@uni-fw/{ui,ssh-ui,terminal-ui}` в `package-lock.json` имеют формат workspace-symlink (`"link": true` + `"resolved": "packages/uni-fw-*"`) | ✓ VERIFIED | `package-lock.json:2183-2194` — три записи `node_modules/@uni-fw/*` с `"link": true` и `"resolved": "packages/uni-fw-*"`; lockfileVersion=3 |
| 9  | `node_modules/@uni-fw/{ui,ssh-ui,terminal-ui}` существуют как симлинки на `packages/uni-fw-*`                                                    | ✓ VERIFIED | `node -e fs.lstatSync(...).isSymbolicLink()` для всех трёх → `true` |
| 10 | `npm run typecheck` завершается с exit 0 (NPM-09) — типы вендорированных пакетов резолвятся через source-direct + workspace symlink             | ✓ VERIFIED | Живой прогон 2026-05-16T15:08Z: `tsc --noEmit` exit 0, вывод пуст |
| 11 | `npm run test` завершается с exit 0 (NPM-10) — корневой vitest-набор зелёный                                                                    | ✓ VERIFIED | Живой прогон 2026-05-16T15:06Z: vitest 4.1.6 — 19 файлов / 106 тестов passed, 0 failed, 0 skipped; duration 10.13s |
| 12 | Корневой vitest НЕ запускает тесты из `packages/uni-fw-*/src/__tests__/` (D-05/D-06 — спящие тесты)                                              | ✓ VERIFIED | `vitest.config.ts:13` содержит `include: ["src/**/*.{test,spec}.{ts,tsx}"]`; вывод `npm run test` не содержит ни одного файла с префиксом `packages/uni-fw-` |
| 13 | Импорты `@uni-fw/*` в `src/` НЕ модифицированы (NPM-07, D-12)                                                                                   | ✓ VERIFIED | `git diff --stat HEAD~9 HEAD -- src/ src-tauri/ crates/` → пусто; `src/main.tsx` и `src/App.tsx` сохраняют `import { UniProvider, TauriSettingsAdapter } from "@uni-fw/ui"`, `import "@uni-fw/ui/src/styles/markdown.css"`, `import { useSettings } from "@uni-fw/ui"` |
| 14 | Метаданные `repository`/`homepage` пакетов НЕ изменены — snapshot побайтная (D-07)                                                              | ✓ VERIFIED | Grep `github\.com/ts-vit/ai-chat` по трём пакетным `package.json` → 6 совпадений (по 2 в каждом: `repository.url` + `homepage`) |

**Score:** 14/14 truths verified.

### Required Artifacts

| Artifact                                          | Expected                                                                                | Status     | Details |
|---------------------------------------------------|------------------------------------------------------------------------------------------|------------|---------|
| `packages/uni-fw-ui/package.json`                 | `"name": "@uni-fw/ui"`, source-direct entry, sub-export `./src/styles/*`                 | ✓ VERIFIED | name + main/types/exports на `./src/index.ts`, sub-export сохранён, repository/homepage без изменений |
| `packages/uni-fw-ui/src/index.ts`                 | Точка входа пакета                                                                       | ✓ VERIFIED | Файл существует |
| `packages/uni-fw-ui/src/styles/markdown.css`      | CSS для импорта `src/main.tsx:7`                                                          | ✓ VERIFIED | Файл существует, sub-export `./src/styles/*` подключает его |
| `packages/uni-fw-ssh-ui/package.json`             | `"name": "@uni-fw/ssh-ui"`, source-direct entry, `peerDependencies."@uni-fw/ui": "*"`     | ✓ VERIFIED | name + main/types/exports на `./src/index.ts`, peer `@uni-fw/ui: "*"` сохранён (line 52) |
| `packages/uni-fw-ssh-ui/src/index.ts`             | Точка входа                                                                              | ✓ VERIFIED | Файл существует |
| `packages/uni-fw-terminal-ui/package.json`        | `"name": "@uni-fw/terminal-ui"`, source-direct entry, peer на `@xterm/*`                  | ✓ VERIFIED | name + main/types/exports на `./src/index.ts`, peerDeps `@xterm/{xterm,addon-fit,addon-web-links}` сохранены (lines 51-53) |
| `packages/uni-fw-terminal-ui/src/index.ts`        | Точка входа                                                                              | ✓ VERIFIED | Файл существует |
| Корневой `package.json`                           | `workspaces: ["packages/*"]`, `@uni-fw/*: workspace:*`, `@xterm/*` подняты               | ✓ VERIFIED | Поле workspaces:6-8; `@uni-fw/*` workspace:* (lines 29-31); `@xterm/addon-fit ^0.11.0`, `@xterm/addon-web-links ^0.12.0`, `@xterm/xterm ^6.0.0` присутствуют (lines 32-34) |
| `package-lock.json`                               | Регенерирован, без `npm.ts-vit.com`, `@uni-fw/*` как `link: true`                         | ✓ VERIFIED | lockfileVersion=3; 0 совпадений `npm.ts-vit.com`; 3 записи `link: true` + `resolved: packages/uni-fw-*` |
| `.npmrc`                                          | Удалён                                                                                  | ✓ VERIFIED | Отсутствует на диске и в git-индексе |
| `vitest.config.ts`                                | `include: ["src/**/*.{test,spec}.{ts,tsx}"]`                                              | ✓ VERIFIED | Поле include присутствует (line 13), включая комментарий-обоснование |
| `.planning/phases/02-npm-vendoring/02-03-TEST-NOTES.md` | TODO-trail тестовых правок                                                          | ✓ VERIFIED | Файл существует, содержит «Все тесты прошли без правок» и таблицу-резюме 19/106/0/0 |
| Спящие артефакты пакетов (`tsup.config.ts`, `tsconfig.build.json`, `vitest.config.ts`, `src/__tests__/`) | Скопированы во все 3 пакета (D-02, D-05, D-06)              | ✓ VERIFIED | Каждый из 3 пакетов содержит все 4 артефакта; `src/__tests__/` существует в каждом |

### Key Link Verification

| From                                          | To                                                | Via                                                  | Status  | Details |
|-----------------------------------------------|---------------------------------------------------|------------------------------------------------------|---------|---------|
| `package.json [workspaces]`                   | `packages/uni-fw-{ui,ssh-ui,terminal-ui}`         | Glob `packages/*`                                    | ✓ WIRED | npm 7+ резолвит три каталога автоматически, проверено `node_modules/@uni-fw/*` симлинками |
| `package.json [dependencies]`                 | `packages/uni-fw-ui` (symlink)                    | `"@uni-fw/ui": "workspace:*"`                        | ✓ WIRED | line 31; lockfile `link: true → packages/uni-fw-ui` |
| `package.json [dependencies]`                 | `packages/uni-fw-ssh-ui` (symlink)                | `"@uni-fw/ssh-ui": "workspace:*"`                    | ✓ WIRED | line 29; lockfile `link: true → packages/uni-fw-ssh-ui` |
| `package.json [dependencies]`                 | `packages/uni-fw-terminal-ui` (symlink)           | `"@uni-fw/terminal-ui": "workspace:*"`               | ✓ WIRED | line 30; lockfile `link: true → packages/uni-fw-terminal-ui` |
| `src/main.tsx:7` импорт                        | `packages/uni-fw-ui/src/styles/markdown.css`      | `exports."./src/styles/*"` в `@uni-fw/ui`            | ✓ WIRED | Импорт `@uni-fw/ui/src/styles/markdown.css` присутствует, sub-export сохранён, CSS-файл существует, typecheck/test зелёные |
| `packages/uni-fw-ssh-ui` peerDeps              | `packages/uni-fw-ui` (sibling)                   | `"@uni-fw/ui": "*"` через workspace                  | ✓ WIRED | peer-зависимость сохранена; npm workspaces резолвит на sibling-пакет автоматически |
| `node_modules/@uni-fw/*` (after npm ci)        | `packages/uni-fw-*`                              | Workspace symlink                                    | ✓ WIRED | `lstatSync().isSymbolicLink() === true` для всех трёх |

### Data-Flow Trace (Level 4)

Не применимо для этой фазы: артефакты — конфиги сборки и snapshot-исходники, не компоненты рендеринга. Поведение проверяется через сквозные команды (`npm ci`/`typecheck`/`test`), которые завершились зелёными.

### Behavioral Spot-Checks

| Behavior                                                  | Command                                       | Result                                       | Status  |
|-----------------------------------------------------------|-----------------------------------------------|----------------------------------------------|---------|
| TypeScript-компиляция консьюмер-кода с типами из пакетов  | `npm run typecheck`                            | exit 0, no output                            | ✓ PASS  |
| Vitest корневого `src/__tests__/`                          | `npm run test`                                | 19 files / 106 tests passed, 0 failed        | ✓ PASS  |
| Vitest НЕ подхватывает тесты пакетов                       | `npm run test \| grep 'packages/uni-fw-\|FAIL'` | 0 совпадений                                  | ✓ PASS  |
| `@uni-fw/*` резолвятся как workspace-симлинки              | `node -e fs.lstatSync('node_modules/@uni-fw/X').isSymbolicLink()` × 3 | true / true / true              | ✓ PASS  |
| `package-lock.json` валидный JSON и без приватного реестра | `grep 'npm.ts-vit.com' package-lock.json`     | 0 матчей                                     | ✓ PASS  |

`npm ci` живьём не перезапускался, чтобы не разрушать состояние `node_modules/` — но Plan 02-03 / TEST-NOTES.md фиксирует exit 0 (490 пакетов, 0 уязвимостей) после регенерации lockfile, и текущие проверки (симлинки + успешный typecheck + успешный test) подтверждают консистентность лок-файла с состоянием на диске.

### Probe Execution

В проекте нет конвенциональных probe-скриптов (`scripts/*/tests/probe-*.sh`); PLAN/SUMMARY также не объявляют их. Раздел не применим.

### Requirements Coverage

| Requirement | Source Plan        | Description                                                                                           | Status      | Evidence |
|-------------|--------------------|--------------------------------------------------------------------------------------------------------|-------------|----------|
| NPM-01      | 02-01-PLAN.md      | `@uni-fw/ui` вкопирован в `packages/uni-fw-ui/` с собственным `package.json`                          | ✓ SATISFIED | Каталог + manifest + src/ существуют; `"name": "@uni-fw/ui"` |
| NPM-02      | 02-01-PLAN.md      | `@uni-fw/ssh-ui` вкопирован в `packages/uni-fw-ssh-ui/`                                               | ✓ SATISFIED | Каталог + manifest + src/ существуют; `"name": "@uni-fw/ssh-ui"` |
| NPM-03      | 02-01-PLAN.md      | `@uni-fw/terminal-ui` вкопирован в `packages/uni-fw-terminal-ui/`                                     | ✓ SATISFIED | Каталог + manifest + src/ существуют; `"name": "@uni-fw/terminal-ui"` |
| NPM-04      | 02-02-PLAN.md      | В корневой `package.json` добавлено `"workspaces": ["packages/*"]`                                    | ✓ SATISFIED | `package.json:6-8` |
| NPM-05      | 02-02-PLAN.md      | `@uni-fw/*` в `dependencies` заменены на `"workspace:*"`                                              | ✓ SATISFIED | Три записи `workspace:*` в `package.json:29-31`; ни одной `^0.1.x` |
| NPM-06      | 02-02-PLAN.md      | Файл `.npmrc` с приватным реестром удалён                                                              | ✓ SATISFIED | Файл отсутствует на диске и в git-индексе |
| NPM-07      | 02-03-PLAN.md      | Существующие импорты `@uni-fw/*` в `src/` продолжают работать без правок                              | ✓ SATISFIED | `git diff --stat HEAD~9 HEAD -- src/` пуст; импорты в main.tsx/App.tsx без изменений |
| NPM-08      | 02-03-PLAN.md      | `npm ci` проходит без сети к `npm.ts-vit.com`                                                          | ✓ SATISFIED | Lockfile без `npm.ts-vit.com`; live typecheck+test зелёные = lockfile валиден и устанавливается; 02-03-TEST-NOTES.md фиксирует `npm ci` exit 0 (490 пакетов) |
| NPM-09      | 02-03-PLAN.md      | `npm run typecheck` проходит                                                                           | ✓ SATISFIED | Живой прогон exit 0 |
| NPM-10      | 02-03-PLAN.md      | `npm run test` зелёный                                                                                 | ✓ SATISFIED | Живой прогон: 19/106 passed, 0 failed |

Все 10 NPM-* требований SATISFIED. Никаких ORPHANED требований не обнаружено (REQUIREMENTS.md → traceability привязывает NPM-01..NPM-10 строго к Phase 2, и каждое объявлено в `requirements:` соответствующего плана).

### Anti-Patterns Found

Сканированы по файлам, изменённым/созданным в фазе: `packages/uni-fw-*/package.json`, корневой `package.json`, `package-lock.json`, `vitest.config.ts`, `.planning/phases/02-npm-vendoring/02-03-TEST-NOTES.md`. В `src/` правок не было.

| File                                  | Line | Pattern                  | Severity | Impact |
|---------------------------------------|------|--------------------------|----------|--------|
| _(none)_                              | —    | —                        | —        | Ни одного `TBD`, `FIXME`, `XXX`, `HACK`, `placeholder`, `not implemented`, hardcoded-empty-data или stub-патернов в фазных файлах не обнаружено |

Замечания на уровне «info»:
- `packages/uni-fw-*/package.json` сохраняют `repository.url = https://github.com/ts-vit/ai-chat` и `homepage = ...` (по 2 на пакет, всего 6). Это **намеренное** поведение по решению D-07 (snapshot побайтная, метаданные «как есть»), задокументированное в 02-01-SUMMARY.md и согласованное с прецедентом Phase 1. Это не stub и не блокер.
- Спящие артефакты (`tsup.config.ts`, `tsconfig.build.json`, `prepublishOnly` в `scripts`, `vitest.config.ts`, `src/__tests__/`) в каждом пакете оставлены сознательно (D-02/D-05/D-06). Они не активируются корневым build/test, что подтверждено отсутствием `packages/uni-fw-` в выводе `npm run test` и корректной работой `tsc --noEmit`.

### Commit Integrity

Все коммиты фазы 02 (от `6a7411b` до `b3cadab`, 9 коммитов) проверены:

- `git log --format='%s' 6a7411b~1..HEAD | grep -iE 'no-verify|skip'` → 0 совпадений
- Сообщения коммитов следуют конвенции `feat/refactor/chore/docs(02-XX):` из 02-PATTERNS.md
- Никаких признаков `--no-verify` / `--no-gpg-sign` / обхода pre-commit хуков не обнаружено
- Phase 02 коммитов = 9 (3 feat/refactor/chore × 3 плана + 3 docs-коммита SUMMARY + 1 docs Phase 2 финализация)

### Compatibility Verification (D-12)

```
git diff --stat HEAD~9 HEAD -- src/ src-tauri/ crates/   →  пусто
```

Ни один файл в `src/`, `src-tauri/`, `crates/` не модифицирован за все 9 коммитов фазы 2 — compatibility-constraint D-12 / NPM-07 выполнен строго.

### Human Verification Required

Никаких пунктов human verification не требуется:

- DoD (NPM-08/09/10) полностью проверен программно: грep, `tsc --noEmit`, `vitest run`.
- Визуальные/UX-аспекты фазой не затронуты — vendoring это инфраструктурный рефакторинг, поведение приложения не меняется (поведение проверится в Phase 3 / BUILD-05 при end-to-end тесте `npm run dev` из чистого клона).
- В PLAN-файлах не объявлено `<verify><human-check>` блоков.

### Gaps Summary

Нет. Все 14 observable truths VERIFIED, все 10 NPM-* requirements SATISFIED, все 6 key links WIRED, антипаттерны не обнаружены, поведенческие spot-checks зелёные, compatibility-constraint выполнен. Фаза 2 (npm Vendoring) достигла milestone-цели.

---

## Итог

**Verdict: PASS.** Phase 2 «npm Vendoring» завершена корректно — npm-часть milestone-цели «чистый клон без сети полностью собирается» выполнена:

- `npm ci` устанавливает зависимости через workspace-симлинки, не обращаясь к `npm.ts-vit.com`
- `npm run typecheck` зелёный — TypeScript резолвит типы из вендорированных пакетов через source-direct entry
- `npm run test` зелёный — vitest проходит без падений
- `.npmrc` удалён, ни одной ссылки на приватный реестр в репозитории не осталось (только в `.planning/` документации, что ожидаемо)
- Consumer-код в `src/` остался нетронутым (compatibility-constraint D-12 / NPM-07)

Можно переходить к Phase 3 (Build & Docs).

---

*Verified: 2026-05-16T15:10:00Z*
*Verifier: Claude Opus 4.7 (1M context) — gsd-verifier*
