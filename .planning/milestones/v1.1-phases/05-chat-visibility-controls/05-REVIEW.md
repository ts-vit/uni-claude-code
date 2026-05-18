---
phase: 05-chat-visibility-controls
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/types/claude.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/ru.json
  - src/components/chat/StatusBar.tsx
  - src/__tests__/StatusBar.test.tsx
  - src/components/chat/ChatPanel.tsx
  - src/__tests__/ChatPanel.test.tsx
findings:
  critical: 1
  warning: 7
  info: 4
  total: 12
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-18
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Реализация Phase 5 в целом выполнена в соответствии с планами 05-01..05-03 и закрытыми решениями D-05-01..14. State, рендер, тесты, i18n keys присутствуют, типы `SessionMetadata` / `Usage` нетронуты, backend не затронут. Однако обнаружен **один критический баг** в обработчике `case "system"`, который нарушает React-инвариант "updaters должны быть чистыми" — побочный эффект `setAccumulatedUsage(null)` вызывается внутри функционального updater'а `setSessionId`. В React 18 StrictMode и при повторных рендерах это может вызвать двойное обнуление, и, что хуже, проблемы будущей отладки.

Дополнительно — серия предупреждений: лишний non-null assertion `tokenSum!`, неубедительные/хрупкие matcher'ы в новых тестах, потенциальный race condition между `system`-eventом и приходом `assistant` без предшествующего `system`, опасное отсутствие defensive copy для входящего `Usage` в первый branch accumulator init (фактически implemented через `{...curr}` — OK; но D-05 объявлял дополнительные edge-кейсы).

Backend и Phase 4 invariants (keep-mounted, `useTauriListener`) не задеты — это позитивно.

## Critical Issues

### CR-01: setState внутри функционального updater другого setState (нарушение чистоты)

**File:** `src/components/chat/ChatPanel.tsx:142-147`
**Issue:** `setSessionId((prevId) => { if (claudeEvent.session_id && claudeEvent.session_id !== prevId) { setAccumulatedUsage(null); } return ... })` вызывает другой `setState` (`setAccumulatedUsage(null)`) внутри функционального updater'а `setSessionId`. React **гарантирует** только то, что updater будет вызван хотя бы один раз — но в StrictMode (а Vite dev-mode по умолчанию его включает в `<React.StrictMode>` обёртках; проверить `src/main.tsx`) React **намеренно вызывает updater дважды** для выявления побочных эффектов. Это значит:

1. В StrictMode `setAccumulatedUsage(null)` будет вызван **2 раза подряд** при одном входящем `system` event.
2. Если React в будущем добавит batching/retry updater'ов (что уже произошло с concurrent rendering) — обнуление может произойти больше раз или в неожиданный момент.
3. Сам факт setState внутри updater'а другого setState — это явный React anti-pattern (см. React docs «Updater functions must be pure»).

В текущей реализации сам baseline функционально работает (null → null = no-op, а accumulator ещё не успел установиться к моменту первого system-event), но это **скрытая ловушка для будущих изменений**: если кто-то добавит `setSessionResult(null)` или другую side-effect внутри updater'а, поведение будет недетерминированным.

**Fix:**
```tsx
case "system": {
  const newSessionId = claudeEvent.session_id ?? null;
  // Чистое сравнение вне updater — никакого setState-в-setState
  setSessionId((prevId) => {
    if (newSessionId && newSessionId !== prevId) {
      // Отложить сайд-эффект на следующий тик — НО лучше вынести логику наружу.
      // См. ниже корректный вариант.
    }
    return newSessionId ?? prevId;
  });
  // ...
}
```

Корректный вариант — вынести сравнение наружу через ref или вычислить в условии:
```tsx
case "system": {
  const newSessionId = claudeEvent.session_id ?? null;
  // Используем функциональную форму чтобы атомарно получить prev,
  // но решение про reset принимаем ПО ЗАВЕРШЕНИИ обновления через отдельный effect,
  // либо проще — сравнить с ref'ом текущего sessionId.
  if (newSessionId && newSessionId !== sessionIdRef.current) {
    setAccumulatedUsage(null);
  }
  setSessionId(newSessionId ?? sessionIdRef.current);
  // sessionIdRef обновляется в отдельном useEffect, синхронизированном с sessionId state.
  // ...
}
```

