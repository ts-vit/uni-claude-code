# Milestones

## v1.1 Chat UX (Shipped: 2026-05-18)

**Goal:** Чат не теряется при навигации между view и проектами; в каждом моменте видно, с какой моделью идёт диалог и сколько токенов потрачено; базовые операции доступны через UI-кнопку, а не только через текстовые команды.

**Scope:** 2 phases, 6 plans, 9 tasks. Frontend-only — 10 файлов изменено (+497/−110), 40 commits за ~12 часов 2026-05-18, vitest 119/119 passing.

**Key accomplishments:**

1. **PERSIST-01/02 — keep-mounted рендер.** `src/App.tsx` переписан в три sibling-блока (`main` / view-overlay / welcome) с переключением видимости через `display: flex/none` вместо conditional unmount; каждый opened project держит `DualPanelLayout` смонтированным всегда. Удалён мёртвый `projectLayoutState Map` и публичный API `DualPanelLayoutState` (`initialState`/`onStateChange`); `App.test.tsx` инвертирован под keep-mounted семантику.
2. **VIS-01/02/03 — постоянные индикаторы сессии в StatusBar.** Добавлены три новых поля: Model (имя активной модели), Session (8-символьный prefix + Mantine `CopyButton` через render-prop для копирования полного UUID), Σ Tokens (накопленная сумма с `Tooltip`-breakdown по input / output / cache_creation / cache_read). 15 unit-тестов StatusBar (7 новых).
3. **UI-01 — кнопка Clear в шапке ChatPanel.** `ActionIcon` с `IconEraser` (`ml="auto"`, `disabled={isRunning}`); единый `handleClear` атомарно сбрасывает 8 полей состояния (`messages`, `sessionResult`, `hasSessionRef`, `archivedMessagesRef`, стриминг-буферы + `sessionModel`, `sessionId`, `accumulatedUsage`); эквивалент текстовой команды `/clear`.
4. **Accumulator с ref-based reset.** В `ChatPanel` добавлены три `useState`: `sessionModel`, `sessionId`, `accumulatedUsage`. Накопление usage из `assistant.message.usage` через functional updater; reset accumulator при смене `session_id` реализован через ref-сравнение (CR-01 fix в коммите `ce93e73` — заменил impure `setState` в `case "system"` на чистый ref-based switch).
5. **TypeScript + i18n фундамент.** Тип `SessionMetadata { model, sessionId, usage }` в `src/types/claude.ts`; новые i18n-keys `chat.{model,session,tokens,copySessionId,copied,clearChat}` + nested `chat.tokensTooltip.{input,output,cacheCreation,cacheRead}` в EN+RU локалях.
6. **UAT closure.** Phase 5 HUMAN-UAT: 5/5 live-сценариев passed пользователем (CopyButton + Clipboard API, Tooltip hover, Clear-кнопка, refresh сессии после Clear). Phase 4 HUMAN-UAT: 26-пунктовый чек-лист подтверждён; единственный сценарий (WR-02 — ресайз окна при невидимой панели) отложен как known warning.

**Known deferred items at close: 4** (см. STATE.md → Deferred Items → «Acknowledged at v1.1 close»):

- **WR-02** — `triggerTerminalRefit()` не вызывается на view-switch после keep-mounted рендера; xterm/FitAddon может показывать обрезанные строки после resize окна при невидимой панели. Решение: «старый баг, пока править не будем» (трекается в `.planning/todos/pending/wr-02-terminal-refit-view-switch.md`).
- Phase 04 HUMAN-UAT (`status: deferred`) — единственный сценарий WR-02 отложен.
- Phase 04 VERIFICATION (`status: human_needed`) — соответствует deferred WR-02; статус намеренно не повышен до `verified`.
- Phase 05 HUMAN-UAT (`status: resolved`) — flagged audit-логикой как формальный gap, но фактически все сценарии closed.

**Archives:**

- `.planning/milestones/v1.1-ROADMAP.md` — полные детали Phase 4 (Chat Persistence) и Phase 5 (Chat Visibility & Controls)
- `.planning/milestones/v1.1-REQUIREMENTS.md` — 6 требований (PERSIST-01/02, VIS-01/02/03, UI-01) со статусами Complete
- `.planning/milestones/v1.1-phases/` — артефакты обеих фаз (CONTEXT, PLAN, SUMMARY, VERIFICATION, HUMAN-UAT, REVIEW, DISCUSSION-LOG, PATTERNS)

**Git tag:** `v1.1` (local-only)

---

## v1.0 Vendoring (Shipped: 2026-05-16)

**Goal:** Убрать зависимость репозитория от приватного npm-реестра `npm.ts-vit.com` и приватной git-ветки `github.com/ts-vit/ai-chat#dev`. Чистый клон без приватной сети полностью собирается и проходит все тесты.

**Scope:** 3 phases, 9 plans, 18 tasks.

**Key accomplishments:**

1. 6 крейтов `uni-*` (`uni-common`, `uni-process`, `uni-settings`, `uni-db`, `uni-ssh`, `uni-terminal`) внесены в `crates/` как члены workspace и path-зависимости; 7 git-ссылок на `github.com/ts-vit/ai-chat#dev` устранены; `cargo build --workspace` проходит без сети.
2. 3 npm-пакета `@uni-fw/*` (`ssh-ui`, `terminal-ui`, `ui`) внесены в `packages/uni-fw-*` через npm workspaces со ссылкой `workspace:*`; `.npmrc` удалён; `npm ci` проходит без сети.
3. Top-level `README.md` создан (RU, quickstart, 37 строк, 0 упоминаний приватных сервисов); `CLAUDE.md` и 6 файлов `.planning/codebase/*` переписаны на vendored-язык; секция «Supply Chain Risk» удалена из `CONCERNS.md`.
4. End-to-end проверка чистого клона: `git clone --no-local` + 5 grep-инвариантов (0 hits) + `npm ci` (17.9s) + `cargo build --workspace` (89.4s) + `npm run test:all` (118.2s, vitest 106/106 passed + cargo test 97 passed/1 ignored) + `npm run build` (212.1s, MSI + NSIS bundles) — все exit 0 без приватной сети.

**Known deviations (acknowledged, see phase VERIFICATION.md files):**

- **D-V2** — фактическая независимость от приватной сети доказана через grep-инварианты + успешный прогон команд в свежем клоне вместо физической сетевой блокировки (D-V1 запретил firewall/hosts-правки).
- **D-C4** — три устаревших упоминания внутри GSD-генератор-блоков `CLAUDE.md` (строки 77, 143, 247) сохранены; правка между маркерами `<!-- GSD:* -->` запрещена дизайном, блоки обновятся автоматически при следующем прогоне `generate-claude-profile` от уже-зачищенных source-документов.

**Archives:**

- `.planning/milestones/v1.0-ROADMAP.md` — полные детали фаз
- `.planning/milestones/v1.0-REQUIREMENTS.md` — 26 требований (RUST-01..10, NPM-01..10, BUILD-01..06) со статусами Complete
- `.planning/milestones/v1.0-phases/` — артефакты всех трёх фаз (CONTEXT.md, PLAN.md, SUMMARY.md, VERIFICATION.md, TEST-NOTES, REVIEW.md)

**Git tag:** `v1.0` (local-only, не запушен)

---
