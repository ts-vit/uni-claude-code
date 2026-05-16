---
phase: 03-build-docs
plan: 02
subsystem: docs
tags: [documentation, vendoring, codebase-maps, concerns, architecture]

requires:
  - phase: 03-build-docs/03-01
    provides: README.md создан; контекст фазы 3 установлен

provides:
  - "CLAUDE.md свободная часть переписана: External Dependencies → Vendored Dependencies (crates/uni-* + packages/uni-fw-*)"
  - "STACK.md UNI Framework секции описывают vendored workspaces без упоминания npm.ts-vit.com / ts-vit/ai-chat"
  - "INTEGRATIONS.md: uni-ssh Provider и Environment Configuration переписаны на vendored-язык"
  - "ARCHITECTURE.md: Layer 4 (external) → (vendored), Location указывает на внутренние workspace-каталоги"
  - "CONCERNS.md: секция Supply Chain Risk удалена полностью (D-C2)"
  - "CONVENTIONS.md / TESTING.md: проверены grep'ом, D-C3-паттернов не обнаружено, файлы не тронуты"

affects:
  - 03-build-docs/03-03
  - future map-codebase agents
  - future planner sessions reading .planning/codebase/

tech-stack:
  added: []
  patterns:
    - "GSD-маркеры в CLAUDE.md защищены от ручных правок (D-C4): все 14 маркеров сохранены, содержимое между ними не изменено"
    - "CONCERNS.md документирует только актуальные риски; история устранённых рисков живёт в phases/"

key-files:
  created: []
  modified:
    - "CLAUDE.md"
    - ".planning/codebase/STACK.md"
    - ".planning/codebase/INTEGRATIONS.md"
    - ".planning/codebase/ARCHITECTURE.md"
    - ".planning/codebase/CONCERNS.md"

key-decisions:
  - "GSD-блоки в CLAUDE.md (строки 62-295) содержат устаревшие упоминания (npm.ts-vit.com, ts-vit/ai-chat, git dependency) — они не редактируются (D-C4 override). Свободная часть (строки 1-61) полностью очищена."
  - "CONVENTIONS.md и TESTING.md не содержат D-C3-паттернов — файлы оставлены без изменений согласно D-C3."
  - "Supply Chain Risk удалена полностью (не помечена resolved) — CONCERNS.md описывает только текущее состояние."

requirements-completed: [BUILD-06]

duration: 15min
completed: 2026-05-16
---

# Phase 03 Plan 02: Codebase Revision Summary

**Семь doc-файлов зачищены от упоминаний приватных источников: External Dependencies → Vendored Dependencies в CLAUDE.md; UNI Framework секции STACK/INTEGRATIONS/ARCHITECTURE переписаны на workspace-язык; Supply Chain Risk удалена из CONCERNS.md.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-16
- **Completed:** 2026-05-16
- **Tasks:** 2
- **Files modified:** 5 (CLAUDE.md, STACK.md, INTEGRATIONS.md, ARCHITECTURE.md, CONCERNS.md; CONVENTIONS.md и TESTING.md — без изменений)

## Accomplishments

- CLAUDE.md: параграф «External Dependencies» переименован в «Vendored Dependencies»; добавлены точные пути crates/uni-* и packages/uni-fw-* с пояснением о snapshot-источнике
- STACK.md: заголовки UNI Framework (Frontend/Rust) переписаны, пункт .npmrc заменён на npm workspaces; 0 совпадений по запрещённым паттернам
- INTEGRATIONS.md: строка Provider uni-ssh (git:...) → (vendored as crates/uni-ssh); Environment Configuration переписан без private registry и без git access
- ARCHITECTURE.md: Layer 4 (external) → (vendored); Location: crates/uni-* + packages/uni-fw-*
- CONCERNS.md: секция Supply Chain Risk (22 строки + разделитель) удалена полностью; между Security Considerations и Tech Debt остался ровно один разделитель ---; итого 7 H2-заголовков
- CONVENTIONS.md / TESTING.md: D-C3 grep-аудит дал 0 совпадений — файлы не тронуты

