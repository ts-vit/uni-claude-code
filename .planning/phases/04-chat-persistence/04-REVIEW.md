---
phase: 04-chat-persistence
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/App.tsx
  - src/components/DualPanelLayout.tsx
  - src/__tests__/App.test.tsx
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-18
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Адверсариальное ревью трёх изменённых файлов фазы «Chat Persistence». Основная цель фазы (всегда-смонтированный `DualPanelLayout` + видимость через CSS, удаление мёртвого `projectLayoutState` Map / `DualPanelLayoutState` type / `initialState`/`onStateChange` props) реализована корректно — `grep` подтверждает, что во всём `src/` не осталось ни одного упоминания удалённых идентификаторов, и ChatPanel-state (`messages`, refs, стриминг-буферы) теперь действительно физически переживает навигацию.

Тем не менее, найден ряд WARNING-уровня дефектов:

1. CSS-структура нового root-контейнера: `flex: 1` на трёх sibling-блоках мёртв, потому что родитель — block-контекст, а не flex. Видимая регрессия маловероятна, но это нерабочая стилевая инструкция, которая вводит в заблуждение и может дать сюрприз при будущих правках.
2. `triggerTerminalRefit` больше не вызывается на переходе main ↔ settings/files/... — постоянно смонтированный `TerminalPanel` (через `xterm` `FitAddon`) не получает resize-event при показе/скрытии своего DOM-узла. Если окно ресайзилось пока пользователь был в settings, при возврате терминал останется с устаревшим `cols/rows`.
3. Тест `keeps active project layout mounted when switching views` не проверяет computed-видимость блока (а только присутствие в DOM) — регрессия типа «обёртка осталась `display: none` после возврата» проскочила бы.
4. Селектор `document.querySelector(".tabler-icon-settings")?.closest("button")` хрупкий — зависит от внутренней структуры классов Tabler-иконок Mantine, без явного контракта.

INFO-уровня: документация комментариев (a)/(b)/(c) хорошая, но дублирует условия в коде; устаревшая ссылка `src/App.tsx:271` в 04-CONTEXT.md больше не соответствует строкам; модульный `tabCounter` теперь шарится между 3 одновременно смонтированными `DualPanelLayout` (не bug, но стоит явно зафиксировать); `handleProjectsChange` не сравнивает все поля `Project` (createdAt/updatedAt) — оптимизация, не дефект.

Все blocker-критерии (race conditions, security, data loss, корректность keep-mounted) пройдены. Никаких регрессий в backend / `panelId` стабильности / cleanup'е удалённого кода не обнаружено.

## Структурные находки (fallow)

Структурный pre-pass не был передан — секция пуста.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `flex: 1` на трёх sibling-блоках мёртв — родитель не flex-контейнер

**File:** `src/App.tsx:244-318`
**Issue:** Корневой обёрточный `<div>` объявлен как:

```tsx
<div style={{ height: "calc(100vh - 50px)", overflow: "hidden" }}>
```

Это `display: block` (default). Три прямых потомка — блоки (a), (b), (c) — содержат `flex: 1` в своих стилях (например `App.tsx:252, 284`). В block-контексте `flex: 1` (shorthand для `flex-grow: 1; flex-shrink: 1; flex-basis: 0%`) **не имеет эффекта** — flex-свойства применяются только к flex-item, т.е. к прямым потомкам flex-контейнера. Сейчас высота нужного блока определяется не `flex: 1`, а тем, что `height: 100%` равно высоте родителя (`calc(100vh - 50px)`), плюс `display: none` исключает невидимые блоки из flow.

В run-time это «работает» (один видимый блок занимает всю высоту через `height: 100%`), но:
- Стиль `flex: 1` обманчиво намекает, что родитель — flex-контейнер, что усложняет дальнейшие правки.
- Если в будущем кто-то уберёт `height: 100%` (полагая, что `flex: 1` достаточно), макет сломается.
- При одновременной видимости двух блоков (например рефакторинг убрал `display: none` для overlay) они уложатся вертикально стопкой, а не разделят высоту.

