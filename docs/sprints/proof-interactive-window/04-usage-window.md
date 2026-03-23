# Sprint 04: Usage Window — демо витрачання executions

> Третій таб Proof-вікна: користувач бачить реальний баланс, витрачає executions двома кнопками з різною вартістю, бачить журнал усіх транзакцій (списання, поповнення, скидання). Бекенд отримує повноцінний transaction log, який фіксує кожну зміну балансу — від Stripe webhook до ручного витрачання.

---

## Ключові рішення

### Все реальне — ніяких sandbox-балансів
Proof працює на реальному балансі користувача (`executions.balance`). Stripe у test mode, тому ризику немає. Користувач купує executions через таб Billing → витрачає їх у табі Usage. Наскрізний flow без імітацій.

### Вартість дій: 100 і 500
Дві кнопки: "Generate Report" (-100) і "Run AI Analysis" (-500). При мінімальному пакеті 5,000 executions це дає 10–50 натискань — достатньо щоб побавитись, не клікаючи тисячі разів. Вартість задана як shared constant в `packages/types`, і бекенд, і фронтенд використовують одне джерело.

### Transaction log — інфраструктура billing core
Нова колекція `ExecutionTransaction` — не тимчасове рішення для proof, а повноцінна частина billing системи. Кожна зміна балансу (покупка пакету, активація підписки, витрачання, скидання) створює запис. Це аудит-лог, не фінансовий леджер — `balanceAfter` може мати мінімальне відхилення при паралельних операціях, що прийнятно для поточного масштабу.

### Транзакції при resetBilling
`resetBilling` створює запис `billing_reset` (якщо баланс > 0), потім видаляє всі транзакції користувача. Чистий стан для повторного тестування — відвідувач починає з нуля.

### Неавторизований користувач
Показуємо empty state з поясненням + `onRequestAuth()` при спробі дії — аналогічно Billing табу.

---

## Секція A: Shared Types (`packages/types`)

### 1. `packages/types/src/contracts/executions.ts` — новий файл

**Константи дій:**
```typescript
export const EXECUTION_ACTION = {
    // Debit (user-initiated)
    STANDARD_REPORT: 'standard_report',
    AI_ANALYSIS: 'ai_analysis',
    // Credit (system, via webhooks)
    SUBSCRIPTION_ACTIVATION: 'subscription_activation',
    PACK_PURCHASE: 'pack_purchase',
    PLAN_CHANGE: 'plan_change',
    // System
    BILLING_RESET: 'billing_reset',
} as const;

export type ExecutionAction =
    (typeof EXECUTION_ACTION)[keyof typeof EXECUTION_ACTION];
```

**Типи транзакцій:**
```typescript
export const EXECUTION_TRANSACTION_TYPE = {
    CREDIT: 'credit',
    DEBIT: 'debit',
} as const;

export type ExecutionTransactionType =
    (typeof EXECUTION_TRANSACTION_TYPE)[keyof typeof EXECUTION_TRANSACTION_TYPE];
```

**Вартість дій (shared source of truth):**
```typescript
export const SPENDABLE_ACTIONS = [
    EXECUTION_ACTION.STANDARD_REPORT,
    EXECUTION_ACTION.AI_ANALYSIS,
] as const;

export type SpendableAction = (typeof SPENDABLE_ACTIONS)[number];

export const EXECUTION_ACTION_COST: Record<SpendableAction, number> = {
    [EXECUTION_ACTION.STANDARD_REPORT]: 100,
    [EXECUTION_ACTION.AI_ANALYSIS]: 500,
} as const;
```

**Zod schema для spend endpoint:**
```typescript
export const SpendExecutionsSchema = z.object({
    action: z.enum(SPENDABLE_ACTIONS),
});

export type SpendExecutions = z.infer<typeof SpendExecutionsSchema>;
```

**Тип транзакції для API response:**
```typescript
export const ExecutionTransactionItemSchema = z.object({
    id: z.string(),
    type: z.enum([
        EXECUTION_TRANSACTION_TYPE.CREDIT,
        EXECUTION_TRANSACTION_TYPE.DEBIT,
    ]),
    action: z.string(),
    amount: z.number().int().positive(),
    balanceAfter: z.number().int().min(0),
    createdAt: z.coerce.date(),
});

export type ExecutionTransactionItem = z.infer<
    typeof ExecutionTransactionItemSchema
>;
```

