# AI Chat — Parallel Request Bypass (TOCTOU)

> **Статус:** Знайдена проблема, виправлення НЕ розпочате. Цей документ — фіксація дефекту і затверджений план фіксу. Імплементацію виконати окремою задачею.

> **Критичність:** Висока. Прямий обхід білінгу + lifetime free-tier ліміту. Дозволяє ескалувати реальну вартість Anthropic API на нашу кишеню.

---

## 1. Опис проблеми (простими словами)

Уяви, що в тебе на рахунку рівно на одну каву. Ти підходиш до пʼяти бариста одночасно і кажеш кожному "наливай". Кожен бариста перевіряє твій баланс — бачить що грошей вистачає на одну — і починає наливати. Усі пʼять кав уже у тебе в руках, і тільки тоді каса намагається списати. Списується одна. Решта чотири — безкоштовно.

Так само працює зараз AI-чат: користувач може запустити багато паралельних запитів, отримати багато відповідей від Claude і заплатити лише за один. Ми платимо Anthropic за всі ці відповіді з власної кишені. Так само обходиться "безкоштовний ліміт": людина має право на 5 запитів, а може зробити 50, якщо запустить їх одночасно.

---

## 2. Технічний опис (root cause)

### 2.1 Залучені файли

| Файл | Що робить | Чому є частиною проблеми |
|------|-----------|-------------------------|
| `apps/api/src/modules/ai/guards/ai-rate-limit.guard.ts:49-61` | `checkAccountLimit()` читає `user.ai.requestsUsed` зі snapshot документа, отриманого `JwtActiveGuard`, і кидає `AI_LIMIT_EXHAUSTED` якщо ≥ ліміт | Snapshot — це фотографія стану ДО запиту. Конкурентні запити бачать однакову фотографію і всі проходять перевірку. |
| `apps/api/src/modules/ai/ai.controller.ts:50-55` | Pre-stream balance check: `if (user.executions.balance < AI_CHAT_COST) throw` | Той самий snapshot. Та сама проблема: усі N паралельних запитів проходять перевірку одночасно. |
| `apps/api/src/modules/ai/ai.controller.ts:74-104` | Стрімить SSE з Anthropic, накопичує `assistantContent`, після завершення викликає `finalizeChat()` | Витрата токенів Anthropic відбувається ТУТ, у пʼять (чи більше) потоків паралельно. Гроші вже списано з нашого боку. |
| `apps/api/src/modules/ai/ai.service.ts:107-125` | `finalizeChat()` робить атомарний `findOneAndUpdate({ _id, 'executions.balance': { $gte: AI_CHAT_COST } }, { $inc: { 'executions.balance': -200, 'ai.requestsUsed': 1 } })` | Атомарність ТУТ захищає лише від негативного балансу. До цього моменту стрім уже завершився і відповідь у клієнта. |

### 2.2 Часова діаграма експлойту

Початковий стан користувача: `executions.balance = 200`, `ai.requestsUsed = limit - 1`.

```
T0   Клієнт → надсилає 5 паралельних POST /ai/chat
T1   Запит #1: JwtActiveGuard завантажує User → snapshot: balance=200, requestsUsed=limit-1
T1   Запит #2: JwtActiveGuard завантажує User → snapshot: balance=200, requestsUsed=limit-1
T1   Запит #3: JwtActiveGuard завантажує User → snapshot: balance=200, requestsUsed=limit-1
T1   Запит #4: JwtActiveGuard завантажує User → snapshot: balance=200, requestsUsed=limit-1
T1   Запит #5: JwtActiveGuard завантажує User → snapshot: balance=200, requestsUsed=limit-1

T2   Усі 5: AiRateLimitGuard.checkAccountLimit() → requestsUsed (limit-1) < limit → PASS
T3   Усі 5: pre-stream check у контролері → balance (200) >= 200 → PASS
T4   Усі 5: res.flushHeaders() → SSE headers відправлені
T5   Усі 5: aiService.processChat() → 5 паралельних стрімів до Anthropic API
        ↑ ТУТ ми платимо Anthropic за 5 повних відповідей з нашого балансу

T6   Усі 5: стріми завершуються, у клієнта 5 повних відповідей AI
T7   Запит #1: finalizeChat → findOneAndUpdate з $gte:200 → SUCCESS, balance=0, requestsUsed=limit
T7   Запит #2: finalizeChat → findOneAndUpdate з $gte:200 → FAIL (balance=0)
        → throw 'Insufficient executions during finalization'
        → SSE error event клієнту (але клієнт уже отримав повну відповідь!)
T7   Запит #3, #4, #5: те саме що #2

Підсумок:
  - Користувач отримав 5 AI-відповідей
  - Списано 200 executions (за 1 відповідь)
  - requestsUsed інкрементовано на 1 (а не на 5)
  - Anthropic зняв з нашого Anthropic-акаунта вартість 5 запитів
```

