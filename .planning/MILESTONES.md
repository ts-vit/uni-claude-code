# Milestones

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
