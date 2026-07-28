# Design Tokens Policy

> Всі кольори, шрифти та візуальні параметри стилізації мають використовувати дизайн-токени,
> визначені в `apps/web/src/shared/styles/`. Хардкоджені значення за межами цих файлів **заборонені**.

## Принцип

```
Feature / Page / Widget / shared/ui/
        |
        v
  Tailwind theme tokens    <-- bg-primary, text-muted-foreground, border-border ...
        |
        v
  CSS custom properties    <-- var(--primary), var(--muted-foreground) ...
        |
        v
  shared/styles/themes.css <-- single source of truth
```

Дизайн-токени -- єдине джерело правди для всього візуального оформлення.
Це гарантує консистентну підтримку light/dark теми, можливість глобальної зміни палітри
з одного місця та запобігає візуальним розбіжностям між компонентами.

## Реєстр токенів

Файл: `apps/web/src/shared/styles/themes.css`

Формат: `{color}` + `{color}-foreground` пари. Всі кольори монохромні (oklch з нульовою хромою), крім `destructive`, `success`, `warning`.

| Група | Tailwind-клас | CSS-змінна | Призначення |
|-------|---------------|------------|-------------|
| **Background** | `bg-background` | `var(--background)` | Фон сторінки |
| **Foreground** | `text-foreground`, `bg-foreground` | `var(--foreground)` | Основний текст, інвертовані елементи |
| **Card** | `bg-card`, `text-card-foreground` | `var(--card)`, `var(--card-foreground)` | Фон карток, текст на картках |
| **Primary** | `bg-primary`, `text-primary`, `text-primary-foreground` | `var(--primary)`, `var(--primary-foreground)` | CTA кнопки, акценти |
| **Secondary** | `bg-secondary`, `text-secondary-foreground` | `var(--secondary)`, `var(--secondary-foreground)` | Subtle surfaces (icon badges, hover states) |
| **Muted** | `bg-muted`, `text-muted-foreground` | `var(--muted)`, `var(--muted-foreground)` | Muted surfaces, другорядний текст |
| **Accent** | `bg-accent`, `text-accent-foreground` | `var(--accent)`, `var(--accent-foreground)` | Accent surfaces (hover states) |
| **Destructive** | `bg-destructive`, `text-destructive`, `text-destructive-foreground` | `var(--destructive)`, `var(--destructive-foreground)` | Помилки, деструктивні дії |
| **Border** | `border-border` | `var(--border)` | Межі, роздільники |
| **Input** | `bg-input`, `border-input` | `var(--input)` | Input borders/bg |
| **Ring** | `ring-ring` | `var(--ring)` | Focus rings |
| **Success** | `text-success`, `bg-success` | `var(--success)` | Успішні стани, toast notifications |
| **Warning** | `text-warning`, `bg-warning` | `var(--warning)` | Попередження, toast notifications |

**Utility tokens:**

| Токен | Значення | Tailwind-клас | Призначення |
|-------|----------|---------------|-------------|
| `--radius` | `0.625rem` | `rounded-sm/md/lg/xl` | Base border-radius |

## Rules

### 1. Заборонені сирі значення кольорів

Наступне **заборонено** у всіх `.tsx`, `.ts` та `.css` файлах за межами `shared/styles/`:

| Заборонено | Використовувати |
|---|---|
| Сирі палітри Tailwind (`bg-red-500`, `text-neutral-300`, `border-blue-200`) | Токени теми (`bg-destructive`, `text-muted-foreground`, `border-border`) |
| Hex-значення (`#3b82f6`, `#f9fafb`) | CSS-змінні (`var(--primary)`, `var(--background)`) |
| `rgb()` / `rgba()` / `hsl()` / `hsla()` | CSS-змінні або opacity-модифікатори (`bg-primary/20`) |

### 2. Відсутній токен -- не привід для хардкоду

Якщо потрібний візуальний варіант не покритий існуючими токенами:

1. Додай нову CSS-змінну в `themes.css` (в обидва блоки: `:root` та `.dark`)
2. Додай Tailwind-прив'язку в блок `@theme inline`
3. Оновити реєстр токенів у цьому документі
4. Використовуй новий токен у компоненті

Ніколи не пропускай цей процес заради "швидкості" -- хардкоджене значення зламає тему.

### 3. Шрифти

Проєкт використовує єдиний шрифт Mulish, підключений в `layout.tsx` через `next/font`.
Прямі `font-family` декларації в CSS чи inline-стилях **заборонені**.

Дозволено лише Tailwind-утиліти для характеристик шрифту: `font-bold`, `text-sm`, `tracking-wide` тощо.

#### Type-scale

Системна шкала розмірів. Беремо розмір **за роллю елемента**, не «на око»:

