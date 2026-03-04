# Phase 4 — Toggle Mechanism

## Залежності

Вимагає завершення Phase 1 + Phase 3.

## Мета

Документація того, як механізм вмикання/вимикання типів платежів працює наскрізно (env → backend → frontend). Код для backend вже написаний у Phase 1 (env.ts) і Phase 3 (payments.service.ts). Ця фаза — web env vars.

---

## Як toggle працює

### Backend (вже зроблено в Phase 1 + 3)

```
ENV.PAYMENTS_SUBSCRIPTION_ENABLED  (bool, default: true)
ENV.PAYMENTS_ONE_OFF_ENABLED        (bool, default: true)
```

1. **Startup validation** в `env.ts` — якщо обидва `false`, app падає:
   ```
   ❌ At least one payment type must be enabled...
   ```

2. **Per-request check** в `PaymentsService.createCheckoutSession`:
   - `SUBSCRIPTION` request + `PAYMENTS_SUBSCRIPTION_ENABLED=false` → `BadRequestException(PAYMENT_TYPE_DISABLED)`
   - `ONE_OFF` request + `PAYMENTS_ONE_OFF_ENABLED=false` → `BadRequestException(PAYMENT_TYPE_DISABLED)`

### Frontend (ця фаза)

```
NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED  (default: 'true')
NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED        (default: 'true')
```

Frontend читає ці змінні і умовно рендерить секції billing page.

---

## 4.1 `apps/web/src/shared/config/env.ts`

**Читай поточний файл перед змінами.**

Додати нові змінні в кінець:

```typescript
// Payment type toggles (sync with backend PAYMENTS_*_ENABLED)
// Set to 'false' to hide payment UI sections
export const PAYMENTS_SUBSCRIPTION_ENABLED =
    process.env.NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED !== 'false';

export const PAYMENTS_ONE_OFF_ENABLED =
    process.env.NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED !== 'false';
```

**Важливо:**
- Використовуємо `!== 'false'` (а не `=== 'true'`) — це означає default `true` якщо змінна не задана
- `process.env.NEXT_PUBLIC_*` must be inline reference (Next.js compile-time inlining)
- Не загортати в `getEnvVar()` — frontend env vars не є fail-fast critical

---

## 4.2 `.env.example`

В секцію Frontend env vars (якщо є) або поруч з backend toggles додати:

```bash
# Frontend payment type toggles (sync with backend PAYMENTS_*_ENABLED)
NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED=true
NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED=true
```

---

## Сценарії конфігурації

### Обидва типи активні (default)
```bash
PAYMENTS_SUBSCRIPTION_ENABLED=true
PAYMENTS_ONE_OFF_ENABLED=true
NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED=true
NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED=true
```
Frontend: показує обидві секції (підписка + кредитні пакети)

### Тільки підписка
```bash
PAYMENTS_SUBSCRIPTION_ENABLED=true
PAYMENTS_ONE_OFF_ENABLED=false
NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED=true
NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED=false
```
Frontend: показує тільки секцію підписки. API відхиляє one-off requests.

### Тільки one-off (кредити)
```bash
PAYMENTS_SUBSCRIPTION_ENABLED=false
PAYMENTS_ONE_OFF_ENABLED=true
NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED=false
NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED=true
```
Frontend: показує тільки кредитні пакети. API відхиляє subscription requests.

### Обидва вимкнені — crash
```bash
PAYMENTS_SUBSCRIPTION_ENABLED=false
PAYMENTS_ONE_OFF_ENABLED=false
```
API: `throw new Error('❌ At least one payment type must be enabled...')` при старті

---

## Verification Phase 4

```bash
# Переконатись що web config компілюється:
pnpm --filter web build

# Вручну в apps/web/src/shared/config/env.ts:
# - PAYMENTS_SUBSCRIPTION_ENABLED та PAYMENTS_ONE_OFF_ENABLED використовують inline process.env
# - Default поведінка: true якщо NEXT_PUBLIC_* не задано
```
