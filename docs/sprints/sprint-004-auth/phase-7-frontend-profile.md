# Фаза 7: Frontend — Profile Page

> Залежить від: Фаза 4 + Фаза 5 + Фаза 6

## 7.1 Сторінка профілю

### `apps/web/src/app/[locale]/(protected)/profile/page.tsx`

Сторінка профілю підтримує 4 режими через query parameter `mode`:

| Mode | Коли | Опис |
|---|---|---|
| `default` (немає mode) | Після входу, навігація з меню | Повний профіль: перегляд + Security + Danger Zone |
| `new` | Після реєстрації (magic link, purpose=register) | Форма заповнення: ім'я (required), прізвище, аватар, пароль (optional) |
| `set-password` | Після magic link login (purpose=login) | View-only профіль + editable password (optional) |
| `reset-password` | Після forgot password (purpose=reset-password) | View-only профіль + editable password (**required**) |

### Логіка сторінки

```typescript
export default function ProfilePage() {
    const searchParams = useSearchParams();
    const mode = searchParams.get('mode') as ProfileMode | null;
    const { user } = useAuthStore();
    const t = useTranslations('profile_page');

    return (
        <div>
            <h1>{t('heading')}</h1>

            {/* Profile section — завжди видимий */}
            <ProfileForm
                user={user}
                editable={mode === 'new' || mode === null}
                nameRequired={mode === 'new'}
            />

            {/* Password section — залежить від mode */}
            <SecuritySection
                user={user}
                mode={mode}
            />

            {/* Danger Zone — тільки в default mode */}
            {mode === null && <DangerZone />}
        </div>
    );
}
```

---

## 7.2 Profile features/components

### `apps/web/src/features/profile/`

Нова feature директорія:

```
features/profile/
├── ProfileForm.tsx
├── SecuritySection.tsx
├── DangerZone.tsx
├── DeleteAccountModal.tsx
└── index.ts
```

### `ProfileForm.tsx`

Форма профілю:

```typescript
interface ProfileFormProps {
    user: UserProfile;
    editable: boolean;
    nameRequired: boolean;
}
```

**Поля:**
- **Ім'я** (first name) — text input, required якщо `nameRequired=true`
- **Прізвище** (last name) — text input, optional
- **Аватар** — URL input або upload (MVP: URL input)
- **Мова** — select (uk/en)

**Дії:**
- Submit → `PATCH /users/me` (updateProfile)
- Після save: toast "Профіль оновлено" / "Profile updated"
- В mode `new`: після save redirect до `/check` (main app)

### `SecuritySection.tsx`

Секція безпеки — set/change/delete password:

```typescript
interface SecuritySectionProps {
    user: UserProfile;
    mode: ProfileMode | null;
}
```

**Стани залежно від `user.hasPassword` + `mode`:**

| hasPassword | mode | UI |
|---|---|---|
| false | `new` | "Встановити пароль (опціонально)" — password field з show/hide toggle |
| false | `set-password` | "Встановити пароль (опціонально)" — password field з show/hide toggle |
| false | `reset-password` | "Встановити пароль" — password field з show/hide toggle (**required**) |
| false | default | "Встановити пароль" — password field з show/hide toggle |
| true | default | "Змінити пароль" — current + new fields (обидва з show/hide toggle) + "Видалити пароль" link |
| true | `reset-password` | "Новий пароль" — new field з show/hide toggle (**required**, без current) |

> **Show/hide toggle:** Всі password fields використовують іконку ока (lucide-react `Eye`/`EyeOff`) замість окремого поля "Підтвердити пароль". Сучасний підхід — менше фрустрації для юзера.

**API calls:**
- Set password → `POST /auth/password/set`
- Change password → `POST /auth/password/change` → response містить новий `accessToken` (всі інші сесії ревоковані) → оновити in-memory token
- Delete password → `POST /auth/password/delete` (після confirmation)

