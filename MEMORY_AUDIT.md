# MEMORY AUDIT

Дата аудита: 2026-04-01

## Краткий вывод

Критичных "забытых cleanup" по `listen()`, `setInterval()` и `setTimeout()` в исходниках `src/` почти нет. Основной риск памяти находится в двух местах:

1. Асинхронная подписка через `listen(...).then(...)` в нескольких компонентах создаёт race condition: если компонент размонтирован до резолва промиса, `unlisten` не будет вызван и подписка останется жить.
2. `App.tsx` держит несколько `DualPanelLayout` смонтированными через `display: none`; скрытые панели продолжают выполнять `useEffect`, держать `claude-event` listeners, состояние чата и, вероятно, ресурсы терминала.

## Проверенное покрытие

- Проверены все прямые использования `listen()` в `src/`.
- Проверены все `setInterval` / `setTimeout` / `requestAnimationFrame` в `src/`.
- Проверен lifecycle использования `TerminalPanel` в коде репозитория.
- Проверен паттерн скрытых через `display:none` компонентов.
- Проверены backend emit-точки в `src-tauri/src/`.

## Найденные проблемы

| Priority | File | Line | Тип | Описание | Предложенный фикс |
|---|---|---:|---|---|---|
| critical | `src/App.tsx` | 245 | Hidden mounted components | Все `openedProjects` рендерятся одновременно, а неактивные проекты скрываются через `display: "none"`. Это значит, что каждый `DualPanelLayout` остаётся смонтированным, его `useEffect` продолжают работать, подписки на `claude-event` остаются активными, состояние чатов и терминалов остаётся в памяти часами. При 3 открытых проектах это как минимум 6 frontend-listeners на `claude-event` только из локального кода, без учёта `TerminalPanel`. | Размонтировать неактивные проекты вместо `display:none`, либо внедрить явную паузу/отключение listeners и terminal sessions у неактивных панелей. |
| critical | `src/components/chat/ChatPanel.tsx` | 336 | Async listener cleanup race | Подписка создаётся через `listen(...).then((fn) => { unlisten = fn; })`, а cleanup вызывает только текущее значение `unlisten`. Если компонент размонтируется до резолва `listen()`, cleanup выполнится раньше, `unlisten` останется `null`, и реальная подписка утечёт навсегда. На фоне скрытых смонтированных панелей риск накапливается. | Использовать паттерн с флагом `disposed` и немедленным вызовом `fn()` после резолва, если cleanup уже произошёл. |
| critical | `src/components/DualPanelLayout.tsx` | 80 | Async listener cleanup race | Тот же race pattern для глобальной подписки на `claude-event`. Даже одна утекшая подписка будет продолжать обрабатывать все события всех панелей. | Тот же фикс: `let disposed = false; listen(...).then((fn) => disposed ? fn() : (unlisten = fn)); return () => { disposed = true; unlisten?.(); };` |
| critical | `src/hooks/usePipelineController.ts` | 233 | Async listener cleanup race | Аналогичная гонка cleanup в pipeline listener. Если `PipelinePage` размонтируется во время асинхронной регистрации, listener на `claude-event` может остаться активным и удерживать refs/state через closure. | Применить тот же безопасный шаблон cleanup для promise-based `listen()`. |
| medium | `src/components/DualPanelLayout.tsx` | 278 | xterm / terminal lifetime risk | `TerminalPanel` из `@uni-fw/terminal-ui` всегда смонтирован внутри каждого `DualPanelLayout`, даже если проект скрыт или пользователь смотрит на другой panel/view. Исходник `TerminalPanel` в репозитории отсутствует, поэтому нельзя доказать, что его `Terminal`, addons и PTY listeners корректно dispose'ятся. Но текущий паттерн использования гарантирует длительное удержание терминальных ресурсов для всех opened projects. | Проверить пакет `@uni-fw/terminal-ui`: должны быть `terminal.dispose()`, dispose addons, отписка от `pty-data` / `pty-exit`, закрытие PTY session. На уровне app — не держать скрытые терминалы смонтированными. |
| medium | `src/components/PipelinePage.tsx` | 523 | Hidden mounted chat panels | В live-view пайплайна одновременно смонтированы оба `ChatPanel` (`discuss` и `code`), один из них скрыт через `display:none`. У обоих живы `claude-event` listeners; это не баг само по себе, но увеличивает число активных подписок и объём удерживаемого состояния. | Размонтировать неактивную фазу пайплайна или сделать listener conditional по `pipeline.currentPhase`. |
| medium | `src/hooks/usePipelineController.ts` | 48 | Unbounded in-memory log growth | `log` в state накапливается без лимита: `log: [...prev.log, logEntry]`. При долгой работе пайплайна или множестве задач это даёт линейный рост памяти даже без визуальной активности. | Ограничить размер лога, например последними 200-500 записями, или выносить историю в persistent storage. |
| low | `src-tauri/src/commands/claude.rs` | 141 | Global event fan-out | Backend отправляет каждый `RunnerEvent` через глобальный `app.emit("claude-event", ...)`. Даже если конкретной панели событие не нужно, оно доходит до всех frontend listeners, а фильтрация идёт уже на клиенте. Это не самостоятельная утечка, но сильно усиливает эффект от лишних подписок и скрытых компонентов. | Перейти на scoped events по panel id, отдельные event names или канал с целевой адресацией. |
| low | `src-tauri/src/lib.rs` | 143 | PTY emit without subscriber awareness | PTY данные и exit events эмитятся глобально (`pty-data`, `pty-exit`) независимо от того, есть ли активные видимые терминалы. В коде репозитория нет признаков subscriber-aware backpressure. Это не доказывает утечку, но повышает риск лишней очереди/нагрузки при скрытых терминалах. | Проверить `uni_terminal` / `@uni-fw/terminal-ui` на backpressure, отписку и уничтожение session при unmount. |

