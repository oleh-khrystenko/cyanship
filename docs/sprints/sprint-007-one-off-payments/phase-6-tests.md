# Phase 6 — Tests

## Залежності

Вимагає завершення всіх попередніх фаз (1–5).

## Scope

- `apps/api/src/modules/payments/payments.service.spec.ts` — оновити існуючі + нові тести
- `apps/api/src/modules/payments/payments.controller.spec.ts` — оновити сигнатури
- `apps/api/src/modules/payments/providers/stripe.service.spec.ts` — нові тести для one-off
- `apps/api/src/modules/users/users.service.spec.ts` — тест для `addCredits`
- `apps/api/test/payments.e2e-spec.ts` — новий E2E сценарій one-off

---

## 6.1 `payments.service.spec.ts`

**Читай поточний файл перед змінами (697 рядків). Оновлення наявних тестів + нові.**

### 6.1.1 Оновити `createCheckoutSession` тести

Поточні тести передають `(userId, 'monthly_usd')`. Змінити на DTO форму:

```typescript
// Було:
await service.createCheckoutSession(userId, 'monthly_usd');

// Стало:
await service.createCheckoutSession(userId, {
    paymentType: PAYMENT_TYPE.SUBSCRIPTION,
    planCode: 'monthly_usd',
});
```

### 6.1.2 Нові тести для `createCheckoutSession` — one-off

```typescript
describe('createCheckoutSession (one-off)', () => {
    it('should create one-off checkout session for valid packCode', async () => {
        // arrange
        mockUserModel.findById.mockReturnValue({
            lean: () => Promise.resolve({ _id: userId, email: 'user@test.com', billing: null }),
        });
        mockPaymentProvider.createCheckoutSession.mockResolvedValue({
            checkoutUrl: 'https://checkout.stripe.com/one-off',
            providerSessionId: 'cs_test_oneoff',
        });

        // act
        const result = await service.createCheckoutSession(userId, {
            paymentType: PAYMENT_TYPE.ONE_OFF,
            packCode: 'credits_5',
        });

        // assert
        expect(result.checkoutUrl).toBe('https://checkout.stripe.com/one-off');
        expect(mockPaymentProvider.createCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({
                paymentType: PAYMENT_TYPE.ONE_OFF,
                planCode: 'credits_5',
                credits: 5,
            }),
        );
    });

    it('should throw BadRequestException for invalid packCode', async () => {
        mockUserModel.findById.mockReturnValue({
            lean: () => Promise.resolve({ _id: userId, email: 'user@test.com' }),
        });

        await expect(
            service.createCheckoutSession(userId, {
                paymentType: PAYMENT_TYPE.ONE_OFF,
                packCode: 'invalid_pack' as CreditPackCode,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw when PAYMENTS_ONE_OFF_ENABLED is false', async () => {
        // Мок ENV.PAYMENTS_ONE_OFF_ENABLED = false
        jest.spyOn(ENV, 'PAYMENTS_ONE_OFF_ENABLED', 'get').mockReturnValue(false);

        await expect(
            service.createCheckoutSession(userId, {
                paymentType: PAYMENT_TYPE.ONE_OFF,
                packCode: 'credits_5',
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw when PAYMENTS_SUBSCRIPTION_ENABLED is false and type is subscription', async () => {
        jest.spyOn(ENV, 'PAYMENTS_SUBSCRIPTION_ENABLED', 'get').mockReturnValue(false);

        await expect(
            service.createCheckoutSession(userId, {
                paymentType: PAYMENT_TYPE.SUBSCRIPTION,
                planCode: 'monthly_usd',
            }),
        ).rejects.toThrow(BadRequestException);
    });
});
```

**Примітка щодо mockENV:** Якщо `ENV` — plain object (не class), то `jest.spyOn` на getter не спрацює. Замість цього можна мокувати через jest.mock:

