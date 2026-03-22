# Sprint 03: Billing Window — платіжна інтеграція у Proof секції

> Міні-віджет каталогу планів/паків в інтерактивному вікні секції Proof. Відвідувач бачить реальні ціни зі Stripe і може пройти тестовий checkout.

---

## Ключові рішення

### Catalog fetch
ProofBilling сам фетчить каталог через `getCatalog()` (public endpoint, без auth, Redis cache 5 хв). Це ізолює компонент — не потрібно prop-drilling через ProofWindow/DogfoodingSection.

### Неавторизований користувач
UI каталогу виглядає однаково. При кліку на будь-яку кнопку Subscribe/Buy → `onRequestAuth()` перемикає вікно на Auth tab. Повідомлення "Платіжна система доступна тільки авторизованим" показується у Auth вікні (відповідальність ProofWindow/Auth, не Billing).

### Повернення після Stripe Checkout
Stripe redirectить на `/billing/success` або `/billing/cancel` (захардкоджені в backend). Щоб юзер повернувся на лендінг:
- Перед redirect на Stripe: `sessionStorage.setItem('billing_return_path', '/${locale}#dogfooding')`
- Success/cancel сторінки перевіряють `sessionStorage.getItem('billing_return_path')` і редіректять туди замість `/billing`
- Без змін у backend

### Layout — sub-tabs Plans | Packs
Віджет компактний, все одразу не влізе. Якщо обидва feature flags увімкнені — показуємо два sub-tabs. Якщо один — показуємо тільки відповідний контент без tabs. Кожен план/пак — горизонтальний рядок: назва + ціна + кнопка. Без картинок, без списку фіч — це proof, не повна billing page.

### DemoBanner
Реюзаємо існуючий `DemoBanner` з `@/features/billing` як є. Він достатньо компактний (title + description + test card number). Критично важливий — відвідувач має знати що можна безпечно тестувати.

---

## Файли для зміни

### 1. `apps/web/src/features/agency/proof/ui/ProofBilling/ProofBilling.tsx`
Повний rewrite заглушки.

**Структура компонента:**
```
ProofBilling({ onRequestAuth })
├── State: catalog, isLoading, loadingAction (який checkout в процесі)
├── useEffect: getCatalog()
├── handleCheckout(paymentType, code):
│   ├── if !isAuthenticated → onRequestAuth()
│   ├── sessionStorage.setItem('billing_return_path', ...)
│   ├── createSubscriptionCheckout(code) або createOneOffCheckout(code)
│   └── window.location.assign(checkoutUrl)
├── Render:
│   ├── DemoBanner (з @/features/billing)
│   ├── Sub-tabs: Plans | Packs (якщо обидва flags enabled)
│   ├── Plan rows: назва + ціна/interval + Subscribe кнопка
│   └── Pack rows: назва + ціна + executions count + Buy кнопка
```

**Деталі:**
- Props: `{ onRequestAuth?: () => void }`
- Feature flags з `ENV`: `PAYMENTS_SUBSCRIPTION_ENABLED`, `PAYMENTS_ONE_OFF_ENABLED`
- `formatPrice()` з `@cyanship/types` для форматування цін
- `UiButton` size="sm": `variant="filled"` для featured, `variant="outline"` для інших
- Loading стан: `UiSpinner` поки каталог вантажиться
- Error стан: коротке повідомлення якщо каталог не завантажився
- Loading spinner в кнопці під час checkout (як на billing page)
- Сортування за `displayOrder` з каталогу

**Імпорти (все існуюче):**
- `getCatalog`, `createSubscriptionCheckout`, `createOneOffCheckout` з `@/shared/api`
- `useAuthStore` — `isAuthenticated`
- `DemoBanner` з `@/features/billing`
- `formatPrice` з `@cyanship/types`
- `ENV` з `@/shared/config`
- `UiButton`, `UiSpinner`
- `useTranslations`, `useLocale`

### 2. `apps/web/src/app/[locale]/(protected)/billing/success/page.tsx`
Мінімальна зміна — замість хардкоду `/${locale}/billing`:
```
const returnPath = sessionStorage.getItem('billing_return_path');
sessionStorage.removeItem('billing_return_path');
router.replace(returnPath || `/${locale}/billing`);
```

### 3. `apps/web/src/app/[locale]/(protected)/billing/cancel/page.tsx`
Та сама зміна — sessionStorage return path.

### 4. `apps/web/messages/en.json`
Додати під `landing_page.dogfooding`:
```json
"proof_billing": {
    "plans_tab": "Plans",
    "packs_tab": "Packs",
    "subscribe_button": "Subscribe",
    "buy_button": "Buy",
    "error": "Could not load pricing"
}
```
Решта ключів (назви планів, ціни, інтервали) реюзаються з існуючого `billing_page.*`.

### 5. `apps/web/messages/uk.json`
Українські еквіваленти нових ключів.

---

## Що НЕ змінюємо
- Backend — жодних змін (checkout URLs залишаються ті самі)
- `shared/api/payments.ts` — використовуємо існуючі функції
- `DemoBanner` — реюзаємо як є
- `CatalogService` — нічого не міняємо

---

## Edge cases
- **Обидва feature flags вимкнені** → каталог повернеться порожнім → показуємо пустий стан
- **sessionStorage після Stripe redirect** → працює бо Stripe redirect в тому ж табі/origin. Якщо юзер відкриє в новому табі — fallback на `/billing`
- **Auth expired під час Stripe checkout** → success page під protected layout → AuthGuard редіректить на signin → sessionStorage return path втрачається, але оплата вже пройшла
- **Catalog fetch fail** → показуємо error message, не крашимо весь віджет

---

## Верифікація
1. `pnpm --filter web build` — білд без помилок
2. Неавторизований: бачить каталог, кнопки при кліку перемикають на Auth tab
3. Авторизований: кнопка Subscribe → Stripe Checkout → тестова карта → success → повернення на лендінг#dogfooding
4. Cancel checkout → повернення на лендінг#dogfooding
5. DemoBanner видно з тестовою карткою
6. Feature flags: вимкнути subscription → тільки packs, і навпаки
