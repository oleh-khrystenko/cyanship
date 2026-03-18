# Plan: Stripe Billing Demo Flow

> **Goal:** Implement a polished, production-ready Billing page that serves as a live Stripe test-mode demo for CyanShip's landing page visitors. The page showcases two payment models — Subscription and One-off Credit Packs — using real Stripe Checkout in test mode.

---

## Context & Current State

### What already exists and works

- **Backend** (`apps/api/src/modules/payments/`):
    - `StripeService` — implements `IPaymentProvider` interface; creates Checkout Sessions (subscription + one-off), Portal Sessions, handles webhooks
    - `PaymentsService` — orchestrates checkout creation, webhook processing with two-phase idempotency, subscription status updates, credit balance updates
    - `PaymentsController` — three endpoints: `POST /payments/checkout-session`, `POST /payments/portal-session`, `POST /payments/webhook/:provider`
    - `ProcessedWebhookEvent` schema — idempotent webhook deduplication with `pending`/`applied` status
    - `SubscriptionGuard` — route guard checking `billing.hasActiveSubscription`
    - Feature flags: `PAYMENTS_SUBSCRIPTION_ENABLED`, `PAYMENTS_ONE_OFF_ENABLED` (both backend and frontend env vars)

- **Frontend** (`apps/web/`):
    - `src/app/[locale]/(protected)/billing/page.tsx` — existing Billing page with subscription + credits sections (functional but plain UI)
    - `src/app/[locale]/(protected)/billing/success/page.tsx` — success redirect (refreshes user, shows toast)
    - `src/app/[locale]/(protected)/billing/cancel/page.tsx` — cancel redirect (shows toast, redirects back)
    - `src/shared/api/payments.ts` — three API functions: `createSubscriptionCheckout`, `createOneOffCheckout`, `createPortalSession`
    - Feature flag env vars: `NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED`, `NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED`

- **Shared types** (`packages/types/src/contracts/payments.ts`):
    - `PAYMENT_TYPE`, `SUBSCRIPTION_STATUS`, `BILLING_EVENT_TYPE` enums
    - `CREDIT_PACK_CONFIG` — `credits_5`, `credits_10`, `credits_20`
    - `CreateCheckoutSessionSchema` (Zod), `UserBillingSchema`, `BillingWebhookEventSchema`

- **User schema** (`apps/api/src/modules/users/schemas/user.schema.ts`):
    - `billing` subdocument: `provider`, `providerCustomerId`, `providerSubscriptionId`, `planCode`, `currency`, `subscriptionStatus`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `hasActiveSubscription`, `lastProviderEventAt`
    - `credits` subdocument: `balance`, `freeReportUsed`

- **Config** (`apps/api/src/config/env.ts`):
    - Stripe env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_SUBSCRIPTION`, `STRIPE_PRICE_ID_CREDITS_5/10/20`
    - `STRIPE_CREDIT_PACKS` computed map: `packCode → { priceId, credits }`

### What needs to be done

The backend logic is ~90% complete. The main work is:
1. Stripe Dashboard setup (create Products/Prices in test mode)
2. Billing page UI redesign (pricing cards with prices, demo banner)
3. DogfoodingSection interactive widget on landing
4. Translations update
5. End-to-end testing of the full flow

---

## Phase 1 — Stripe Dashboard Setup (Manual, not code)

> **This phase is done manually by the developer in Stripe Dashboard (test mode). No code changes.**

### Step 1.1: Create Subscription Product

In Stripe Dashboard (test mode):
1. Go to **Products** → **Add product**
2. Product name: `CyanShip Pro`
3. Add a price:
    - Pricing model: **Recurring**
    - Amount: `$9.00` / month
    - Currency: USD
4. Copy the **Price ID** (starts with `price_...`)
5. Set it as `STRIPE_PRICE_ID_SUBSCRIPTION` in `.env`

### Step 1.2: Create Credit Pack Products

Create 3 products:

| Product name       | Price  | Type     | Env var                      |
| ------------------ | ------ | -------- | ---------------------------- |
| 5 Credits Pack     | $5.00  | One-time | `STRIPE_PRICE_ID_CREDITS_5`  |
| 10 Credits Pack    | $9.00  | One-time | `STRIPE_PRICE_ID_CREDITS_10` |
| 20 Credits Pack    | $15.00 | One-time | `STRIPE_PRICE_ID_CREDITS_20` |

For each:
1. **Products** → **Add product**
2. Set the name and price (one-time)
3. Copy the Price ID → set in `.env`

### Step 1.3: Configure Customer Portal

1. Go to **Settings** → **Billing** → **Customer portal**
2. Enable: Cancel subscription, Update payment method
3. Save

### Step 1.4: Set Up Webhook Endpoint

1. Go to **Developers** → **Webhooks** → **Add endpoint**
2. Endpoint URL: `https://<your-api-domain>/api/payments/webhook/stripe`
    - For local dev: use Stripe CLI (`stripe listen --forward-to localhost:4000/api/payments/webhook/stripe`)