### 2. `packages/types/src/contracts/index.ts`
Додати `export * from './executions';`

### 3. `packages/types/src/enums/response-code.ts`
Додати `EXECUTIONS_SPENT: 'EXECUTIONS_SPENT'` в `RESPONSE_CODE` та відповідний mapping `SUCCESS` в `RESPONSE_CODE_TYPE`.

---

## Секція B: Backend — ExecutionTransaction Schema

### 1. `apps/api/src/modules/users/schemas/execution-transaction.schema.ts` — новий файл

```typescript
@Schema({ timestamps: true })
export class ExecutionTransaction {
    @Prop({ required: true, type: Types.ObjectId, index: true })
    userId!: Types.ObjectId;

    @Prop({ required: true, enum: ['credit', 'debit'] })
    type!: string;

    @Prop({ required: true })
    action!: string;

    @Prop({ required: true, min: 1 })
    amount!: number;

    @Prop({ required: true, min: 0 })
    balanceAfter!: number;
}
```

**Indexes:**
- `{ userId: 1, createdAt: -1 }` — compound index для запиту "останні N транзакцій користувача". Покриває і фільтрацію, і сортування.

**Без TTL** — транзакції зберігаються до явного видалення (resetBilling). Для production-масштабу TTL можна додати пізніше.

### 2. `apps/api/src/modules/users/users.module.ts`
Додати `ExecutionTransaction` в `MongooseModule.forFeature()`.

---

## Секція C: Backend — UsersService extensions

### 1. Inject `ExecutionTransactionModel`
Додати `@InjectModel(ExecutionTransaction.name)` в конструктор `UsersService`.

### 2. Новий метод: `recordTransaction()`
Низькорівневий запис транзакції. Використовується всіма методами, що змінюють баланс.

```typescript
async recordTransaction(data: {
    userId: string;
    type: 'credit' | 'debit';
    action: string;
    amount: number;
    balanceAfter: number;
}): Promise<ExecutionTransactionDocument> {
    return this.executionTransactionModel.create({
        userId: new Types.ObjectId(data.userId),
        type: data.type,
        action: data.action,
        amount: data.amount,
        balanceAfter: data.balanceAfter,
    });
}
```

### 3. Рефакторинг: `addExecutions()`
Поточна сигнатура: `addExecutions(userId, amount)` — тільки `$inc`.
Нова сигнатура: `addExecutions(userId, amount, action, metadata?)` — `$inc` + transaction record.

```typescript
async addExecutions(
    userId: string,
    amount: number,
    action: string,
): Promise<number> {
    const user = await this.userModel.findByIdAndUpdate(
        userId,
        { $inc: { 'executions.balance': amount } },
        { new: true },
    );
    const balanceAfter = user?.executions.balance ?? 0;

    await this.recordTransaction({
        userId,
        type: EXECUTION_TRANSACTION_TYPE.CREDIT,
        action,
        amount,
        balanceAfter,
    });

    return balanceAfter;
}
```

Повертає `balanceAfter` замість `void` — корисно для callers.

### 4. Новий метод: `spendExecutions()`
Atomic deduction з перевіркою достатності балансу + запис транзакції.

```typescript
async spendExecutions(
    userId: string,
    amount: number,
    action: string,
): Promise<{ balanceAfter: number; transaction: ExecutionTransactionDocument } | null> {
    const user = await this.userModel.findOneAndUpdate(
        { _id: userId, 'executions.balance': { $gte: amount } },
        { $inc: { 'executions.balance': -amount } },
        { new: true },
    );
    if (!user) return null;

    const balanceAfter = user.executions.balance;
    const transaction = await this.recordTransaction({
        userId,
        type: EXECUTION_TRANSACTION_TYPE.DEBIT,
        action,
        amount,
        balanceAfter,
    });

    return { balanceAfter, transaction };
}
```

`findOneAndUpdate` з `{ $gte: amount }` — atomic guard, ніколи не піде в мінус.

### 5. Новий метод: `getRecentTransactions()`
```typescript
async getRecentTransactions(
    userId: string,
    limit: number = 10,
): Promise<ExecutionTransactionDocument[]> {
    return this.executionTransactionModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
}
```

