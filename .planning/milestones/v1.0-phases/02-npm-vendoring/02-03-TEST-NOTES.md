# Phase 02 Plan 03 — Test Notes

Все тесты прошли без правок.

## Резюме `npm run test` (vitest run)

| Группа | Test files | Tests passed | Tests failed | Tests skipped |
|--------|------------|--------------|--------------|---------------|
| `src/__tests__/*.test.tsx` (корневой vitest) | 19 | 106 | 0 | 0 |
| **Итого** | **19** | **106** | **0** | **0** |

Длительность: ~11 s (transform 0.8 s, setup 6.8 s, tests 8.6 s).

## Резюме `npm run typecheck` (`tsc --noEmit`)

Exit code 0, никаких ошибок. Типы из `packages/uni-fw-*/src/` резолвятся через workspace symlink + `moduleResolution: "bundler"` (см. STACK.md), как и ожидалось при source-direct entry (D-01).

## Резюме `npm ci`

Exit code 0. Установлено 490 пакетов из 494, найдено 0 уязвимостей. `node_modules/@uni-fw/*` пересоздаются как workspace symlinks из `packages/uni-fw-*/`. Сетевых обращений к `npm.ts-vit.com` нет (приватный реестр удалён в Plan 02-02, `package-lock.json` регенерирован в Plan 02-03 / Task 1 без таких записей).

## Пометки `it.skip`, добавленные этим планом

**Никаких.** Все 19 корневых файлов / 106 тестов в `src/__tests__/` прошли с первого запуска. Атрибут `it.skip` в `src/__tests__/*.test.tsx` не добавлялся.

`src/__tests__/setup.ts` НЕ модифицирован (см. CONTEXT.md «Reusable Assets»). Моки `vi.mock("@uni-fw/...")` работают независимо от того, как пакет резолвится (npm registry vs workspace symlink), поэтому переключение на `workspace:*` не потребовало правок в setup.

## Тесты внутри `packages/uni-fw-*/src/__tests__/`

В соответствии с CONTEXT.md D-05/D-06 эти тесты — «спящие» снапшоты, не запускаются корневым `npm run test`.

Изначально план предполагал, что vitest по дефолту ищет тесты только в `src/`. На практике vitest сканирует от cwd, поэтому при первом запуске были подхвачены тесты пакетов и обнаружились падения (отсутствие `SettingsProvider` в mock `@uni-fw/ui`, `vi.fn()`-конструктор для `@xterm/xterm.Terminal`). Это unrelated-к-vendoring проблемы — они стабильно падают и у источника (ai-chat), потому что используют моки, которые не были перенесены при vendoring (моки в пакетах используют свой собственный contract, отличный от корневого `setup.ts`).

Для соблюдения D-05/D-06 в корневой `vitest.config.ts` добавлено явное поле `include: ["src/**/*.{test,spec}.{ts,tsx}"]` — defensive фильтр, ограничивающий поиск тестов корневой папкой `src/`. Это правка инфраструктуры (build-config), не консумера и не самих тестов; consumer-код в `src/` не тронут (compatibility constraint D-12 / NPM-07 соблюдён).

После добавления фильтра:
- `Select-String -Path test-output.txt -Pattern '^\s*packages/uni-fw-'` → 0 совпадений
- Тесты `packages/uni-fw-*/src/__tests__/` не появляются в выводе vitest и не учитываются в зачёте.

Если в будущем (см. MAINT-02 в v2) потребуется реактивировать эти тесты — фильтр в `vitest.config.ts` нужно либо расширить, либо завести отдельный конфиг `vitest.config.packages.ts` с собственными моками.

## TODO trail для MAINT-02 (v2)

Пусто. Ни один корневой тест (`src/__tests__/`) не был помечен `it.skip` из-за vendoring, поэтому в v2 нет конкретных кандидатов на «re-enable after vendoring». MAINT-02 остаётся открытым как общая гигиена тестов вендорированных npm-пакетов (стабилизация моков `@uni-fw/ui` / `@xterm/xterm` внутри `packages/uni-fw-*/src/__tests__/`), но без конкретного списка из этой фазы.
