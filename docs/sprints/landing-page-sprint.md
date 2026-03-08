# Sprint: Landing Page

> Перенесення чернетки з `apps/web/_drafts/` у production-ready landing page з дотриманням FSD, design tokens, UI primitives та i18n конвенцій.

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
| `text-foreground` | `text-text-primary` | Design token |
| `text-muted-foreground` | `text-text-secondary` | Design token |
| `bg-card` | `bg-surface` | Design token |
| `bg-secondary` | `bg-surface-hover` | Design token |
| `bg-secondary/50` | `bg-surface-hover/50` | Opacity modifier |
| `text-primary-foreground` | `text-white` | Дозволений виняток (контрастний текст на primary) |
| Hardcoded English text | `useTranslations()` | i18n через next-intl |
| `.container mx-auto px-6` | `.container` (settings.css) + `px-6` | Існуючий utility |

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

## Нові design tokens

Чернетка не вимагає нових токенів — всі кольори маппляться на існуючі:

| Потреба | Існуючий токен | Достатньо? |
|---|---|---|
| Фон карток | `bg-surface` | Так |
| Hover карток | `bg-surface-hover` | Так |
| Акцентний фон | `bg-primary` | Так |
| Текст на primary | `text-white` | Так (виняток) |
| Borders | `border-border` | Так |
| Основний текст | `text-text-primary` | Так |
| Другорядний | `text-text-secondary` | Так |

---

## i18n — розширення існуючого namespace

Namespace: `welcome_page` (існуючий, розширюється новими ключами для landing секцій).