Використовує compound index `{ userId: 1, createdAt: -1 }`.

### 6. Новий метод: `clearTransactions()`
```typescript
async clearTransactions(userId: string): Promise<void> {
    await this.executionTransactionModel.deleteMany({
        userId: new Types.ObjectId(userId),
    });
}
```

Викликається з `PaymentsService.resetBilling()`.

### 7. Що НЕ змінюємо: `deductExecution()`
Існуючий метод `deductExecution()` (hardcoded -1, free report fallback) зараз не викликається жодним endpoint'ом — модуль `reports` scaffold. Коли reports буде реалізований, він використовуватиме `spendExecutions()`. Видалення `deductExecution()` — поза скоупом цього спринту (breaking change для `hasExecution()` логіки).

---

## Секція D: Backend — UsersController endpoints

### 1. `POST /users/me/executions/spend`

```
Guard: JwtActiveGuard
Body: { action: 'standard_report' | 'ai_analysis' }
Response 200: {
    data: {
        balance: number,
        transaction: ExecutionTransactionItem,
    }
}
Error 400: INSUFFICIENT_EXECUTIONS (code вже існує в RESPONSE_CODE)
```

**Логіка:**
1. Validate `action` через `SpendExecutionsDto` (Zod)
2. Lookup cost: `EXECUTION_ACTION_COST[action]`
3. `usersService.spendExecutions(userId, cost, action)`
4. Якщо `null` → throw `BadRequestException({ code: RESPONSE_CODE.INSUFFICIENT_EXECUTIONS })`
5. Return `{ data: { balance, transaction } }`

### 2. `GET /users/me/executions/transactions`

```
Guard: JwtActiveGuard
Query: limit? (default 10, max 50)
Response 200: {
    data: ExecutionTransactionItem[]
}
```

**Логіка:**
1. `usersService.getRecentTransactions(userId, limit)`
2. Map documents → `ExecutionTransactionItem` (id, type, action, amount, balanceAfter, createdAt)

### 3. DTO файли
- `apps/api/src/modules/users/dto/spend-executions.dto.ts` — `createZodDto(SpendExecutionsSchema)`

---

## Секція E: Backend — PaymentsService integration

### 1. `applyOneOffPayment()` — додати action
Поточний виклик:
```typescript
await this.usersService.addExecutions(userId, executionsAmount);
```
Новий виклик:
```typescript
await this.usersService.addExecutions(
    userId,
    executionsAmount,
    EXECUTION_ACTION.PACK_PURCHASE,
);
```

### 2. `processSubscriptionEvent()` — записати транзакцію після atomic update
Після успішного `processSubscriptionEvent` і коли `executionAdjustment !== 0`:

```typescript
if (executionAdjustment !== 0) {
    // Fetch fresh balance after atomic update
    const updatedUser = await this.userModel.findById(userId).lean();
    if (updatedUser) {
        const action =
            event.type === BILLING_EVENT_TYPE.CHECKOUT_COMPLETED
                ? EXECUTION_ACTION.SUBSCRIPTION_ACTIVATION
                : EXECUTION_ACTION.PLAN_CHANGE;
        await this.usersService.recordTransaction({
            userId,
            type: executionAdjustment > 0
                ? EXECUTION_TRANSACTION_TYPE.CREDIT
                : EXECUTION_TRANSACTION_TYPE.DEBIT,
            action,
            amount: Math.abs(executionAdjustment),
            balanceAfter: updatedUser.executions.balance,
        });
    }
}
```

**Чому окремий read:** atomic pipeline update не повертає документ через `findOneAndUpdate` return value (він повертає pre-update стан, а `new: true` не застосовується до pipeline updates в MongoDB). Тому read after write. Мінімальний race condition на `balanceAfter` — прийнятний для audit log.

### 3. `resetBilling()` — запис + очищення
Перед скиданням (між `findById` і `findByIdAndUpdate`):

```typescript
// Record reset transaction if user had balance
const previousBalance = user.executions.balance;
if (previousBalance > 0) {
    await this.usersService.recordTransaction({
        userId,
        type: EXECUTION_TRANSACTION_TYPE.DEBIT,
        action: EXECUTION_ACTION.BILLING_RESET,
        amount: previousBalance,
        balanceAfter: 0,
    });
}
```

