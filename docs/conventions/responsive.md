# Responsive & Mobile-First Policy

> **Залізобетонне правило.** Усі сторінки — адаптивні під **mobile + tablet + desktop**. Дизайн і верстка робляться **mobile-first**: спочатку мобільний layout, потім розширюємо для більших екранів.

## Принцип

**Mobile-first** означає:

- Базові стилі компонента — для мобільного.
- Tailwind-модифікатори (`sm:`, `md:`, `lg:`, `xl:`) додають / змінюють поведінку для більших екранів.
- НЕ навпаки (десктоп-стилі за замовчуванням, потім `max-md:` для мобільного — заборонено).

```tsx
// ✅ Правильно (mobile-first)
<div className="flex flex-col gap-4 md:flex-row md:gap-8">

// ❌ Неправильно (desktop-first з override на мобільне)
<div className="flex flex-row gap-8 max-md:flex-col max-md:gap-4">
```

## Чому mobile-first

1. **Публічні сторінки** (лендінг, форми заявок, посилання з месенджера) відкривають переважно з телефона. Це основний, а не побічний сценарій.
2. **Кабінет** — десктоп лишається основним робочим середовищем, але користувач мусить мати змогу перевірити стан зі смартфона.
3. **CSS cascading** — додавати стилі простіше, ніж їх перевизначати. Mobile-first дає більш передбачуваний CSS.

## Breakpoints

Використовуємо **стандартні Tailwind v4 breakpoints**:

| Префікс   | Min-width | Цільові пристрої                |
| --------- | --------- | ------------------------------- |
| (default) | 0px       | Mobile portrait (від 320px)     |
| `sm:`     | 640px     | Mobile landscape, малі планшети |
| `md:`     | 768px     | Tablet portrait (iPad mini, iPad) |
| `lg:`     | 1024px    | Tablet landscape, малі ноутбуки |
| `xl:`     | 1280px    | Desktop                         |
| `2xl:`    | 1536px    | Великі desktop-монітори         |

**Custom breakpoints не вводити без сильного обґрунтування** — фрагментація шкали ускладнює QA. Якщо реально потрібен новий (типовий кейс: тонкий адаптив у межах телефонів, де `sm` на 640px надто далеко) — додавати у `apps/web/src/shared/styles/themes.css` через `@theme` (`--breakpoint-*`) і обовʼязково оновлювати цю таблицю.

## Обовʼязкові правила

### 1. Жодного horizontal scroll на мобільному

При ширині 320px сторінка **не повинна** мати горизонтального скролу. Тестується через DevTools "Responsive" 320×568.

Типові порушники:

- Великі таблиці без `overflow-x-auto` обгортки.
- Inline-зображення з фіксованою шириною (`w-[800px]`).
- `whitespace-nowrap` на довгих рядках без `overflow-hidden text-ellipsis`.

### 2. Touch targets ≥ 44×44 px

Усі клікабельні елементи (кнопки, посилання, чекбокси) на мобільному мають розмір touch-target ≥ 44×44 px (Apple HIG / Material Design). Маленькі іконки обгортаються у padding.

> ⚠️ `UiButton` наразі **не enforce-ить** 44×44 на рівні примітиву — розмір задає `size`-проп. Це відповідальність callsite. Якщо icon-кнопка зʼявляється у mobile flow — переконайся, що вона дотягує до 44×44 (`min-h-11 min-w-11`), інакше задай це в `className`. Кращий варіант на майбутнє — підняти baseline у сам `UiButton variant="icon"`, щоб callsite не думав про розміри.

```tsx
// ✅ Touch-friendly icon-кнопка у mobile flow
<UiButton variant="icon" aria-label="Закрити" className="min-h-11 min-w-11">
  <CloseIcon />
</UiButton>

// ❌ Native <button> заборонено за ui-primitives.md
<button className="p-3" aria-label="Закрити">
  <CloseIcon className="size-4" />
</button>

// ⚠️ icon-compact — навмисно щільний варіант, без 44×44 baseline.
//    Допустимий лише в dense desktop UI (toolbars, table-rows), де поруч ≥ 8 px gap
//    і primary-input — миша. Не використовуй у mobile flow.
<UiButton variant="icon-compact" aria-label="Закрити">
  <CloseIcon />
</UiButton>
```

> Native HTML-елементи (`<button>`, `<a>`, `<input>`) поза `shared/ui/` заборонені — див. [ui-primitives.md](ui-primitives.md). У цьому документі позитивні приклади використовують `Ui*` примітиви; native-теги зʼявляються лише у `❌`-прикладах, щоб явно показати заборонене.

### 3. Текст читабельний без zoom

Базовий розмір тексту на мобільному — не менше 14px (Tailwind `text-sm`). Дрібніше — лише для абсолютно вторинної інформації (timestamps, метадані). Повна шкала — [design-tokens.md](design-tokens.md), розділ «Type-scale».

