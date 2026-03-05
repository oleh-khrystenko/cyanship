# Account Linking

## Правило

Один email = один акаунт. Провайдер не створює окремий акаунт.

## Сценарії

| Перша реєстрація | Друга дія | Результат |
|------------------|-----------|-----------|
| Google (user@gmail.com) | Email вхід user@gmail.com | Той самий акаунт, magic link для входу (пароля немає) |
| Magic link (user@gmail.com) | Google OAuth з user@gmail.com | Той самий акаунт, Google провайдер додається до акаунту |
| Email + пароль (user@gmail.com) | Google OAuth з user@gmail.com | Той самий акаунт, Google провайдер додається, пароль зберігається |