Після скидання billing та webhook events:
```typescript
await this.usersService.clearTransactions(userId);
```

Порядок: record → reset → clear. Record створюється для консистентності, а потім видаляється разом з рештою. Якщо clear не потрібен (хочемо зберігати повну історію) — обговорюємо. Поточне рішення: чистий стан при reset.

---

## Секція F: Frontend — API client

### 1. `apps/web/src/shared/api/executions.ts` — новий файл

```typescript
import { apiClient } from './client';
import type { ExecutionTransactionItem, SpendableAction } from '@cyanship/types';

export async function spendExecutions(
    action: SpendableAction,
): Promise<{ balance: number; transaction: ExecutionTransactionItem }> {
    const { data } = await apiClient.post<{
        data: { balance: number; transaction: ExecutionTransactionItem };
    }>('/users/me/executions/spend', { action });
    return data.data;
}

export async function getExecutionTransactions(
    limit: number = 10,
): Promise<ExecutionTransactionItem[]> {
    const { data } = await apiClient.get<{
        data: ExecutionTransactionItem[];
    }>('/users/me/executions/transactions', { params: { limit } });
    return data.data;
}
```

### 2. `apps/web/src/shared/api/index.ts`
Додати re-export: `export { spendExecutions, getExecutionTransactions } from './executions';`

---

## Секція G: Frontend — ProofUsage компонент

### 1. `apps/web/src/features/agency/proof/ui/ProofUsage/ProofUsage.tsx`
Повний rewrite заглушки.

**Props:**
```typescript
interface ProofUsageProps {
    onRequestAuth?: () => void;
}
```

**State:**
```typescript
const user = useAuthStore((s) => s.user);
const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
const refreshUser = useAuthStore((s) => s.refreshUser);

const [transactions, setTransactions] = useState<ExecutionTransactionItem[]>([]);
const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
const [spendingAction, setSpendingAction] = useState<SpendableAction | null>(null);
```

**Баланс:** Читається з `user.executions.balance` (auth store). Після spend — оновлюється через `refreshUser()` або локально через response.

**Структура компонента:**
```
ProofUsage({ onRequestAuth })
├── Неавторизований → Empty state + "Увійдіть щоб протестувати"
├── Авторизований:
│   ├── Індикатор балансу (великий число + label)
│   ├── Панель дій:
│   │   ├── Кнопка "Generate Report" (-100)
│   │   └── Кнопка "Run AI Analysis" (-500)
│   └── Журнал транзакцій (останні 10)
│       ├── Кожен рядок: іконка ↑/↓ + назва дії + час + кількість
│       └── Empty state якщо немає транзакцій
```

**handleSpend(action):**
1. `setSpendingAction(action)`
2. `const result = await spendExecutions(action)`
3. Оновити auth store: `refreshUser()` (робить `getMe()` → оновлює баланс)
4. Prepend transaction в локальний state
5. `setSpendingAction(null)`
6. При помилці: toast з `mapApiCode` (INSUFFICIENT_EXECUTIONS → i18n message)

**useEffect (fetch transactions):**
- Триггер: `isAuthenticated` змінюється на `true`
- `getExecutionTransactions(10)` → `setTransactions()`
- Loading state під час fetch

**Кнопки disabled коли:**
- `spendingAction !== null` (будь-яка дія в процесі)
- `balance < cost` (недостатньо executions — disabled + пояснення)

**Відображення транзакцій:**
- Compact list, кожен рядок ~40px
- Іконка: `ArrowUpRight` (credit, зелений) / `ArrowDownRight` (debit)
- Action label через i18n: `proof_usage.actions.standard_report` тощо
- Timestamp: relative time ("2 min ago") через `Intl.RelativeTimeFormat` або absolute time
- Amount: `+5,000` (green) / `-100` (default)
- Max 10 записів, без пагінації (proof, не dashboard)

**Імпорти (все існуюче крім нового API):**
- `useAuthStore` з `@/stores/auth`
- `spendExecutions`, `getExecutionTransactions` з `@/shared/api`
- `EXECUTION_ACTION`, `EXECUTION_ACTION_COST`, `SPENDABLE_ACTIONS` з `@cyanship/types`
- `UiButton`, `UiSpinner` з `@/shared/ui`
- `useTranslations` з `next-intl`
- `toast` з `sonner`
- `ArrowUpRight`, `ArrowDownRight` з `lucide-react`