> **Session invalidation:** Після `changePassword` backend ревокує всі інші refresh tokens і повертає новий `accessToken`. Frontend має оновити in-memory token з response. Toast: "Пароль змінено. Інші пристрої було відключено."

### `DangerZone.tsx`

Danger zone секція:

```
┌──────────────────────────────────────┐
│  ⚠️ Небезпечна зона                  │
│                                      │
│  Видалення акаунту                   │
│  Після видалення у вас є 30 днів     │
│  для відновлення акаунту.            │
│                                      │
│  [ Видалити акаунт ]  ← red button   │
└──────────────────────────────────────┘
```

Клік на "Видалити акаунт" → `POST /users/account/delete`:
- Якщо `requiresPassword: true` → відкрити `DeleteAccountModal`
- Якщо `requiresMagicLink: true` → показати "Перевірте пошту" toast

### `DeleteAccountModal.tsx`

Modal для підтвердження видалення з паролем:

```
┌──────────────────────────────────────┐
│  Видалення акаунту                   │
│                                      │
│  Ви впевнені? Ваш акаунт буде       │
│  деактивовано. У вас буде 30 днів    │
│  для відновлення.                    │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Введіть пароль для            │  │
│  │ підтвердження                 │  │
│  └────────────────────────────────┘  │
│                                      │
│  [ Скасувати ]  [ Видалити акаунт ]  │
│                     ↑ red button     │
└──────────────────────────────────────┘
```

**Flow:**
1. User вводить пароль
2. Submit → `POST /users/account/delete/confirm` { password }
3. Успіх → toast "Акаунт деактивовано" → redirect на `/auth/signin`
4. Помилка → показати "Невірний пароль"

---

## 7.3 Profile API (Backend)

### `apps/api/src/modules/users/users.controller.ts`

#### `PATCH /users/me`

```typescript
@Patch('me')
@UseGuards(JwtAuthGuard)
async updateProfile(@CurrentUser() user: UserDocument, @Body() body: UpdateProfileDto) {
    const updated = await this.usersService.updateProfile(user._id.toString(), body);
    return {
        data: {
            id: updated._id,
            email: updated.email,
            profile: updated.profile,
            credits: updated.credits,
            preferredLang: updated.preferredLang,
            hasPassword: !!updated.passwordHash,
            deletedAt: updated.deletedAt ?? null,
        },
    };
}
```

### `apps/api/src/modules/users/users.service.ts`

```typescript
async updateProfile(
    userId: string,
    data: { name?: string; avatar?: string; preferredLang?: string },
): Promise<UserDocument | null> {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update['profile.name'] = data.name;
    if (data.avatar !== undefined) update['profile.avatar'] = data.avatar;
    if (data.preferredLang !== undefined) update.preferredLang = data.preferredLang;
    return this.userModel.findByIdAndUpdate(userId, update, { new: true });
}
```

### `UpdateProfileDto`

Новий DTO з Zod schema:

```typescript
// packages/types — додати UpdateProfileSchema
export const UpdateProfileSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    avatar: z.string().url().optional(),
    preferredLang: z.enum(['uk', 'en']).optional(),
});

// apps/api — DTO
export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
```

---

## 7.4 Middleware

### `apps/web/src/middleware.ts`

Додати `/profile` до protected paths:

```typescript
const protectedPaths = ['/check', '/pay', '/profile'];
```

---

## 7.5 i18n — profile

### `apps/web/messages/uk.json` (додати)