**Fix:** Либо привести родителя к flex-контексту, либо убрать мёртвые `flex: 1` и оставить только `height: 100%`:

```tsx
// Вариант 1 — родитель flex
<div style={{ height: "calc(100vh - 50px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>

// Вариант 2 — убрать flex: 1 из (a), (b)
<div
  style={{
    display: view === "main" ? "flex" : "none",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  }}
>
```

### WR-02: `triggerTerminalRefit` не вызывается на view-переходах (main ↔ overlay)

**File:** `src/App.tsx:41-45, 80-95, 153-232`
**Issue:** Раньше при переключении view `DualPanelLayout` (и `TerminalPanel` внутри) полностью размонтировался и пересоздавался, поэтому xterm заново вычислял размеры. Теперь `TerminalPanel` постоянно смонтирован; xterm-аддон `FitAddon` пересчитывает `cols/rows` только когда DOM-узел получает реальный resize (через `ResizeObserver` или явный `fit()`).

`triggerTerminalRefit()` (`window.dispatchEvent(new Event("resize"))` через 100мс) вызывается ТОЛЬКО в `handleProjectSelect` (`App.tsx:86`) и `handleProjectCreated` (`App.tsx:94`), т.е. при смене активного проекта. Но при переключении `view`: main → settings → main `triggerTerminalRefit` не дёргается. Сценарий бага:

1. Пользователь открыл проект A, view=main, terminal отрендерен и зафитен под текущую ширину окна.
2. Пользователь переключился в view=settings; блок (a) получает `display: none`.
3. Пользователь ресайзит окно (например, развернул на второй монитор).
4. Пользователь возвращается в view=main; блок (a) снова `display: flex`.
5. Xterm всё ещё думает, что у него прежний `cols/rows`, потому что `display: none` подавляет `ResizeObserver` и никто не дёргает `fitAddon.fit()`.

Раньше шаг 5 неявно решался размонтированием + созданием новой инстанции; теперь — не решается. Симптом: терминал показывает «обрезанные» строки, курсор смещён относительно фактического размера буфера, ввод пишется не в той колонке.

D-04-04 явно фиксирует: «терминалы НЕ перемонтируются, но всё ещё нуждаются в resize-events при смене видимого DOM-узла» — но фактически вызов `triggerTerminalRefit` забыт для view-переходов.

**Fix:** Вызывать `triggerTerminalRefit` при возврате во view=main (например в `useEffect`), либо использовать `ResizeObserver` на родителе блока (a) с принудительным `fit()` после `display: none → display: flex`. Минимальная правка — добавить эффект:

```tsx
useEffect(() => {
  if (view === "main" && activeProject) {
    triggerTerminalRefit();
  }
}, [view, activeProject?.id]);
```

Альтернативно — добавить вызов в обработчики кнопок переключения view в `AppShell.Header` (но это шумнее).

### WR-03: Тест `keeps active project layout mounted when switching views` не проверяет видимость, только DOM-присутствие

**File:** `src/__tests__/App.test.tsx:85-123`
**Issue:** Ключевые ассерты теста:

```tsx
expect(screen.getByText("dual-panel-p1")).toBeInTheDocument(); // line 111 — view === "settings"
fireEvent.click(settingsBtn!); // toggle back
await waitFor(() => {
  expect(screen.getByText("dual-panel-p1")).toBeInTheDocument(); // line 121 — view === "main"
});
```

`getByText` находит узел, даже если он внутри элемента с `display: none`. Это означает, что тест **не отличает** "DualPanelLayout смонтирован и видим во view=main" от "DualPanelLayout смонтирован, но обёртка осталась `display: none`" (что бы было блокирующей регрессией PERSIST-01: пользователь возвращается в main и видит белый экран).