```jsonc
// messages/uk.json & messages/en.json
{
  "welcome_page": {
    // --- Існуючі ключі (зберігаються) ---
    "head": { "title": "...", "description": "..." },
    "heading": "...",
    "description": "...",
    "cta": "...",

    // --- Нові ключі для landing секцій ---
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

Всі widgets використовують `useTranslations('welcome_page')` — єдиний namespace для всієї landing/welcome сторінки.

---

## План імплементації

### Фаза 1: Інфраструктура

**Крок 1.1 — i18n ключі**
- Розширити існуючий `welcome_page` namespace в `messages/uk.json` та `messages/en.json`
- Додати нові вкладені секції: `nav`, `hero`, `problem`, `dogfooding`, `portfolio`, `workflow`, `pricing`, `footer_cta`, `footer`
- Всі тексти з чернетки перекласти на українську
- Файли: `apps/web/messages/uk.json`, `apps/web/messages/en.json`

**Крок 1.2 — Перевірити design tokens**
- Переконатися що `bg-surface`, `bg-surface-hover`, `border-border` коректно працюють для card-подібних елементів
- Якщо потрібно — додати нові токени в `themes.css` (з оновленням registry в `design-tokens.md`)

### Фаза 2: Widgets (знизу вверх по залежностях)

Кожен widget створюється як окрема директорія в `widgets/landing/` зі структурою `Component.tsx` + `types.ts` + `index.ts`.

**Крок 2.1 — LandingFooter**
- Простий footer з Logo + copyright
- Використовує `Logo` з `entities/brand`
- i18n: `welcome_page.footer`

**Крок 2.2 — LandingNav**
- Горизонтальна anchor navigation для секцій сторінки
- `UiButton as="a"` variant="text" для anchor links (#problem, #portfolio, #workflow, #pricing)
- Рендериться всередині `page.tsx` як перший елемент `<main>`, під глобальним auth Header
- Mobile: горизонтальний scroll або compact layout
- i18n: `welcome_page.nav`

**Крок 2.3 — HeroSection**
- Grid layout: текст зліва + CodeVisual справа
- `CodeVisual.tsx` — окремий під-компонент (псевдо-editor з syntax highlighting через span кольори)
- 2 CTA: `UiButton` filled (primary) + `UiButton` text (secondary)
- CodeVisual використовує `font-mono`, кольори через design tokens
- i18n: `welcome_page.hero`

**Крок 2.4 — ProblemSection**
- Текстовий блок + 3 feature cards
- Cards = `<div>` з `bg-surface border-border rounded-lg p-6`
- Іконки: `Layers`, `Code2`, `Rocket` з lucide-react
- i18n: `welcome_page.problem`

**Крок 2.5 — DogfoodingSection**
- Текстовий блок + checklist
- Checklist items = `<div>` з `bg-surface border-border rounded-lg p-4`
- Check icon в круглому індикаторі
- i18n: `welcome_page.dogfooding`

**Крок 2.6 — PortfolioSection**
- Grid: текст зліва + video placeholder справа
- Video placeholder — `<div>` з Play іконкою (не інтерактивний поки що, або `UiButton as="a"` якщо буде Loom URL)
- i18n: `welcome_page.portfolio`

**Крок 2.7 — WorkflowSection**
- Текстовий блок + 3 cards
- Cards = `<div>` з `bg-surface border-border rounded-lg`
- Icon badges = `<div>` з `bg-surface-hover border-border rounded-lg`
- i18n: `welcome_page.workflow`

**Крок 2.8 — PricingSection**
- Grid: pricing card зліва + FAQ справа
- Pricing card = `<div>` з `border-2 border-text-primary bg-surface` (акцентна рамка)
- Includes checklist з Check іконками
- CTA: `UiButton` variant="filled" full-width
- FAQ: список question/answer div-ів
- i18n: `welcome_page.pricing`

**Крок 2.9 — FooterCtaSection**
- Grid: текст + CTA зліва, 4-step process cards справа
- Step cards = `<div>` з icon badge + title + subtitle + step number
- Перший step: `bg-primary` icon badge, інші: `bg-surface-hover`
- CTA: `UiButton` variant="filled"
- i18n: `welcome_page.footer_cta`

### Фаза 3: Збирання сторінки

**Крок 3.1 — Оновити `app/[locale]/page.tsx`**
- Замінити поточний placeholder на композицію всіх landing widgets
- Server component (без `'use client'`)
- `useTranslations('welcome_page')` — кожен widget викликає `useTranslations` самостійно
- Anchor `<div id="problem">`, `<div id="portfolio">`, etc. для scroll navigation
- Оновити `generateMetadata()` з оновленими `welcome_page.head` ключами

**Layout залишається без змін** — глобальний auth `Header` (logo, avatar, theme, lang) рендериться для всіх сторінок включно з landing. `LandingNav` з anchor links рендериться всередині `page.tsx` як додаткова навігація по секціях.

### Фаза 4: Responsive & Polish

**Крок 4.1 — Mobile responsive**
- LandingNav: горизонтальний scroll або приховування на small screens
- Hero: single column на mobile, code visual під текстом
- Cards: 1 column на mobile, 2-3 на desktop
- Pricing: stack вертикально

**Крок 4.2 — Smooth scroll**
- CSS `scroll-behavior: smooth` на `<html>` або в `globals.css`
- Offset для sticky header (scroll-margin-top)

**Крок 4.3 — Animations (optional)**
- Fade-in on scroll (intersection observer) — якщо потрібно
- Визначити в `animations.css` (конвенція)

### Фаза 5: SEO & Metadata

**Крок 5.1 — Metadata**
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
- [ ] Server components за замовчуванням, `'use client'` тільки де потрібен interactivity (smooth scroll)

---

## Залежності та ризики

| Ризик                                              | Мітігація                                                                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| CodeVisual syntax colors потребують нових токенів   | Використати opacity modifiers (`text-text-secondary`, `text-text-primary`) — достатньо для mono-chrome code display    |
| LandingNav mobile layout                           | Горизонтальний scroll або приховування на mobile (responsive)                                                           |
| Loom video embed                                   | Placeholder на першій ітерації, embed пізніше                                                                          |
| CTA buttons — куди ведуть?                         | "Request a Technical Estimate" → зовнішнє посилання (Calendly/Typeform, визначити пізніше). "Try Live Demo" → `/auth/signin` |

---

## Порядок виконання

```
1.1 i18n ключі
    ↓
1.2 Design tokens перевірка
    ↓
2.1-2.9 Widgets (паралельно, незалежні)
    ↓
3.1 Збирання сторінки (page.tsx)
    ↓
4.1-4.3 Responsive + polish
    ↓
5.1 SEO
```

Widgets (2.1-2.9) можна робити паралельно, бо вони незалежні. Layout не змінюється — глобальний Header залишається на місці.
