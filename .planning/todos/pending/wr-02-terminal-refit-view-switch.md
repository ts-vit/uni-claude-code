---
title: "WR-02: Terminal refit на view-switch — потенциальная регрессия после Phase 4 keep-mounted"
created: 2026-05-18
source: 04-REVIEW.md / 04-VERIFICATION.md / 04-HUMAN-UAT.md
severity: warning
status: deferred
phase_origin: 04-chat-persistence
resolves_phase: null
---

# WR-02 — Terminal refit на view-switch

## Контекст

После Phase 4 (Chat Persistence) `TerminalPanel` внутри `DualPanelLayout` постоянно смонтирован (keep-mounted), но `triggerTerminalRefit()` в `src/App.tsx:41-45` вызывается **только** в `handleProjectSelect` и `handleProjectCreated`, т.е. на смену активного проекта. На переключение `view ↔ view` (main ↔ settings/files/diff/history/claude-md/pipeline) refit не дёргается.

## Сценарий бага

1. Открыт проект A в view=main, терминал отрендерен и зафитен под текущую ширину.
2. Пользователь переключился в view=settings → блок (a) получает `display: none`. ResizeObserver в xterm/FitAddon при `display: none` подавлён.
3. Пользователь ресайзит окно (например, разворачивает на второй монитор).
4. Возврат в view=main → блок (a) снова `display: flex`.
5. Xterm всё ещё думает, что `cols/rows` прежние — без явного `fit()`. **Симптом:** обрезанные строки терминала, курсор смещён, ввод пишется не в той колонке.

До Phase 4 шаг 5 решался размонтированием + созданием новой инстанции (это и был источник проблемы chat-persistence). Теперь — не решается.

D-04-04 в 04-CONTEXT.md явно фиксирует: «терминалы НЕ перемонтируются, но всё ещё нуждаются в resize-events при смене видимого DOM-узла» — но фактически вызов `triggerTerminalRefit` забыт для view-переходов.

## Решение пользователя

User: «Так это старый баг пока править не будем. Но надо его запомнить» (2026-05-18).

Phase 4 закрыта с этим открытым пунктом. WR-02 deferred — не блокирует phase-completion.

## Возможный fix (когда дойдут руки)

Минимальная правка — добавить `useEffect` в `src/App.tsx`:

```tsx
useEffect(() => {
  if (view === "main" && activeProject) {
    triggerTerminalRefit();
  }
}, [view, activeProject?.id]);
```

Альтернативно — `ResizeObserver` на родителе блока (a) с принудительным `fit()` после `display: none → display: flex`.

## Ссылки

- `04-REVIEW.md` секция «WR-02»
- `04-VERIFICATION.md` секция «Human Verification Required»
- `04-HUMAN-UAT.md` Test #1