3. Events to listen for:
    - `checkout.session.completed`
    - `checkout.session.async_payment_succeeded`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
4. Copy the **Webhook signing secret** (starts with `whsec_...`)
5. Set it as `STRIPE_WEBHOOK_SECRET` in `.env`

### Step 1.5: Verify `.env`

Ensure all these vars are set:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_SUBSCRIPTION=price_...
STRIPE_PRICE_ID_CREDITS_5=price_...
STRIPE_PRICE_ID_CREDITS_10=price_...
STRIPE_PRICE_ID_CREDITS_20=price_...
PAYMENTS_SUBSCRIPTION_ENABLED=true
PAYMENTS_ONE_OFF_ENABLED=true
NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED=true
NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED=true
```

---

## Phase 2 — Structured Pricing Constants (Single Source of Truth)

### Step 2.1: Add structured pricing to shared types

**File:** `packages/types/src/contracts/payments.ts`

Add structured pricing data alongside `CREDIT_PACK_CONFIG`. Prices stored as **cents + currency** — formatted on frontend via `Intl.NumberFormat`. This is the **single source of truth** for all display prices across the app (billing page, landing teaser, translations). Prices must match what is configured in Stripe Dashboard in Phase 1.

```ts
export const SUBSCRIPTION_PLAN = {
  code: 'monthly_usd',
  label: 'Pro',
  priceAmount: 900,    // cents
  currency: 'usd',
  interval: 'month',
} as const;