## Проверка `listen()`

Найдены все прямые использования `listen()` в `src/`:

1. `src/components/SshStatusIndicator.tsx:24-28`
   Статус: cleanup есть.
   Замечание: безопаснее, чем остальные места, потому что cleanup делает `p.then((unlisten) => unlisten())` и вызовет отписку даже если промис зарезолвится после unmount.

2. `src/components/DualPanelLayout.tsx:82`
   Статус: cleanup формально есть, но содержит race condition.

3. `src/components/chat/ChatPanel.tsx:338`
   Статус: cleanup формально есть, но содержит race condition.

4. `src/hooks/usePipelineController.ts:236`
   Статус: cleanup формально есть, но содержит race condition.

Итог: прямых случаев "вообще без cleanup" в `src/` не найдено, но 3 из 4 подписок используют небезопасный async cleanup pattern.

## Проверка таймеров и RAF

1. `src/components/PipelinePage.tsx:135`
   `setInterval(...)` очищается через `clearInterval(interval)`.

2. `src/App.tsx:42`
   `window.setTimeout(...)` одноразовый, короткий, вне `useEffect`; явной утечки не образует.

3. `src/components/chat/ChatPanel.tsx:118`
   `requestAnimationFrame(...)` корректно отменяется в `resetStreamingState()` и в unmount cleanup.

Итог: явных утечек по `setInterval` / `setTimeout` / `requestAnimationFrame` не найдено.

## Проверка xterm.js lifecycle

Поиск по `src/` не нашёл локальных `new Terminal(...)` или `.dispose()`; терминал используется через внешний компонент:

- `src/components/DualPanelLayout.tsx:278` -> `TerminalPanel` из `@uni-fw/terminal-ui`

Из-за отсутствия исходников `@uni-fw/terminal-ui` внутри репозитория нельзя подтвердить:

- вызывает ли компонент `terminal.dispose()` при unmount;
- dispose'ит ли `FitAddon`, `WebLinksAddon` и прочие addons;
- отписывается ли от `pty-data` / `pty-exit`;
- уничтожает ли PTY session при скрытии/размонтировании.

Однако текущий app-level lifecycle уже проблемный: скрытые проекты не размонтируются, значит скрытые `TerminalPanel` потенциально живут столько же, сколько живёт приложение.

## Проверка `display:none` и количества подписок

### Main view

В `src/App.tsx:245-263` одновременно рендерятся все `openedProjects`, а неактивные скрываются через `display:none`.

Для каждого открытого проекта минимум создаётся:

- 1 listener в `DualPanelLayout` на `claude-event`
- 1 listener в активной вкладке `ChatPanel` на `claude-event`
- 1 внешний `TerminalPanel` с неизвестным количеством PTY listeners

Итого без учёта терминала:

- 1 проект -> минимум 2 listeners на `claude-event`
- 3 проекта -> минимум 6 listeners на `claude-event`

Если пользователь добавляет дополнительные discuss tabs, каждая вкладка создаёт ещё один смонтированный `ChatPanel`, а скрытие внутри `DualPanelLayout` тоже сделано через `display:none`. Значит listeners масштабируются и по числу проектов, и по числу вкладок.

### Pipeline live view

В `src/components/PipelinePage.tsx:523-550` обе фазы (`discuss` и `code`) смонтированы одновременно, одна скрыта через `display:none`.

Во время работы пайплайна это даёт:

- 2 `ChatPanel` listeners
- 1 listener в `usePipelineController`

Итого минимум 3 listeners на `claude-event` только для pipeline UI.

## Проверка Rust-side emit

### Найденные emit-точки

- `src-tauri/src/commands/claude.rs:141` -> `app.emit("claude-event", &panel_event)`
- `src-tauri/src/lib.rs:106-128` -> `ssh-tunnel-*`, `proxy-settings-changed`
- `src-tauri/src/lib.rs:143-159` -> `pty-data`, `pty-exit`

### Вывод

- `claude-event` эмитится на каждое событие runner'а глобально и попадает всем подписчикам.
- `pty-data` и `pty-exit` тоже эмитятся глобально.
- В просмотренном коде backend нет проверки наличия подписчиков перед emit.
- Само по себе это не доказывает утечку, но в комбинации со скрыто смонтированными компонентами и утекшими listeners существенно увеличивает потребление памяти и объём работы на каждом событии.

## Итоговый приоритет

### Critical

1. Скрытые, но смонтированные `DualPanelLayout` в `App.tsx`.
2. Race condition cleanup у `listen()` в `ChatPanel.tsx`.
3. Race condition cleanup у `listen()` в `DualPanelLayout.tsx`.
4. Race condition cleanup у `listen()` в `usePipelineController.ts`.

### Medium

1. Потенциально долгоживущие `TerminalPanel` / xterm / PTY ресурсы у скрытых проектов.
2. Одновременный mount двух `ChatPanel` в pipeline live view.
3. Неограниченный рост `pipeline.log`.

### Low

1. Глобальный fan-out `claude-event`.
2. Глобальный emit `pty-data` / `pty-exit` без видимой subscriber-aware оптимизации.

## Что не подтверждено по исходникам репозитория

Следующие риски вероятны, но не могут быть доказаны без аудита внешних пакетов:

- реальная утечка `xterm.js` instance;
- отсутствие `dispose()` у xterm addons;
- незакрытые PTY/websocket/event connections внутри `@uni-fw/terminal-ui` или `uni_terminal`.

Для их подтверждения нужен аудит исходников `@uni-fw/terminal-ui` и `uni_terminal`.
