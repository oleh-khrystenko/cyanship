# Design Tokens Policy

> Всі кольори, шрифти та візуальні параметри стилізації мають використовувати дизайн-токени,
> визначені в `apps/web/src/shared/styles/`. Хардкоджені значення за межами цих файлів **заборонені**.

## Принцип

```
Feature / Page / Widget / shared/ui/
        |
        v
  Tailwind theme tokens    <-- bg-primary, text-text-secondary, border-border ...
        |
        v
  CSS custom properties    <-- var(--primary), var(--text-secondary) ...
        |
        v
  shared/styles/themes.css <-- single source of truth
```

Дизайн-токени -- єдине джерело правди для всього візуального оформлення.
Це гарантує консистентну підтримку light/dark теми, можливість глобальної зміни палітри
з одного місця та запобігає візуальним розбіжностям між компонентами.

## Реєстр токенів

Файл: `apps/web/src/shared/styles/themes.css`

| Група | Tailwind-клас | CSS-змінна | Призначення |
|-------|---------------|------------|-------------|
| **Primary** | `bg-primary`, `text-primary` | `var(--primary)` | Основний акцент (кнопки, посилання, active states) |
| | `bg-primary-dark`, `text-primary-dark` | `var(--primary-dark)` | Hover/pressed стан акценту |
| | `bg-primary-light`, `text-primary-light` | `var(--primary-light)` | Фонові підсвітки акценту |
| **Neutrals** | `bg-background` | `var(--background)` | Фон сторінки |
| | `bg-surface` | `var(--surface)` | Фон карток, панелей, модалок |
| | `bg-surface-hover` | `var(--surface-hover)` | Hover-стан поверхні |
| | `border-border` | `var(--border)` | Межі, роздільники |
| | `text-text-primary` | `var(--text-primary)` | Основний текст |
| | `text-text-secondary` | `var(--text-secondary)` | Другорядний текст, підказки |
| **Status** | `text-success`, `bg-success` | `var(--success)` | Успішні стани |
| | `text-warning`, `bg-warning` | `var(--warning)` | Попередження |
| | `text-error`, `bg-error` | `var(--error)` | Помилки, деструктивні дії |

## Rules

### 1. Заборонені сирі значення кольорів

Наступне **заборонено** у всіх `.tsx`, `.ts` та `.css` файлах за межами `shared/styles/`:

| Заборонено | Використовувати |
|---|---|
| Сирі палітри Tailwind (`bg-red-500`, `text-neutral-300`, `border-blue-200`) | Токени теми (`bg-error`, `text-text-secondary`, `border-border`) |
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

### 4. Анімації

Кастомні анімації визначаються в `shared/styles/animations.css`.
Нові `@keyframes` додаються туди ж -- ніколи не в компонентні файли чи inline-стилі.

### 5. Opacity-модифікатори

Для напівпрозорих варіантів використовуй Tailwind opacity syntax з токенами теми:

```
bg-error/10        -- замість bg-red-50
text-success/80    -- замість text-green-600
border-primary/30  -- замість border-blue-200
```

## Винятки

| Контекст | Що дозволено | Причина |
|----------|--------------|---------|
| `shared/styles/` | Hex-значення в CSS-змінних | Тут визначаються самі токени |
| `shared/icons/` | Hex-значення у SVG `fill`/`stroke` | Брендові іконки (Google, Stripe) з офіційними кольорами |
| `white` / `black` | `text-white`, `bg-black/50` | Універсальні константи (контрастний текст на primary, overlay backdrop) |
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
