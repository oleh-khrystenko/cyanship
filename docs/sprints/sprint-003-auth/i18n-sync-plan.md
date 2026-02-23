# Plan: i18n Sync — Language Synchronization

> Конвенція: [docs/conventions/i18n.md](../../conventions/i18n.md)
>
> Мета: бекенд повертає тільки коди + dev-message англійською. Фронт маппить коди на локалізовані повідомлення. Emails — мовою користувача.

## Поточний стан (проблеми)

| Що | Проблема |
|----|----------|
| `auth.controller.ts` — magic-link/send | Повертає `{ data: { message: 'Magic link sent' } }` — немає code |
| `auth.controller.ts` — logout | Повертає `{ data: { message: 'Logged out' } }` — немає code |
| `auth.service.ts` — exceptions | `throw new UnauthorizedException('Invalid or expired...')` — message потрапляє в response, фронт нічого з ним не робить |
| `auth.service.ts` — TooManyRequestsException | Хардкод `'Too many requests. Try again in 15 minutes.'` — dev message, ОК, але на фронті показується generic error |
| `email.service.ts` | Хардкод українською: subject, body. Не приймає `lang` |
| `all-exceptions.filter.ts` | Вже повертає `{ error: { code, message } }` — формат ОК |
| `uk.json` / `en.json` | Немає маппінгу API кодів на повідомлення. Є тільки page-specific тексти |
| Frontend auth pages | Показують hardcoded `error_generic` при будь-якій помилці, не дивляться на `code` з API |
| `preferredLang` sync | Зберігається в MongoDB, але не оновлюється при зміні мови на фронті |

---

## Задачі

### 1. packages/types — Response codes (універсальні)

Коди відповідей не прив'язані до одного стану. Кожен код має **тип** (`ResponseType`), який визначає як фронт його відображає (колір нотифікації, іконка тощо).

**Файл:** `packages/types/src/enums/response-type.ts` (новий)

```typescript
export const RESPONSE_TYPE = {
    SUCCESS: 'success',   // зелений — операція виконана
    ERROR: 'error',       // червоний — помилка, щось пішло не так
} as const;

export type ResponseType = (typeof RESPONSE_TYPE)[keyof typeof RESPONSE_TYPE];
```

Поки два типи. Нові (наприклад `warning`, `info`) додаються коли з'явиться потреба — достатньо додати рядок в enum.

**Файл:** `packages/types/src/enums/response-code.ts` (новий)

Єдиний реєстр **всіх** кодів — і success, і error, і будь-яких майбутніх:

```typescript
import { RESPONSE_TYPE, type ResponseType } from './response-type';

export const RESPONSE_CODE = {
    // --- auth success ---
    MAGIC_LINK_SENT: 'MAGIC_LINK_SENT',
    LOGGED_OUT: 'LOGGED_OUT',

    // --- users success ---
    LANG_UPDATED: 'LANG_UPDATED',

    // --- errors (вже існують в ERROR_CODE, мігруємо сюди) ---
    UNAUTHORIZED: 'UNAUTHORIZED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ResponseCode = (typeof RESPONSE_CODE)[keyof typeof RESPONSE_CODE];

/** Маппінг код → тип для фронту (колір нотифікації тощо) */
export const RESPONSE_CODE_TYPE: Record<ResponseCode, ResponseType> = {
    [RESPONSE_CODE.MAGIC_LINK_SENT]: RESPONSE_TYPE.SUCCESS,
    [RESPONSE_CODE.LOGGED_OUT]: RESPONSE_TYPE.SUCCESS,
    [RESPONSE_CODE.LANG_UPDATED]: RESPONSE_TYPE.SUCCESS,
    [RESPONSE_CODE.UNAUTHORIZED]: RESPONSE_TYPE.ERROR,
    [RESPONSE_CODE.VALIDATION_ERROR]: RESPONSE_TYPE.ERROR,
    [RESPONSE_CODE.NOT_FOUND]: RESPONSE_TYPE.ERROR,
    [RESPONSE_CODE.RATE_LIMIT_EXCEEDED]: RESPONSE_TYPE.ERROR,
    [RESPONSE_CODE.INSUFFICIENT_CREDITS]: RESPONSE_TYPE.ERROR,
    [RESPONSE_CODE.INTERNAL_ERROR]: RESPONSE_TYPE.ERROR,
};
```

