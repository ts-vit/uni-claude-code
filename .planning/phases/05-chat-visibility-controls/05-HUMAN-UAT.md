---
status: partial
phase: 05-chat-visibility-controls
source: [05-VERIFICATION.md]
started: 2026-05-18T10:50:00Z
updated: 2026-05-18T10:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Имя модели в StatusBar
expected: В нижней строке ChatPanel появляется текст «Model: claude-sonnet-4-6» (или другая активная модель) сразу после первого system-события Claude CLI.
why_human: Требует живого Tauri-процесса с настроенным Claude CLI; unit-тесты проверяют передачу prop, но не реальный поток событий от CLI.
result: [pending]

### 2. CopyButton для session_id
expected: StatusBar показывает «Session: abc12345...» (prefix 8 символов + «...»). Клик по иконке копирует полный UUID в буфер обмена; иконка переключается на галочку на ~1.5 сек.
why_human: Поведение CopyButton (clipboard.writeText) недоступно в jsdom; реальный Clipboard API нужен браузерному WebView Tauri.
result: [pending]

### 3. Tooltip-breakdown токенов при hover
expected: Поле «Tokens» обновляется после каждого assistant-ответа. Tooltip при наведении показывает breakdown по Input / Output / Cache creation / Cache read.
why_human: Tooltip в Mantine рендерится лениво — только при hover; unit-тест проверяет сумму, но не открытие Tooltip-а.
result: [pending]

### 4. Кнопка Clear очищает переписку
expected: После клика по иконке-ластику в шапке ChatPanel: поле сообщений пустое, StatusBar показывает «Model: —», «Session: —», «Tokens: —».
why_human: Поведение подтверждается unit-тестом, но визуальный результат и правильное положение кнопки в header требуют ручного осмотра.
result: [pending]

### 5. End-to-end: Clear + новая сессия (no sticky-state)
expected: После Clear и запуска новой сессии: при первом system-событии StatusBar обновляется на имя модели и новый session_id; токены начинаются с 0. Нет «прилипших» значений от предыдущей сессии.
why_human: SC #5 покрыт unit-тестом на смену session_id, но end-to-end сценарий Clear + новый запуск требует live-сессии.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