| Токен       | px  | Призначення                                                                  |
| ----------- | --- | ---------------------------------------------------------------------------- |
| `text-sm`   | 14  | **підлога** — описи, помилки, лейбли над інпутом, вторинний текст            |
| `text-base` | 16  | body, абзаци, лейбли read-view (key-value рядки)                             |
| `text-lg`   | 18  | заголовок секції в картці (h2, `UiSectionCard`), значення поля (read-view)   |
| `text-xl`   | 20  | заголовок overlay (`UiModalTitle`, `UiSheetTitle`), значення компактної картки |
| `text-2xl`  | 24  | заголовок сторінки на mobile, заголовок великої секції поза карткою          |
| `text-3xl`  | 30  | заголовок сторінки (h1, `UiPageHeading`), велика метрика на mobile           |
| `text-4xl`  | 36  | велика метрика на desktop (баланс, ціна плану)                               |
| `text-xs`   | 12  | **резерв** — лише рідкісні щільні блоки, не за замовчуванням                 |

Шкала описує **робочі поверхні** (кабінет, форми, налаштування). Маркетингові поверхні (лендінг, публічні сторінки) живуть за власною display-шкалою (`text-4xl`–`text-6xl`) — вони продають, а не тримають робочий потік.

**Зростання на `md:`/`lg:`.** Body, лейбли, описи і помилки не ростуть ніколи: на широкому моніторі сторінка отримує більше **колонок**, а не більший кегль. Виняток — заголовок сторінки і велика метрика: їм дозволено рівно один щабель угору (`text-2xl md:text-3xl`, `text-3xl md:text-4xl`).

**Правила:**

1. **14px — підлога.** `text-sm` (14) — найдрібніший шрифт за замовчуванням. Нижче 14px комфорт різко падає, особливо на mobile (див. [responsive.md](responsive.md)). Виняток — лічильники і бейджі всередині поля (наприклад лічильник символів у чаті), де `text-xs` (12) читається як службова мітка, а не як текст.
2. **`text-xs` (12) — виняток, не старт.** Лише щільні блоки з обмеженим простором (badge, табличні підписи). Підлога на 14 лишає 12 як аварійний щабель нижче — якщо стартувати з 12, падати нема куди.
3. **Помилки — мінімум 14px.** Повідомлення про помилку треба легко прочитати; ховати його дрібним кеглем — антипатерн. Усі `error`-рядки у примітивах на `text-sm`.
4. **Лейбл за роллю: read-view ≠ форма.** Лейбл у **read-view** (key-value рядок) — це **якір сканування**, тому body-tier `text-base` (16). Лейбл **над інпутом** у формі вводу — `text-sm` (14): фокус на самому полі. Не плутати: однакове слово «лейбл», різні ролі.
5. **Ієрархія, не розмір заради розміру.** Контраст лейбл↔значення тримати кольором (`text-muted-foreground` лейбл / `text-foreground` значення) і вагою, а не лише кеглем.
6. **Однаковий кегль ≠ однаковий рівень.** Заголовок секції і значення поля можуть обидва бути на `text-lg` (18) — розрізняє їх вага і трекінг (`font-semibold tracking-tight` у h2 проти звичайної ваги значення), а не розмір.
7. **Шкала живе у shared-примітивах.** Розміри лейбла і повідомлення про помилку задають `UiInput`, `UiTextarea`, `UiSelect`, `UiPasswordInput`, `UiCheckbox`; розміри заголовків — `UiSectionCard`, `UiPageHeading`, `UiModalTitle`. Сторінки споживають готову шкалу, а не задають її локальними класами. Слота для пояснювального тексту під полем примітиви поки не мають — якщо він знадобиться, додається пропом у сам примітив (за патерном `error`), а не окремим `<p className="text-sm">` на сторінці.

### 4. Анімації

Кастомні анімації визначаються в `shared/styles/animations.css`.
Нові `@keyframes` додаються туди ж -- ніколи не в компонентні файли чи inline-стилі.

### 5. Opacity-модифікатори

Для напівпрозорих варіантів використовуй Tailwind opacity syntax з токенами теми:

```
bg-destructive/10  -- замість bg-red-50
text-success/80    -- замість text-green-600
border-primary/30  -- замість border-blue-200
```

## Винятки

| Контекст | Що дозволено | Причина |
|----------|--------------|---------|
| `shared/styles/` | oklch-значення в CSS-змінних | Тут визначаються самі токени |
| `shared/icons/` | Hex-значення у SVG `fill`/`stroke` | Брендові іконки (Google, Stripe) з офіційними кольорами |
| `white` / `black` | `text-white`, `bg-black/50` | Універсальні константи (контрастний текст, overlay backdrop) |
| Inline `style` для динамічних значень | `style={{ backgroundColor: userColor }}` | Runtime-значення, що не можуть бути токеном (user avatar color, chart data) |

## Scope

Правило діє для всього коду фронтенду:

```
apps/web/src/
  app/           -- заборонені сирі кольори
  features/      -- заборонені сирі кольори
  entities/      -- заборонені сирі кольори
  widgets/       -- заборонені сирі кольори
  shared/ui/     -- заборонені сирі кольори (примітиви теж використовують токени)
  shared/styles/ -- ДОЗВОЛЕНО (тут визначаються токени)
  shared/icons/  -- ДОЗВОЛЕНО (брендові SVG)
```
