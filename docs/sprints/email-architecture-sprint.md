# Sprint: Email Architecture

> Рефакторинг email-системи: React Email шаблони з композицією, типізована i18n, виділений EmailModule, брендові кольори як shared константи.

---

## Мотивація

Поточний стан `email.service.ts`:
- HTML layout дублюється між `sendMagicLink` і `sendDeletionConfirmation`
- Хардкоджені кольори (`#2563eb`, `#f4f4f5`) без єдиного джерела
- Переклади розмазані: частково в `TEMPLATES` об'єкті, частково в inline тернарниках
- `EmailService` живе в `AuthModule` — email це cross-cutting concern, не auth

---

## Архітектурні рішення

### 1. React Email для шаблонів

**Пакети:** `@react-email/components`, `@react-email/render`

Чому React Email:
- Компонентна композиція (base layout → конкретні шаблони)
- Type-safe props на кожен шаблон
- Resend приймає JSX напряму (та сама компанія) — не потрібен ручний `render()`
- Preview під час розробки (`email dev`)
- Той самий mental model що і фронтенд (React + TypeScript)

### 2. Виділений EmailModule (global)

`EmailService` переїжджає з `AuthModule` у власний `EmailModule`:
- `@Global()` — будь-який модуль (auth, payments, reports) може інжектити без import
- `AuthModule` більше не експортує `EmailService` і `REDIS_CLIENT` (email не потребує Redis)
- Чітке розділення відповідальності: auth = автентифікація, email = відправка листів

### 3. Композиція шаблонів

```
BaseLayout (єдине джерело істини дизайну)
  ├── brand header (CyanShip)
  ├── container (max-width, border-radius, padding)
  ├── {children} ← конкретний шаблон
  └── footer area (muted text)

MagicLinkEmail extends BaseLayout
  ├── body text (залежить від purpose)
  ├── CTA button (link з token)
  └── footer note (expiry warning)

DeletionConfirmationEmail extends BaseLayout
  ├── body text (account deactivated)
  ├── instruction text (how to recover)
  ├── CTA button (sign in link)
  └── footer note (security warning)
```

### 4. Email i18n — типізований словник

**Принцип:** простий TypeScript словник без зовнішніх i18n бібліотек (конвенція `docs/conventions/i18n.md` — email єдиний виняток де бекенд працює з локалізованим контентом).

- Інтерфейс `EmailTranslations` визначає структуру всіх перекладів
- Кожна мова — окремий файл (`uk.ts`, `en.ts`), що має задовольняти `satisfies EmailTranslations`
- TypeScript гарантує повноту: пропустив ключ → compile error
- Додати мову = створити файл `de.ts` з тим самим інтерфейсом
- Тип `Lang` береться з `packages/types` (single source of truth)

### 5. EMAIL_COLORS — брендові кольори для листів

**Розташування:** `packages/types/src/constants/email-colors.ts`

Чому в `packages/types`, а не в `apps/api`:
- Single source of truth між API та потенційними майбутніми consumers
- Консистентність з іншими shared константами (LANG, RESPONSE_CODE)

Чому НЕ витягуємо всі кольори з `themes.css`:
- Фронт використовує CSS-змінні + light/dark тему (один токен = два значення)
- Email не підтримує CSS-змінні, `prefers-color-scheme` ненадійний
- Email завжди рендерить один фіксований набір кольорів (inline styles)
- Різні контексти з різними технічними обмеженнями = свідоме розділення

**Правило:** `EMAIL_COLORS` — строга проекція `themes.css` (light-тема). Назви ключів 1:1 з CSS-змінними. Жодних вигаданих кольорів чи імен.

Набір email-кольорів мінімальний (~6 значень), синхронізований з light-темою:

| Ключ | Значення | Призначення | CSS-змінна в themes.css |
|------|----------|-------------|------------------------|
| `background` | `#f8f8fa` | Фон body листа | `--background` |
| `card` | `#fbfcfc` | Фон контейнера з контентом | `--card` |
| `foreground` | `#13161b` | Основний текст | `--foreground` |
| `mutedForeground` | `#6e7278` | Другорядний текст, footer | `--muted-foreground` |
| `primary` | `#00a7a8` | CTA кнопка | `--primary` |
| `primaryForeground` | `#f8f8fa` | Текст на CTA кнопці | `--primary-foreground` |

> Hex-значення конвертовані з oklch light-теми `themes.css`. Єдине джерело істини — `themes.css`, `EMAIL_COLORS` є його проекцією.

---

## Цільова структура файлів