```typescript
jest.mock('../../config/env', () => ({
    ENV: {
        ...jest.requireActual('../../config/env').ENV,
        PAYMENTS_ONE_OFF_ENABLED: false,
    },
    STRIPE_CREDIT_PACKS: jest.requireActual('../../config/env').STRIPE_CREDIT_PACKS,
}));
```

Або в beforeEach встановлювати через Object.defineProperty. Обери підхід що кращий з точки зору ізоляції.

### 6.1.3 Нові тести для `handleWebhook` — ONE_OFF_PAYMENT_COMPLETED

```typescript
describe('handleWebhook (one-off)', () => {
    const oneOffEvent: BillingWebhookEvent = {
        type: BILLING_EVENT_TYPE.ONE_OFF_PAYMENT_COMPLETED,
        providerEventId: 'evt_oneoff_123',
        occurredAt: new Date('2026-03-01'),
        userId: 'user123',
        creditsAmount: 5,
        raw: {},
    };

    it('should add credits on ONE_OFF_PAYMENT_COMPLETED', async () => {
        // arrange
        mockPaymentProvider.handleWebhookPayload.mockReturnValue(oneOffEvent);
        mockWebhookEventModel.create.mockResolvedValue(oneOffEvent);
        mockUserModel.findById.mockResolvedValue({
            _id: 'user123',
            billing: null,
        });
        mockUsersService.addCredits = jest.fn().mockResolvedValue(undefined);

        // act
        await service.handleWebhook('stripe', Buffer.from(''), 'sig');

        // assert
        expect(mockUsersService.addCredits).toHaveBeenCalledWith('user123', 5);
        expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should NOT apply out-of-order check for one-off events', async () => {
        // arrange: user має lastProviderEventAt NEWER ніж event.occurredAt
        const staleUserBilling = {
            lastProviderEventAt: new Date('2026-03-15'), // newer
        };
        mockPaymentProvider.handleWebhookPayload.mockReturnValue({
            ...oneOffEvent,
            occurredAt: new Date('2026-02-01'), // older
        });
        mockWebhookEventModel.create.mockResolvedValue({});
        mockUserModel.findById.mockResolvedValue({
            _id: 'user123',
            billing: staleUserBilling,
        });
        mockUsersService.addCredits = jest.fn().mockResolvedValue(undefined);

        // act
        await service.handleWebhook('stripe', Buffer.from(''), 'sig');

        // assert: credits все одно зараховано (out-of-order check skipped)
        expect(mockUsersService.addCredits).toHaveBeenCalledWith('user123', 5);
    });

    it('should warn and skip if creditsAmount is 0', async () => {
        mockPaymentProvider.handleWebhookPayload.mockReturnValue({
            ...oneOffEvent,
            creditsAmount: 0,
        });
        mockWebhookEventModel.create.mockResolvedValue({});
        mockUserModel.findById.mockResolvedValue({ _id: 'user123', billing: null });
        mockUsersService.addCredits = jest.fn();

        await service.handleWebhook('stripe', Buffer.from(''), 'sig');

        expect(mockUsersService.addCredits).not.toHaveBeenCalled();
    });
});
```

---

## 6.2 `stripe.service.spec.ts`

**Читай поточний файл перед змінами (310 рядків).**

### 6.2.1 Оновити `createCheckoutSession` тести

Передавати `paymentType` і `priceId` в mock input:

```typescript
const subscriptionInput: CreateCheckoutInput = {
    userId: 'user123',
    userEmail: 'test@example.com',
    paymentType: PAYMENT_TYPE.SUBSCRIPTION,
    planCode: 'monthly_usd',
    priceId: 'price_monthly_test',
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
};
```

Перевірити що `createCheckoutSession` викликає Stripe з правильним `mode`:
- `SUBSCRIPTION` → `mode: 'subscription'`
- `ONE_OFF` → `mode: 'payment'`