Альтернатива — `useReducer` с одним диспатчем, который атомарно обрабатывает оба поля.

---

## Warnings

### WR-01: non-null assertion `tokenSum!` без необходимости

**File:** `src/components/chat/StatusBar.tsx:85`
**Issue:** `{t("chat.tokens")}: {tokenSum!.toLocaleString()}` использует non-null assertion `!`. TS strict mode не сужает тип `tokenSum: number | null` между объявлением (строка 17-20) и JSX (строка 85), потому что между ними расстояние больше, чем TS narrowing держит. Тем не менее, безусловный `!` — это шум кода. JSX-блок уже находится в ветке `usage !== null ? (...)`, значит `tokenSum` гарантированно `number`. Лучше либо вычислить `tokenSum` локально внутри ветки, либо использовать non-nullable вычисление с `(usage.input_tokens + ...).toLocaleString()` непосредственно.

**Fix:**
```tsx
{usage !== null ? (
  <Tooltip ...>
    {(() => {
      const sum = usage.input_tokens + usage.output_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
      return (
        <Text size="xs" c="dimmed" style={{ cursor: "default" }}>
          {t("chat.tokens")}: {sum.toLocaleString()}
        </Text>
      );
    })()}
  </Tooltip>
) : (...)}
```
Или просто: `{(usage.input_tokens + usage.output_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens).toLocaleString()}` — TS внутри ветки видит `usage` как non-null.

### WR-02: повторное использование `claudeEvent.result!` (non-null assertion после if-guard)

**File:** `src/components/chat/ChatPanel.tsx:306, 309`
**Issue:** В блоке `case "result"`:
```tsx
if (claudeEvent.result) {
  updateMessages((prev) => {
    // ...
    updated[updated.length - 1] = { ...last, text: claudeEvent.result!, streaming: false };
    // ...
    return [...prev, { id: createMessageId(), kind: "assistant-text", text: claudeEvent.result!, streaming: false }];
  });
}
```
Использует `claudeEvent.result!` дважды внутри `updateMessages` callback. TS-narrowing не переживает функциональное замыкание — отсюда `!`. Однако `claudeEvent` уже захвачен замыканием, и `claudeEvent.result` может теоретически быть mutated (хотя на практике маловероятно). Лучше извлечь в локальную const перед `updateMessages`:

**Fix:**
```tsx
if (claudeEvent.result) {
  const resultText = claudeEvent.result; // narrow type once
  updateMessages((prev) => {
    // ...
    updated[updated.length - 1] = { ...last, text: resultText, streaming: false };
    // ...
    return [...prev, { id: createMessageId(), kind: "assistant-text", text: resultText, streaming: false }];
  });
}
```

### WR-03: missing dependency `resetStreamingState` в handleClear

**File:** `src/components/chat/ChatPanel.tsx:419-428`
**Issue:** `handleClear` использует `resetStreamingState` и указывает его в deps. Однако `setMessages`, `setSessionResult`, `setSessionModel`, `setSessionId`, `setAccumulatedUsage` — все они стабильны (React гарантия). Технически OK. Но `archivedMessagesRef.current = []` — присваивание current полю ref'а — НЕ триггерит ре-рендер, поэтому если в какой-то момент `<MessageList>` пропсом считывает `archivedMessagesRef.current.length > 0` (как сейчас на строке 553), ре-рендер MessageList произойдёт только в следующий тик при ре-рендере ChatPanel. После clear `setMessages([])` триггерит ре-рендер, поэтому всё OK. **Но эта связь хрупкая** — если в будущем clear-логика поменяется (например, `setMessages` не будет вызываться), `hasEarlierMessages` показатель устареет.

**Fix:** Перевести `archivedMessages` в state, либо добавить явный комментарий:
```tsx
const handleClear = useCallback(() => {
  setMessages([]); // also triggers re-render so `archivedMessagesRef.current` reads are fresh
  // ...
  archivedMessagesRef.current = [];
  // ...
}, [resetStreamingState]);
```

### WR-04: handleSend deps array потерял `resetStreamingState`