### 2.3 Чому existing захисти НЕ покривають цей кейс

| Захист | Чому не працює |
|--------|----------------|
| `IpRateLimit` (Lua INCR+EXPIRE у тому ж guard) | Працює правильно й атомарно — але це **per-IP** ліміт. Він обмежує загальну кількість запитів з IP за 24 години (наприклад 20). Він НЕ запобігає burst-у з 5-10 паралельних запитів у межах ліміту. Атакуючий просто робить стільки паралельних запитів, скільки дозволяє IP-ліміт. |
| Atomic guard у `finalizeChat` (`'executions.balance': { $gte: AI_CHAT_COST }`) | Захищає тільки інваріант "balance не може стати негативним". Не захищає від уже надісланої клієнту відповіді і вже сплачених Anthropic токенів. |
| `JwtActiveGuard` | Перевіряє лише валідність токена і soft-delete. Не має жодного відношення до rate limiting. |

### 2.4 Заявлений vs реальний інваріант

CLAUDE.md і `docs/sprints/ai-chat/` декларують:
- **"3-layer protection"** — насправді 1 шар (IP) атомарний, 2 шари (account, balance) — TOCTOU.
- **"Debit only on success"** — насправді "debit only for one success out of N concurrent". Решта успіхів безкоштовні.

---

## 3. Вплив

| Категорія | Вплив |
|-----------|-------|
| **Фінансовий (Anthropic API)** | Прямі витрати на наш Anthropic-акаунт. При ціні Haiku ~$0.0004/запит і ліміті 20 запитів з IP за 24h, один зловмисник на день = ~$0.008. Botnet на 1000 IP = ~$8/день. Не катастрофа, але реальні витрати без upper bound у бізнес-логіці. |
| **Бізнес (lifetime free limit)** | Lead може отримати десятки безкоштовних AI-відповідей замість 5. Це руйнує конверсійну воронку: ціль чату — після вичерпання 5 запитів показати brief-форму і конвертувати ліда. Якщо ліміт обходиться, brief-форма ніколи не зʼявляється. |
| **Платні користувачі** | Користувач, що купив executions pack, може витратити в N разів більше реальних AI-відповідей, ніж заплатив. Прямий збиток на маржу. |
| **Цілісність ledger** | `ExecutionTransaction` записи коректні (одна транзакція на одне успішне списання), але реальна "робота" виконана у N разів більша. Audit trail виглядає чистим, аномалію не видно з ledger-у. |

---

## 4. План виправлення (Reserve → Stream → Confirm/Refund)

Архітектурний принцип: **резервувати ресурс ДО виконання роботи, відкочувати при failure**. Це класична saga / two-phase pattern для одного ресурсу.

### 4.1 Ключова ідея

Замість "перевірити → попрацювати → списати", переходимо на "**атомарно зарезервувати → попрацювати → підтвердити (no-op) або відкотити (refund)**". Резерв — це і є списання, але з можливістю компенсації.

### 4.2 Зміни по файлах

#### A. `apps/api/src/modules/ai/guards/ai-rate-limit.guard.ts`

**Що змінити:** замінити `checkAccountLimit()` зі snapshot-read на атомарний conditional `findOneAndUpdate`.

```ts
// Було (TOCTOU):
private checkAccountLimit(user: UserDocument): void {
    const ai = user.ai ?? { requestsUsed: 0, bonusGranted: false };
    const limit = ENV.AI_CHAT_FREE_LIMIT + (ai.bonusGranted ? ENV.AI_CHAT_BONUS_AMOUNT : 0);
    if (ai.requestsUsed >= limit) throw new ForbiddenException(...);
}

// Стає (atomic reserve):
private async reserveAccountSlot(userId: string): Promise<void> {
    // Атомарно інкрементуємо requestsUsed з guard-ом на ліміт.
    // Mongo рахує limit як free + (bonusGranted ? bonus : 0) через aggregation pipeline.
    const result = await this.userModel.findOneAndUpdate(
        {
            _id: userId,
            $expr: {
                $lt: [
                    '$ai.requestsUsed',
                    {
                        $add: [
                            ENV.AI_CHAT_FREE_LIMIT,
                            { $cond: ['$ai.bonusGranted', ENV.AI_CHAT_BONUS_AMOUNT, 0] }
                        ]
                    }
                ]
            }
        },
        { $inc: { 'ai.requestsUsed': 1 } }
    );
    if (!result) {
        throw new ForbiddenException({
            code: RESPONSE_CODE.AI_LIMIT_EXHAUSTED,
            message: 'AI request limit exhausted',
        });
    }
}
```

