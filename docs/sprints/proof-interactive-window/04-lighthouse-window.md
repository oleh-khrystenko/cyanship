# Sprint 04: Lighthouse Window — анімовані діаграми швидкості

> Захардкоджені кругові діаграми Lighthouse scores (Performance, Accessibility, Best Practices, SEO) з анімацією заповнення від 0 до 100%.

---

## Ключові рішення

### Підхід до діаграм — SVG circle gauge
SVG `<circle>` з `stroke-dasharray` + `stroke-dashoffset`. Анімація через CSS `transition` на `stroke-dashoffset`. Це стандартний паттерн для circular progress, не потребує бібліотек, легковагий і стилізується через Tailwind/CSS variables.

### Анімація при появі — Intersection Observer
Діаграми анімуються від 0 до 100 коли вкладка стає активною. Використовуємо простий `useState` + `useEffect` — коли компонент маунтиться (tab переключається на Lighthouse), запускаємо анімацію з невеликим delay. CSS transition робить плавне заповнення.

### Значення — хардкод 100%
Всі чотири метрики: 100. Це демонстрація, не live audit. Колір зелений (#0cce6b — стандартний Lighthouse green для 90-100 range).

### Без зовнішніх залежностей
Проект не використовує framer-motion чи інші animation бібліотеки. Зберігаємо цей підхід — чистий CSS transition + SVG.

---

## Файли для зміни

### 1. `apps/web/src/features/agency/proof/ui/ProofLighthouse/ProofLighthouse.tsx`
Повний rewrite заглушки.

**Структура компонента:**
```
ProofLighthouse()
├── State: animated (boolean, starts false)
├── useEffect: setTimeout(() => setAnimated(true), 100) на маунт
├── Render:
│   ├── 2x2 grid з 4 gauge компонентів
│   └── Кожен gauge: SVG circle + score число + label
```

**Gauge компонент (inline або окремий):**
```
LighthouseGauge({ label, score, animated })
├── SVG viewBox="0 0 120 120"
│   ├── <circle> background (stroke: muted/border color, opacity 0.2)
│   └── <circle> progress (stroke: green, stroke-dashoffset: animated ? 0 : full)
├── <span> score число по центру (100)
└── <span> label під діаграмою
```

**Деталі SVG gauge:**
- Радіус: 52, circumference: `2 * π * 52 ≈ 327`
- `stroke-dasharray: 327`
- `stroke-dashoffset`: `327` (0%) → `0` (100%)
- CSS: `transition: stroke-dashoffset 1.5s ease-out`
- `transform: rotate(-90deg)` + `transform-origin: center` щоб старт був зверху
- `stroke-linecap: round` для закруглених кінців

**Число по центру:**
- Анімація count-up від 0 до 100 через `requestAnimationFrame` або CSS counter
- Простіший варіант: показати 0 → через transition delay показати 100
- Найпростіший: одразу 100, без count-up (діаграма і так анімується)

**Стилізація:**
- Grid: `grid grid-cols-2 gap-6` (2x2)
- Кольори: зелений для progress (`text-success` або хардкод `#0cce6b`), `text-muted-foreground` для labels
- Score число: `text-2xl font-bold text-foreground`
- Label: `text-sm text-muted-foreground`

**4 метрики:**
1. Performance — 100
2. Accessibility — 100
3. Best Practices — 100
4. SEO — 100

**Імпорти (мінімальні):**
- `useState`, `useEffect` з React
- `useTranslations` з next-intl

### 2. `apps/web/messages/en.json`
Додати під `landing_page.dogfooding`:
```json
"proof_lighthouse": {
    "performance": "Performance",
    "accessibility": "Accessibility",
    "best_practices": "Best Practices",
    "seo": "SEO"
}
```

### 3. `apps/web/messages/uk.json`
Українські еквіваленти (Performance, Accessibility зазвичай не перекладають, але для консистентності):
```json
"proof_lighthouse": {
    "performance": "Продуктивність",
    "accessibility": "Доступність",
    "best_practices": "Найкращі практики",
    "seo": "SEO"
}
```

---

## Що НЕ робимо
- Live Lighthouse audit — тільки хардкод
- Framer-motion чи інші animation бібліотеки
- Count-up анімацію числа (зайва складність, circle gauge і так достатньо ефектний)
- Backend зміни — їх немає

---

## Edge cases
- **Повторне перемикання на tab** → компонент ремаунтиться → анімація спрацює знову (це бажана поведінка)
- **prefers-reduced-motion** → поважаємо через CSS `@media (prefers-reduced-motion: reduce)` — вимикаємо transition, показуємо одразу заповнені діаграми
- **Темна/світла тема** → SVG stroke кольори через CSS variables (`text-success`, `stroke-muted`)

---

## Верифікація
1. `pnpm --filter web build` — білд без помилок
2. Перемикнути на Lighthouse tab → 4 діаграми анімовано заповнюються до 100%
3. Перемикнути на інший tab і назад → анімація повторюється
4. Перевірити в dark mode — кольори коректні
5. `prefers-reduced-motion` — діаграми заповнені одразу без анімації