**File:** `src/components/chat/ChatPanel.tsx:430-461`
**Issue:** Согласно плану 05-03 Task 1 пункт (7), deps `handleSend` должны были измениться с
`[createMessageId, cwd, mode, panelId, projectModel, projectPermissionMode, resetStreamingState, updateMessages]`
на
`[createMessageId, cwd, handleClear, mode, panelId, projectModel, projectPermissionMode, updateMessages]`
— добавлен `handleClear`, удалён `resetStreamingState`.

В коде (`ChatPanel.tsx:460`) deps:
```tsx
[createMessageId, cwd, handleClear, mode, panelId, projectModel, projectPermissionMode, updateMessages]
```
Это корректно — `resetStreamingState` больше не используется напрямую в `handleSend` (через `handleClear`). **Но**: проверка фактического исходника показывает что в текущем `handleSend` нет вызова `resetStreamingState`, всё через `handleClear()`. OK. Однако: TypeScript ESLint `react-hooks/exhaustive-deps` правило могло бы warn'ить, если такое правило включено в проекте. Если нет — это просто info, не warning. Поднимаю до warning, т.к. неявная dependency через `handleClear` может ввести в заблуждение при чтении.

**Fix:** Добавить комментарий явно:
```tsx
const handleSend = useCallback(
  async (text: string) => {
    // ...
  },
  // handleClear inherits resetStreamingState dep — see handleClear's own deps
  [createMessageId, cwd, handleClear, mode, panelId, projectModel, projectPermissionMode, updateMessages],
);
```

### WR-05: race condition между `assistant` (с usage) до первого `system` event

**File:** `src/components/chat/ChatPanel.tsx:264-278`
**Issue:** В `case "assistant"` accumulator инициализируется при первом приходе usage. Однако если порядок event'ов нарушен (например, Claude CLI прислал `assistant` event без предшествующего `system` event — теоретически возможно при `--continue` или resumed session), `accumulatedUsage` будет инициализирован, но `sessionId` будет `null`. Затем если придёт `system` с новым `session_id`, наш `setSessionId` updater сравнит `claudeEvent.session_id !== null` (`prevId === null`) и сбросит accumulator. То есть: первая инициализация будет потеряна.

В норме `system` приходит **первым** (это контракт CLI), и реальный риск низкий. Но защита от нарушения порядка отсутствует.

**Fix:** Условно инициализировать `accumulatedUsage` только когда `sessionId !== null`:
```tsx
if (claudeEvent.message.usage && sessionIdRef.current !== null) {
  // ...
}
```
Или принять текущее поведение и явно задокументировать инвариант: «system event всегда приходит первым; если CLI нарушит этот порядок, accumulator будет cumulative-but-then-reset».

### WR-06: i18n keys в `tokensTooltip` помечают raw labels — но `cache_creation_input_tokens` и `cache_read_input_tokens` отображаются как нагруженные числа без единицы измерения

**File:** `src/components/chat/StatusBar.tsx:77-82`, `src/i18n/locales/{en,ru}.json` (chat.tokensTooltip.*)
**Issue:** В tooltip выводятся 4 строки, например `Cache creation: 12,345`. Числа без суффикса единицы. Для usability в реальной работе это может быть путающим — пользователь не сразу поймёт, что "12,345" это **tokens** (а не байты, секунды, доллары). При том что общий счётчик `ΣTokens` имеет префикс `chat.tokens` («Токены»), внутри tooltip контекст теряется.

**Fix:** Либо добавить заголовок в tooltip (например, первой строкой `t("chat.tokens")` или mini-header), либо использовать формат `12,345 tok` для всех 4 строк, либо принять текущее поведение и добавить unit-test, проверяющий contents. Сейчас лишь визуальная UX-проблема, не bug.

### WR-07: `disabled={isRunning || !cwd}` в PromptInput, но Clear-кнопка только `disabled={isRunning}`