**Наслідок:** guard потребує `UserModel` (через `@InjectModel`). Guard перетворюється на mutating — це нестандартно для Nest guards (зазвичай pure check). Альтернатива нижче.

#### B. `apps/api/src/modules/ai/ai.controller.ts`

**Що змінити:** до `flushHeaders()` атомарно зарезервувати executions; обгорнути весь стрім у try/catch/finally з компенсуючим refund на будь-яку failure-стежку.

```ts
async chat(...) {
    const userId = user._id.toString();

    // Step 1: атомарний резерв (account slot + executions)
    // Викликаємо service-метод, який робить ОБИДВА інкременти атомарно.
    const reservation = await this.aiService.reserveChat(userId);
    // reservation = { reservationId, balanceAfter, requestsUsedAfter }
    // Якщо ресурсу немає — service кидає 4xx ДО будь-яких SSE headers.

    // Step 2: SSE headers
    res.setHeader(...);
    res.flushHeaders();

    let committed = false;
    try {
        const stream = await this.aiService.processChat(...);
        let assistantContent = '';
        for await (const chunk of stream) {
            if (aborted) break;
            assistantContent += chunk;
            this.writeSSE(...);
        }

        if (!aborted) {
            // Step 3: підтвердження — пише історію, записує ledger transaction.
            // НЕ міняє balance/requestsUsed (вже списано на резерві).
            const result = await this.aiService.commitChat(
                userId,
                reservation,
                dto.message,
                assistantContent
            );
            committed = true;
            this.writeSSE({ type: DONE, balanceAfter: result.balanceAfter, ... });
        }
    } catch (err) {
        // SSE error event
        this.writeSSE({ type: ERROR, code: 'AI_PROVIDER_ERROR' });
    } finally {
        if (!committed) {
            // Step 4: компенсація — повертаємо executions і decrement requestsUsed.
            // Обовʼязково: інакше юзер втратить кошти за провалений стрім.
            await this.aiService.refundChat(userId, reservation).catch((err) => {
                this.logger.error(`Failed to refund AI chat reservation ${reservation.reservationId}: ${err.message}`);
                // Refund failure — критичний інцидент, треба алерт.
            });
        }
        req.off('close', onClose);
        if (!res.writableEnded) res.end();
    }
}
```

#### C. `apps/api/src/modules/ai/ai.service.ts`

**Що змінити:** замінити `finalizeChat()` на три методи: `reserveChat()`, `commitChat()`, `refundChat()`.

