# Project Conventions

Єдине джерело правил та конвенцій для всіх AI-агентів та розробників.

Агент-специфічні файли (`CLAUDE.md`, `AGENTS.md`) посилаються на ці правила —
**не дублюй** їх в інших місцях.

## Index

| Конвенція | Файл | Опис |
|-----------|------|------|
| Tone & Style | [tone.md](tone.md) | Тон та стиль user-facing повідомлень |
| Fail Fast | [fail-fast.md](fail-fast.md) | Політика обов'язкових env vars |
| i18n | [i18n.md](i18n.md) | Синхронізація мови між фронтом та бекендом |
| Env Sync | [env-sync.md](env-sync.md) | Синхронізація env vars між env.ts, .env та .env.example |

## Як додати нове правило

1. Створи файл `docs/conventions/<rule-name>.md`
2. Додай рядок в таблицю Index вище
3. Правило автоматично підхоплюється через посилання в `CLAUDE.md` / `AGENTS.md`