export const CREDIT_PACK_CONFIG = {
  credits_5:  { credits: 5,  priceAmount: 500,  currency: 'usd' },
  credits_10: { credits: 10, priceAmount: 900,  currency: 'usd' },
  credits_20: { credits: 20, priceAmount: 1500, currency: 'usd' },
} as const;
```

> **Note:** `CREDIT_PACK_CONFIG` already exists but currently only has `{ credits: number }`. Add `priceAmount` and `currency` fields. `CreditPackCode` type derived from `keyof typeof CREDIT_PACK_CONFIG` — should still work.

### Step 2.2: Add `formatPrice` utility

**File:** `packages/types/src/utils/format-price.ts` (new)

Utility function to format price from cents + currency into display string using `Intl.NumberFormat`. Used by frontend to render prices from `SUBSCRIPTION_PLAN` and `CREDIT_PACK_CONFIG`.

```ts
export function formatPrice(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}
```

Export from `packages/types/src/index.ts`.

> **Why cents?** Stripe works in cents. Storing in cents avoids floating-point issues and keeps our constants aligned with Stripe's model. If we add EUR/UAH later — just change `currency`, formatting adapts automatically.

---

## Phase 3 — Billing Page UI Redesign

### Step 3.1: Create demo banner component

**File:** `apps/web/src/features/billing/ui/DemoBanner/DemoBanner.tsx` (new)

A prominent banner at the top of the Billing page:
- Yellow/amber accent background (using existing design tokens)
- Icon: info or test-tube
- Text from translations: `billing_page.demo_banner.title` + `billing_page.demo_banner.description`
- Below: monospace block with test card from translations: `billing_page.demo_banner.test_card`
- The banner should be visually clear but not overwhelming

Create barrel export: `apps/web/src/features/billing/ui/DemoBanner/index.ts`

> **Why `features/billing/` not `widgets/billing/`?** DemoBanner is a stateless presentational component tied to the billing feature domain. In FSD, `widgets/` are compositional blocks combining multiple features. A single-purpose UI component belongs in `features/`.

### Step 3.2: Redesign Billing page with pricing cards

**File:** `apps/web/src/app/[locale]/(protected)/billing/page.tsx`

Complete rewrite of the current page. New layout:

**Structure:**
1. `<DemoBanner />` at top
2. **Subscription section** — single pricing card:
    - Card with border accent (similar to PricingSection on landing)
    - Title: "Pro Plan"
    - Price: formatted via `formatPrice(SUBSCRIPTION_PLAN.priceAmount, SUBSCRIPTION_PLAN.currency)` + `" / " + t('subscribe.interval')`
    - Feature list from translations: `billing_page.subscribe.features` (array of 3-4 items — e.g. "Unlimited access", "Priority support", "All premium features")
    - CTA button: "Subscribe" (when no active subscription)
    - OR: Active subscription status card (when subscribed) with: status badge, next billing date, "Manage subscription" button
3. **Credits section** — three cards in a row:
    - Each card shows: pack name, credit count, price formatted via `formatPrice(pack.priceAmount, pack.currency)`
    - "Buy" button on each
    - Current balance displayed above the cards: "Your balance: X credits"
4. Terms note at bottom (existing `checkout_terms_note` translation)

**Behavior:**
- All existing functionality stays the same (handlers: `handleSubscriptionCheckout`, `handleOneOffCheckout`, `handlePortal`)
- Loading states with `UiSpinner` (already implemented)
- Error toasts (already implemented)

**Styling:**
- Use existing UI components: `UiButton`, `UiSpinner`
- Follow project's Tailwind conventions (see other sections like PricingSection for reference patterns)
- Responsive: cards stack on mobile, grid on desktop
- Use existing color tokens: `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`, etc.

### Step 3.3: Create barrel export for billing feature UI

**File:** `apps/web/src/features/billing/index.ts` (new)

```ts
export { DemoBanner } from './ui/DemoBanner';
```

---

## Phase 4 — DogfoodingSection Interactive Widget

### Step 4.1: Add interactive checkout preview to DogfoodingSection

**File:** `apps/web/src/widgets/agency/landing/DogfoodingSection/DogfoodingSection.tsx`

Modify the existing section to include an interactive element below the existing steps list:

- Add a mini "pricing preview" card inside the section (NOT a full duplicate of billing page — just a teaser)
- Shows subscription and credits info with prices formatted via `formatPrice()` from shared constants — **no hardcoded price strings**
- Labels from translations: `landing_page.dogfooding.preview_subscription` (with `{price}` interpolation) and `landing_page.dogfooding.preview_credits` (with `{price}` interpolation)
- Each has a CTA button with text from `landing_page.dogfooding.try_cta`
- On click:
    - If user is authenticated → navigate to `/billing`
    - If user is NOT authenticated → navigate to `/auth/signin?redirect=/billing`
- Use `useAuthStore` to check auth state
- Use `useRouter` + `useLocale` for navigation

**Important:** This widget does NOT trigger Stripe Checkout directly. It's just a visual teaser that routes to the billing page. The actual checkout happens on `/billing`.

### Step 4.2: Add redirect support to auth flow

> **Scope:** Redirect parameter must survive 3 different auth flows. Each flow has свій механізм збереження стану, тому використовуємо **два механізми** залежно від flow.

**Проблема:** `sessionStorage` — per-tab. Password login і Google OAuth працюють в тій самій вкладці → `sessionStorage` підходить. Magic link відкривається з email у **новій вкладці** → `sessionStorage` з signin page **недоступний**. Тому для magic link потрібно прокинути `redirect` через backend у URL verify-посилання.

#### 4.2.1: Shared — redirect validation utility

**File:** `apps/web/src/shared/lib/redirect.ts` (new)

```ts
const REDIRECT_KEY = 'auth_redirect';