### 2. `apps/web/src/features/agency/proof/index.ts`
Export вже має бути (ProofUsage експортується lazy через ProofWindow). Перевірити.

---

## Секція H: i18n

### 1. `apps/web/messages/en.json`
Під `landing_page.dogfooding`:
```json
"proof_usage": {
    "balance_label": "Your Balance",
    "balance_executions": "{count} executions",
    "generate_report": "Generate Report",
    "run_analysis": "Run AI Analysis",
    "cost_label": "-{cost} exec",
    "spending": "Processing...",
    "insufficient_balance": "Not enough executions",
    "transactions_title": "Recent Activity",
    "no_transactions": "No activity yet. Purchase executions in the Billing tab to get started.",
    "not_authenticated": "Sign in to test the usage-based billing",
    "sign_in_button": "Sign in",
    "actions": {
        "standard_report": "Report generated",
        "ai_analysis": "AI analysis completed",
        "subscription_activation": "Subscription activated",
        "pack_purchase": "Execution pack purchased",
        "plan_change": "Plan changed",
        "billing_reset": "Billing reset"
    },
    "time_just_now": "Just now",
    "time_minutes_ago": "{count}m ago",
    "time_hours_ago": "{count}h ago"
}
```

### 2. `apps/web/messages/uk.json`
Українські еквіваленти всіх ключів.

---

## Що НЕ змінюємо

- `deductExecution()` — не використовується endpoint'ами, рефакторинг при реалізації reports
- `hasExecution()` — залишається як є
- `ProofWindow`, `ProofTabs`, `DogfoodingSection` — не потребують змін (ProofUsage вже підключений)
- `CatalogService` — ніяких змін
- Stripe webhook parsing (`StripeService`) — ніяких змін
- Auth flow — ніяких змін

---

## Edge cases

- **Баланс 0, ніколи не купував** → кнопки disabled, журнал порожній, пояснення "Купіть executions в табі Billing"
- **Баланс > 0 але < 100** → обидві кнопки disabled (мінімальна дія коштує 100)
- **Баланс ≥ 100 але < 500** → "Generate Report" активна, "Run AI Analysis" disabled
- **Concurrent spend** → atomic `$gte` guard в MongoDB. Якщо два таби одночасно — один отримає null, побачить INSUFFICIENT_EXECUTIONS
- **resetBilling між вкладками** → після reset баланс 0, транзакції видалені. Usage таб при наступному spend отримає INSUFFICIENT_EXECUTIONS. При наступному fetch transactions — порожній список
- **Webhook запізнився** → користувач купив пакет, повернувся на лендінг, але webhook ще не прийшов. Balance = 0 в store. Рішення: `refreshUser()` при mount ProofUsage. Якщо webhook вже оброблений — баланс оновиться. Якщо ні — користувач побачить 0 і має почекати (Stripe webhooks зазвичай < 5 секунд)
- **Неавторизований → натиснув spend** → неможливо, кнопки не рендеряться. Показується empty state з `onRequestAuth`

---

## Верифікація

1. `pnpm --filter @cyanship/types build` — типи збираються
2. `pnpm --filter api build` — API збирається
3. `pnpm --filter web build` — Web збирається
4. `pnpm --filter api test` — існуючі тести не зламані

### Manual flow
1. Відкрити лендінг → таб Usage → неавторизований → empty state
2. Авторизуватись через таб Auth → повернутись на Usage → баланс 0, порожній журнал
3. Перейти на таб Billing → купити пакет basic (5,000 exec) через тестову карту Stripe
4. Повернутись на Usage → баланс 5,000 → журнал показує "+5,000 Execution pack purchased"
5. Натиснути "Generate Report" → баланс 4,900 → журнал: "-100 Report generated"
6. Натиснути "Run AI Analysis" → баланс 4,400 → журнал: "-500 AI analysis completed"
7. Натиснути кілька разів → перевірити що баланс коректно зменшується
8. Зробити Reset Billing (через Stripe portal або API) → баланс 0, журнал очищений
9. Повторити покупку → перевірити що flow працює з нуля