## Task Commits

1. **Task 1: Переписать private-registry mentions в CLAUDE.md + STACK.md + INTEGRATIONS.md + ARCHITECTURE.md** — `58c6b0e` (docs)
2. **Task 2: Удалить Supply Chain Risk из CONCERNS.md; D-C3 аудит CONVENTIONS/TESTING** — `f1e46d3` (docs)

## Files Created/Modified

- `CLAUDE.md` — §External Dependencies → §Vendored Dependencies; три упоминания внутри GSD-блоков оставлены нетронутыми (D-C4)
- `.planning/codebase/STACK.md` — два заголовка UNI Framework переписаны; пункт .npmrc заменён
- `.planning/codebase/INTEGRATIONS.md` — Provider uni-ssh и Environment Configuration переписаны
- `.planning/codebase/ARCHITECTURE.md` — Layer 4 заголовок и Location переписаны
- `.planning/codebase/CONCERNS.md` — секция Supply Chain Risk удалена полностью

## Decisions Made

- **GSD-блоки оставлены без изменений (D-C4 override).** В CLAUDE.md на строках 77, 143, 247 (внутри GSD-блоков project-start/stack-start/architecture-start) остаются упоминания npm.ts-vit.com, ts-vit/ai-chat, git dependency. Это ожидаемо: содержимое между маркерами генерируется отдельным процессом (generate-claude-profile) и не может редактироваться вручную. Свободная часть CLAUDE.md полностью очищена. Три совпадения в CLAUDE.md при финальном grep-аудите — только внутри GSD-блоков; реальный acceptance criterion (свободная часть) выполнен.
- **CONVENTIONS.md / TESTING.md не тронуты.** Grep по D-C3-паттернам вернул 0 совпадений в обоих файлах. Согласно D-C3 файлы не редактируются.
- **Формулировка INTEGRATIONS.md строка 133.** Вариант «no private registry required» заменён на «resolved locally, no external registry» чтобы полностью избежать слова «private registry» в читаемой части.

## Deviations from Plan

### Отклонение: GSD-блоки содержат устаревшие упоминания (ожидаемо, D-C4)

- **Найдено при:** Task 1, grep-аудит CLAUDE.md
- **Суть:** Финальный grep-инвариант по CLAUDE.md возвращает 3 совпадения (строки 77, 143, 247) — все строго внутри GSD-блоков (project-start, stack-start, architecture-start). Acceptance criteria Task 1 формально требуют 0 совпадений суммарно; D-C4 запрещает правки между маркерами.
- **Решение:** D-C4 имеет приоритет над формальным счётчиком. Свободная часть CLAUDE.md (строки 1-61) полностью очищена. Содержимое GSD-блоков обновится автоматически при следующем прогоне generate-claude-profile с обновлёнными source-документами (STACK.md теперь содержит vendored-язык).
- **Верификация:** `grep -c '<!-- GSD:' CLAUDE.md` = 14 (все маркеры целы); diff показывает правки только в строках 51-56 (вне всех маркеров).

---

**Итого отклонений:** 1 (ожидаемое ограничение D-C4, не ошибка исполнения)

## Issues Encountered

При первой формулировке INTEGRATIONS.md строка 133 содержала «no private registry required», что давало ложное срабатывание на паттерн `private registry`. Переформулировано на «resolved locally, no external registry».

## D-C3 Audit Result

| Файл | Совпадений по D-C3-паттернам | Действие |
|------|------------------------------|---------|
| CONVENTIONS.md | 0 | Не тронут |
| TESTING.md | 0 | Не тронут |

## Next Phase Readiness

- Все семь doc-файлов описывают вендорированное состояние без ложных upstream-рисков
- Будущий map-codebase прогон получит чистый baseline
- Готово к плану 03-03 (end-to-end verification BUILD-05)

---
*Phase: 03-build-docs*
*Completed: 2026-05-16*