**File:** `src/components/chat/ChatPanel.tsx:508` (Clear), `src/components/chat/ChatPanel.tsx:560` (PromptInput)
**Issue:** PromptInput `isRunning={isRunning || !cwd}` — кнопка Send disabled и при отсутствии cwd. Clear-кнопка `disabled={isRunning}` — Clear работает даже когда `cwd` пустой. Это логично (Clear не зависит от cwd), но создаёт UX-нестыковку: если cwd выбран `null`/пустой, у пользователя есть disabled Send, disabled Stop, активная Clear. Что Clear-нет — нечего (messages пустые, isRunning=false, sessionResult=null). Кликнуть Clear для no-op — minor UX-странность.

**Fix:** Опционально дополнить условие:
```tsx
disabled={isRunning || messages.length === 0}
```
Это блокирует Clear, когда нечего очищать. Не критично — нынешнее поведение функционально корректно, просто полировка.

---

## Info

### IN-01: Лишний пустой `<>` Fragment в StatusBar

**File:** `src/components/chat/StatusBar.tsx:52-71`
**Issue:** `<>...</>` Fragment окружает Text + CopyButton, но не несёт никакой нагрузки — оба элемента и так могут быть siblings в outer Group. Лишний Fragment безопасен, но визуальный шум.

**Fix:** Убрать Fragment — `Text` и `CopyButton` сами рендерятся как siblings внутри outer `<Group>`. Альтернативно: использовать `<Group gap={4}>` для группировки Text+CopyButton, чтобы они визуально были ближе друг к другу, чем остальные поля statusbar (CopyButton логически relates к Session, а не равноправно с Cost).

### IN-02: Magic number `1500` для CopyButton timeout

**File:** `src/components/chat/StatusBar.tsx:55`
**Issue:** `CopyButton value={sessionId} timeout={1500}` — magic number. По Mantine convention 1500ms — стандартный таймаут "Copied" фидбэка, но магическое число всё равно лучше вынести в named const.

**Fix:**
```tsx
const COPY_FEEDBACK_TIMEOUT_MS = 1500;
// ...
<CopyButton value={sessionId} timeout={COPY_FEEDBACK_TIMEOUT_MS}>
```

### IN-03: Дублирование fallback `?? null` в JSX

**File:** `src/components/chat/ChatPanel.tsx:569`
**Issue:** `model={sessionModel ?? projectModel ?? null}` — двойной `?? null`. Третий `?? null` избыточен: `sessionModel ?? projectModel` уже даёт `string | null | undefined`. Если `projectModel: string | null | undefined`, тогда `string | undefined` после second `??`. Третий `?? null` нормализует к `string | null`, что и нужно для `model: string | null`. Технически корректно, просто слегка многословно. TypeScript bridge: `projectModel?: string | null` ⇒ `string | null | undefined` ⇒ `?? null` нормализует undefined в null. OK, но не магическая константа.

**Fix:** Извлечь в локальную const:
```tsx
const displayedModel: string | null = sessionModel ?? projectModel ?? null;
// ...
<StatusBar model={displayedModel} ... />
```

### IN-04: Хрупкий matcher `(content) => /chat\.tokens.*—/.test(content)` в тестах

**File:** `src/__tests__/StatusBar.test.tsx:116`, `src/__tests__/ChatPanel.test.tsx:334, 363, 374-376, 417-419`
**Issue:** Тесты полагаются на формат `chat.tokens: —`, где `:` literally в текст-content. Поскольку i18n mock возвращает key as-is, тест работает. Однако:

1. Если в будущем формат рендера поменяется (например, `{t("chat.tokens")} - {value}` через дефис вместо двоеточия) — тест продолжит проходить (regex `.*` жадный), но **не отловит**, что текст стал нелогичным.
2. Matcher `(c) => /chat\.tokens/.test(c) && /750/.test(c)` падёт, если другой StatusBar-элемент случайно содержит "750" (например, sessionId-prefix `7500abcd`). В реальности маловероятно, но защиты нет.

**Fix:** Использовать более специфичный matcher:
```tsx
expect(screen.getByText(/^chat\.tokens:\s*750$/)).toBeInTheDocument();
```
Это требует точного совпадения формата, и сразу падёт при изменении layout. Или использовать data-testid:
```tsx
<Text data-testid="status-tokens">...</Text>
// в тесте:
expect(screen.getByTestId("status-tokens")).toHaveTextContent("chat.tokens: 750");
```

---

_Reviewed: 2026-05-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