```json
{
    "profile_page": {
        "heading": "Профіль",
        "new_heading": "Заповніть профіль",
        "form": {
            "name_label": "Ім'я",
            "name_placeholder": "Ваше ім'я",
            "name_required": "Ім'я обов'язкове",
            "last_name_label": "Прізвище",
            "last_name_placeholder": "Ваше прізвище",
            "avatar_label": "Аватар (URL)",
            "avatar_placeholder": "https://example.com/photo.jpg",
            "language_label": "Мова",
            "save_button": "Зберегти",
            "saved": "Профіль оновлено"
        },
        "security": {
            "heading": "Безпека",
            "set_password": "Встановити пароль",
            "set_password_optional": "Встановити пароль (опціонально)",
            "change_password": "Змінити пароль",
            "delete_password": "Видалити пароль",
            "current_password_label": "Поточний пароль",
            "new_password_label": "Новий пароль",
            "password_placeholder": "Мінімум 8 символів",
            "show_password": "Показати пароль",
            "hide_password": "Сховати пароль",
            "password_set": "Пароль встановлено",
            "password_changed": "Пароль змінено. Інші пристрої було відключено",
            "password_deleted": "Пароль видалено",
            "password_invalid": "Невірний пароль",
            "delete_password_confirm": "Ви впевнені, що хочете видалити пароль? Ви зможете входити тільки через magic link або Google."
        },
        "danger_zone": {
            "heading": "Небезпечна зона",
            "delete_title": "Видалення акаунту",
            "delete_description": "Після видалення у вас є 30 днів для відновлення акаунту.",
            "delete_button": "Видалити акаунт"
        }
    },
    "delete_account_modal": {
        "title": "Видалення акаунту",
        "description": "Ви впевнені? Ваш акаунт буде деактивовано. У вас буде 30 днів для відновлення.",
        "password_label": "Введіть пароль для підтвердження",
        "cancel_button": "Скасувати",
        "confirm_button": "Видалити акаунт",
        "magic_link_sent": "Посилання для підтвердження надіслано на пошту",
        "deleted": "Акаунт деактивовано",
        "invalid_password": "Невірний пароль"
    }
}
```

### `apps/web/messages/en.json` (додати)

```json
{
    "profile_page": {
        "heading": "Profile",
        "new_heading": "Complete your profile",
        "form": {
            "name_label": "First name",
            "name_placeholder": "Your name",
            "name_required": "Name is required",
            "last_name_label": "Last name",
            "last_name_placeholder": "Your last name",
            "avatar_label": "Avatar (URL)",
            "avatar_placeholder": "https://example.com/photo.jpg",
            "language_label": "Language",
            "save_button": "Save",
            "saved": "Profile updated"
        },
        "security": {
            "heading": "Security",
            "set_password": "Set password",
            "set_password_optional": "Set password (optional)",
            "change_password": "Change password",
            "delete_password": "Delete password",
            "current_password_label": "Current password",
            "new_password_label": "New password",
            "password_placeholder": "Minimum 8 characters",
            "show_password": "Show password",
            "hide_password": "Hide password",
            "password_set": "Password set",
            "password_changed": "Password changed. Other devices have been signed out",
            "password_deleted": "Password deleted",
            "password_invalid": "Invalid password",
            "delete_password_confirm": "Are you sure you want to delete your password? You will only be able to sign in with magic link or Google."
        },
        "danger_zone": {
            "heading": "Danger zone",
            "delete_title": "Delete account",
            "delete_description": "After deletion you have 30 days to restore your account.",
            "delete_button": "Delete account"
        }
    },
    "delete_account_modal": {
        "title": "Delete account",
        "description": "Are you sure? Your account will be deactivated. You will have 30 days to restore it.",
        "password_label": "Enter password to confirm",
        "cancel_button": "Cancel",
        "confirm_button": "Delete account",
        "magic_link_sent": "Confirmation link sent to your email",
        "deleted": "Account deactivated",
        "invalid_password": "Invalid password"
    }
}
```

---

## Verification

1. Profile page: default mode — перегляд всіх секцій
2. Profile page: mode=new — форма заповнення, ім'я required
3. Profile page: mode=set-password — password optional
4. Profile page: mode=reset-password — password required
5. PATCH /users/me — оновлення name, avatar, preferredLang
6. Security: set password → change password → delete password
7. Danger Zone: delete account з password → modal → confirmation
8. Danger Zone: delete account без password → magic link sent
9. Middleware: /profile protected — redirect без auth
