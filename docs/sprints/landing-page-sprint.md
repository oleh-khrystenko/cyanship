# Sprint: Landing Page

> Перенесення чернетки з `apps/web/_drafts/` у production-ready landing page з дотриманням FSD, design tokens, UI primitives та i18n конвенцій. **Mobile-first** підхід — верстка починається з mobile breakpoint, розширюється через `md:` та `lg:` модифікатори.

---

## Аналіз чернетки

Чернетка — standalone Next.js app із 8 секціями на базі shadcn/ui. Потребує адаптації під існуючу архітектуру.

### Секції (порядок на сторінці)

1. **LandingNav** — anchor navigation по секціях (#problem, #portfolio, #workflow, #pricing), рендериться під глобальним Header
2. **Hero** — заголовок + підзаголовок + 2 CTA + code visual (псевдо-редактор коду)
3. **ProblemSolution** — текст + 3 feature cards (Clean Architecture, Fully Typed, Ready to Scale)
4. **Dogfooding** — текст + checklist із 3 кроків
5. **Portfolio** — текст + Loom video placeholder
6. **Workflow** — текст + 3 cards (Async Communication, Video Updates, Code Transparency)
7. **Pricing** — pricing card ($1,500) + FAQ
8. **FooterCTA** — текст + CTA + 4-step process visualization
9. **Footer** — logo + copyright

### Що потрібно адаптувати

| Чернетка (shadcn/ui) | Production (LucidShip) | Примітка |
|---|---|---|
| `<Button>` | `UiButton` | Variant mapping: default→filled, ghost→text |
| `<Card>`, `<CardContent>`, etc. | Нативні `<div>` + design tokens | Card не є інтерактивним — не потребує Ui-обгортки |
| `<a href="#section">` | `UiButton as="a"` variant="text" | Anchor links у nav |
| Hardcoded English text | `useTranslations()` | i18n через next-intl |
| `.container mx-auto px-6` | `.container` (settings.css) + `px-6` | Існуючий utility |

Кольорові класи з чернетки (`text-foreground`, `bg-card`, `bg-secondary`, `text-muted-foreground`, etc.) **залишаються як є** — нова token-система їх підтримує нативно.

---

## FSD-структура

```
apps/web/src/
├── app/[locale]/
│   └── page.tsx                          # Landing page (збирає widgets)
│
├── widgets/
│   └── landing/                          # Landing-specific widgets
│       ├── LandingNav/
│       │   ├── LandingNav.tsx            # Anchor navigation (#problem, #portfolio, etc.) — рендериться всередині page
│       │   ├── types.ts
│       │   └── index.ts
│       ├── HeroSection/
│       │   ├── HeroSection.tsx
│       │   ├── CodeVisual.tsx            # Псевдо-редактор коду (виділений під-компонент)
│       │   ├── types.ts
│       │   └── index.ts
│       ├── ProblemSection/
│       │   ├── ProblemSection.tsx
│       │   ├── types.ts
│       │   └── index.ts
│       ├── DogfoodingSection/
│       │   ├── DogfoodingSection.tsx
│       │   ├── types.ts
│       │   └── index.ts
│       ├── PortfolioSection/
│       │   ├── PortfolioSection.tsx
│       │   ├── types.ts
│       │   └── index.ts
│       ├── WorkflowSection/
│       │   ├── WorkflowSection.tsx
│       │   ├── types.ts
│       │   └── index.ts
│       ├── PricingSection/
│       │   ├── PricingSection.tsx
│       │   ├── types.ts
│       │   └── index.ts
│       ├── FooterCtaSection/
│       │   ├── FooterCtaSection.tsx
│       │   ├── types.ts
│       │   └── index.ts
│       ├── LandingFooter/
│       │   ├── LandingFooter.tsx
│       │   ├── types.ts
│       │   └── index.ts
│       └── index.ts                      # Re-export всіх widgets
```

### Обґрунтування розміщення

- **widgets/landing/** — секції landing page є самодостатніми композиційними блоками (widget у FSD). Вони не є features (немає бізнес-логіки) і не є entities (немає доменних об'єктів).
- **LandingNav** — anchor navigation для секцій сторінки (#problem, #portfolio, etc.). Рендериться всередині `page.tsx` під глобальним auth `Header`, який залишається в root layout без змін.
- **CodeVisual виділений** — складний візуальний компонент із pseudo-syntax highlighting, виділення спрощує HeroSection.

---

## Design tokens — повна заміна

Поточна token-система (hex, власні назви) замінюється на систему з чернетки (oklch, shadcn/ui конвенція). Це зламає існуючі сторінки — вони будуть адаптовані окремо.

### Джерело правди

Файл: `apps/web/_drafts/styles/globals.css` (з правильними light/dark темами).

### Нова token-система

Формат: `{color}` + `{color}-foreground` пари. Всі кольори монохромні (oklch з нульовою хромою), крім `destructive`.

**Core tokens:**

| Токен | Light | Dark | Tailwind-клас | Призначення |
|---|---|---|---|---|
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | `bg-background` | Фон сторінки |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | `text-foreground`, `bg-foreground` | Основний текст, інвертовані елементи |
| `--card` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | `bg-card` | Фон карток |
| `--card-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | `text-card-foreground` | Текст на картках |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | `bg-primary`, `text-primary` | CTA кнопки, акценти |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | `text-primary-foreground` | Текст на primary фоні |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | `bg-secondary` | Subtle surfaces (icon badges) |
| `--secondary-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | `text-secondary-foreground` | Текст на secondary фоні |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | `bg-muted` | Muted surfaces |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | `text-muted-foreground` | Другорядний текст, підказки |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | `bg-accent` | Accent surfaces (hover states) |
| `--accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | `text-accent-foreground` | Текст на accent фоні |
| `--border` | `oklch(0.922 0 0)` | `oklch(0.269 0 0)` | `border-border` | Borders, роздільники |
| `--input` | `oklch(0.922 0 0)` | `oklch(0.269 0 0)` | `bg-input`, `border-input` | Input borders/bg |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.439 0 0)` | `ring-ring` | Focus rings |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.396 0.141 25.723)` | `bg-destructive`, `text-destructive` | Помилки, деструктивні дії |
| `--destructive-foreground` | `oklch(0.577 0.245 27.325)` | `oklch(0.637 0.237 25.331)` | `text-destructive-foreground` | Текст destructive |

**Додаткові tokens (не в чернетці, потрібні для існуючих features):**

| Токен | Light | Dark | Призначення |
|---|---|---|---|
| `--success` | `oklch(0.696 0.17 162.48)` | `oklch(0.696 0.17 162.48)` | Toast notifications, статуси |
| `--warning` | `oklch(0.828 0.189 84.429)` | `oklch(0.769 0.188 70.08)` | Toast notifications |

**Utility tokens:**

| Токен | Light | Dark | Призначення |
|---|---|---|---|
| `--radius` | `0.625rem` | `0.625rem` | Base border-radius |

### Токени що видаляються

| Старий токен | Замінений на |
|---|---|
| `--primary-dark` | — (видалений, не потрібен) |
| `--primary-light` | — (видалений, не потрібен) |
| `--surface` | `--card` |
| `--surface-hover` | `--secondary` або `--accent` |
| `--text-primary` | `--foreground` |
| `--text-secondary` | `--muted-foreground` |
| `--error` | `--destructive` |

### Міграція існуючих Tailwind-класів

| Старий клас | Новий клас |
|---|---|
| `text-text-primary` | `text-foreground` |
| `text-text-secondary` | `text-muted-foreground` |
| `bg-surface` | `bg-card` |
| `bg-surface-hover` | `bg-secondary` або `bg-accent` |
| `text-error`, `bg-error` | `text-destructive`, `bg-destructive` |
| `text-primary-dark` | — (видалений) |
| `bg-primary-light` | — (видалений) |

### Файли для оновлення

1. `apps/web/src/shared/styles/themes.css` — повна заміна token-системи
2. `docs/conventions/design-tokens.md` — оновити реєстр під нові токени
3. Всі `.tsx` файли з використанням старих класів — замінити на нові (існуючі сторінки будуть адаптуватись окремо, але `shared/ui/` компоненти потрібно оновити одразу щоб landing міг їх використовувати)

---

## i18n

Namespace: `landing_page`. Існуючий `welcome_page` перейменовується на `landing_page`, старі ключі (`heading`, `description`, `cta`) видаляються — їх замінюють нові секції. Ключ `head` зберігається з оновленим контентом.

Всі місця в коді, що посилаються на `welcome_page` (page.tsx, metadata), оновлюються на `landing_page`.

```jsonc
// messages/uk.json & messages/en.json
{
  "landing_page": {
    "head": { "title": "...", "description": "..." },
    "nav": {
      "approach": "Підхід / Approach",
      "portfolio": "Портфоліо / Portfolio",
      "workflow": "Робочий процес / Workflow",
      "pricing": "Ціни / Pricing"
    },
    "hero": {
      "heading": "Запустіть свій SaaS MVP за 4 тижні. / Launch Your SaaS MVP in 4 Weeks.",
      "description": "...",
      "cta_primary": "Запросити технічну оцінку / Request a Technical Estimate",
      "cta_secondary": "Спробувати демо / Try Live Demo"
    },
    "problem": {
      "heading": "...",
      "paragraph_1": "...",
      "paragraph_2": "...",
      "paragraph_3": "...",
      "feature_architecture_title": "...",
      "feature_architecture_description": "...",
      "feature_typed_title": "...",
      "feature_typed_description": "...",
      "feature_scale_title": "...",
      "feature_scale_description": "..."
    },
    "dogfooding": {
      "heading": "...",
      "description": "...",
      "step_1": "...",
      "step_2": "...",
      "step_3": "..."
    },
    "portfolio": {
      "label": "Портфоліо / Portfolio",
      "heading": "...",
      "paragraph_1": "...",
      "paragraph_2": "...",
      "video_label": "Дивитись відео / Watch Loom Video"
    },
    "workflow": {
      "heading": "...",
      "description": "...",
      "step_async_title": "...",
      "step_async_description": "...",
      "step_video_title": "...",
      "step_video_description": "...",
      "step_code_title": "...",
      "step_code_description": "..."
    },
    "pricing": {
      "heading": "...",
      "package_label": "...",
      "price": "...",
      "delivery": "...",
      "includes_label": "...",
      "include_1": "...",
      "include_2": "...",
      "include_3": "...",
      "include_4": "...",
      "include_5": "...",
      "cta": "...",
      "faq_heading": "...",
      "faq_1_q": "...", "faq_1_a": "...",
      "faq_2_q": "...", "faq_2_a": "...",
      "faq_3_q": "...", "faq_3_a": "...",
      "faq_4_q": "...", "faq_4_a": "..."
    },
    "footer_cta": {
      "heading": "...",
      "description": "...",
      "cta": "...",
      "step_1_title": "...", "step_1_sub": "...",
      "step_2_title": "...", "step_2_sub": "...",
      "step_3_title": "...", "step_3_sub": "...",
      "step_4_title": "...", "step_4_sub": "..."
    },
    "footer": {
      "copyright": "© {year} LucidShip. Усі права захищені."
    }
  }
}
```

Всі widgets використовують `useTranslations('landing_page')`.

---

## План імплементації

### Фаза 0: Міграція design-системи

Виконується першою — без неї нові landing widgets не зможуть використовувати правильні кольори.

**Крок 0.1 — Замінити `themes.css`**
- Повністю переписати `apps/web/src/shared/styles/themes.css`
- Нові CSS-змінні (oklch, `{color}`/`{color}-foreground` пари) з `_drafts/styles/globals.css`
- Додати `--success` та `--warning` (відсутні в чернетці, але потрібні для toasts)
- Зберегти `@theme inline` блок з новими `--color-*` прив'язками
- Додати `@layer base` з `border-border` та `bg-background text-foreground`

**Крок 0.2 — Оновити `shared/ui/` компоненти**
- Замінити старі класи на нові у всіх Ui* компонентах:
  - `text-text-primary` → `text-foreground`
  - `text-text-secondary` → `text-muted-foreground`
  - `bg-surface` → `bg-card`
  - `bg-surface-hover` → `bg-secondary`
  - `text-error`, `bg-error` → `text-destructive`, `bg-destructive`
  - `border-error` → `border-destructive`
  - `bg-primary-dark` → видалити (hover через `hover:bg-primary/90`)
- UiButton: variant="filled" bg-primary → primary залишається, але тепер це монохромний колір (не синій)
- Файли: всі компоненти в `apps/web/src/shared/ui/`

**Крок 0.3 — Оновити `design-tokens.md`**
- Замінити таблицю реєстру на нову token-систему
- Оновити приклади та правила
- Файл: `docs/conventions/design-tokens.md`

**Крок 0.4 — Оновити існуючі сторінки (мінімально)**
- Замінити старі класи у `widgets/header/`, `features/`, `entities/`, `app/` — скрізь де використовуються видалені токени
- Мета: щоб додаток компілювався і базово рендерився. Повна адаптація дизайну існуючих сторінок — окремий спринт

### Фаза 1: Інфраструктура

**Крок 1.1 — i18n ключі**
- Перейменувати `welcome_page` → `landing_page` в `messages/uk.json` та `messages/en.json`
- Видалити старі ключі (`heading`, `description`, `cta`), оновити `head`
- Додати секції: `nav`, `hero`, `problem`, `dogfooding`, `portfolio`, `workflow`, `pricing`, `footer_cta`, `footer`
- Оновити всі посилання в коді: `useTranslations('welcome_page')` → `useTranslations('landing_page')`, `fetchMetadata` page key
- Всі тексти з чернетки перекласти на українську
- Файли: `apps/web/messages/uk.json`, `apps/web/messages/en.json`, `apps/web/src/app/[locale]/page.tsx`

### Фаза 2: Widgets (mobile-first)

Кожен widget створюється як окрема директорія в `widgets/landing/` зі структурою `Component.tsx` + `types.ts` + `index.ts`.

**Mobile-first принцип:** базова верстка — це mobile layout (single column, stacked). Desktop адаптація додається через `md:` та `lg:` breakpoint-модифікатори. Кожен widget одразу готовий для всіх екранів.

**Крок 2.1 — LandingFooter**
- Простий footer з Logo + copyright
- Використовує `Logo` з `entities/brand`
- Mobile: stacked (logo зверху, copyright знизу, `flex-col items-center`)
- Desktop: `md:flex-row md:justify-between`
- i18n: `landing_page.footer`

**Крок 2.2 — LandingNav**
- Anchor navigation для секцій сторінки
- `UiButton as="a"` variant="text" для anchor links (#problem, #portfolio, #workflow, #pricing)
- Рендериться всередині `page.tsx` під глобальним auth Header
- Mobile: горизонтальний scroll (`overflow-x-auto`, `flex-nowrap`, `gap-2`)
- Desktop: `md:justify-center md:gap-8`
- i18n: `landing_page.nav`

**Крок 2.3 — HeroSection**
- `CodeVisual.tsx` — окремий під-компонент (псевдо-editor з syntax highlighting через span кольори)
- 2 CTA: `UiButton` filled (primary) + `UiButton` text (secondary)
- CodeVisual використовує `font-mono`, кольори через design tokens
- Mobile: single column — текст, CTA buttons stacked (`flex-col`), CodeVisual під текстом
- Desktop: `lg:grid-cols-2` — текст зліва, CodeVisual справа; CTA buttons inline (`sm:flex-row`)
- Типографіка: `text-3xl` → `md:text-5xl lg:text-6xl`
- i18n: `landing_page.hero`

**Крок 2.4 — ProblemSection**
- Текстовий блок + 3 feature cards
- Cards = `<div>` з `bg-card border-border rounded-lg p-6`
- Іконки: `Layers`, `Code2`, `Rocket` з lucide-react
- Mobile: cards stacked (`grid-cols-1 gap-4`)
- Desktop: `md:grid-cols-3 md:gap-8`
- i18n: `landing_page.problem`

**Крок 2.5 — DogfoodingSection**
- Текстовий блок + checklist
- Checklist items = `<div>` з `bg-card border-border rounded-lg p-4`
- Check icon в круглому індикаторі (`bg-foreground`, іконка `text-background`)
- Mobile/Desktop: single column layout (однаковий на всіх breakpoints, max-width обмежує ширину)
- i18n: `landing_page.dogfooding`

**Крок 2.6 — PortfolioSection**
- Текст + video placeholder
- Video placeholder — `<div>` з Play іконкою (не інтерактивний поки що, або `UiButton as="a"` якщо буде Loom URL)
- Mobile: stacked — текст зверху, video під ним (`grid-cols-1`)
- Desktop: `lg:grid-cols-2` — текст зліва, video справа
- i18n: `landing_page.portfolio`

**Крок 2.7 — WorkflowSection**
- Текстовий блок + 3 cards
- Cards = `<div>` з `bg-card border-border rounded-lg`
- Icon badges = `<div>` з `bg-secondary border-border rounded-lg`
- Mobile: cards stacked (`grid-cols-1 gap-4`)
- Desktop: `md:grid-cols-3 md:gap-6`
- i18n: `landing_page.workflow`

**Крок 2.8 — PricingSection**
- Pricing card + FAQ
- Pricing card = `<div>` з `border-2 border-foreground bg-card` (акцентна рамка)
- Includes checklist з Check іконками (`text-foreground`)
- CTA: `UiButton` variant="filled" full-width
- FAQ: список question/answer div-ів
- Mobile: stacked — pricing card зверху, FAQ під ним (`grid-cols-1`)
- Desktop: `lg:grid-cols-2 lg:gap-12` — pricing зліва, FAQ справа
- i18n: `landing_page.pricing`

**Крок 2.9 — FooterCtaSection**
- Текст + CTA + 4-step process cards
- Step cards = `<div>` з icon badge + title + subtitle + step number
- Перший step: `bg-primary` icon badge (`text-primary-foreground`), інші: `bg-secondary`
- CTA: `UiButton` variant="filled"
- Mobile: stacked — текст + CTA зверху, step cards під ним (`grid-cols-1`)
- Desktop: `lg:grid-cols-2 lg:gap-16` — текст зліва, steps справа
- i18n: `landing_page.footer_cta`

### Фаза 3: Збирання сторінки

**Крок 3.1 — Оновити `app/[locale]/page.tsx`**
- Замінити поточний placeholder на композицію всіх landing widgets
- Server component (без `'use client'`)
- `useTranslations('landing_page')` — кожен widget викликає `useTranslations` самостійно
- Anchor `<div id="problem">`, `<div id="portfolio">`, etc. для scroll navigation
- Оновити `generateMetadata()` з оновленими `landing_page.head` ключами

**Layout залишається без змін** — глобальний auth `Header` (logo, avatar, theme, lang) рендериться для всіх сторінок включно з landing. `LandingNav` з anchor links рендериться всередині `page.tsx` як додаткова навігація по секціях.

**Крок 3.2 — Smooth scroll**
- CSS `scroll-behavior: smooth` в `globals.css`
- `scroll-margin-top` на anchor targets для offset sticky header

**Крок 3.3 — Animations (optional)**
- Fade-in on scroll (intersection observer) — якщо потрібно
- Визначити в `animations.css` (конвенція)

### Фаза 4: SEO & Metadata

**Крок 4.1 — Metadata**
- Оновити `fetchMetadata()` для landing page
- Open Graph / Twitter Card метадані
- Structured data (Organization schema)

---

## Чеклист конвенцій

- [ ] Жодних hardcoded кольорів — тільки design tokens
- [ ] Жодних `<button>`, `<a>`, `<input>` — тільки Ui* компоненти
- [ ] Всі тексти через `useTranslations()` — жодного hardcoded тексту
- [ ] Тон: classic-polite, формальне "ви", без емодзі
- [ ] FSD: widgets у `widgets/landing/`, entities у `entities/brand/`
- [ ] Компоненти: `Component.tsx` + `types.ts` + `index.ts`
- [ ] Шрифт: тільки Tailwind utilities (font-bold, text-sm), без font-family
- [ ] Анімації: в `animations.css`, не inline
- [ ] Mobile-first: базові класи для mobile, `md:`/`lg:` для desktop
- [ ] Server components за замовчуванням, `'use client'` тільки де потрібен interactivity

---

## Залежності та ризики

| Ризик | Мітігація |
|---|---|
| Token-міграція зламає існуючі сторінки | Очікувано. Крок 0.4 — мінімальна заміна класів для компіляції. Повна адаптація — окремий спринт |
| `shared/ui/` компоненти після міграції | Оновити одразу в кроці 0.2, бо landing widgets їх використовують |
| Монохромний primary (чорний/білий) vs синій | Свідоме дизайнерське рішення чернетки. Всі accent-кольори тепер через contrast, не hue |
| Loom video embed | Placeholder на першій ітерації, embed пізніше |
| CTA buttons — куди ведуть? | "Request a Technical Estimate" → зовнішнє посилання (Calendly/Typeform, визначити пізніше). "Try Live Demo" → `/auth/signin` |

---

## Порядок виконання

```
0.1 Замінити themes.css
    ↓
0.2 Оновити shared/ui/ компоненти
    ↓
0.3 Оновити design-tokens.md
    ↓
0.4 Мінімально оновити існуючі сторінки (компіляція)
    ↓
1.1 i18n ключі
    ↓
2.1-2.9 Widgets (паралельно, незалежні, одразу mobile-first)
    ↓
3.1 Збирання сторінки (page.tsx)
    ↓
3.2-3.3 Smooth scroll + animations
    ↓
4.1 SEO
```

**Фаза 0 — блокуюча.** Без неї нові класи (`bg-card`, `text-foreground`, etc.) не працюватимуть. Після фази 0 widgets (2.1-2.9) можна робити паралельно.