Додавання нового коду — один рядок в `RESPONSE_CODE` + один рядок в `RESPONSE_CODE_TYPE`.

**Міграція:** `ERROR_CODE` залишити як alias/re-export для зворотної сумісності з `AllExceptionsFilter`, але нові коди додавати тільки в `RESPONSE_CODE`.

**Файл:** `packages/types/src/index.ts` — додати re-export.

---

### 2. packages/types — Оновити ApiResponse

**Файл:** `packages/types/src/contracts/api.ts`

Додати типізовану message response з обов'язковим `code`:

```typescript
export interface ApiMessageResponse {
    data: {
        code: ResponseCode;
        message: string;
    };
    meta?: Record<string, unknown>;
}
```

`ApiResponse<T>` залишити як є для data-heavy responses (verify, refresh, getMe).

---

### 3. Backend — auth.controller.ts

**Файл:** `apps/api/src/modules/auth/auth.controller.ts`

| Endpoint | Зараз | Після |
|----------|-------|-------|
| `POST magic-link/send` | `{ data: { message } }` | `{ data: { code: 'MAGIC_LINK_SENT', message: 'Magic link sent' } }` |
| `POST logout` | `{ data: { message } }` | `{ data: { code: 'LOGGED_OUT', message: 'Logged out' } }` |
| `POST magic-link/send` | Не передає `lang` в service | Читати `Accept-Language` header або body `lang`, передати в `sendMagicLink()` |

---

### 4. Backend — email.service.ts (мультимовність)

**Файл:** `apps/api/src/modules/auth/services/email.service.ts`

- Метод `sendMagicLink()` приймає `lang: Lang` параметр
- Email templates для `uk` та `en`:

| Елемент | UK | EN |
|---------|----|----|
| Subject | Вхід у LucidKit | Sign in to LucidKit |
| Body text | Натисніть кнопку нижче, щоб увійти у ваш акаунт. | Click the button below to sign in to your account. |
| CTA | Увійти в LucidKit | Sign in to LucidKit |
| Footer | Посилання дійсне 15 хвилин. Якщо ви не запитували вхід — ігноруйте цей лист. | This link expires in 15 minutes. If you didn't request this — ignore this email. |

- `html lang="{lang}"` динамічно

---

### 5. Backend — auth.service.ts

**Файл:** `apps/api/src/modules/auth/auth.service.ts`

- `sendMagicLink(email, lang?)` — приймає optional `lang`, передає в `emailService.sendMagicLink()`
- Для авторизованих запитів (email flow) — `lang` з body або header
- Default: `'uk'` якщо не передано

---

### 6. Backend — SendMagicLinkDto

**Файл:** `packages/types/src/contracts/auth.ts`

Додати optional `lang` в `SendMagicLinkSchema`. Мови беруться з `LANG` — єдиного джерела правди, без хардкоду:

```typescript
import { LANG } from '../constants/lang';

const langValues = Object.values(LANG) as [string, ...string[]];

export const SendMagicLinkSchema = z.object({
    email: emailSchema,
    lang: z.enum(langValues).optional(),
});
```

Коли додається нова мова — достатньо додати її в `LANG` (`packages/types/src/constants/lang.ts`). Всі схеми, які використовують `langValues`, підхоплять автоматично.

---

### 7. Frontend — i18n ключі для API кодів

**Файли:** `apps/web/messages/uk.json`, `apps/web/messages/en.json`

Додати секції `notifications` та `errors`:

```json
{
    "notifications": {
        "auth": {
            "magic_link_sent": "Посилання надіслано на вашу пошту",
            "logged_out": "Ви вийшли з акаунту"
        }
    },
    "errors": {
        "auth": {
            "unauthorized": "Час сесії вичерпано. Увійдіть знову",
            "invalid_magic_link": "Посилання недійсне або прострочене"
        },
        "generic": {
            "validation_error": "Перевірте введені дані",
            "rate_limit_exceeded": "Забагато запитів. Спробуйте через 15 хвилин",
            "internal_error": "Сталася помилка. Спробуйте пізніше",
            "unknown": "Сталася помилка. Спробуйте пізніше"
        }
    }
}
```

Аналогічно для `en.json`.

---

### 8. Frontend — утиліта маппінгу API кодів

**Файл:** `apps/web/src/shared/api/mapApiCode.ts` (новий)

Функція `getApiMessage(code: string, module?: string): string` — повертає i18n ключ для коду:

```typescript
// Пріоритет:
// 1. errors.{module}.{code_lower}   (якщо module передано)
// 2. errors.generic.{code_lower}    (fallback)
// 3. errors.generic.unknown          (final fallback)
```

Використання з `next-intl`:

```typescript
const t = useTranslations();
const message = t(getApiMessageKey(error.code, 'auth'));
```

---

### 9. Frontend — auth pages (використання кодів)

**Файли:**
- `apps/web/src/app/[locale]/auth/signin/page.tsx`
- `apps/web/src/app/[locale]/auth/verify/page.tsx`

Замість generic `error_generic`:
1. Читати `error.code` з API response
2. Маппити через `getApiMessageKey()`
3. Показувати локалізоване повідомлення

Для success:
1. `magic-link/send` → показати "Перевірте пошту" (вже є)
2. Тости (якщо будуть): використовувати `notifications.auth.{code}`

---

### 10. Frontend — передавати `lang` при відправці magic link

**Файл:** `apps/web/src/shared/api/auth.ts`

При виклику `POST /auth/magic-link/send` — передавати поточну мову:

```typescript
export const sendMagicLink = (email: string, lang: string) =>
    client.post('/auth/magic-link/send', { email, lang });
```

---

### 11. Frontend — синхронізація preferredLang

**Файли:**
- `apps/web/src/features/change-lang/ChangeLang.tsx` (або де перемикається мова)
- `apps/api/src/modules/users/users.controller.ts`
- `apps/api/src/modules/users/users.service.ts`

При зміні мови на фронті:
1. Фронт відправляє `PATCH /api/users/me/lang` (або `PATCH /api/users/me` з `{ preferredLang }`)
2. API оновлює `user.preferredLang` в MongoDB
3. Це впливає на мову emails при наступних запитах

Endpoint:
```typescript
@UseGuards(JwtAuthGuard)
@Patch('me/lang')
async updateLang(
    @CurrentUser() user: UserDocument,
    @Body() dto: UpdateLangDto
) {
    await this.usersService.updateLang(user.id, dto.lang);
    return { data: { code: 'LANG_UPDATED', message: 'Language updated' } };
}
```

---

## Порядок виконання

```
1. packages/types — response codes/types + ApiMessageResponse + SendMagicLink lang
2. apps/api — email.service.ts (мультимовні templates)
3. apps/api — auth.service.ts (передача lang)
4. apps/api — auth.controller.ts (code в responses, Accept-Language)
5. apps/api — users controller/service (PATCH preferredLang)
6. apps/web — i18n ключі (notifications + errors в uk.json / en.json)
7. apps/web — mapApiCode утиліта
8. apps/web — auth pages (маппінг кодів на повідомлення)
9. apps/web — передача lang при magic-link/send
10. apps/web — ChangeLang → sync preferredLang з API
```

Кроки 1-5 (backend) та 6-7 (frontend types/utils) можна робити паралельно.

---

## Не входить в цей план

- Локалізація інших emails (поки є тільки magic link)
- i18n для майбутніх модулів (reports, payments) — додаватимуться при реалізації
- Зміна формату `ApiResponse<T>` для data-heavy endpoints (verify, refresh, getMe) — вони вже ОК