```ts
async reserveChat(userId: string): Promise<Reservation> {
    // Один атомарний findOneAndUpdate, що:
    //  - перевіряє requestsUsed < limit (через $expr з $add+$cond як вище)
    //  - перевіряє executions.balance >= AI_CHAT_COST
    //  - інкрементує requestsUsed на 1
    //  - декрементує balance на AI_CHAT_COST
    const updated = await this.userModel.findOneAndUpdate(
        {
            _id: userId,
            'executions.balance': { $gte: AI_CHAT_COST },
            $expr: {
                $lt: [
                    '$ai.requestsUsed',
                    { $add: [
                        ENV.AI_CHAT_FREE_LIMIT,
                        { $cond: ['$ai.bonusGranted', ENV.AI_CHAT_BONUS_AMOUNT, 0] }
                    ]}
                ]
            }
        },
        {
            $inc: {
                'executions.balance': -AI_CHAT_COST,
                'ai.requestsUsed': 1,
            }
        },
        { new: true }
    );

    if (!updated) {
        // Треба розрізнити "ліміт" vs "баланс" — другий запит на чистий read для exception code.
        const fresh = await this.userModel.findById(userId).lean();
        if (!fresh) throw new NotFoundException('User not found');
        const limit = ENV.AI_CHAT_FREE_LIMIT + (fresh.ai?.bonusGranted ? ENV.AI_CHAT_BONUS_AMOUNT : 0);
        if ((fresh.ai?.requestsUsed ?? 0) >= limit) {
            throw new ForbiddenException({ code: RESPONSE_CODE.AI_LIMIT_EXHAUSTED, ... });
        }
        throw new BadRequestException({ code: RESPONSE_CODE.INSUFFICIENT_EXECUTIONS, ... });
    }

    return {
        reservationId: new Types.ObjectId().toString(), // для logging/idempotency
        balanceAfter: updated.executions.balance,
        requestsUsedAfter: updated.ai.requestsUsed,
    };
}

async commitChat(userId, reservation, userMessage, assistantContent) {
    // НЕ міняє balance/requestsUsed — вони вже списані на reserveChat.
    // Лише: записує ChatMessage history + ExecutionTransaction ledger entry.
    await this.usersService.recordTransaction({
        userId,
        type: EXECUTION_TRANSACTION_TYPE.DEBIT,
        action: EXECUTION_ACTION.AI_CHAT,
        amount: AI_CHAT_COST,
        balanceAfter: reservation.balanceAfter,
    });
    await this.chatMessageModel.insertMany([...]);

    // Recalc remaining для UI
    const limit = ENV.AI_CHAT_FREE_LIMIT + (bonusGranted ? ENV.AI_CHAT_BONUS_AMOUNT : 0);
    const aiRequestsRemaining = Math.max(0, limit - reservation.requestsUsedAfter);
    return { balanceAfter: reservation.balanceAfter, aiRequestsRemaining };
}

async refundChat(userId, reservation): Promise<void> {
    // Атомарно повертаємо executions і decrement requestsUsed.
    // Обовʼязково atomic — кілька рефандів не повинні дублюватись.
    await this.userModel.findByIdAndUpdate(userId, {
        $inc: {
            'executions.balance': AI_CHAT_COST,
            'ai.requestsUsed': -1,
        }
    });
    // НЕ записуємо в ledger — резерв і refund скасовують один одного,
    // у ledger потрапляє ТІЛЬКИ повна успішна транзакція через commitChat.
}
```

#### D. Видалити старий `finalizeChat()`

Метод повністю замінюється трьома вище. Видалити його разом з усіма імпортами/тестами, що на нього посилаються.

#### E. Guard-вибір (важливе архітектурне рішення)

Є два варіанти, де робити reserve:

**Варіант 1 (рекомендований):** Видалити `checkAccountLimit` з guard-у повністю. Залишити в guard-і лише `checkIpLimit` (він уже атомарний). Reserve account+balance робити в `aiService.reserveChat()`, який викликається на початку контролера. **Плюси:** guard залишається pure check, mutation у service-шарі. **Мінуси:** unified reserve — менше layered protection, але це і є правильно (немає сенсу робити нерелевантну перевірку лімітів якщо є атомарний reserve далі).

**Варіант 2:** Залишити guard, але переписати на atomic reserve (як у пункті A). Тоді у service-і `reserveChat` робить тільки decrement балансу. **Мінуси:** guard перестає бути pure (mutation у guard — anti-pattern), дві окремі точки списання (account і balance), складніше думати про refund.

→ **Йдемо з Варіантом 1.**

### 4.3 Edge cases і ризики імплементації

| Кейс | Що враховуємо |
|------|---------------|
| **Клієнт закрив вкладку посередині стріму** | `req.on('close')` тригерить abort, контролер потрапляє у `finally` без `committed=true` → `refundChat` повертає executions і requestsUsed. Юзер не втрачає нічого за провалений стрім. |
| **Refund сам падає (наприклад, MongoDB down)** | Catch навколо `refundChat`, лог `error` з reservationId. Потенційно треба черга невдалих refundʼів (як `OrphanedProviderCustomer` для Stripe) або алерт. На перший проход — лог + Sentry alert; чергу додаємо лише якщо такі інциденти зʼявляться. |
| **Anthropic повертає 5xx до першого токена** | `processChat` кидає → попадаємо у `catch` → `committed=false` → `refundChat` у `finally`. Юзер бачить SSE error, гроші не списано. ✓ |
| **Стрім завершився, але `commitChat` падає** | `committed` ще не `true` (виставляється після `commitChat`) → `refundChat` спрацює. Але `assistantContent` вже надіслано клієнту. Це OK: кращий варіант — повернути гроші і втратити історію, ніж списати без history. |
| **Race: дві finalize-and-commit спроби** | Неможливо: `commitChat` викликається лише з одного try-блоку для одного reservation. |
| **`reserveChat` зарезервувало, але потім `processChat` ніколи не запускається (process crash між)** | Резерв зависає назавжди: requestsUsed і balance списані без compensation. На це треба окремий механізм (TTL на reservation у Redis або cron-reconcile). На перший проход приймаємо ризик — рідкісний кейс при graceful shutdown. Документуємо як known limitation. |
| **Тестування паралельних сценаріїв** | Нові e2e тести з `Promise.all([chat(), chat(), chat(), chat(), chat()])` для юзера на межі ліміту. Очікується: рівно один stream завершується успішно, решта отримують 4xx ДО будь-якого SSE event. |