```
packages/types/src/
└── constants/
    ├── lang.ts                            # існуючий (оновити: додати утиліти)
    └── email-colors.ts                    # NEW: брендові кольори для email

apps/api/src/modules/
├── email/                                 # NEW: виділений модуль
│   ├── email.module.ts                    # @Global() NestJS module
│   ├── email.service.ts                   # send logic через Resend
│   ├── email.service.spec.ts              # тести
│   ├── templates/
│   │   ├── layouts/
│   │   │   └── base.tsx                   # base layout — єдине джерело дизайну
│   │   ├── magic-link.tsx                 # magic link шаблон (всі 4 purpose)
│   │   └── deletion-confirmation.tsx      # deletion confirmation шаблон
│   └── i18n/
│       ├── types.ts                       # інтерфейси перекладів
│       ├── uk.ts                          # українська
│       ├── en.ts                          # англійська
│       └── resolve.ts                     # helper: lang → translations (з fallback)
├── auth/
│   ├── services/
│   │   └── email.service.ts              # ВИДАЛИТИ (замінений на modules/email/)
│   │   └── email.service.spec.ts         # ВИДАЛИТИ
│   ├── auth.module.ts                     # ОНОВИТИ: прибрати EmailService, імпорт не потрібен (global)
│   └── auth.service.ts                    # ОНОВИТИ: використовувати новий EmailService API
```

---

## Кроки реалізації

### Крок 1: Shared constants

**Файли:** `packages/types/src/constants/`

1.1. Створити `email-colors.ts` — строга проекція light-теми `themes.css`, назви 1:1 з CSS-змінними:
```typescript
/**
 * Email-кольори — проекція light-теми з themes.css.
 * Назви ключів відповідають CSS-змінним (camelCase).
 * Єдине джерело істини: apps/web/src/shared/styles/themes.css
 */
export const EMAIL_COLORS = {
  background: '#f8f8fa',       // --background
  card: '#fbfcfc',             // --card
  foreground: '#13161b',       // --foreground
  mutedForeground: '#6e7278',  // --muted-foreground
  primary: '#00a7a8',          // --primary
  primaryForeground: '#f8f8fa', // --primary-foreground
} as const;
```

1.2. Оновити `lang.ts` — додати масив всіх мов та default:
```typescript
export const LANG = {
  UK: 'uk',
  EN: 'en',
} as const;

export type Lang = (typeof LANG)[keyof typeof LANG];

export const SUPPORTED_LANGS: Lang[] = [LANG.UK, LANG.EN];
export const DEFAULT_LANG: Lang = LANG.EN;
```

1.3. Оновити `packages/types` barrel export.

1.4. Rebuild `packages/types` (`pnpm --filter @cyanship/types build`).

---

### Крок 2: Install React Email

**Файли:** `apps/api/package.json`

2.1. Встановити залежності:
```bash
pnpm --filter api add @react-email/components @react-email/render
```

2.2. Переконатись що `tsconfig.json` в `apps/api` підтримує JSX:
- `"jsx": "react-jsx"` (або `"react"`) — потрібно для `.tsx` файлів в API
- Перевірити `include` патерни щоб підхопити `**/*.tsx`

---

### Крок 3: Email i18n system

**Файли:** `apps/api/src/modules/email/i18n/`

3.1. Створити `types.ts` — інтерфейси для всіх email перекладів:
```typescript
interface MagicLinkTranslations {
  subject: string;
  body: string;
  cta: string;
  footer: string;
}

interface DeletionConfirmationTranslations {
  subject: string;
  body: (formattedDate: string) => string;
  instruction: string;
  cta: string;
  footer: string;
}

interface EmailTranslations {
  magicLink: Record<MagicLinkPurpose, MagicLinkTranslations>;
  deletionConfirmation: DeletionConfirmationTranslations;
}
```

3.2. Створити `uk.ts` — переклади з поточного коду (перенести, не переписувати).

3.3. Створити `en.ts` — аналогічно.

3.4. Створити `resolve.ts` — helper:
```typescript
import { type Lang, DEFAULT_LANG } from '@cyanship/types';

const translationMap: Record<Lang, EmailTranslations> = { uk, en };

export function resolveTranslations(lang: string): EmailTranslations {
  return translationMap[lang as Lang] ?? translationMap[DEFAULT_LANG];
}
```

---

### Крок 4: React Email шаблони

**Файли:** `apps/api/src/modules/email/templates/`

4.1. Створити `layouts/base.tsx` — base layout:
- Використовує `EMAIL_COLORS` з `@cyanship/types`
- React Email компоненти: `Html`, `Head`, `Body`, `Container`, `Section`, `Text`
- Props: `lang: string`, `children: React.ReactNode`
- Рендерить: brand header "CyanShip", container wrapper, footer slot

4.2. Створити `magic-link.tsx`:
- Props: `link: string`, `translations: MagicLinkTranslations`, `lang: string`
- Обгортає контент в `<BaseLayout>`
- Рендерить: body text, CTA button, footer note

4.3. Створити `deletion-confirmation.tsx`:
- Props: `signInUrl: string`, `translations: DeletionConfirmationTranslations`, `formattedDate: string`, `lang: string`
- Обгортає контент в `<BaseLayout>`
- Рендерить: body text, instruction, CTA button, footer note

---

### Крок 5: EmailModule + EmailService

**Файли:** `apps/api/src/modules/email/`

