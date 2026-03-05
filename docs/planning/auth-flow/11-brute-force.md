# Захист від brute force

## Невірний пароль — progressive lockout

Замість фіксованого ліміту використовується прогресивне блокування, яке не дратує легітимних юзерів, але ефективно зупиняє ботів:

| Невдалих спроб | Блокування |
|----------------|------------|
| 5              | 1 хвилина  |
| 10             | 5 хвилин   |
| 20             | 15 хвилин  |

- **Ключ:** Redis `login_attempts:{ip}:{email}` — зв'язка IP + email, щоб зловмисник не міг заблокувати вхід для легітимного юзера з іншого IP (DoS prevention)
- **TTL:** Лічильник спроб скидається після 15 хвилин неактивності
- **Повідомлення юзеру:** "Забагато невдалих спроб. Спробуйте через {N} хвилин або скористайтесь посиланням 'Забув пароль?'"
- **Після 20 спроб:** Додатково показувати "Увійти через email-посилання" як основний шлях

## Rate limit для check-email

- **Ключ:** Redis `check_email:{ip}` — per-IP rate limit
- **Ліміт:** 10 запитів на IP за 1 хвилину
- Запобігає масовому перебору email-адрес

## Конфігурація

```
AUTH_LOCKOUT_THRESHOLDS=5:1,10:5,20:15   # спроби:хвилини_блоку
AUTH_LOGIN_ATTEMPTS_TTL_MIN=15
AUTH_PASSWORD_MIN_LENGTH=8
AUTH_MAGIC_LINK_TTL_MIN=15
AUTH_MAGIC_LINK_RATE_LIMIT=3
AUTH_MAGIC_LINK_RATE_WINDOW_MIN=15
AUTH_MAGIC_LINK_DEDUP_SEC=60
ACCOUNT_DELETION_GRACE_DAYS=30
```

> **Boilerplate-нотатка:** Progressive lockout — стандартна практика (Google, GitHub). Конфігурується через `AUTH_LOCKOUT_THRESHOLDS` у форматі `attempts:block_minutes`. Ключ `{ip}:{email}` захищає від двох векторів: brute force пароля І DoS через блокування чужого email.