/** Validate redirect path — must start with `/`, no protocol, no `//` */
export function isValidRedirect(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://');
}

export function saveRedirect(path: string): void {
  if (isValidRedirect(path)) sessionStorage.setItem(REDIRECT_KEY, path);
}

export function consumeRedirect(fallback: string): string {
  const saved = sessionStorage.getItem(REDIRECT_KEY);
  sessionStorage.removeItem(REDIRECT_KEY);
  return saved && isValidRedirect(saved) ? saved : fallback;
}
```

#### 4.2.2: Signin page — read and store redirect

**File:** `apps/web/src/app/[locale]/auth/signin/page.tsx`

- Read `searchParams.redirect` from URL
- On mount: `if (redirect) saveRedirect(redirect)` → зберігає в `sessionStorage`
- **Password login:** after successful `loginWithPassword()` → `router.replace(consumeRedirect('/${locale}/profile'))`
- **Google OAuth:** `sessionStorage` вже має redirect → user натискає Google → та сама вкладка → `callback/page.tsx` читає через `consumeRedirect()`
- **Magic link:** redirect передається як параметр в API (Step 4.2.4)

#### 4.2.3: Callback page (Google OAuth) — consume redirect

**File:** `apps/web/src/app/[locale]/auth/callback/page.tsx`

- After successful auth: `router.replace(consumeRedirect('/${locale}/profile'))`
- `consumeRedirect()` автоматично видаляє з `sessionStorage`

#### 4.2.4: Magic link — backend passthrough

Magic link відкривається в новій вкладці → `sessionStorage` недоступний. Тому `redirect` прокидається через backend в URL.

**Frontend change** (`apps/web/src/shared/api/auth.ts`):
- `sendMagicLink(email, purpose, lang, redirectTo?)` — додати optional параметр
- Signin page передає redirect: `sendMagicLink(email, 'login', locale, redirect)`

**Backend changes** (мінімальні, ~5 рядків):
- `apps/api/src/modules/auth/auth.service.ts` → `sendMagicLink()`: зберегти `redirectTo` в Redis payload поруч з `{email, purpose, lang}`
- `apps/api/src/modules/auth/services/email.service.ts` → `sendMagicLink()`: якщо `redirectTo` є, додати `&redirect=${encodeURIComponent(redirectTo)}` до verify URL
- Zod schema для `sendMagicLink` DTO: додати optional `redirectTo` string field з валідацією (starts with `/`)

**Result:** magic link URL стає `${WEB_URL}/auth/verify?token=${token}&redirect=/billing`

#### 4.2.5: Verify page (Magic link) — read redirect from URL

**File:** `apps/web/src/app/[locale]/auth/verify/page.tsx`

- Read `searchParams.redirect` from URL (прийшов через magic link)
- Validate via `isValidRedirect()` (defense in depth — навіть якщо backend вже валідував)
- After successful verification: `router.replace(redirect || '/${locale}/profile')`

#### 4.2.6: Security checklist

- `isValidRedirect()` перевіряє на **кожному consumption point** (defense in depth)
- Backend валідує `redirectTo` через Zod DTO (starts with `/`, no protocol)
- `sessionStorage` автоматично очищується через `consumeRedirect()`
- Ніколи не redirect на зовнішні URL

---

## Phase 5 — Translations

### Step 5.1: Update English translations

**File:** `apps/web/messages/en.json`

Update the `billing_page` section:

```json
{
  "billing_page": {
    "head": {
      "title": "Billing"
    },
    "demo_banner": {
      "title": "Stripe Test Mode Demo",
      "description": "This is a live Stripe integration demo. No real charges will be made.",
      "test_card": "Test card: 4242 4242 4242 4242 · Any future date · Any CVC"
    },
    "subscribe": {
      "title": "Pro Plan",
      "interval": "/ month",
      "features": {
        "item_1": "Unlimited access",
        "item_2": "Priority support",
        "item_3": "All premium features"
      },
      "button": "Subscribe",
      "error": "Failed to create checkout session"
    },
    "active": {
      "title": "Your Subscription",
      "status_active": "Active",
      "status_canceling": "Active until {date}",
      "plan_label": "Plan: {plan}",
      "next_billing": "Next billing: {date}",
      "cancel_notice": "Your subscription will end at the current period's close.",
      "manage_button": "Manage Subscription",
      "manage_error": "Failed to open management portal"
    },
    "credits": {
      "title": "Credit Packs",
      "description": "Purchase credits to use platform services.",
      "balance": "Your balance: {count} credits",
      "pack_label": "{credits} credits — {price}",
      "buy_button": "Buy",
      "error": "Failed to create payment session"
    },
    "callback": {
      "loading": "Processing payment…",
      "success": "Payment successful!",
      "canceled": "Payment canceled",
      "refresh_error": "Failed to update data. Please reload the page."
    },
    "checkout_terms_note": "By proceeding, you agree to the <terms>payment terms</terms>."
  }
}
```

> **Key decisions:**
> - **No hardcoded prices in translations.** Prices come from `SUBSCRIPTION_PLAN` / `CREDIT_PACK_CONFIG` constants and are formatted via `formatPrice()`. Translations use `{price}` interpolation where needed.
> - **Feature list** in `subscribe.features` — iterable via `Object.keys()`, easy to add/remove items.
> - **`credits.pack_label`** uses `{credits}` and `{price}` interpolation — both values computed from `CREDIT_PACK_CONFIG` + `formatPrice()`.
> - Removed old `subscribe.price` — price is rendered programmatically from constants.

### Step 5.2: Update Ukrainian translations

**File:** `apps/web/messages/uk.json`

Add corresponding Ukrainian translations for all new keys. Follow the same structure as `en.json`.

### Step 5.3: Update DogfoodingSection translations

Add to both `en.json` and `uk.json` under `landing_page.dogfooding`:

```json
{
  "try_cta": "Try it",
  "preview_subscription": "Pro Plan — {price}/mo",
  "preview_credits": "Credit Packs from {price}"
}
```

> **Note:** `{price}` is interpolated at render time from `formatPrice(SUBSCRIPTION_PLAN.priceAmount, SUBSCRIPTION_PLAN.currency)` and `formatPrice(CREDIT_PACK_CONFIG.credits_5.priceAmount, CREDIT_PACK_CONFIG.credits_5.currency)` respectively. No hardcoded price strings in translations.

---

## Phase 6 — Testing & Verification

### Step 6.1: Local webhook testing setup

Use Stripe CLI for local webhook forwarding:

```bash
stripe listen --forward-to localhost:4000/api/payments/webhook/stripe
```

Copy the webhook signing secret from CLI output → set as `STRIPE_WEBHOOK_SECRET` in `.env`.

### Step 6.2: Test Subscription flow

1. Log in as test user
2. Go to `/billing`
3. Verify demo banner is visible with test card info
4. Click "Subscribe" on Pro Plan card
5. Stripe Checkout opens → enter `4242 4242 4242 4242`, any future expiry, any CVC
6. Complete payment → redirected to `/billing/success`
7. Verify: toast "Payment successful!", redirected to `/billing`
8. Verify: subscription card now shows "Active" status, next billing date, "Manage Subscription" button
9. Click "Manage Subscription" → Stripe Portal opens
10. In Portal: cancel subscription → return to `/billing`
11. Verify: status shows "Active until [date]", cancel notice visible
12. Check MongoDB: `user.billing` fields updated correctly

### Step 6.3: Test One-off Credit Pack flow

1. Note current credit balance on `/billing`
2. Click "Buy" on the 5 credits pack
3. Complete Stripe Checkout with test card
4. Verify: redirected to success page, balance updated to +5
5. Repeat for 10 and 20 credit packs
6. Check MongoDB: `user.credits.balance` incremented correctly

### Step 6.4: Test DogfoodingSection + redirect flow

**Password login path:**
1. Open landing page as unauthenticated user
2. Click "Try it" → verify redirect to `/auth/signin?redirect=/billing`
3. Login with password
4. Verify: redirected to `/billing` (not `/profile`)

**Magic link path:**
1. Click "Try it" → `/auth/signin?redirect=/billing`
2. Enter email → receive magic link
3. Click magic link from email (opens new tab)
4. Verify: URL contains `?token=xxx&redirect=/billing`
5. After verification → redirected to `/billing`

**Google OAuth path:**
1. Click "Try it" → `/auth/signin?redirect=/billing`
2. Click "Sign in with Google" → complete OAuth
3. After callback → redirected to `/billing`

**Authenticated user:**
1. Login first, then open landing page
2. Click "Try it" → verify direct navigation to `/billing` (no signin page)

### Step 6.5: Test edge cases

- Double-click protection: rapidly clicking "Subscribe" or "Buy" should not create multiple sessions (existing `loadingAction` state handles this — verify it works)
- Already subscribed: clicking "Subscribe" when active subscription exists should show error (existing `ConflictException` with `ALREADY_SUBSCRIBED` code)
- Feature flags: set `PAYMENTS_SUBSCRIPTION_ENABLED=false` → subscription section should not render. Same for `PAYMENTS_ONE_OFF_ENABLED`
- Webhook idempotency: send same webhook event twice → second should be ignored (existing `ProcessedWebhookEvent` dedup)

---

## File Change Summary

### Shared types (`packages/types/`)
| Action | File | Description |
|--------|------|-------------|
| MODIFY | `src/contracts/payments.ts` | Add `SUBSCRIPTION_PLAN`, `priceAmount`+`currency` to packs |
| CREATE | `src/utils/format-price.ts` | `formatPrice()` utility (cents + currency → display string) |
| MODIFY | `src/index.ts` | Export `formatPrice` |

### Frontend — Billing UI (`apps/web/`)
| Action | File | Description |
|--------|------|-------------|
| CREATE | `src/features/billing/ui/DemoBanner/DemoBanner.tsx` | Demo mode banner component |
| CREATE | `src/features/billing/ui/DemoBanner/index.ts` | Barrel export |
| CREATE | `src/features/billing/index.ts` | Barrel export |
| REWRITE | `src/app/[locale]/(protected)/billing/page.tsx` | Full redesign with pricing cards |
| MODIFY | `src/widgets/agency/landing/DogfoodingSection/DogfoodingSection.tsx` | Add interactive checkout preview widget |

### Frontend — Auth redirect (`apps/web/`)
| Action | File | Description |
|--------|------|-------------|
| CREATE | `src/shared/lib/redirect.ts` | `saveRedirect()`, `consumeRedirect()`, `isValidRedirect()` |
| MODIFY | `src/shared/api/auth.ts` | Add optional `redirectTo` to `sendMagicLink()` |
| MODIFY | `src/app/[locale]/auth/signin/page.tsx` | Read `?redirect`, save to sessionStorage, use after login |
| MODIFY | `src/app/[locale]/auth/verify/page.tsx` | Read `?redirect` from URL after magic link verification |
| MODIFY | `src/app/[locale]/auth/callback/page.tsx` | `consumeRedirect()` from sessionStorage after OAuth |

### Backend — Magic link redirect passthrough (`apps/api/`)
| Action | File | Description |
|--------|------|-------------|
| MODIFY | `src/modules/auth/auth.service.ts` | Store `redirectTo` in Redis with magic link token |
| MODIFY | `src/modules/auth/services/email.service.ts` | Append `&redirect=` to verify URL if `redirectTo` provided |
| MODIFY | `src/modules/auth/dto/` | Add optional `redirectTo` to send-magic-link DTO |

### Translations
| Action | File | Description |
|--------|------|-------------|
| MODIFY | `apps/web/messages/en.json` | Update billing + dogfooding translations |
| MODIFY | `apps/web/messages/uk.json` | Update billing + dogfooding translations |