```typescript
it('should create payment mode session for ONE_OFF', async () => {
    const oneOffInput: CreateCheckoutInput = {
        userId: 'user123',
        userEmail: 'test@example.com',
        paymentType: PAYMENT_TYPE.ONE_OFF,
        planCode: 'credits_5',
        priceId: 'price_credits5_test',
        credits: 5,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
    };

    mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_oneoff',
        url: 'https://checkout.stripe.com/pay/oneoff',
    });

    const result = await service.createCheckoutSession(oneOffInput);

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
            mode: 'payment',
            line_items: [{ price: 'price_credits5_test', quantity: 1 }],
            metadata: expect.objectContaining({
                credits: '5',
            }),
        }),
    );
    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/pay/oneoff');
});
```

### 6.2.2 Нові тести для `handleCheckoutCompleted` — one-off path

```typescript
describe('handleWebhookPayload — checkout.session.completed (payment mode)', () => {
    it('should return ONE_OFF_PAYMENT_COMPLETED for mode=payment + paid', () => {
        const event = buildMockStripeEvent('checkout.session.completed', {
            mode: 'payment',
            payment_status: 'paid',
            metadata: { userId: 'user123', credits: '5', planCode: 'credits_5' },
            client_reference_id: 'user123',
        });

        const result = service.handleWebhookPayload(
            Buffer.from(JSON.stringify(event)),
            'sig',
        );

        expect(result?.type).toBe(BILLING_EVENT_TYPE.ONE_OFF_PAYMENT_COMPLETED);
        expect(result?.creditsAmount).toBe(5);
        expect(result?.userId).toBe('user123');
    });

    it('should return CHECKOUT_COMPLETED for mode=subscription', () => {
        const event = buildMockStripeEvent('checkout.session.completed', {
            mode: 'subscription',
            metadata: { userId: 'user123', planCode: 'monthly_usd' },
        });

        const result = service.handleWebhookPayload(
            Buffer.from(JSON.stringify(event)),
            'sig',
        );

        expect(result?.type).toBe(BILLING_EVENT_TYPE.CHECKOUT_COMPLETED);
    });

    it('should return null for mode=payment + unpaid', () => {
        // payment_status !== 'paid' → Stripe ще не підтвердив оплату
        // Поточна логіка: якщо mode=payment але payment_status !== 'paid' → не є ONE_OFF
        // Перевір яку поведінку має повертати (null або CHECKOUT_COMPLETED)
        // Рекомендовано: повернути null (Stripe надішле окремий event payment_intent.succeeded)
        const event = buildMockStripeEvent('checkout.session.completed', {
            mode: 'payment',
            payment_status: 'unpaid',
            metadata: { userId: 'user123', credits: '5' },
        });

        const result = service.handleWebhookPayload(
            Buffer.from(JSON.stringify(event)),
            'sig',
        );

        // Якщо в stripe.service.ts не обробляємо цей case — result може бути null або CHECKOUT_COMPLETED
        // Перевір що реальна імплементація повертає і адаптуй тест
        expect(result).toBeNull();
    });
});
```

---

## 6.3 `users.service.spec.ts`

Додати тест для нового методу `addCredits`:

```typescript
describe('addCredits', () => {
    it('should increment credits.balance by amount', async () => {
        const findByIdAndUpdateSpy = jest
            .spyOn(mockUserModel, 'findByIdAndUpdate')
            .mockResolvedValue(null);

        await service.addCredits('user123', 10);

        expect(findByIdAndUpdateSpy).toHaveBeenCalledWith('user123', {
            $inc: { 'credits.balance': 10 },
        });
    });
});
```

---

## 6.4 `payments.controller.spec.ts`

**Читай поточний файл перед змінами.**

Оновити `createCheckoutSession` тести — `dto` тепер містить `paymentType`:

```typescript
it('should create checkout session with subscription type', async () => {
    const dto = {
        paymentType: PAYMENT_TYPE.SUBSCRIPTION,
        planCode: 'monthly_usd',
    };
    mockPaymentsService.createCheckoutSession.mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/test',
    });

    const result = await controller.createCheckoutSession(mockUser, dto);

    expect(mockPaymentsService.createCheckoutSession).toHaveBeenCalledWith(
        mockUser._id.toString(),
        dto,
    );
    expect(result.data.checkoutUrl).toBe('https://checkout.stripe.com/test');
});

it('should create checkout session with one-off type', async () => {
    const dto = {
        paymentType: PAYMENT_TYPE.ONE_OFF,
        packCode: 'credits_5' as CreditPackCode,
    };
    mockPaymentsService.createCheckoutSession.mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/oneoff',
    });

    const result = await controller.createCheckoutSession(mockUser, dto);

    expect(mockPaymentsService.createCheckoutSession).toHaveBeenCalledWith(
        mockUser._id.toString(),
        dto,
    );
});
```

---

## 6.5 `test/payments.e2e-spec.ts`

**Читай поточний файл перед змінами (600+ рядків).**

Додати новий describe block для one-off flow:

```typescript
describe('POST /payments/checkout-session (one-off)', () => {
    it('should create one-off checkout session and credit user on webhook', async () => {
        // 1. Authenticate user
        // ... (використай існуючу auth helper з e2e spec)

        // 2. Create one-off checkout session
        const checkoutResponse = await request(app.getHttpServer())
            .post('/api/payments/checkout-session')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ paymentType: 'one_off', packCode: 'credits_5' })
            .expect(201);

        expect(checkoutResponse.body.data.checkoutUrl).toBeDefined();

        // 3. Simulate Stripe webhook: ONE_OFF_PAYMENT_COMPLETED
        const webhookBody = {
            id: 'evt_oneoff_test',
            type: 'checkout.session.completed',
            created: Math.floor(Date.now() / 1000),
            data: {
                object: {
                    mode: 'payment',
                    payment_status: 'paid',
                    metadata: {
                        userId: userId,
                        credits: '5',
                        planCode: 'credits_5',
                    },
                    client_reference_id: userId,
                },
            },
        };

        // Mock stripe.webhooks.constructEvent to return our event
        // (StripeService mock повинен вже існувати в e2e test setup)

        const webhookResponse = await request(app.getHttpServer())
            .post('/api/payments/webhook/stripe')
            .set('stripe-signature', 'test-sig')
            .send(Buffer.from(JSON.stringify(webhookBody)))
            .expect(200);

        expect(webhookResponse.body.received).toBe(true);

        // 4. Verify credits added
        const userResponse = await request(app.getHttpServer())
            .get('/api/users/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(userResponse.body.data.credits.balance).toBe(5);
    });

    it('should reject one-off when PAYMENTS_ONE_OFF_ENABLED=false', async () => {
        // Mock ENV для цього тесту
        // Implement based on how other feature flag tests are done in file
    });
});
```

---

## Verification Phase 6

```bash
pnpm --filter api test
# Всі unit тести проходять — 0 failures

pnpm --filter api test:e2e
# Всі E2E тести проходять

pnpm --filter web test
# Web тести проходять

pnpm --filter api test:cov
# Coverage не падає
```

## Загальний checklist після Phase 6

- [ ] `payments.service.spec.ts` — тести для `createCheckoutSession` оновлені під новий DTO
- [ ] `payments.service.spec.ts` — `ONE_OFF_PAYMENT_COMPLETED` webhook flow протестовано
- [ ] `payments.service.spec.ts` — out-of-order skip не застосовується до one-off
- [ ] `payments.service.spec.ts` — feature flag disabled → throw tested
- [ ] `stripe.service.spec.ts` — `mode: 'payment'` для ONE_OFF tested
- [ ] `stripe.service.spec.ts` — `handleCheckoutCompleted` one-off path tested
- [ ] `users.service.spec.ts` — `addCredits` tested
- [ ] `payments.controller.spec.ts` — dto передається цілком в service
- [ ] `payments.e2e-spec.ts` — full one-off flow: checkout + webhook + credits verified