5.1. Створити `email.service.ts`:
```typescript
@Injectable()
export class EmailService {
  private readonly resend = new Resend(ENV.RESEND_API_KEY);
  private readonly logger = new Logger(EmailService.name);

  async sendMagicLink(params: {
    email: string;
    token: string;
    purpose: MagicLinkPurpose;
    lang: string;
    redirectTo?: string;
  }): Promise<void> {
    const t = resolveTranslations(params.lang);
    const link = this.buildMagicLink(params.token, params.purpose, params.redirectTo);

    // Resend приймає JSX напряму — render() не потрібен
    await this.send({
      to: params.email,
      subject: t.magicLink[params.purpose].subject,
      react: MagicLinkEmail({
        link,
        translations: t.magicLink[params.purpose],
        lang: params.lang,
      }),
    });

    this.logger.log(`Magic link (${params.purpose}) sent to ${params.email}`);
  }

  async sendDeletionConfirmation(params: {
    email: string;
    deletionDate: Date;
    lang: string;
  }): Promise<void> {
    // ... аналогічно
  }

  private async send(options: { to: string; subject: string; react: JSX.Element }) {
    const { error } = await this.resend.emails.send({
      from: ENV.RESEND_FROM_EMAIL,
      ...options,
    });
    if (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${error.message}`);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  private buildMagicLink(token: string, purpose: MagicLinkPurpose, redirectTo?: string): string {
    // логіка з поточного email.service.ts
  }
}
```

5.2. Створити `email.module.ts`:
```typescript
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
```

5.3. Створити `email.service.spec.ts` — перенести та адаптувати тести з поточного файлу.

---

### Крок 6: Інтеграція

**Файли:** `apps/api/src/`

6.1. `app.module.ts` — додати `EmailModule` до imports.

6.2. `modules/auth/auth.module.ts`:
- Прибрати `EmailService` з `providers` і `exports`
- `REDIS_CLIENT` залишається (використовується `AuthService` для tokens)

6.3. `modules/auth/auth.service.ts`:
- Оновити import `EmailService` → з `../email/email.service` (або через DI, module global)
- Оновити виклики `sendMagicLink` і `sendDeletionConfirmation` під новий API (params object)

6.4. Видалити старі файли:
- `modules/auth/services/email.service.ts`
- `modules/auth/services/email.service.spec.ts`

---

### Крок 7: Верифікація

7.1. Rebuild types: `pnpm --filter @cyanship/types build`
7.2. Запустити lint: `pnpm lint`
7.3. Запустити тести: `pnpm --filter api test`
7.4. Перевірити що `auth.service.spec.ts` проходить (mock нового EmailService)
7.5. Перевірити що `email.service.spec.ts` покриває всі шаблони × всі мови

---

## Чеклист якості

- [ ] Жоден хардкоджений колір в шаблонах — тільки `EMAIL_COLORS`
- [ ] Жоден хардкоджений переклад в шаблонах — тільки через i18n
- [ ] `Lang` type з `@cyanship/types` використовується всюди
- [ ] Base layout один — всі шаблони його наслідують
- [ ] TypeScript compile error при неповних перекладах
- [ ] `EmailService` НЕ залежить від Redis, JWT, або будь-якого auth-коду
- [ ] `AuthModule` НЕ експортує `EmailService`
- [ ] Всі існуючі тести адаптовані та проходять
- [ ] `email.service.spec.ts` покриває: кожен шаблон × кожну мову × fallback на EN
- [ ] Preview працює (`email dev`) — опціонально, не блокує merge

---

## Ризики та нюанси

| Ризик | Мітігація |
|-------|-----------|
| `tsconfig.json` API не підтримує JSX | Додати `"jsx": "react-jsx"`, перевірити `include` |
| React Email збільшує bundle size API | Мінімальний вплив — `@react-email/components` tree-shakeable |
| Circular dependency при global module | `EmailModule` не імпортує жодного іншого app module |
| Resend JSX rendering в тестах | Mock Resend SDK як зараз, перевіряти props а не HTML |
| `AUTH_MAGIC_LINK_TTL_MIN` в footer тексті | Передавати TTL як параметр або брати з ENV |

---

## Логотип в листах

### Поточне рішення: текстовий "CyanShip"

Стилізований текст у `BaseLayout`. Працює в 100% email-клієнтів без будь-яких обмежень.

### Чому не `<img>` з логотипом

Більшість email-клієнтів (Gmail, Outlook, Apple Mail) блокують зовнішні зображення за замовчуванням. Користувач бачить порожній квадрат поки не натисне "Show images". Багато відомих сервісів (Stripe, Linear, Vercel) свідомо обирають текстовий підхід саме з цієї причини.

### Майбутня еволюція (за scope)

- **`<img>` з CDN** — коли з'явиться CDN для статики, можна додати логотип як progressive enhancement з fallback на текст (alt="CyanShip")
- **BIMI** — логотип поруч з іменем відправника в inbox (як аватар). Вимагає верифікований домен (SPF, DKIM, DMARC) + VMC сертифікат (~$1,000-1,500/рік). Доцільно при масштабуванні

---

## Що виходить за scope

- Додавання нових типів листів (billing notifications, reports) — окремий sprint
- Dark mode для email — ненадійна підтримка email клієнтами
- React Email preview setup (`email dev`) — nice to have, не блокує
- Міграція фронтенд кольорів — не потрібна, `themes.css` залишається як є
- Логотип як зображення / BIMI — див. секцію "Логотип в листах"