### 4. Форми працюють із virtual keyboard

- `type` задає клавіатуру там, де це можливо: `type="email"`, `type="tel"`, `type="url"`. Окремий `inputMode` дублювати не треба.
- `inputMode` — для полів, де тип не описує клавіатуру: числа, коди підтвердження, суми (`inputMode="numeric"`, `inputMode="decimal"`).
- `autoComplete` на всіх полях, що бере autofill: `email`, `name`, `current-password`, `new-password`, `one-time-code`.
- Автофокус поля при відкритті модалки / шторки — лише на десктопі. На мобільному не автофокусуємо: це викликає клавіатуру і ламає layout. **Не потребує дій на callsite**: `UiModal` і `UiSheet` самі гасять автофокус нижче `md` — обидва джерела початкового фокуса. Radix-івський (`onOpenAutoFocus` → фокус на контейнер) і React-івський (`autoFocus` на самому полі, який спрацьовує ще до монтування focus-scope і тому взагалі оминув би `onOpenAutoFocus`) — другий перехоплює перевірка у ref-колбеку `useOverlayAutoFocusGuard`, що виконується на кожне відкриття (ефект тут не годиться: компонент-обгортка лишається змонтованим при закритому overlay, тож mount-ефект відпрацював би один раз і без вмісту в DOM). Тож `autoFocus` у полі всередині overlay спрацює лише на десктопі. На звичайних сторінках (не overlay) автофокус першого поля дозволений.

### 5. Модалки і sheets

На мобільному (`<md`, тобто до 768px) модалки рендеряться як **bottom sheet** (висувається знизу). На десктопі — centered modal. Це вже реалізовано в `UiModal` (див. [ui-primitives.md](ui-primitives.md)) — використовуємо без замін. Брейкпоінт переходу — саме `md`, не `sm`: на планшеті в портреті вікно вже centered.

### 6. Hover-стани не несуть критичної інформації

На мобільному hover не існує. Будь-який UI-елемент з hover-tooltip / hover-меню повинен мати **альтернативу для тапу** (long-press / окремий tap-handler / inline-індикатор).

```tsx
// ✅ Завжди видимий inline-опис (працює однаково на mobile і desktop)
<div>
  <span>Режим розробника</span>
  <p className="text-sm text-muted-foreground">
    Показує технічні деталі запитів
  </p>
</div>

// ❌ Hover-only tooltip — інформація недоступна на mobile
<div>
  Режим розробника
  <Tooltip content="Показує технічні деталі запитів">
    <InfoIcon />
  </Tooltip>
</div>
```

Якщо інформація **дійсно вторинна** (advanced-деталі для power-юзера) і tooltip є кращим UX за inline-текст — використовуй click-trigger через існуючий popover-примітив (`UiDropdownMenu` або `UiSheet`), не hover-only. Окремого `UiTooltip` примітива в репо немає; якщо він знадобиться — додаємо за патерном з [ui-primitives.md](ui-primitives.md) (Radix Tooltip wrapped як `Ui*`), і одразу з обовʼязковим click-fallback для mobile.

### 7. Тестові viewport-и

Перед merge кожна нова сторінка / суттєва зміна layout перевіряється на трьох viewport-ах через DevTools:

| Viewport | Розмір   | Цільовий пристрій            |
| -------- | -------- | ---------------------------- |
| Mobile   | 375×667  | iPhone SE 2nd gen / iPhone 8 |
| Tablet   | 768×1024 | iPad portrait                |
| Desktop  | 1440×900 | Ноутбук / середній монітор   |

## Винятки

Жодних «ця сторінка тільки для десктопу» — усе адаптивне.

Єдиний легітимний кейс десктоп-only — **dev-utility сторінки** (внутрішні admin-панелі, debug-вікна). Коли зʼявляться — вони мають бути під окремим префіксом (наприклад `/admin`) і явно помічені як «desktop only» у заголовку.

## Scope

Правило діє для всього фронтенду:

```
apps/web/src/
  app/           -- усі сторінки адаптивні
  features/      -- усі компоненти адаптивні
  widgets/       -- усі widgets адаптивні
  entities/      -- усі компоненти адаптивні
  shared/ui/     -- примітиви адаптивні (mobile-first defaults)
```

## Чек-лист для PR

При створенні / зміні UI-компонента:

- [ ] Перевірено на 320px — нема horizontal scroll.
- [ ] Перевірено на 375×667 (iPhone SE 2) — основний flow працює.
- [ ] Перевірено на 768×1024 (iPad portrait) — layout масштабується.
- [ ] Перевірено на 1440×900 (desktop) — layout не «розтягнутий» (max-width контейнери де треба).
- [ ] Touch targets ≥ 44×44 px на мобільному.
- [ ] Hover-tooltip має fallback-альтернативу для тапу.
- [ ] Mobile-first Tailwind (без `max-*:` префіксів).
