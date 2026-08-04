# Захист від brute force

Файл: `apps/api/src/modules/auth/auth.service.ts` (checkBruteForce, checkEmailRateLimit)

## Невірний пароль — progressive lockout

Прогресивне блокування по ключу `login_attempts:{ip}:{email}`:

| Невдалих спроб | Блокування |
|----------------|------------|
| 5              | 1 хвилина  |
| 10             | 5 хвилин   |
| 20             | 15 хвилин  |

- **Ключ:** `login_attempts:{ip}:{email}` — зв'язка IP + email, щоб зловмисник не міг заблокувати вхід для легітимного юзера з іншого IP
- **TTL:** Лічильник спроб скидається після 15 хвилин неактивності (`LOGIN_ATTEMPTS_TTL`)
- **Скидання при успіху:** Після успішного логіну лічильник очищується (`clearLoginAttempts`)
- **HTTP response:** 429 Too Many Requests з повідомленням "Too many login attempts. Try again in {N} minutes"
- **Frontend:** При 429 показує повідомлення з кількістю хвилин (парсить Retry-After header) + кнопку "Увійти через email-посилання" (`showMagicLinkSuggestion`)

## Rate limit для check-email

- **Ключ:** `check_email:{ip}` — per-IP rate limit
- **Ліміт:** 10 запитів на IP за 60 секунд
- **HTTP response:** 429 Too Many Requests

## Rate limit для magic link

- **Ключ:** `ratelimit:magic:{email}` — per-email rate limit
- **Ліміт:** 3 запити за 15 хвилин (`MAGIC_LINK_RATE_LIMIT`, `MAGIC_LINK_RATE_WINDOW`)
- **HTTP response:** 429 Too Many Requests

## Конфігурація

Константи модуля в `apps/api/src/modules/auth/auth.service.ts` (не env vars — значення однакові в усіх середовищах):

```typescript
const LOGIN_ATTEMPTS_TTL = 15 * 60;
const MAGIC_LINK_TTL = 15 * 60;
const MAGIC_LINK_RATE_LIMIT = 3;
const MAGIC_LINK_RATE_WINDOW = 15 * 60;
const MAGIC_LINK_DEDUP_TTL = 60;

const LOCKOUT_THRESHOLDS = [
    { attempts: 5, blockMin: 1 },
    { attempts: 10, blockMin: 5 },
    { attempts: 20, blockMin: 15 },
];
```
