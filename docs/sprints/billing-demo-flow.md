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
    - For local dev: use Stripe CLI (`stripe listen --forward-to localhost:3001/api/payments/webhook/stripe`)
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

## Phase 2 — Add Price Display Constants

### Step 2.1: Add display prices to shared types

**File:** `packages/types/src/contracts/payments.ts`

Add display-only pricing info alongside `CREDIT_PACK_CONFIG`. This is used by the frontend only — it does NOT affect Stripe (Stripe uses Price IDs from env). Prices must match what is configured in Stripe Dashboard in Phase 1.

```ts
export const SUBSCRIPTION_PLAN = {
  code: 'monthly_usd',
  label: 'Pro',
  priceDisplay: '$9',
  interval: 'month',
} as const;

export const CREDIT_PACK_CONFIG = {
  credits_5:  { credits: 5,  priceDisplay: '$5'  },
  credits_10: { credits: 10, priceDisplay: '$9'  },
  credits_20: { credits: 20, priceDisplay: '$15' },
} as const;
```

> **Note:** `CREDIT_PACK_CONFIG` already exists but currently only has `{ credits: number }`. Add the `priceDisplay` field. Update `CreditPackCode` type if needed — it should still work since it's derived from `keyof typeof CREDIT_PACK_CONFIG`.

---

## Phase 3 — Billing Page UI Redesign

### Step 3.1: Create demo banner component

**File:** `apps/web/src/widgets/billing/DemoBanner/DemoBanner.tsx` (new)

A prominent banner at the top of the Billing page:
- Yellow/amber accent background (using existing design tokens)
- Icon: info or test-tube
- Text: "This is a live Stripe demo in test mode. No real charges."
- Below: monospace block with test card details: `4242 4242 4242 4242 · Any future date · Any CVC`
- The banner should be visually clear but not overwhelming

Create barrel export: `apps/web/src/widgets/billing/DemoBanner/index.ts`

### Step 3.2: Redesign Billing page with pricing cards

**File:** `apps/web/src/app/[locale]/(protected)/billing/page.tsx`

Complete rewrite of the current page. New layout:

**Structure:**
1. `<DemoBanner />` at top
2. **Subscription section** — single pricing card:
    - Card with border accent (similar to PricingSection on landing)
    - Title: "Pro Plan"
    - Price: "$9 / month" (from `SUBSCRIPTION_PLAN.priceDisplay`)
    - Short feature list (3-4 items, keep simple — e.g. "Unlimited access", "Priority support", "All features")
    - CTA button: "Subscribe" (when no active subscription)
    - OR: Active subscription status card (when subscribed) with: status badge, next billing date, "Manage subscription" button
3. **Credits section** — three cards in a row:
    - Each card shows: pack name, credit count, price (from `CREDIT_PACK_CONFIG[packCode].priceDisplay`)
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

### Step 3.3: Create barrel export for billing widgets

**File:** `apps/web/src/widgets/billing/index.ts` (new)

```ts
export { DemoBanner } from './DemoBanner';
```

---

## Phase 4 — DogfoodingSection Interactive Widget

### Step 4.1: Add interactive checkout preview to DogfoodingSection

**File:** `apps/web/src/widgets/agency/landing/DogfoodingSection/DogfoodingSection.tsx`

Modify the existing section to include an interactive element below the existing steps list:

- Add a mini "pricing preview" card inside the section (NOT a full duplicate of billing page — just a teaser)
- Shows: "Pro Plan — $9/mo" and "Credit Packs from $5" as two compact cards
- Each has a "Try it →" button
- On click:
    - If user is authenticated → navigate to `/billing`
    - If user is NOT authenticated → navigate to `/auth/signin?redirect=/billing`
- Use `useAuthStore` to check auth state
- Use `useRouter` + `useLocale` for navigation

**Important:** This widget does NOT trigger Stripe Checkout directly. It's just a visual teaser that routes to the billing page. The actual checkout happens on `/billing`.

### Step 4.2: Add redirect support to auth flow