### 4.4 Зміни в контракті API

**Жодних змін у публічному API.** SSE events `TOKEN`/`DONE`/`ERROR` залишаються. Frontend не потребує оновлень.

Єдина різниця для клієнта: при exhausted limit / insufficient balance тепер відповідь приходить як HTTP 4xx з `code` у body (як зараз), а не як SSE error event. Це і так уже працює — `reserveChat` кидає до `flushHeaders`.

### 4.5 Тести (мінімальний набір)

1. **Unit `ai.service.spec.ts`:**
   - `reserveChat` успішно списує при достатніх ресурсах
   - `reserveChat` кидає `INSUFFICIENT_EXECUTIONS` при нестачі балансу
   - `reserveChat` кидає `AI_LIMIT_EXHAUSTED` при `requestsUsed >= limit`
   - `reserveChat` враховує `bonusGranted` у розрахунку ліміту
   - `refundChat` повертає рівно стільки, скільки списано
   - `commitChat` не міняє balance/requestsUsed, лише пише ledger+history

2. **Unit `ai.controller.spec.ts`:**
   - Успішний стрім → `commitChat` викликано, `refundChat` НЕ викликано
   - Anthropic кидає → `commitChat` НЕ викликано, `refundChat` викликано
   - Клієнт abort → `refundChat` викликано

3. **e2e `ai-chat-concurrency.e2e-spec.ts`:**
   - User з `balance=200` робить 5 паралельних chat → рівно 1 успішний `DONE`, 4 отримують 4xx `INSUFFICIENT_EXECUTIONS` ДО SSE
   - User з `requestsUsed=limit-1` робить 5 паралельних chat → рівно 1 успішний `DONE`, 4 отримують 4xx `AI_LIMIT_EXHAUSTED`
   - Один користувач, успішний chat → перевірити, що `assistantContent` збережено в history і `ExecutionTransaction` створено

---

## 5. Чого НЕ робимо в межах цього спринта

- Не додаємо TTL/reconcile для зависаючих reservation (приймаємо ризик crash-window).
- Не міняємо IP rate limit (він уже атомарний і коректний).
- Не міняємо frontend.
- Не міняємо ціну `AI_CHAT_COST` чи ліміти.
- Не додаємо нову колекцію для reservation tracking — резерв і так "захардкоджений" як state у `User.executions.balance` + `User.ai.requestsUsed`.

---

## 6. Definition of Done

- [ ] `checkAccountLimit` видалено з `AiRateLimitGuard`, guard містить лише IP check
- [ ] `aiService.reserveChat()` / `commitChat()` / `refundChat()` реалізовані
- [ ] Старий `finalizeChat()` видалено
- [ ] Контролер обгорнуто у `try/catch/finally` з компенсаційним refund
- [ ] Refund failure логуються через `Logger.error` з `reservationId`
- [ ] Усі unit-тести зелені
- [ ] Новий e2e на паралельні запити зелений (5 паралельних → 1 успіх)
- [ ] CLAUDE.md оновлено: секція "AI chat debit only on success" перефразована на "Reserve → stream → commit/refund"
- [ ] `docs/sprints/ai-chat/` оновлено: "3-layer protection" перефразовано так, щоб відображати, що account+balance — це **один атомарний reserve**, а не два окремих check-и

---

## 7. Оцінка складності

**6/10.** Не "додати один параметр", але і не тиждень роботи. Потребує:
- Перебудови debit flow з check-then-act на reserve-then-confirm
- Акуратного finally-блоку з гарантованим refund на всіх failure-стежках
- Нових e2e тестів на паралельні сценарії (це найбільш fragile частина)

**Орієнтовний обсяг:** кілька годин на код + час на тести і ручну верифікацію через `curl` з `&`.