Сам комментарий теста (`App.test.tsx:78-83`) утверждает «hidden via display:none (not unmounted)», но никакой ассерт на `display` не проверяется ни для `view !== "main"`, ни для возврата `view === "main"`.

**Fix:** Добавить ассерты на computed-видимость обёртки. Сделать это можно через атрибут `data-testid` на блоке (a) или через class:

```tsx
// В App.tsx — пометить обёртку:
<div data-testid="main-layout-wrapper" style={{ display: view === "main" ? "flex" : "none", ... }}>

// В тесте:
const wrapper = screen.getByTestId("main-layout-wrapper");
expect(wrapper).toHaveStyle({ display: "flex" }); // во view=main
expect(wrapper).toHaveStyle({ display: "none" });  // во view=settings
```

Без этого тест проходит даже если кто-то случайно сломает тернарник `view === "main" ? "flex" : "none"` на `"none"` constant.

### WR-04: Хрупкий селектор `.tabler-icon-settings` в тесте

**File:** `src/__tests__/App.test.tsx:98-100`
**Issue:**

```tsx
const settingsBtn = document
  .querySelector(".tabler-icon-settings")
  ?.closest("button");
```

Зависит от внутреннего class-naming `@tabler/icons-react`. При апгрейде пакета (текущая версия — `3.31.0`) или смене иконки на другую (`IconSettings2`, `IconAdjustments`) тест молча сломается. Комментарий теста (lines 94-97) объясняет, почему `getByRole("button", { name: "common.settings" })` не работает (Mantine `Tooltip` не пробрасывает aria-label), но не предлагает устойчивого fallback.

**Fix:** Добавить в `App.tsx` явный `aria-label` на ActionIcon кнопках:

```tsx
<ActionIcon
  aria-label={t("common.settings")}
  variant={view === "settings" ? "filled" : "subtle"}
  ...
>
  <IconSettings size={20} stroke={1.5} />
</ActionIcon>
```

И в тесте:

```tsx
const settingsBtn = screen.getByRole("button", { name: "common.settings" });
```

Это устранит и a11y-регрессию (см. IN-04) и брittleness теста одновременно.

## Info

### IN-01: Дублирующиеся условия в `display`-стилях

**File:** `src/App.tsx:250, 261`
**Issue:** Внутри блока (a) видимость каждого openedProject вычисляется как:

```tsx
<div style={{
  display: project.id === activeProject.id && view === "main" ? "flex" : "none",
  ...
}}>
```

Но блок (a) уже обёрнут в `{activeProject ? <div style={{ display: view === "main" ? "flex" : "none", ... }}>...</div> : null}`. Когда сюда попадает рендер, гарантированно `view === "main"` (родитель `display: flex`) — потому что иначе родитель `display: none` и потомков не показывает. Условие `&& view === "main"` на потомке — мёртвая часть тернарника (не вредная, просто избыточная).

**Fix:** Упростить до:

```tsx
display: project.id === activeProject.id ? "flex" : "none",
```

Хотя текущий код корректен и более защитный — это микро-оптимизация читаемости.

### IN-02: Глобальный `tabCounter` теперь шарится между ≤3 смонтированными DualPanelLayout

**File:** `src/components/DualPanelLayout.tsx:25-28`
**Issue:** До фазы 4 одновременно был смонтирован максимум один `DualPanelLayout` — `let tabCounter = 0;` глобал был фактически локальным для активного компонента. После фазы — до 3 layout'ов одновременно. Каждый при mount-time вызывает `nextTabId("discuss")` (line 57), увеличивая глобал. Поведение в run-time корректно (каждый id уникален), но это нарушает изначальный contract: «tabCounter генерирует уникальные tab IDs в пределах сессии (DualPanelLayout)» — теперь правильнее: «в пределах процесса webview».

