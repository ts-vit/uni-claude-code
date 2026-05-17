---
status: deferred
phase: 04-chat-persistence
source: [04-VERIFICATION.md]
started: 2026-05-18T01:20:00Z
updated: 2026-05-18T01:30:00Z
---

## Current Test

[deferred — отложено пользователем как «старый баг» 2026-05-18]

## Tests

### 1. Терминал переживает window-resize при невидимой панели (WR-02)
expected: После: открыть проект A → view main, ресайзить окно → settings → ресайзить окно ещё раз → вернуться в main. Терминал в DualPanelLayout должен корректно подогнаться (cols/rows совпадают с фактической шириной), курсор не смещён, ввод пишется в правильную колонку.
result: deferred — see `.planning/todos/pending/wr-02-terminal-refit-view-switch.md`

## Summary

total: 1
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 0
deferred: 1

## Gaps

Нет gaps, блокирующих закрытие фазы. WR-02 (Terminal refit на view-switch) отложен в `.planning/todos/pending/wr-02-terminal-refit-view-switch.md` по решению пользователя 2026-05-18 («это старый баг, пока не править, но запомнить»).
