# UNI Claude Code

Tauri 2 + React 19 + Rust IDE-ассистент на базе Claude Code CLI.
Многосессионный чат, встроенный терминал, SSH-туннелирование, управление MCP-серверами и пайплайн задач.

## Prerequisites

- **Node.js + npm** — свежая LTS-версия (`.nvmrc` в репозитории отсутствует)
- **Rust toolchain** (stable, edition 2021) — установка через [rustup.rs](https://rustup.rs)
- **Claude CLI** — Claude Code CLI by Anthropic должен быть доступен на `PATH`; используется в runtime для чат-сессий
- **Tauri 2 платформенные зависимости** (WebView2 на Windows, webkit2gtk на Linux, Xcode CLT на macOS) —
  полный список и инструкции: [v2.tauri.app/start/prerequisites/](https://v2.tauri.app/start/prerequisites/)

## Команды сборки и проверки

```bash
# Установить все зависимости
npm ci

# Запустить приложение в режиме разработки (Vite frontend + Rust backend)
npm run dev

# Собрать production-бандл (Tauri bundle)
npm run build

# Проверить типы TypeScript (tsc --noEmit)
npm run typecheck

# Запустить тесты frontend (vitest run)
npm run test

# Запустить тесты backend (cargo test --workspace)
npm run test:rust

# Запустить все проверки последовательно: typecheck + test + test:rust
npm run test:all
```
