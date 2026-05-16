# Phase 03 Plan 03 — Test Notes

**Дата прогона:** 2026-05-16 16:12 UTC+3
**Временный каталог:** `C:\Users\Huawei\AppData\Local\Temp\uni-claude-code-verify-20260516-161214`
**Источник:** `D:\work-ai\uni-claude-code`
**Source commit:** `ebb79e1ec889f9a00c041b5d4ca4a3bedd8cf0da`
**HEAD clone == HEAD source:** ДА (совпадают)

---

## Deviation Note (D-V1, D-V2)

Сеть к `npm.ts-vit.com` / `github.com/ts-vit/ai-chat` **не блокируется** физически (D-V1 — никаких Windows Firewall outbound rules, никаких hosts-заглушек). Фактическая независимость подтверждается через 5 grep-инвариантов ниже и полный прогон сборки. Это интерпретация ROADMAP success criterion 4 (D-V2): буква ROADMAP «сеть … заблокирована» переформулирована в `03-CONTEXT.md` как «фактическая независимость через grep-инварианты + успешный прогон».

---

## Grep-инварианты

Все инварианты выполнены во временном клоне `C:\Users\Huawei\AppData\Local\Temp\uni-claude-code-verify-20260516-161214`.

| # | Инвариант | Target | Regex / Check | Hit count | Status |
|---|-----------|--------|---------------|-----------|--------|
| 1 | `package-lock.json` не содержит `npm.ts-vit.com` | `<temp>/package-lock.json` | `npm\.ts-vit\.com` | 0 | PASS |
| 2 | Корневой `package.json` не содержит `@uni-fw/*` со значением ≠ `workspace:*` | `<temp>/package.json` | `.dependencies["@uni-fw/*"] != "workspace:*"` | 0 | PASS |
| 3 | `Cargo.lock` не содержит `github.com/ts-vit/ai-chat` | `<temp>/Cargo.lock` | `github\.com/ts-vit/ai-chat` | 0 | PASS |
| 4 | Все репозиторные `Cargo.toml` без `git = "https://github.com/ts-vit/ai-chat"` | `<temp>/Cargo.toml`, `<temp>/src-tauri/Cargo.toml`, `<temp>/crates/claude-code-core/Cargo.toml` | `git\s*=\s*"https://github\.com/ts-vit/ai-chat"` | 0 | PASS |
| 5 | Файл `.npmrc` отсутствует в корне | `<temp>/.npmrc` | `Test-Path` → `False` | файл отсутствует | PASS |

**Результат: 5/5 PASS — все grep-инварианты выполнены.**

---

## Команды end-to-end прогона

| # | Команда | cwd | Exit code | Duration | Резюме |
|---|---------|-----|-----------|----------|--------|
| 0 | `git clone --no-local D:\work-ai\uni-claude-code <temp>` | `D:\work-ai\uni-claude-code` | 0 | ~1.3s | Клон создан, HEAD совпадает с source (`ebb79e1`) |
| 1 | `npm ci` | `<temp>` | 0 | 17.9s | 490 packages added, 494 audited, 0 vulnerabilities; `@uni-fw/*` как workspace symlinks |
| 2 | `cargo build --workspace` | `<temp>` | 0 | 89.4s | `Finished dev profile [unoptimized + debuginfo]`; все workspace-члены скомпилированы; `crates/uni-*` собраны из path-зависимостей |
| 3 | `npm run test:all` | `<temp>` | 0 | 118.2s | typecheck OK + vitest 19 files / 106 tests passed / 0 failed + cargo test: 97 passed / 1 ignored |
| 4 | `npm run build` | `<temp>` | 0 | 212.1s | `Finished release profile [optimized]`; 2 bundles: `Code Architect_0.1.0_x64_en-US.msi` + `Code Architect_0.1.0_x64-setup.exe` |

### Детали `npm run test:all`

- **typecheck (`tsc --noEmit`):** exit 0, нет ошибок типов
- **vitest:** 19 test files, 106 tests passed, 0 failed, 0 skipped
- **cargo test --workspace:** 97 тестов passed (16 uni-common + 21 uni-process + 5 claude-code-core parser + 28 claude-code-core runner + 7 claude-code-core session + 7 uni-ssh + 6 uni-settings + 7 uni-terminal), 1 ignored (async test в uni-settings), 0 failed

### Детали `npm run build` (BUILD-02)

Таури prod bundle успешно собран без signing — `tauri.conf.json` не содержит `bundle.signing` или `bundle.windows.certificateThumbprint`. Два артефакта:
- `target\release\bundle\msi\Code Architect_0.1.0_x64_en-US.msi`
- `target\release\bundle\nsis\Code Architect_0.1.0_x64-setup.exe`

---

## Stdout tails

### `npm ci` (последние строки)
```
added 490 packages, and audited 494 packages in 18s
161 packages are looking for funding
found 0 vulnerabilities
```

### `cargo build --workspace` (последние строки)
```
   Compiling uni-claude-code v0.1.0 (<temp>/src-tauri)
   Compiling arboard v3.6.1
   Compiling tao v0.35.2
   Compiling webview2-com v0.38.2
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1m 29s
```

### `npm run test:all` (ключевые строки)
```
 Test Files  19 passed (19)
      Tests  106 passed (106)
test result: ok. 97 passed; 0 failed; 1 ignored; finished in ~0.3s (суммарно по workspace)
```

### `npm run build` (последние строки)
```
    Finished `release` profile [optimized] target(s) in 2m 15s
       Built application at: <temp>\target\release\uni-claude-code.exe
    Finished 2 bundles at:
        <temp>\target\release\bundle\msi\Code Architect_0.1.0_x64_en-US.msi
        <temp>\target\release\bundle\nsis\Code Architect_0.1.0_x64-setup.exe
```

---

## Резюме

Чистый клон без приватной сети (`npm.ts-vit.com` / `github.com/ts-vit/ai-chat`) полностью собирается и проходит все проверки: `npm ci` + `cargo build --workspace` + `npm run test:all` + `npm run build` — все команды exit 0. Deviation D-V2 зафиксирован выше. Milestone-цель «чистый клон без сети полностью собирается» формально PASS.

**Временный каталог:** `C:\Users\Huawei\AppData\Local\Temp\uni-claude-code-verify-20260516-161214` — оставлен для возможного re-run; удалить вручную при необходимости (`Remove-Item -Recurse -Force <temp>`).
