# Вимоги до пароля

Файл: `packages/types/src/validation/common.ts` (passwordSchema)

## Вимоги

- Мінімальна довжина: 8 символів (`passwordSchema` — `z.string().min(8)`)
- Без додаткових вимог до складності

## Валідація

- Zod-схема `passwordSchema` в `packages/types` — single source of truth
- Перевірка на backend через `createZodDto()` (nestjs-zod)
- Хешування: bcrypt з salt rounds 10