**File:** `apps/web/src/app/[locale]/auth/signin/page.tsx`

Check if the signin page already supports a `redirect` query parameter after successful login. If not, add:
- Read `searchParams.redirect` from URL
- After successful authentication, redirect to that URL instead of the default route
- Sanitize the redirect URL (must start with `/` — no external redirects)

> **Note:** Review the existing auth callback flow (`apps/web/src/app/[locale]/auth/callback/page.tsx`) and `AuthInitializer.tsx` to understand where the post-login redirect happens. The redirect param must be preserved through the entire auth flow (signin → magic link/Google OAuth → callback → redirect target).

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
      "price": "$9",
      "interval": "/ month",
      "feature_1": "Unlimited access",
      "feature_2": "Priority support",
      "feature_3": "All premium features",
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

> **Note:** Remove `credits.pack_label` — pack labels will be generated dynamically from `CREDIT_PACK_CONFIG` (e.g. "5 credits — $5"). Remove `subscribe.description` and `subscribe.plan_label` — replaced by the card layout.

### Step 5.2: Update Ukrainian translations

**File:** `apps/web/messages/uk.json`

Add corresponding Ukrainian translations for all new keys. Follow the same structure as `en.json`.

### Step 5.3: Update DogfoodingSection translations

Add to both `en.json` and `uk.json` under `landing_page.dogfooding`:

```json
{
  "try_cta": "Try it",
  "preview_subscription": "Pro Plan — $9/mo",
  "preview_credits": "Credit Packs from $5"
}
```

---

## Phase 6 — Testing & Verification

### Step 6.1: Local webhook testing setup

Use Stripe CLI for local webhook forwarding:

```bash
stripe listen --forward-to localhost:3001/api/payments/webhook/stripe
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

### Step 6.4: Test DogfoodingSection flow

1. Open landing page as unauthenticated user
2. Scroll to DogfoodingSection
3. Click "Try it" on either preview card
4. Verify: redirected to signin page with `?redirect=/billing`
5. Complete authentication
6. Verify: redirected to `/billing` (not default dashboard)

### Step 6.5: Test edge cases

- Double-click protection: rapidly clicking "Subscribe" or "Buy" should not create multiple sessions (existing `loadingAction` state handles this — verify it works)
- Already subscribed: clicking "Subscribe" when active subscription exists should show error (existing `ConflictException` with `ALREADY_SUBSCRIBED` code)
- Feature flags: set `PAYMENTS_SUBSCRIPTION_ENABLED=false` → subscription section should not render. Same for `PAYMENTS_ONE_OFF_ENABLED`
- Webhook idempotency: send same webhook event twice → second should be ignored (existing `ProcessedWebhookEvent` dedup)

---

## File Change Summary

| Action   | File                                                                     | Description                                       |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| MODIFY   | `packages/types/src/contracts/payments.ts`                               | Add `SUBSCRIPTION_PLAN`, `priceDisplay` to packs  |
| CREATE   | `apps/web/src/widgets/billing/DemoBanner/DemoBanner.tsx`                 | Demo mode banner component                        |
| CREATE   | `apps/web/src/widgets/billing/DemoBanner/index.ts`                       | Barrel export                                     |
| CREATE   | `apps/web/src/widgets/billing/index.ts`                                  | Barrel export                                     |
| REWRITE  | `apps/web/src/app/[locale]/(protected)/billing/page.tsx`                 | Full redesign with pricing cards                  |
| MODIFY   | `apps/web/src/widgets/agency/landing/DogfoodingSection/DogfoodingSection.tsx` | Add interactive checkout preview widget       |
| MODIFY   | `apps/web/src/app/[locale]/auth/signin/page.tsx`                         | Add redirect query param support (if not present) |
| MODIFY   | `apps/web/messages/en.json`                                              | Update billing + dogfooding translations          |
| MODIFY   | `apps/web/messages/uk.json`                                              | Update billing + dogfooding translations          |

**No backend code changes required** — all existing API endpoints, services, webhooks, and guards are already implemented correctly.