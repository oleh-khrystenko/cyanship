# Documentation

Документація впорядкована за блоками.

## Блоки

- `docs/vision/` — опис самого CyanShip: бізнес-модель, позиціонування. Єдиний блок, який видаляється при форку під клієнта.
- `docs/architecture/` — опис реалізованих підсистем ядра (auth, payments).
- `docs/testing/` — тестові плани та документація (unit, integration, manual E2E).
- `docs/conventions/` — загальні конвенції та правила для AI-агентів/розробників.
- `docs/prompts/` — службові prompt-и для агентів/асистентів.

## Поточне наповнення

- `docs/vision/product.md` — повний опис проекту CyanShip
- `docs/architecture/auth-flow/` — опис реалізації авторизації (16 документів)
- `docs/architecture/payments-flow/` — опис реалізації платіжної системи (12 документів)
- `docs/testing/auth/` — unit + integration + manual E2E тести для auth
- `docs/testing/payments/` — automated + manual тести для payments
- `docs/conventions/` — tone, fail-fast, i18n, modular-boundaries, ui-primitives, design-tokens, overlays
- `docs/prompts/codex/update-context.md`
- `docs/prompts/gemini/update-context.md`

## Спринти

Планування спринтів живе в `docs/sprints/NN-slug/` і створюється по ходу роботи.
У бойлерплейті цієї папки немає навмисно — історія розробки ядра не потрібна новому проекту.
