# Sprint 01: Interactive Shell — каркас вікна, tabs, bottom sheet

> Перетворення секції Proof з одноколонкового тексту на двоколонковий layout з інтерактивним вікном. Кроки стають клікабельними табами, справа з'являється вікно з контентом. На мобільному — bottom sheet.

---

## Ключові рішення

### Desktop layout — two-column grid
Патерн з PricingSection: `lg:grid-cols-2` + `lg:sticky lg:top-24` для лівої колонки. Ліворуч: заголовок + tabs (колишні кроки). Праворуч: ProofWindow з контентом активного таба.

### Mobile layout — UiSheet bottom
На мобільному кроки відображаються як кнопки. При кліку відкривається `UiSheet` з `side="bottom"`. Компонент `UiSheet` вже є в `shared/ui/` — підтримує bottom, має overlay, анімацію slide-in/out.

### Кроки → клікабельні tabs
Поточні `<li>` з чекмарками стають інтерактивними кнопками. Активний tab візуально виділений (border-primary, або bg зміна). На десктопі клік перемикає вікно справа, на мобільному — відкриває sheet.

### State management — в DogfoodingSection
`activeTab` стейт живе в DogfoodingSection і прокидається в ProofTabs + ProofWindow. Callback `onRequestAuth` (від Billing → Auth) теж обробляється тут — просто `setActiveTab('auth')`.

### Фіксована висота вікна
ProofWindow має фіксовану висоту на десктопі (`h-[400px]` або подібне) щоб контент не стрибав при перемиканні табів. Overflow scroll якщо контент не влазить.

---

## Файли для зміни

### 1. `apps/web/src/widgets/agency/landing/DogfoodingSection/DogfoodingSection.tsx`
Основна переробка layout.

**Було:** одноколонковий текст + список кроків
**Стає:** `'use client'` компонент з двоколонковим layout

**Структура:**
```
DogfoodingSection
├── State: activeTab (ProofTabKey), sheetOpen (boolean)
├── handleTabChange(tab):
│   ├── setActiveTab(tab)
│   ├── Desktop: нічого більше
│   └── Mobile: setSheetOpen(true)
├── handleRequestAuth():
│   └── setActiveTab('auth')
├── Render:
│   ├── <section id="dogfooding">
│   │   ├── container
│   │   │   ├── grid lg:grid-cols-2
│   │   │   │   ├── Left (lg:sticky lg:top-24):
│   │   │   │   │   ├── label "Proof"
│   │   │   │   │   ├── heading
│   │   │   │   │   ├── description
│   │   │   │   │   └── ProofTabs (activeTab, onTabChange)
│   │   │   │   └── Right (hidden on mobile):
│   │   │   │       └── ProofWindow (activeTab, onRequestAuth)
│   │   │   └── Mobile only:
│   │   │       └── UiSheet (open=sheetOpen, side="bottom")
│   │   │           ├── UiSheetHeader + UiSheetTitle
│   │   │           └── ProofWindow (activeTab, onRequestAuth)
```

**Responsive:**
- `lg:grid-cols-2` — двоколонковий на desktop
- ProofWindow справа: `hidden lg:block`
- UiSheet: `lg:hidden` (тільки мобільний)

**Імпорти:**
- `useState` з React
- `useTranslations` з next-intl
- `ProofTabs`, `ProofWindow` — локальні файли
- `UiSheet`, `UiSheetContent`, `UiSheetHeader`, `UiSheetTitle` з `@/shared/ui/UiSheet`
- `ProofTabKey` з `./types`

### 2. `apps/web/src/widgets/agency/landing/DogfoodingSection/ProofTabs.tsx`
Повна реалізація табів.

**Структура:**
```
ProofTabs({ activeTab, onTabChange })
├── tabs config: [{ key, icon, labelKey }]
│   ├── auth: UserPlus icon, step_1
│   ├── billing: CreditCard icon, step_2
│   └── lighthouse: Gauge icon, step_3
├── Render:
│   └── <ul> space-y-3
│       └── tabs.map → <li>
│           └── <button> onClick={onTabChange(key)}
│               ├── Icon (в кружечку, як зараз Check)
│               └── Текст кроку (t(labelKey))
│               └── Active state: border-primary bg-primary/5
│               └── Inactive: border-border bg-card hover:bg-accent
```

**Деталі:**
- Зберігаємо візуальний стиль поточних кроків (rounded-lg border p-4)
- Замість Check іконки — тематична іконка для кожного таба
- Активний tab: виділений border-primary + легкий background
- Cursor pointer, hover ефект
- Іконки з lucide-react: `UserPlus`, `CreditCard`, `Gauge`

**Імпорти:**
- `useTranslations` з next-intl
- `UserPlus`, `CreditCard`, `Gauge` з lucide-react
- `ProofTabKey` з `./types`

### 3. `apps/web/src/widgets/agency/landing/DogfoodingSection/ProofWindow.tsx`
Мінімальні зміни до існуючого scaffold.

**Додати:**
- Обгортка з фіксованою висотою: `h-[420px] overflow-y-auto`
- Стилізація: `rounded-xl border border-border bg-card p-6`
- CSS transition при перемиканні контенту (opacity fade)

**Існуючий код вже:**
- Маппить activeTab → Panel компонент
- Передає onRequestAuth

### 4. `apps/web/messages/en.json`
Додати під `landing_page.dogfooding`:
```json
"proof_shell": {
    "sheet_title": "Try it yourself"
}
```
Існуючі `step_1`, `step_2`, `step_3` ключі реюзаються для тексту табів.

### 5. `apps/web/messages/uk.json`
```json
"proof_shell": {
    "sheet_title": "Спробуйте самі"
}
```

---

## Що НЕ змінюємо
- ProofAuth, ProofBilling, ProofLighthouse — залишаються заглушками (реалізація в спрінтах 02-04)
- `types.ts` — `ProofTabKey` вже визначений
- `index.ts` — barrel export вже є
- Інші секції лендінгу

---

## Edge cases
- **SSR** → `DogfoodingSection` стає `'use client'` через useState. Це нормально — інші секції (Hero, Pricing) теж client components
- **Sheet закриття** → UiSheet вже обробляє close через overlay click, escape, swipe
- **Tab switch при відкритому sheet** → sheet залишається відкритим, контент міняється всередині
- **`onRequestAuth` з Billing tab** → `setActiveTab('auth')`, на мобільному sheet залишається відкритим з auth контентом
- **Scroll до секції** → `scroll-mt-28` на section вже є, anchor `#dogfooding` працює
- **Висота контенту** → фіксована висота + overflow-y-auto запобігає стрибкам layout

---

## Порядок імплементації

1. DogfoodingSection — переробити layout на two-column grid
2. ProofTabs — реалізувати клікабельні таби
3. ProofWindow — додати стилізацію та обгортку
4. UiSheet інтеграція — mobile bottom sheet
5. i18n ключі

---

## Верифікація
1. `pnpm --filter web build` — білд без помилок
2. Desktop: двоколонковий layout, кліки по табах перемикають вікно справа
3. Mobile: таби як кнопки, клік відкриває bottom sheet з контентом
4. Перемикання між табами — плавне, без стрибків висоти
5. Sheet закривається через overlay, escape, swipe
6. `onRequestAuth` з billing заглушки — перемикає на auth tab
7. Responsive: перехід між desktop/mobile layout коректний
