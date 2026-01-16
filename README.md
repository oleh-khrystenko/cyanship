# Lucid Kit
## The Clarity of Enterprise Architecture.
<br>

Цей репозиторій використовує **Turborepo** для організації монорепозиторію з фронтендом, бекендом і спільними пакетами.

---

## 📁 Структура проєкту

<pre>
lucid-kit/
├── apps/                     # Основні застосунки
│   ├── web/                  # Фронтенд (Next.js)
│   └── api/                  # Бекенд (NestJS)
│
├── packages/                 # Спільні пакети
│   ├── shared/               # Компоненти інтерфейсу
│   └── types/                # Спільні типи TypeScript
│
├── .env                      # Змінні середовища
│
├── .gitignore                # Правила ігнорування для Git
├── .prettierrc               # Конфіг Prettier
├── .prettierignore           # Ігнор для Prettier
│
├── .dockerignore             # Ігнор для Docker
├── docker-compose.dev.yml    # дев-середовище в Docker
├── docker-compose.yml        # прод-середовище в Docker
│
├── package.json              # Скрипти та загальні залежності
├── pnpm-lock.yaml
├── pnpm-workspace.yaml       # Робоча область для монорепозиторію
├── tsconfig.json             # Головний конфіг TypeScript з project references
└── turbo.json                # Конфіг Turborepo
</pre>

---

## ⚙️ Скрипти

| Команда       | Опис                             |
| ------------- | -------------------------------- |
| `pnpm dev`    | Запуск dev-серверів              |
| `pnpm build`  | Збірка всіх застосунків          |
| `pnpm lint`   | Лінтинг коду                     |
| `pnpm format` | Форматування коду через Prettier |

---

## 🧰 Технології

- 🔷 **Next.js** — фронтенд
- 🟦 **NestJS** — бекенд
- ✨ **TypeScript** — типізація в усьому проєкті
- 🚀 **Turborepo** — керування монорепозиторієм
- 🧹 **Prettier + ESLint** — форматування та перевірка якості коду
- 📦 **PNPM Workspaces** — керування залежностями

---

## 🚀 Швидкий старт

### 1️⃣ Завантаження

* Скачай архів цього репозиторію у будь-яку теку.
* **Не роби `git clone`** — просто розпакуй архів.

---

### 2️⃣ Запуск Docker

Переконайся, що встановлено:

* **Docker**
* **Docker Compose**

---

### 3️⃣ Створи файл `.env` у корені

Приклад вмісту:

```env
NODE_ENV=production
WEB_PORT=3000
API_PORT=3001
MONGODB_DB_NAME=myapp
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://api:3001
```

> У продакшні потрібно буде вказати реальний Atlas URI:
>
> ```
> MONGODB_URI=mongodb+srv://user:pass@cluster.example.mongodb.net/myapp
> ```

---

### 4️⃣ Запуск для розробки (з локальною Mongo)

```bash
  docker compose -f docker-compose.dev.yml up --build
```

* Frontend: [http://localhost:3000](http://localhost:3000)
* Backend: [http://localhost:3001](http://localhost:3001)
* MongoDB: порт 27017 (для перевірки, якщо потрібно)

Зупинити:

```bash
  docker compose -f docker-compose.dev.yml down
```

---

### 5️⃣ Запуск для продакшну (Atlas DB)

1. У `.env` додай свій Atlas `MONGODB_URI`.
2. Запусти:

    ```bash
    docker compose up --build -d
    ```
3. Відкрий:

    * Frontend → [http://localhost:3000](http://localhost:3000)
    * Backend → [http://localhost:3001](http://localhost:3001)

Зупинити:

```bash
  docker compose down
```

---

### 6️⃣ Все готово

* Весь код (фронт, бек, спільні пакети) вже зв’язані через **Turborepo**.
* Нічого додатково встановлювати локально не потрібно.
* Всі залежності інсталюються всередині контейнерів.