Никаких видимых багов — `claude_start` идемпотентен по `panelId`, и backend хранит runners в HashMap. Но `MAX_TABS_PER_PANEL = 5` теперь применяется к каждому проекту независимо, при этом ID-пространство общее. Если пользователь долго работает, ID будет вроде `discuss-37` для четвёртой вкладки в третьем проекте — это OK, но факт стоит зафиксировать комментом.

**Fix:** Либо переместить `tabCounter` в module внутри `DualPanelLayout` через `useRef`, либо добавить comment:

```tsx
// tabCounter — module-level mutable, общий для всех смонтированных DualPanelLayout.
// Гарантирует уникальные panelId через ChatPanel инстанции, в т.ч. через несколько
// одновременно открытых проектов (after Phase 4 keep-mounted).
let tabCounter = 0;
```

### IN-03: `handleProjectsChange` сравнивает только 5 полей `Project`

**File:** `src/App.tsx:120-150`
**Issue:** Сравнение `prev` ↔ `next` идёт по `id`, `name`, `cwd`, `model`, `permissionMode`. Поля `createdAt` / `updatedAt` игнорируются (это намеренно — оптимизация против бесконечных re-render'ов после `project_touch`, который обновляет `updatedAt`). Но если структура `Project` расширится новым полем (которое frontend начнёт использовать, например `claudeMd: string | null`), сравнение его не учтёт, и UI отстанет от backend-state до следующего рестарта.

**Fix:** Это `code smell` — явное перечисление полей фрагильно. Альтернатива: создать helper `projectsEqual(a, b)` и держать его рядом с типом `Project`:

```tsx
// src/types/claude.ts
export const PROJECT_UI_FIELDS = ["id", "name", "cwd", "model", "permissionMode"] as const;

export function projectUIEqual(a: Project, b: Project): boolean {
  return PROJECT_UI_FIELDS.every((k) => a[k] === b[k]);
}
```

Не критично для этой фазы, но это техдолг.

### IN-04: ActionIcon кнопки в header не имеют `aria-label`

**File:** `src/App.tsx:163-231`
**Issue:** Все 6 `<ActionIcon>` обёрнуты в `<Tooltip label={...}>`, но Mantine не пробрасывает label как `aria-label` на саму кнопку (комментарий теста `App.test.tsx:94-97` это подтверждает). Скринридерам кнопка читается как «button» без названия — accessibility regression (не новая, но усугубляется фазой, т.к. теперь именно эти кнопки используются для навигации между view, не унифицируются ни через сайдбар, ни через что-либо). Это также причина WR-04 (хрупкий тест-селектор).

**Fix:** Добавить явный `aria-label` к каждой `ActionIcon`:

```tsx
<ActionIcon
  aria-label={t("common.settings")}
  variant={view === "settings" ? "filled" : "subtle"}
  ...
>
```

Применить к иконкам: pipeline, files, diff, claude-md, history, settings. Заодно решит и WR-04.

### IN-05: Магическая константа `"calc(100vh - 50px)"` дублирует header height

**File:** `src/App.tsx:155, 244`
**Issue:** `AppShell` объявляет `header={{ height: 50 }}`, а потом отдельно root-обёртка main-area хардкодит `height: "calc(100vh - 50px)"`. Если высота header поменяется (например, на 60 для accessibility) — main-area получит лишние 10px и появится скролл. Это не из этой фазы (issue был и раньше), но фаза трогает именно этот участок без рефакторинга.

**Fix:** Извлечь в константу или использовать CSS-переменную:

```tsx
const HEADER_HEIGHT = 50;
// ...
<AppShell header={{ height: HEADER_HEIGHT }} ...>
// ...
<div style={{ height: `calc(100vh - ${HEADER_HEIGHT}px)`, overflow: "hidden" }}>
```

Либо лучше — позволить `AppShell.Main` самому управлять высотой (Mantine 8 рассчитывает это автоматически через CSS-vars, явный `calc` не нужен).

---

_Reviewed: 2026-05-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
