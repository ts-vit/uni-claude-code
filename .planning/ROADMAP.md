# Roadmap: UNI Claude Code

## Milestones

- ✅ **v1.0 Vendoring** — Phases 1-3 (shipped 2026-05-16) — см. [`.planning/milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Chat UX** — Phases 4-5 (started 2026-05-18) — фикс потери чата при навигации, метаданные сессии в StatusBar, UI-кнопка Clear

## Phases

<details>
<summary>✅ v1.0 Vendoring (Phases 1-3) — SHIPPED 2026-05-16</summary>

- [x] Phase 1: Rust Vendoring (3/3 plans) — completed 2026-05-16
- [x] Phase 2: npm Vendoring (3/3 plans) — completed 2026-05-16
- [x] Phase 3: Build & Docs (3/3 plans) — completed 2026-05-16

Архивы фаз: `.planning/milestones/v1.0-phases/`

</details>

### 🚧 v1.1 Chat UX (Phases 4-5) — IN PROGRESS

- [x] **Phase 4: Chat Persistence** — Чат не размонтируется при переключении view и активного проекта (completed 2026-05-17)
- [ ] **Phase 5: Chat Visibility & Controls** — StatusBar показывает модель/session/usage; кнопка Clear в шапке ChatPanel

## Phase Details

### Phase 4: Chat Persistence
**Goal**: Переписка во всех вкладках чата сохраняется при любых навигационных переключениях (view ↔ view, project ↔ project в пределах `maxOpenProjects`) — состояние не теряется ни визуально, ни в DOM, ни в памяти React.
**Depends on**: Nothing (первая фаза v1.1, опирается на shipped v1.0)
**Requirements**: PERSIST-01, PERSIST-02
**Success Criteria** (что должно быть TRUE):
  1. Пользователь начинает чат с Claude в проекте A, переключается из view `main` в `settings` / `files` / `diff` / `history` / `claude-md` / `pipeline` и обратно — все сообщения, состояние стриминга и `session_id` видны без потерь, как будто переключения не было.
  2. Пользователь работает с двумя-тремя одновременно открытыми проектами (в пределах `ui.maxOpenProjects`, по умолчанию 3), переключает активный проект через сайдбар — переписка в каждом из этих проектов сохраняется при возврате к нему.
  3. Активная Claude-сессия (`isRunning === true`) продолжает принимать `claude-event` и накапливать сообщения в фоне, даже когда соответствующий проект/view не активен — при возврате пользователь видит догнавшуюся переписку, а не пропуск.
  4. Идентификаторы вкладок (`panelId`) и привязанные к ним runner'ы на бэкенде остаются неизменными при навигации — никаких «Session already running»-ошибок при возврате на ранее активную вкладку.
**Plans**: 3 plans
  - [x] 04-01-PLAN.md — Always-mounted рендер DualPanelLayout в src/App.tsx + удаление projectLayoutState Map
  - [x] 04-02-PLAN.md — Cleanup DualPanelLayout.tsx — удаление устаревшего state-lifting API
  - [x] 04-03-PLAN.md — Обновление App.test.tsx + полная test-pass + ручная UAT-верификация

### Phase 5: Chat Visibility & Controls
**Goal**: В каждом моменте чата видно, с какой моделью идёт диалог, какой `session_id` корреспондирует с логами Claude и сколько токенов потрачено; базовая операция `/clear` доступна через явную кнопку в UI, а не только через текстовую команду.
**Depends on**: Phase 4 (StatusBar и ChatPanel должны переживать навигацию, иначе показывать метаданные постоянно бессмысленно)
**Requirements**: VIS-01, VIS-02, VIS-03, UI-01
**Success Criteria** (что должно быть TRUE):
  1. Пользователь видит имя активной модели Claude (например `claude-sonnet-4-6`) постоянно в StatusBar для каждой запущенной вкладки чата — независимо от того, прокручена ли переписка вниз и виден ли исходный системный init-message.
  2. Пользователь видит `session_id` текущей Claude-сессии в StatusBar (полный или префикс достаточной длины), может скопировать его и сопоставить с файлами в `~/.claude/projects/`.
  3. Пользователь видит накопленное token usage текущей сессии в StatusBar — отдельно input / output / cache (cache_creation + cache_read), значение обновляется по мере получения `assistant`-событий с полем `usage`.
  4. Пользователь нажимает явную кнопку в шапке `ChatPanel` (или соседнем читаемом месте) и полностью очищает переписку текущей вкладки — поведение эквивалентно текстовой команде `/clear` (сброс `messages`, `sessionResult`, `hasSessionRef`, `archivedMessagesRef`, стриминг-состояния).
  5. Метаданные StatusBar (модель / session / usage) корректно обновляются при пересоздании сессии (после Clear или start новой сессии с другой моделью) — нет «прилипших» значений от предыдущей сессии.
**Plans**: 3 plans
  - [x] 05-01-PLAN.md — Типы (SessionMetadata) и i18n keys для StatusBar/Clear/CopyButton/TokensTooltip
  - [x] 05-02-PLAN.md — StatusBar: новые props model/sessionId/usage + рендер 3 полей с CopyButton и Tooltip + tests
  - [ ] 05-03-PLAN.md — ChatPanel: state аккумулятора, handleClear callback, UI-кнопка Clear в header, прокидывание props в StatusBar + tests
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Rust Vendoring | v1.0 | 3/3 | Complete | 2026-05-16 |
| 2. npm Vendoring | v1.0 | 3/3 | Complete | 2026-05-16 |
| 3. Build & Docs | v1.0 | 3/3 | Complete | 2026-05-16 |
| 4. Chat Persistence | v1.1 | 3/3 | Complete   | 2026-05-17 |
| 5. Chat Visibility & Controls | v1.1 | 2/3 | In Progress|  |
