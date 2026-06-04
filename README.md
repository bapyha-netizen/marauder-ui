# Marauder UI

**Версия:** 0.7.1 (build 2026-06-05) — Layout & Scrolling Fixes
**Прошивка:** [ESP32 Marauder](https://github.com/justcallmekoko/ESP32Marauder) by justcallmekoko
**Назначение:** Desktop/web UI для управления ESP32 с прошивкой Marauder через Web Serial API

---

## Содержание

1. [Что это такое](#что-это-такое)
2. [Архитектура](#архитектура)
3. [Быстрый старт](#быстрый-старт)
4. [Подключение к ESP32](#подключение-к-esp32)
5. [Интерфейс](#интерфейс)
6. [Демо-режим](#демо-режим)
7. [Разработка](#разработка)
8. [Сборка и деплой](#сборка-и-деплой)
9. [Тестирование](#тестирование)
10. [Структура проекта](#структура-проекта)
11. [Безопасность](#безопасность)
12. [Производительность](#производительность)
13. [Changelog](#changelog)
14. [Юридическое предупреждение](#юридическое-предупреждение)

---

## Что это такое

Marauder UI — графический интерфейс для **ESP32 Marauder**. Приложение работает полностью локально в браузере (Chrome/Edge). Весь обмен данными — через USB (Web Serial API). Никаких серверов, никакого бэкенда.

### Возможности

- 📡 **Сканирование WiFi** — `scanall`, `sniffbeacon`, `sniffprobe`, `sniffdeauth`, `sniffpmkid`, `sniffraw`, `sniffsae`, `sigmon`, `mactrack`
- 🔵 **Bluetooth** — `sniffbt` (AirTag/Flipper/Flock/Meta/Speakers), `blespam` (11 типов), `sniffskim`, `spoofat`
- 🔊 **Атаки на колонки** — Speaker Hunter (поиск + атака), Speaker Kill (агрессивный спам), целевые атаки по брендам
- ⚡ **Атаки** — deauth, beacon spam (random/list/clone), probe spam, rickroll, badmsg, sleep, sae, csa, quiet, funny
- 📊 **Дашборд** — Live Output с виртуальным скроллом, статистика AP/Stations/BLE/Pkts, топ-10 AP, лента событий
- 📋 **Таблицы** — AP Explorer (с раскрытием станций, сортировкой, поиском), BLE Explorer (с подсветкой AirTag)
- 🗺 **Wardriving** — GPS-трекинг с записью в Wigle-формате, отметки POI, NMEA
- ⚡ **Сценарии** — 16 готовых сценариев (рекон, атаки, BLE, GPS, колонки) с Abort-механизмом
- 🔌 **Demo-режим** — работа без ESP32 для ознакомления
- 🆘 **Emergency Stop** — кнопка немедленной остановки в хедере
- 🔒 **Безопасность** — USB vendor whitelist, CSP в production, HTML-фильтрация, Excel Formula Injection защита
- 🌐 **i18n** — переключение русского/английского языка (кнопка EN/RU в хедере)
- ♿ **Accessibility** — ARIA labels, клавиатурная навигация, focus trap, color contrast

---

## Архитектура

```
┌──────────────────────────────────────────────────────┐
│                   Браузер (Chrome/Edge)               │
│                                                        │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Vue 3 UI    │  │  Pinia   │  │  Parser Engine    │  │
│  │  (Component) │  │ (Store)  │  │  (14 parsers)     │  │
│  └──────┬──────┘  └─────┬────┘  └────────┬─────────┘  │
│         │               │                │             │
│         └───────────────┴────────────────┘             │
│                        │                               │
│                    Web Serial API                       │
│                        │                               │
│  ┌─────────────────────┴─────────────────────────────┐ │
│  │            ESP32 Marauder Firmware                  │ │
│  │  (Wireless monitor mode + attack framework)         │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Быстрый старт

```bash
git clone <repo-url>
cd marauder-ui
npm install
npm run dev
```

Откройте `http://localhost:3010`

**Требования:**
- Chrome 89+ или Edge 89+
- ESP32 с прошивкой Marauder (CH340/CP2102 драйвер)
- Node.js 20+

---

## Подключение к ESP32

1. Подключите ESP32 к USB (используйте data-кабель)
2. Откройте `http://localhost:3010` в Chrome/Edge
3. Нажмите **Connect** в правом верхнем углу
4. В появившемся диалоге выберите порт ESP32 (обычно CP2102 или CH340)
5. После подключения загорится зелёный индикатор и появится статус-бар

**Поддерживаемые USB-устройства:**

| Vendor | Чип | USB VID:PID |
|--------|-----|-------------|
| Silicon Labs | CP2102 | `10C4:EA60` |
| WCH | CH340 | `1A86:7523` |
| FTDI | FT232 | `0403:6001` |
| WCH | CH343 | `1A86:55D4` |
| Espressif | ESP32-S2/S3 | `303A:1001` |

---

## Интерфейс

### Вкладки

| Вкладка | Содержание |
|---------|-----------|
| 📊 **Dashboard** | Live Output с виртуальным скроллом (рендерится ~40 строк из 2000), статистика AP/BLE/Pkts, топ-10 AP, лента событий, группа кнопок по категориям |
| 📶 **APs** | Таблица AP с сортировкой (RSSI/Name/Channel/Clients), поиском (debounced 200ms), раскрытием станций, sparkline истории RSSI |
| 🔵 **BLE** | Таблица BLE с автоопределением типа (AirTag/Speaker/BLE), multi-select для массовых атак |
| 📱 **Probes** | Таблица probe-запросов |
| ⚡ **Scenarios** | Карточки 16 сценариев, пошаговое выполнение с прогресс-баром и немедленной остановкой через AbortController |
| ❓ **Help** | Поиск по всем командам, копирование по клику |

### Status Bar

При подключении отображает: статус, количество AP/BLE/Probes/Pkts, длительность сессии.

### Emergency Stop

Красная кнопка **■ Stop** в хедере — отправляет `stopscan` на ESP32.

### AppActionBar

В хедере отображает текущее выполняемое действие, количество выбранных AP, последний результат.

---

## Демо-режим

1. ESP32 **не должен быть подключён**
2. Нажмите **Try Demo** в хедере
3. Интерфейс заполнится демо-данными: AP, BLE, терминал
4. Каждые 5 секунд — новые данные
5. Нажмите **Exit Demo** для выхода

---

## Разработка

```bash
# Установка
npm install

# Dev-сервер на http://localhost:3010
npm run dev

# Проверка типов
npx vue-tsc --noEmit

# Линтер
npm run lint

# Тесты
npx vitest run

# Сборка
npm run build

# Превью собранного
npm run preview
```

### Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Dev-сервер с HMR на порту 3010 |
| `npm run build` | Production-сборка в `dist/` |
| `npm run preview` | Превью собранного проекта |
| `npm run lint` | ESLint проверка |
| `npx vue-tsc --noEmit` | TypeScript проверка |
| `npx vitest run` | Запуск тестов |
| `npx playwright test` | E2E тесты |

---

## Сборка и деплой

```bash
# Production сборка
npm run build

# Результат в dist/
ls dist/

# Деплой на GitHub Pages (из dist/)
npx gh-pages -d dist
```

### GitHub Pages

Проект настроен на деплой в `/marauder-ui/` (см. `vite.config.ts: base: '/marauder-ui/'`).

Production-сборка включает:
- ✅ Content-Security-Policy заголовки (CSP)
- ✅ PWA (manifest, service worker, иконки)
- ✅ Source maps (опционально, настраивается в vite.config.ts)
- ✅ Tree-shaking, код-сплиттинг, CSS минификация

---

## Тестирование

### Unit-тесты (Vitest)

```bash
npx vitest run
```

Тесты покрывают:
- OUI vendor lookup (26 тестов)
- Parser Engine (62 теста)
- Serial Reconnect (25 тестов)
- Action Dispatcher
- IDB persistence

### E2E тесты (Playwright)

```bash
npx playwright test
```

---

## Структура проекта

```
src/
├── stores/                      # Pinia stores (TypeScript)
│   ├── serialStore.ts           # Serial-порт, терминал, команды
│   ├── apStore.ts               # Точки доступа + станции
│   ├── bleStore.ts              # BLE-устройства
│   ├── dashboardStore.ts        # Статистика, события
│   └── probeStore.ts            # Probe-запросы
├── i18n/                        # Переводы
│   ├── en.ts                    # Английский
│   └── ru.ts                    # Русский
├── services/                    # Business logic
│   ├── i18n.ts                  # i18n: t(), tA(), locale
│   ├── parserEngine.ts          # Парсер-диспетчер
│   ├── firmwareProfiles/
│   │   ├── marauderV1.ts        # 14 парсеров для текущей прошивки
│   │   └── index.ts             # Реестр профилей
│   ├── serialReader.ts          # Read loop, TextDecoder
│   ├── commandExecutor.ts       # send/sendAndWait/sendSequence
│   ├── serialReconnect.ts       # Auto-reconnect
│   ├── commandRegistry.ts       # 77 команд, 9 групп, 16 сценариев
│   └── commandMeta.ts           # Метаданные команд
├── components/
│   ├── dashboard/               # DashboardView
│   ├── ap/                      # APExplorer
│   ├── ble/                     # BLEExplorer
│   ├── probes/                  # ProbesView
│   ├── workflow/                # WorkflowBuilder
│   ├── help/                    # HelpGuide
│   └── ...
├── composables/
│   └── useContextAction.ts      # Композабл для действий
├── utils/                       # Утилиты
│   ├── sanitize.ts              # Санитизация текста
│   ├── uuid.ts                  # UUID v4
│   ├── logger.ts                # Ring-buffer логгер
│   ├── metrics.ts               # Счётчики производительности
│   ├── persist.ts               # Debounced IndexedDB
│   ├── idb.ts                   # IndexedDB wrapper
│   ├── format.ts                # Форматирование
│   ├── toast.ts                 # Toast-уведомления
│   ├── oui.ts                   # OUI vendor lookup
│   ├── clipboard.ts             # Буфер обмена
│   └── wigle.ts                 # CSV экспорт
├── types/                       # TypeScript definitions
├── assets/
│   └── style.css                # Tailwind
└── App.vue                      # Root component
```

---

## Безопасность

### CSP в production

```
default-src 'self'
script-src 'self'
style-src 'self' 'unsafe-inline'
img-src 'self' data:
connect-src 'self' https://*.tile.openstreetmap.org
font-src 'self' data:
worker-src 'self' blob:
```

### Санитизация данных

- `sanitizeText()` — удаление ANSI-кодов, control chars, non-printable Unicode, bidi/zero-width символов
- HTML-фильтрация по белому списку тегов (`span`, `b`, `i`, `u`, `br`)
- Удаление `on*` атрибутов (XSS)
- Ограничение длины (4096 символов)

### Excel Formula Injection

CSV-экспорт экранирует `=+\-@\t\r|` префиксы (OWASP), удаляет zero-width и bidi символы.

### USB vendor whitelist

Только известные USB-чипы: CP2102, CH340, CH343, FT232, ESP32-S2/S3.

### Дополнительно

- `data:` URL запрещён в script-src
- `blob:` разрешён только для worker-ов
- `'unsafe-inline'` разрешён только для style-src (требуется Tailwind)
- `'unsafe-eval'` разрешён только в dev-режиме

---

## Производительность

### Парсер

- **O(1) dispatch** по первому символу строки (14 кодпоинтов)
- **Кэшированный контекст** — `useApStore()`/`useBleStore()`/`useDashboardStore()` вызываются один раз
- **queueMicrotask** — батчинг строк в один microtask
- **14 парсеров** — каждый парсит строго свой формат вывода

### UI

- **Виртуальный скролл терминала** — рендерится ~40 строк из 2000
- **Debounced поиск** — 200ms debounce в таблицах AP/BLE
- **rAF-throttle** для scroll-обработчиков
- **shallowRef + triggerRef** — мутации Map/Set in-place без копирования

### Хранилище

- **LRU eviction** — max 1000 AP, 2000 BLE, 500 probes
- **Debounced IndexedDB** — 1s debounce + 5s max wait + beforeunload flush
- **Инкрементальные индексы** — `_byBssid`, `_byIndex` без полного rebuilt на каждое изменение

### Метрики

| Метрика | Значение |
|---------|----------|
| Parser throughput | 10-50x (O(1) dispatch) |
| Terminal render | ~40 DOM nodes (виртуальный скролл) |
| Store update | O(1) mutation (shallowRef + triggerRef) |
| IndexedDB write | Debounced 1-5s, batch |

---

## Changelog

### v0.7.1 (2026-06-05) — Layout & Scrolling Fixes

- **DashboardView**: восстановлена оригинальная вёрстка `h-full` — скроллинг Live Output и Action Log работает внутри модулей
- Убран rAF throttle из `onTerminalScroll` (задерживал автоскролл)
- Удалена надпись "🎯 Select a target" — вместо неё админ-кнопки
- Добавлены `ADMIN_ACTIONS` (System Info, Settings, Packet Count, Signal Mon, Ch Analyzer, Reboot)

### v0.7.0 (2026-06-05) — Full Audit & Bugfix

**CRITICAL Fixes:**
- **C-08**: ProbesView — кнопка Clear отправляла `clearlist -c` на ESP32 (очищала станции вместо probes). Теперь очистка только локальная.
- **C-12**: `persist.ts` — исправлен расчёт `elapsed` при первом вызове `debouncedSave`
- **C-13**: `wigle.ts` — расширена защита от Excel Formula Injection (добавлены `\t\r|`, zero-width/bidi фильтрация)

**HIGH Fixes:**
- **H-01**: `serialStore.ts` — добавлен `_isConnecting` guard против race condition двойного connect
- **H-08**: `WorkflowBuilder.vue` — `forEachAP` ограничен 50 AP, таймаут снижен с 5s до 2s
- **H-09/A-03**: `sendAndWait` — добавлена поддержка `AbortSignal`; Workflow использует `AbortController` для мгновенной остановки
- **H-11**: `ConfirmDialog.vue` — защита от двойного клика (guard + `disabled`)
- **H-19**: `App.vue` — `beforeunload` теперь синхронный (порт закрывается, а не async sendStop)
- **H-23**: `CommandBuilder.vue` — 4 динамических `import('../utils/toast')` заменены на статический
- **H-24**: `PWAInstallPrompt.vue` — `install()` обёрнут в try/catch/finally
- **H-26**: `marauderV1.ts` — реализован `resetState()` (сброс `_infoAPIndex`, `_ipListBuffer`)
- **H-27**: `marauderV1.ts` — BLE-устройства без MAC больше не сливаются в одну запись

**CRITICAL Architecture:**
- **A-01**: `serialStore.sendAndWait` теперь включает side-эффекты для `clearlist -a/-c` (раньше они срабатывали только через `sendCommand`)
- **A-02/A-03**: AbortController интегрирован в WorkflowBuilder для немедленного прерывания

**MEDIUM Fixes:**
- Debounced поиск (200ms) в APExplorer
- rAF-throttle для `onTerminalScroll`
- Debounced (200ms) `checkMobile` в App.vue
- clipboard.ts — размерный лимит (1MB) + `readOnly` на textarea
- toast.ts — глобальный throttle (max 100ms между toast)
- PWAInstall — localStorage для dismissed
- MobileBlocker — улучшенная детекция iPad
- main.js — `.catch()` для PWA registration

### v0.6.1 (2026-06-04) — Language Update Fix

- EN/RU переключение теперь корректно сохраняется
- Исправления мелких UI-строк

### v0.6.0 (2026-06-04) — i18n & Security

- 🌐 i18n: русский/английский язык (кнопка EN/RU, localStorage)
- 📄 MIT License
- 🔒 XSS: белый список HTML-тегов, удаление `on*` атрибутов
- 🧹 Санитизация: убран мёртвый regex, удалены пустые директории

---

## Юридическое предупреждение

MIT License. Подробнее см. [LICENSE](LICENSE).

Данное программное обеспечение предназначено **только для образовательных целей** и тестирования безопасности собственных сетей. Несанкционированное использование может нарушать местные и международные законы.

---

*Документация обновлена 5 июня 2026, версия 0.7.1*
