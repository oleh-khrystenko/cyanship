# Overlay Policy

> Всі overlay-компоненти (модалки, sheets, confirm dialogs) підпорядковуються єдиним правилам монтування, керування станом та вибору примітиву.

## Принцип

```
Trigger (кнопка, подія, store action)
        |
        v
   Zustand store   <-- єдине джерело стану overlay
        |
        v
   shared/ui/Ui*   <-- єдиний спосіб рендерити overlay
        |
        v
   Layout mount    <-- overlay монтується один раз у root layout
```

Overlay ніколи не монтується поруч із trigger. Trigger лише викликає `store.open()`.

## Реєстр overlay-примітивів

| Примітив | Призначення | Radix база |
|----------|-------------|------------|
| `UiModal` | Модалки з контентом (форми, деталі, wizard) | `react-dialog` |
| `UiSheet` | Бокові/нижні панелі (навігація, фільтри, мобільний контент) | `react-dialog` |
| `UiConfirmDialog` | Підтвердження дій (видалення, скидання, деструктивні операції) | `react-alert-dialog` |

## Rules

### 1. Тільки примітиви

Overlay за межами `shared/ui/` **завжди** використовує один із трьох примітивів. Рендер raw `<div>` з ручним backdrop, Escape-обробкою чи z-index — заборонений.

**Чому:** примітиви гарантують focus trap, scroll lock, accessibility (aria), анімації та консистентну поведінку. Ручна реалізація неминуче пропускає edge cases.

### 2. Стан через Zustand store

Кожен overlay керується через виділений Zustand store:

```
stores/
  {name}Dialog/
    {name}DialogStore.ts    # isOpen, open(), close(), optional payload
    index.ts
```

Store може містити payload для параметризації overlay (наприклад, ID сутності для підтвердження видалення).

**Заборонено:** `useState` для стану overlay, `renderWrapper` / render prop патерни для передачі модалки через trigger.

**Чому:** єдиний патерн для всіх overlay — передбачуваний, тестований, масштабований. Коли з'являється другий trigger, нічого не треба рефакторити.

### 3. Один overlay — один mount у root layout

Всі overlay монтуються в одному місці — `app/[locale]/layout.tsx`. Lazy-завантаження вирішується через `dynamic(() => import(...))` на рівні компонента.

**Заборонено:** монтувати overlay в секційних layout'ах, монтувати один overlay в кількох місцях, обгортати trigger компонентом overlay.

### 4. Вибір примітиву

| Сценарій | Примітив |
|----------|----------|
| Форма, wizard, деталі сутності, складний контент | `UiModal` |
| Підтвердження дії (1 питання → confirm/cancel) | `UiConfirmDialog` |
| Навігація, фільтри, мобільний контент, бокова панель | `UiSheet` |

Якщо overlay починається як confirm, але потребує форму (наприклад, введення пароля для підтвердження) — використовуй `UiModal`, не `UiConfirmDialog`.

### 5. Структура feature-level overlay

```
features/{domain}/
  {Name}Dialog.tsx          # компонент overlay, читає store
  ...

stores/
  {name}Dialog/
    {name}DialogStore.ts    # Zustand store
    index.ts
```

Overlay-компонент:
- Читає `isOpen` та `close` зі store
- Не приймає `children` і не рендерить trigger
- Містить весь контент overlay (або делегує internal-компонентам feature)

### 6. Payload для параметризованих overlay

Коли overlay потребує контексту (ID сутності, варіант дії):

```ts
interface DeleteDialogState {
    isOpen: boolean;
    targetId: string | null;
    open: (id: string) => void;
    close: () => void;
}
```

Trigger викликає `open(id)`, overlay читає `targetId` зі store.

### 7. Заборона вкладених overlay

Overlay не може відкривати інший overlay. Якщо потрібна послідовність кроків — використовуй multi-step контент всередині одного overlay (wizard pattern), а не вкладені модалки.

## Приклад: правильна реалізація

**Store:**
```ts
// stores/briefDialog/briefDialogStore.ts
export const useBriefDialogStore = create<BriefDialogState>((set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
}));
```

**Overlay компонент:**
```tsx
// features/agency/brief/BriefDialog.tsx
export default function BriefDialog() {
    const isOpen = useBriefDialogStore((s) => s.isOpen);
    const close = useBriefDialogStore((s) => s.close);

    return (
        <UiModal open={isOpen} onOpenChange={(open) => !open && close()}>
            <UiModalContent>...</UiModalContent>
        </UiModal>
    );
}
```

**Layout mount:**
```tsx
// app/[locale]/layout.tsx
<Providers>
    <NextIntlClientProvider>
        <BriefDialog />
        <Header />
        {children}
    </NextIntlClientProvider>
</Providers>
```

**Trigger (будь-де в app):**
```tsx
const openBrief = useBriefDialogStore((s) => s.open);
<UiButton onClick={openBrief}>Get started</UiButton>
```
