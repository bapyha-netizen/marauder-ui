# ESP32 Marauder UI — Полное руководство проекта

> **Версия:** 0.2.1  
> **Статус:** Production-ready  
> **Технологии:** Vue 3 + Pinia + Tailwind CSS + Vite  
> **Прошивка:** [ESP32 Marauder](https://github.com/justcallmekoko/ESP32Marauder) by justcallmekoko  
> **Репозиторий:** https://github.com/bapyha-netizen/marauder-ui  
> **GitHub Pages:** https://bapyha-netizen.github.io/marauder-ui/  

---

## Содержание

- [1. Архитектура и стек технологий](#1-архитектура-и-стек-технологий)
  - [1.1 Общая архитектура](#11-общая-архитектура)
  - [1.2 Стек технологий](#12-стек-технологий)
  - [1.3 Жизненный цикл данных](#13-жизненный-цикл-данных)
  - [1.4 Event-driven архитектура](#14-event-driven-архитектура)
- [2. Ключевые компоненты и их взаимодействие](#2-ключевые-компоненты-и-их-взаимодействие)
  - [2.1 Корневой компонент (App.vue)](#21-корневой-компонент-appvue)
  - [2.2 Хранилища (Stores)](#22-хранилища-stores)
  - [2.3 Службы (Services)](#23-службы-services)
  - [2.4 Компоненты представления](#24-компоненты-представления)
  - [2.5 Утилиты (Utils)](#25-утилиты-utils)
  - [2.6 Граф зависимостей](#26-граф-зависимостей)
- [3. История патчей (Changelog)](#3-история-патчей-changelog)
  - [3.1 v0.2.1 — Critical fixes (30.05.2026)](#31-v021--critical-fixes-30052026)
  - [3.2 v0.2.0 — Initial release](#32-v020--initial-release)
- [4. Схемы данных и API](#4-схемы-данных-и-api)
  - [4.1 apStore — Точки доступа](#41-apstore--точки-доступа)
  - [4.2 bleStore — BLE-устройства](#42-blestore--ble-устройства)
  - [4.3 probeStore — Probe-запросы](#43-probestore--probe-запросы)
  - [4.4 dashboardStore — Статистика](#44-dashboardstore--статистика)
  - [4.5 serialStore — Сериальный порт](#45-serialstore--сериальный-порт)
  - [4.6 Web Serial API](#46-web-serial-api)
  - [4.7 Парсеры (Parser Engine)](#47-парсеры-parser-engine)
- [5. Дорожная карта (Roadmap)](#5-дорожная-карта-roadmap)
  - [5.1 Текущие задачи](#51-текущие-задачи)
  - [5.2 Ближайшие задачи](#52-ближайшие-задачи)
  - [5.3 Среднесрочные задачи](#53-среднесрочные-задачи)
  - [5.4 Долгосрочные задачи](#54-долгосрочные-задачи)
  - [5.5 Архив (выполнено)](#55-архив-выполнено)
- [6. Известные проблемы, технический долг и ограничения](#6-известные-проблемы-технический-долг-и-ограничения)
  - [6.1 Критические проблемы](#61-критические-проблемы)
  - [6.2 Технический долг](#62-технический-долг)
  - [6.3 Ограничения](#63-ограничения)
  - [6.4 Частые проблемы пользователей](#64-частые-проблемы-пользователей)
- [7. Развертывание и конфигурация окружения](#7-развертывание-и-конфигурация-окружения)
  - [7.1 Требования](#71-требования)
  - [7.2 Локальная разработка](#72-локальная-разработка)
  - [7.3 Сборка для продакшна](#73-сборка-для-продакшна)
  - [7.4 Развертывание на GitHub Pages](#74-развертывание-на-github-pages)
  - [7.5 Конфигурация Vite](#75-конфигурация-vite)
  - [7.6 Конфигурация Tailwind CSS](#76-конфигурация-tailwind-css)
  - [7.7 Переменные окружения](#77-переменные-окружения)
- [8. Стандарты кодирования](#8-стандарты-кодирования)
  - [8.1 Общие принципы](#81-общие-принципы)
  - [8.2 Vue 3 + Composition API](#82-vue-3--composition-api)
  - [8.3 Pinia Stores](#83-pinia-stores)
  - [8.4 Именование](#84-именование)
  - [8.5 Компоненты](#85-компоненты)
  - [8.6 Обработка ошибок](#86-обработка-ошибок)
  - [8.7 Git-конвенции](#87-git-конвенции)
  - [8.8 Безопасность](#88-безопасность)
- [9. Приложение: Все команды и сценарии](#9-приложение-все-команды-и-сценарии)

---

## 1. Архитектура и стек технологий

### 1.1 Общая архитектура

Приложение представляет собой одностраничное приложение (SPA), работающее полностью в браузере. Бэкенд отсутствует — связь с ESP32 осуществляется через Web Serial API напрямую из браузера.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         БРАУЗЕР (Chrome/Edge)                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Vue 3 Application                        │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  App.vue (Root)                                       │   │   │
│  │  │  ├── MobileBlocker   (guard: desktop only)            │   │   │
│  │  │  ├── Header          (Connect/Demo/Stop)              │   │   │
│  │  │  ├── CommandBuilder  (66 command buttons)             │   │   │
│  │  │  ├── Tab: DashboardView  (terminal + stats)           │   │   │
│  │  │  ├── Tab: APExplorer     (AP table + stations)        │   │   │
│  │  │  ├── Tab: BLEExplorer    (BLE devices)               │   │   │
│  │  │  ├── Tab: ProbesView      (probe requests)             │   │   │
│  │  │  ├── Tab: WorkflowBuilder (18 scenarios)              │   │   │
│  │  │  ├── Tab: HelpGuide       (command reference)         │   │   │
│  │  │  └── StatusBar      (APs/BLE/Pkts/Session)           │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                                                              │   │
│  │  ┌──────────────────────┐  ┌──────────────────────────┐     │   │
│  │  │   Pinia Stores        │  │     Services              │     │   │
│  │  │  ┌──────────────────┐ │  │  ┌─────────────────────┐ │     │   │
│  │  │  │ serialStore.js   │◄├──┼──┤ parserEngine.js     │ │     │   │
│  │  │  │ (port, terminal)  │ │  │  │ (16 парсеров)       │ │     │   │
│  │  │  ├──────────────────┤ │  │  └─────────────────────┘ │     │   │
│  │  │  │ apStore.js       │◄├──┤                          │     │   │
│  │  │  │ (APs + stations)  │ │  │  ┌─────────────────────┐ │     │   │
│  │  │  ├──────────────────┤ │  │  │ commandRegistry.js   │ │     │   │
│  │  │  │ bleStore.js      │ │  │  │ (66 commands,        │ │     │   │
│  │  │  │ (BLE devices)    │ │  │  │  18 workflows)       │ │     │   │
│  │  │  ├──────────────────┤ │  │  └─────────────────────┘ │     │   │
│  │  │  │ dashboardStore.js│ │  │                          │     │   │
│  │  │  │ (stats + events)  │ │  │  ┌─────────────────────┐ │     │   │
│  │  │  ├──────────────────┤ │  │  │   Utils               │ │     │   │
│  │  │  │ probeStore.js    │ │  │  │ format.js / toast.js  │ │     │   │
│  │  │  │ (probe requests)  │ │  │  │ oui.js / demoData.js │ │     │   │
│  │  │  └──────────────────┘ │  │  └─────────────────────┘ │     │   │
│  │  └──────────────────────┘  └──────────────────────────┘     │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │           Web Serial API (navigator.serial)           │   │   │
│  │  └──────────────────────┬───────────────────────────────┘   │   │
│  └─────────────────────────┼───────────────────────────────────┘   │
└───────────────────────────┼───────────────────────────────────────┘
                            │ USB-UART (CP2102 / CH340 / FTDI)
┌───────────────────────────▼───────────────────────────────────────┐
│              ESP32 + Marauder Firmware                             │
│  WiFi (802.11 b/g/n) · BLE 4.2 · GPS · SD Card                    │
│  Режимы: Monitor, Station, Access Point, Sniffer                   │
└───────────────────────────────────────────────────────────────────┘
```

### 1.2 Стек технологий

| Технология | Версия | Назначение |
|------------|--------|------------|
| **Vue 3** | ^3.3.4 | Фреймворк, Composition API + `<script setup>` |
| **Pinia** | ^2.1.6 | Управление состоянием (5 stores) |
| **Vite** | ^5.0 | Сборщик, dev-сервер с HMR |
| **Tailwind CSS** | ^3.3.3 | CSS-утилиты, кастомная тема (slate/indigo) |
| **PostCSS** | ^8.4.27 | Обработка CSS (autoprefixer) |
| **Web Serial API** | браузерный API | Связь с ESP32 через USB |
| **@vitejs/plugin-vue** | ^4.2.3 | Плагин Vite для Vue SFC |

Приложение **не имеет зависимостей** от бэкенда, баз данных, серверных фреймворков или внешних API. Всё работает локально в браузере.

### 1.3 Жизненный цикл данных

```
Шаг 1: ESP32 отправляет данные по UART
        │
Шаг 2: serialStore.listen() читает чанки
        │  rawBuffer += txtDecoder.decode(value, { stream: true })
        │  if rawBuffer > 65536 → slice(-32768)
        │
Шаг 3: split('\n'), последний неполный чанк → rawBuffer
        │
Шаг 4: addToTerminal(line.trim())
        │  _notifyLine(text) → триггерит onLine-подписчиков
        │  escHtml(text) → добавляет в terminalOutput[]
        │
        ├──────────────────────┬──────────────────────┐
        ▼                      ▼                      ▼
Шаг 5a: App.vue watch         Шаг 5b: sendAndWait      Шаг 5c: parser
        parseLine(line)        onLine(handler)         parseLine(line)
        │                      │  (проверка промпта)   │
        ▼                      ▼                       ▼
Шаг 6: Parser Engine          sendAndWait              updateOrAddAP
       16 парсеров             resolve()               в apStore/bleStore
       │                                               dashboardStore
       ▼                                               probeStore
       addEvent → events[]
       updateOrAddAP → apStore
       addProbe → probeStore
       updateOrAddDevice → bleStore
       incrementPackets → dashboardStore
```

**Ключевое различие двух путей парсинга:**

Путь A (через App.vue watch):
- `serialStore.terminalOutput` изменяется → `watch` детектит новые строки → `parseLine()` для каждой → парсеры обновляют store
- Используется для всех строк, добавляемых в терминал (как с реального ESP32, так и из demo-режима)

Путь B (через onLine внутри store):
- `addToTerminal()` → `_notifyLine(text)` → все зарегистрированные `onLine` хендлеры получают уведомление
- Используется `sendAndWait()` для детекции промпта ESP32

### 1.4 Event-driven архитектура

**Проблема (была в v0.2.0):** Workflows использовали фиксированные setTimeout-задержки. Если ESP32 выполнял команду дольше ожидаемого, следующие команды накладывались и ломали логику.

**Решение (v0.2.1):** Event-driven очередь через `sendAndWait()`.

```
sendAndWait(command, timeout)
    │
    ├── 1. Регистрирует onLine-хендлер
    │        handler(line) → если line !== echo && PROMPT_RE.test(line) → resolve()
    │
    ├── 2. Отправляет команду на ESP32
    │        sendCommand(command) → writer.write(command + '\n')
    │
    ├── 3. Ждёт один из двух событий:
    │        A) ESP32 выводит промпт ">" / "esp32marauder>"
    │             → хендлер срабатывает → unsub + resolve
    │        B) Таймаут (по умолчанию 15 сек)
    │             → unsub + resolve (с логом Timed out)
    │
    └── 4. Workflow переходит к следующему шагу
```

**PROMPT_RE** (регулярное выражение для детекции промпта):
```js
const PROMPT_RE = /^>\s*$|^esp32marauder>\s*$/i
// Матчит: ">", "> ", "esp32marauder>", "esp32marauder> "
```

**sendSequence** (для последовательностей без воркфлоу, используется в scanAll):
```js
// Было: sendCommand + setTimeout(fixed delay)
// Стало: sendAndWait(command, timeout) — ждёт промпт
```

---

## 2. Ключевые компоненты и их взаимодействие

### 2.1 Корневой компонент (App.vue)

**Файл:** `src/App.vue` (222 строки)

**Роль:** Оркестратор всего приложения.

**Обязанности:**
- Инициализация Pinia stores при монтировании
- Управление вкладками (6 табов: dashboard, ap, ble, probes, scenarios, help)
- Watch на `serialStore.terminalOutput.length` — парсинг новых строк
- Управление demo-режимом (вкл/выкл, интервал генерации данных)
- Beforeunload-обработчик (пытается отправить `stopscan`)
- Обработка подключения/отключения ESP32
- Экстренная остановка (`handleEmergencyStop`)
- Toast-уведомления (портятся из `useToast()`)

**Ключевые функции:**

```js
// Парсинг новых строк терминала
watch(() => serialStore.terminalOutput.length, (newLen, oldLen) => {
    if (newLen < oldLen) { lastLength = 0; return }
    const lines = serialStore.terminalOutput
    if (lines.length > lastLength) {
        for (let i = lastLength; i < lines.length; i++) {
            parseLine(lines[i].replace(/<[^>]+>/g, ''))  // убираем HTML-теги
        }
        lastLength = lines.length
    }
})

// Demo-режим: генерация данных каждые 5 сек
const toggleDemoMode = () => {
    if (serialStore.isDemoMode) {
        serialStore.terminalOutput = generateDemoTerminalOutput()
        parseDemoAP(); parseDemoBLE()
        demoInterval.value = setInterval(() => { parseDemoAP(); parseDemoBLE() }, 5000)
    } else {
        clearInterval(demoInterval.value)
        // очистка всех stores
    }
}
```

### 2.2 Хранилища (Stores)

#### serialStore.js (246 строк)
**Ядро всего приложения.** Управляет подключением к ESP32, чтением/записью в Serial, терминалом.

**Состояние:**
```js
port: ref(null)              // SerialPort объект
reader: ref(null)             // ReadableStreamDefaultReader
readLoopActive: ref(false)    // флаг активности read-loop
isConnected: ref(false)       // статус подключения
isDemoMode: ref(false)        // демо-режим
terminalOutput: ref([])       // массив HTML-строк (макс 2000)
rawBuffer: ref('')            // буфер неполных чанков (макс 65536)
baudRate: ref(115200)         // скорость порта
_lineHandlers: []             // массив onLine-подписчиков (приватное поле)
```

**Ключевые методы:**

| Метод | Описание |
|-------|----------|
| `connect()` | Запрашивает порт (фильтры: CP2102, CH340, FTDI, CH343, ESP32-S3), открывает, запускает listen() |
| `disconnect()` | Закрывает reader и port, сбрасывает флаги |
| `listen()` | Read-loop: читает чанки, декодит, сплитит по \n, вызывает addToTerminal() |
| `sendCommand()` | Проверяет clearlist, demo-mode, writable → writer.write(command + '\n') |
| `sendAndWait()` | Отправляет команду и ждёт промпт (event-driven) |
| `sendSequence()` | Последовательность команд через sendAndWait |
| `scanAll()` | scanall → stopscan → list -a (через sendSequence) |
| `clearListAndScan()` | clearlist -a → scanAll() |
| `addToTerminal()` | Экранирует HTML, уведомляет onLine-подписчиков, добавляет в terminalOutput |
| `onLine()` | Регистрирует хендлер на новые строки (возвращает unsub-функцию) |
| `_simulateDemoCommand()` | Генерирует демо-данные при нажатии кнопок в demo-режиме |

**Важные детали реализации:**

- `rawBuffer` аккумулирует неполные строки между чанками Web Serial
- При превышении 65536 байт — обрезается до последних 32768
- `addToTerminal` вызывает `_notifyLine` ДО экранирования HTML (хендлеры получают сырой текст)
- `sendCommand()` в demo-режиме вызывает `_simulateDemoCommand()` для генерации правдоподобного вывода
- `writer.releaseLock()` в `finally` блоке — гарантирует освобождение writer даже при ошибке

#### apStore.js (162 строки)
Управляет точками доступа и привязанными к ним станциями.

**Ключ Map:** BSSID в верхнем регистре (например `"AA:BB:CC:DD:EE:FF"`)

**Схема AP-объекта:**
```js
{
    index: Number|null,         // индекс из list -a (например 0, 1, 2...)
    essid: String,              // имя сети (или '(hidden)')
    bssid: String,              // MAC-адрес AP
    channel: Number|null,       // канал WiFi (1-13)
    rssi: Number|null,          // уровень сигнала в dBm
    encryption: String,         // тип шифрования (из info -a)
    isHidden: Boolean,          // скрытая сеть (без SSID)
    isSelected: Boolean,        // выбрана через select -a / чекбокс
    lastSeen: Date,             // время последнего появления
    stations: Array<Station>,   // привязанные станции
    vendor: String,             // производитель (из OUI)
    frameCount: Number,         // количество фреймов
    rssiHistory: Number[]       // история RSSI (макс 20, для спарклайна)
}
```

**Схема Station-объекта:**
```js
{
    id: Number,         // индекс станции
    mac: String,        // MAC-адрес в верхнем регистре
    vendor: String,     // производитель (из OUI)
    isSelected: Boolean,// выбрана?
    lastSeen: Date      // время последнего появления
}
```

**Ключевые методы:**

| Метод | Описание |
|-------|----------|
| `updateOrAddAP(ap)` | Создаёт или обновляет AP с дедупликацией по BSSID, сохраняет RSSI history |
| `addStation(apKey, station)` | Добавляет станцию к AP или обновляет существующую |
| `clearSelected()` | Сбрасывает isSelected у всех AP (вызывается при clearlist) |
| `updateAP(index, data)` | Обновляет поля AP по числовому индексу |
| `removeOldAPs(maxAgeMs)` | Удаляет AP старше maxAgeMs (по умолчанию 5 мин) |
| `exportData()` | Возвращает массив AP для JSON-экспорта |
| `findAPByBSSID(bssid)` | Поиск AP по MAC-адресу |
| `_findExisting(ap)` | Поиск дубликата AP: по BSSID → по индексу → по channel+essid |
| `clearAPs()` | Полная очистка списка (вызывается в demo-режиме и кнопкой Clear) |

**Вычисляемые свойства:**
```js
sortedAPs:     // Массив AP, отсортированный по RSSI (убывание)
apCount:       // Количество AP (accessPoints.size)
totalStations: // Сумма stations.length по всем AP
apByChannel:   // { channel: count } — распределение AP по каналам
avgSignal:     // Средний RSSI по всем AP (округлённый)
```

#### bleStore.js (48 строк)
Управление BLE-устройствами. Простейшее хранилище.

**Ключ Map:** MAC-адрес устройства.

**Схема BLE-объекта:**
```js
{
    mac: String,             // MAC-адрес
    name: String,            // имя устройства
    rssi: Number|null,       // уровень сигнала
    channel: Number|null,    // канал (если известен)
    manufacturer: String,    // производитель
    services: Array,         // список сервисов
    isAirtag: Boolean,       // флаг AirTag
    firstSeen: Date,         // первое обнаружение
    lastSeen: Date,          // последнее обнаружение
    packetCount: Number      // количество пакетов
}
```

#### dashboardStore.js (76 строк)
Статистика сессии, события, счётчики.

**Состояние:**
```js
commandsSent: ref(0)                     // количество отправленных команд
packetsCaptured: ref(0)                  // количество пакетов
sessionStart: ref(new Date())            // время начала сессии
events: ref([])                          // массив событий (макс 200)
tick: ref(0)                             // счётчик для sessionDuration
lastStationAPIndex: ref(null)            // индекс AP для привязки станций
lastStationAPName: ref('')               // имя AP для привязки станций
packetCounts: ref({                      // счётчики по типам
    beacon: 0, probe: 0, deauth: 0,
    eapol: 0, data: 0, management: 0
})
channelUtilization: ref({})              // утилизация каналов { ch: count }
ipList: ref([])                          // список IP-адресов
```

#### probeStore.js (33 строк)
Хранилище probe-запросов.

**Структура:** простой массив (не Map).

**Схема probe-объекта:**
```js
{
    rssi: Number,         // уровень сигнала
    ch: Number,           // канал
    clientMac: String,    // MAC клиента (верхний регистр)
    ssid: String,         // запрашиваемый SSID
    time: Date            // время перехвата
}
```

**Оптимизация:** Используется паттерн `push + reverse` вместо `unshift`:
```js
// Вместо unshift (реактивность → 500 перестроений DOM):
probes.value = [...probes.value, newProbe].slice(-500)

// В шаблоне используется reversedProbes (один computed):
const reversedProbes = computed(() => {
    const res = new Array(p.length)
    for (let i = 0; i < p.length; i++) res[i] = p[p.length - 1 - i]
    return res
})
```

### 2.3 Службы (Services)

#### commandRegistry.js (496 строк)

**Два экспорта:**

1. **`COMMAND_GROUPS`** — массив групп команд (9 групп, 66 команд):
   - Scanning (11) 📡
   - Attacks (13) ⚠
   - Bluetooth (13) 🔵
   - Lists (6) 📋
   - Selection (8) ✅
   - SSID (6) 🎲
   - MAC (4) 🎭
   - Network (10) 🌐
   - Admin (18) ⚙

   Каждая команда: `{ label, command, icon, ru, warning?, color? }`

2. **`WORKFLOWS`** — массив сценариев (18 штук):
   - Каждый: `{ id, name, description, ru, icon, warning?, steps: [...] }`
   - Типы шагов:
     - `{ command, desc, delay? }` — обычная команда
     - `{ command, desc, delay?, requiresInput: true, label, placeholder }` — с вводом
     - `{ command, desc, requiresInput: true, splitInput: true, label, placeholder }` — с вводом через запятую
     - `{ command: 'info -a {idx}', forEachAP: true }` — для каждой AP

#### parserEngine.js (464 строки)

**16 парсеров**, вызываемых последовательно из `parseLine()`:

| Порядок | Парсер | Формат ввода |
|---------|--------|-------------|
| 1 | `parseAPBeacon` | `-45 Ch: 1 AA:BB:CC:DD:EE:FF ESSID: MyWiFi` |
| 2 | `parseAPList` | `[0][CH:6] MyWiFi -65 (selected)` |
| 3 | `parseStationDetect` | `5: ap: SRC -> sta: DST` |
| 4 | `parseStationList` | `[0] MyWiFi -65:` / ` [0] AA:BB:CC:DD:EE:FF` |
| 5 | `parseDeauthSniff` | `-65 Ch: 6 SRC -> DST` |
| 6 | `parseProbeSniff` | `-45 Ch: 1 Client: MAC Requesting: SSID` |
| 7 | `parsePMKID` | `Received EAPOL: MAC` |
| 8 | `parseBLESniff` | `-45 Device: iPhone` / `-45 AA:BB:CC:DD:EE:FF` |
| 9 | `parseBLEMeta` | `Meta Device: -45 RayBan` |
| 10 | `parseSignalMonitor` | `MyWiFi RSSI: -45` |
| 11 | `parsePacketCount` | `beacon: 123` |
| 12 | `parseChannelAnalyzer` | `Ch 1: 45` |
| 13 | `parseAPInfo` | `Index: 0` → `BSSID: MAC` → `Security: ...` |
| 14 | `parseIPList` | `[0] 192.168.1.1 AA:BB:CC:DD:EE:FF` |
| 15 | `parseSystemMsg` | `[INFO] ...`, или начинается с `Starting`/`Stopping` и т.д. |

**Демо-генераторы:**
- `parseDemoAP()` — генерирует 10-25 случайных AP
- `parseDemoBLE()` — генерирует 5-12 случайных BLE-устройств
- `parseDemoPacketCounts()` — случайные счётчики пакетов
- `parseDemoChannelUtil()` — случайная утилизация каналов

**Система очистки:**
- `startParser()` — запускает интервал очистки старых AP (каждые 30 сек, удаляет AP старше 5 мин)
- `stopParser()` — очищает интервал

### 2.4 Компоненты представления

#### CommandBuilder.vue (120 строк)
- 66 кнопок в flex-wrap контейнере, сгруппированные по категориям
- **PROMPT_RULES** — 13 правил для команд, требующих ввода пользователя
- Тултипы при наведении (позиционирование с учётом краёв экрана)
- Поле кастомной команды с отправкой по Enter

**PROMPT_RULES (13 правил):**

| Команда | Regex | Prompt |
|---------|-------|--------|
| `select -a N` | `/^select -a (\d+)$/` | AP index |
| `select -a -f "contains X"` | `/^select -a -f "contains (.+)"$/` | Search text |
| `select -a -f "equals X"` | `/^select -a -f "equals (.+)"$/` | Exact SSID |
| `join -a N -p "pass"` | `/^join -a (\d+) -p "(.+)"$/` | AP index + Password |
| `add -a -b MAC -e "SSID"` | `/^add -a -b ([0-9A-F:]+) -e "(.+)"$/i` | BSSID + SSID |
| `add -c -b MAC -ap N` | `/^add -c -b ([0-9A-F:]+) -ap (\d+)$/i` | BSSID + AP index |
| `ssid -a -n "X"` | `/^ssid -a -n "(.+)"$/` | SSID name |
| `ssid -r N` | `/^ssid -r (\d+)$/` | SSID index |
| `cloneapmac -a N` | `/^cloneapmac -a (\d+)$/` | AP index |
| `clonestamac -s N` | `/^clonestamac -s (\d+)$/` | Station index |
| `info -a N` | `/^info -a (\d+)$/` | AP index |
| `led -s #HEX` | `/^led -s (#[0-9A-F]+)$/i` | Hex color |
| `brightness -s N` | `/^brightness -s (\d+)$/` | Brightness 0-9 |

#### DashboardView.vue (264 строки)
- **Live Output** (левая 1/3) — терминал с автоскроллом, HTML-форматирование, все строки
- **Статистика** (правая 2/3) — 4 карточки (APs, Stations, BLE, Pkts)
- **Топ AP** — топ-10 по RSSI с цветовой индикацией
- **Packet Breakdown** — круговая диаграмма (SVG) + бары для 6 типов пакетов
- **Channel Utilization** — бары для каждого канала
- **Панель управления** — Scan All, Scan BLE, Pkts, Ch An, Clear List, Clear, Export, Import

**Export/Import формат JSON:**
```json
{
    "version": "0.2.1",
    "exportedAt": "2026-05-30T...",
    "apCount": 42,
    "bleCount": 15,
    "aps": [ { "index": 0, "essid": "...", "bssid": "...", ... } ],
    "ble": [ { "mac": "...", "name": "...", ... } ],
    "packetCounts": { "beacon": 100, ... },
    "channelUtilization": { "1": 45, ... },
    "stats": { "commandsSent": 23, "packetsCaptured": 450 }
}
```

#### APExplorer.vue (170 строк)
- Таблица AP с колонками: #, ESSID, CH, RSSI, Signal (спарклайн SVG), BSSID, Vendor, STA, Enc, Seen
- Чекбоксы для выбора AP (отправляют `select -a <index>` на ESP32)
- Поиск и сортировка (Signal / Name / Channel / Clients)
- Разворачивание станций по клику на строку
- Индикация hidden-сетей и выбранных AP

#### BLEExplorer.vue (71 строка)
- Таблица BLE-устройств: Name, MAC, RSSI, Pkts, First, Last, Type
- Подсветка AirTag (красный фон)
- Поиск по имени или MAC

#### ProbesView.vue (65 строк)
- Таблица probe-запросов: #, SSID, Client MAC, CH, RSSI, Time
- Обратный порядок (новые сверху) через reversedProbes computed
- Счётчик уникальных клиентов

#### WorkflowBuilder.vue (343 строки)
- **Сетка карточек** для 18 сценариев (2-3 колонки)
- **Модальное окно** с пошаговым выполнением
- **Stepper** с индикацией статуса каждого шага (ожидание → выполнение → готово)
- **Ввод данных** (requiresInput) с полями и сплитом по запятой
- **forEachAP** — автоматическая итерация по всем найденным AP
- **Execution Log** — real-time лог выполнения
- **Summary** — результаты после завершения (сколько AP/BLE найдено, пакетов)
- Навигация по клику на результаты (→ APs, → BLE, → Dashboard)

#### MobileBlocker.vue (28 строк)
- Определяет мобильное устройство по userAgent и ширине экрана
- Показывает заглушку: "Desktop Only — Web Serial API unavailable on mobile"
- Следит за resize (на случай поворота)

### 2.5 Утилиты (Utils)

#### format.js (33 строки)
```js
signalClass(rssi)   // → CSS-класс для RSSI (> -70: emerald, > -85: amber, иначе red)
dotClass(rssi)      // → CSS-класс для точки индикации
fmtTimeRelative(t)  // → "5s", "3m", "1h"
fmtTimeHM(t)        // → "14:30"
fmtTimeHMS(t)       // → "14:30:22"
```

#### toast.js (20 строк)
```js
useToast() → { toasts, show(message, type, duration), remove(id) }
// type: 'info' | 'success' | 'error' | 'warning'
// duration: 3000ms default
// toasts: глобальный ref (один на всё приложение)
```

#### oui.js (1155 строк)
- База MAC-префиксов: ~300+ вендоров (Cisco, Apple, Samsung, TP-LINK, Xiaomi, Huawei, Intel, Microsoft и др.)
- `lookupVendor(mac)` → ищет первые 3 байта MAC в OUI_DB

#### demoData.js (87 строк)
- `generateDemoData()` → массив случайных AP со станциями
- `generateDemoTerminalOutput()` → массив HTML-строк, имитирующих вывод терминала

### 2.6 Граф зависимостей

```
App.vue
├── serialStore
│   └── apStore (static import)
│   └── parserEngine (static import)
│       ├── apStore
│       ├── bleStore
│       ├── dashboardStore
│       ├── probeStore
│       └── oui
│   └── demoData (indirect via _simulateDemoCommand)
├── apStore
├── bleStore
├── dashboardStore
├── probeStore
├── parserEngine
├── demoData
├── toast

CommandBuilder.vue
├── serialStore
├── dashboardStore
├── commandRegistry

DashboardView.vue
├── serialStore
├── apStore
├── bleStore
├── dashboardStore
├── format
├── toast

APExplorer.vue
├── serialStore
├── apStore
├── format
├── oui
├── toast

WorkflowBuilder.vue
├── serialStore
├── apStore
├── bleStore
├── dashboardStore
├── commandRegistry

BLEExplorer.vue
├── serialStore
├── bleStore
├── format

ProbesView.vue
├── serialStore
├── probeStore
├── format
```

**Важное:** Циклических зависимостей нет. `apStore` и `parserEngine` не импортируют `serialStore`.

---

## 3. История патчей (Changelog)

### 3.1 v0.2.1 — Critical fixes (30.05.2026)

#### 🔧 Critical Bug: sendAndWait не детектит промпт ESP32 (30.05.2026)

**Проблема:** Функция `sendAndWait()` проверяла `line.startsWith('> ')`, но строка промпта `> ` обрезается до `>` при `trim()`. Для `>` длиной 1 символ проверка `startsWith('> ')` всегда возвращала `false`. Workflows зависали на первом шаге до таймаута.

**Решение:** Заменено на `PROMPT_RE.test(line)` — проверка через регулярное выражение, которое корректно обрабатывает `>`, `> `, `esp32marauder>`, `esp32marauder> `.

**Файл:** `src/stores/serialStore.js:216`

#### 🔧 Fix: sendSequence заменён на sendAndWait (30.05.2026)

**Проблема:** `sendSequence` использовал `sendCommand + setTimeout(fixed delay)`, что приводило к race conditions.

**Решение:** Заменено на `sendAndWait` — команды теперь ждут промпта ESP32.

**Файл:** `src/stores/serialStore.js:231-241`

#### 🔧 Fix: Таймауты sendAndWait логируются (30.05.2026)

**Проблема:** При таймауте `sendAndWait` молча резолвился, пользователь не видел ошибки.

**Решение:** Добавлен `addToTerminal('Timed out waiting for prompt after: ...', 'warning')`.

**Файл:** `src/stores/serialStore.js:224-225`

#### 🔧 Fix: Demo-режим теперь уважает таймауты (30.05.2026)

**Проблема:** `sendAndWait` в demo-режиме всегда ждал 500ms независимо от настроек шага.

**Решение:** `setTimeout(resolve, Math.min(timeout, 500))`.

**Файл:** `src/stores/serialStore.js:211`

#### 🔧 Fix: Динамические импорты заменены на статические (30.05.2026)

**Проблема:** Race condition между `import().then()` и синхронным кодом в demo-режиме.

**Решение:** Статические `import` в начале файла.

**Файл:** `src/stores/serialStore.js:3-4`

#### 🔧 Fix: Кнопки в demo-режиме не генерировали данные (30.05.2026)

**Проблема:** Нажатие кнопок в demo-режиме добавляло только `> cmdname` в терминал без реальных данных.

**Решение:** Добавлена `_simulateDemoCommand()` — для каждой команды генерирует правдоподобный вывод.

**Файл:** `src/stores/serialStore.js:167-203`

#### 🛡️ Fix: version sync 0.2.1 + vite base (30.05.2026)

**Проблема:** package.json версия 0.2.0 (не синхронизирована с документацией), vite base `/` (не работает на GitHub Pages).

**Решение:** `package.json: "version": "0.2.1"`, `vite.config.js: base: "/marauder-ui/"`.

**Файлы:** `package.json`, `vite.config.js`

#### 🔧 Fix: apStore BSSID-ключи (29.05.2026)

**Проблема:** Mesh-сети с одинаковым SSID на одном канале теряли данные из-за коллизии ключей `{channel}-{essid}`.

**Решение:** Map-ключ заменён на `BSSID.toUpperCase()` с fallback-поиском.

**Файл:** `src/stores/apStore.js`

#### 🔧 Fix: Event-driven очередь вместо setTimeout (29.05.2026)

**Проблема:** Workflows с setTimeout теряли команды при загруженном UART-буфере.

**Решение:** `sendAndWait()` с детекцией промпта.

**Файлы:** `src/stores/serialStore.js`, `src/components/workflow/WorkflowBuilder.vue`

#### 🔧 Fix: 13 команд с prompt-диалогами (29.05.2026)

**Проблема:** 13 команд (join, add, clone и др.) имели захардкоженные аргументы.

**Решение:** `PROMPT_RULES` с regex и `window.prompt()`.

**Файл:** `src/components/CommandBuilder.vue`

#### 🛡️ Fix: Синхронизация выбора AP (29.05.2026)

**Проблема:** `clearlist -a` не сбрасывал `isSelected`, оставались phantom-галочки.

**Решение:** `clearSelected()` при clearlist.

**Файлы:** `serialStore.js`, `apStore.js`

#### ⚡ Fix: probeStore push+reverse (29.05.2026)

**Проблема:** `unshift()` вызывал 500 перестроений DOM на каждый probe.

**Решение:** `push()` + `reversedProbes` computed.

**Файлы:** `probeStore.js`, `ProbesView.vue`

#### ⚡ Fix: beforeunload stopscan (29.05.2026)

**Проблема:** Закрытие вкладки не останавливало атаки.

**Решение:** `window.addEventListener('beforeunload', sendStop)`.

**Файл:** `App.vue`

### 3.2 v0.2.0 — Initial release

**Релиз:** 29.05.2026

**Возможности:**
- Базовая архитектура Vue 3 + Pinia + Web Serial API
- 66 команд в 9 группах
- 18 сценариев
- 16 парсеров вывода ESP32
- Dashboard с Live Output и статистикой
- AP Explorer, BLE Explorer, ProbesView
- Demo-режим
- Mobil-блокировка
- GitHub Pages CI/CD

---

## 4. Схемы данных и API

### 4.1 apStore — Точки доступа

**Тип:** `Map<String, APObject>` (ключ: BSSID в верхнем регистре)

```js
Map {
    "AA:BB:CC:DD:EE:FF" => {
        // Идентификация
        index: 0,                    // Number | null — из list -a
        essid: "MyWiFi",             // String — имя сети
        bssid: "AA:BB:CC:DD:EE:FF",  // String — MAC-адрес

        // Радио
        channel: 6,                  // Number | null — 1..13
        rssi: -65,                   // Number | null — dBm

        // Безопасность
        encryption: "WPA2",          // String — из info -a

        // UI состояние
        isHidden: false,             // Boolean
        isSelected: true,            // Boolean — галочка в UI

        // Метаданные
        lastSeen: Date,              // последнее появление
        vendor: "TP-LINK",           // String — из OUI
        frameCount: 142,             // Number — количество фреймов

        // История
        rssiHistory: [-65, -67, -63], // Number[] — макс 20 значений

        // Станции
        stations: [
            {
                id: 0,               // Number — индекс станции
                mac: "11:22:33:44:55:66",  // String — MAC клиента
                vendor: "Intel",        // String
                isSelected: false,      // Boolean
                lastSeen: Date          // последняя активность
            }
        ]
    },
    "FF:EE:DD:CC:BB:AA" => { ... }
}
```

**Размер:** Не ограничен явно. Старые AP (старше 5 мин) удаляются автоматически каждые 30 сек.

### 4.2 bleStore — BLE-устройства

**Тип:** `Map<String, BLEObject>` (ключ: MAC-адрес)

```js
Map {
    "AA:BB:CC:DD:EE:FF" => {
        mac: "AA:BB:CC:DD:EE:FF",    // String
        name: "iPhone 15 Pro",       // String
        rssi: -45,                   // Number | null
        channel: 37,                 // Number | null — BLE канал (37/38/39)
        manufacturer: "Apple",       // String
        services: ["0x180F", "0x180A"],  // Array<String>
        isAirtag: false,             // Boolean
        firstSeen: Date,
        lastSeen: Date,
        packetCount: 23              // Number
    }
}
```

**Размер:** Не ограничен явно. AirTag устройства подсвечиваются красным в UI.

### 4.3 probeStore — Probe-запросы

**Тип:** `Array<ProbeObject>`

```js
[
    {
        rssi: -55,           // Number
        ch: 6,               // Number
        clientMac: "AA:BB:CC:DD:EE:FF",  // String (upper case)
        ssid: "HomeWiFi",    // String — запрашиваемая сеть
        time: Date           // время перехвата
    }
]
```

**Размер:** Макс 500 записей (автоматическое ограничение в `addProbe`).

### 4.4 dashboardStore — Статистика

**Типы:**

```js
// Счётчики
commandsSent: 42              // Number
packetsCaptured: 1523         // Number
sessionStart: Date

// События (макс 200)
events: [
    { type: "beacon" | "deauth" | "probe" | "pmkid" | "ble" | "signal" | "system",
      data: "сырая строка",
      time: Date }
]

// Счётчики пакетов
packetCounts: {
    beacon: 450,
    probe: 120,
    deauth: 34,
    eapol: 5,
    data: 890,
    management: 24
}

// Утилизация каналов
channelUtilization: {
    1: 45,
    6: 120,
    11: 78
}

// Вспомогательные поля для парсера
lastStationAPIndex: 2         // Number | null
lastStationAPName: "MyWiFi"    // String

// IP-лист
ipList: [
    { index: 0, ip: "192.168.1.1", mac: "AA:BB:CC:DD:EE:FF" }
]
```

### 4.5 serialStore — Сериальный порт

**Типы:**

```js
port: SerialPort | null            // нативный объект Web Serial API
reader: ReadableStreamDefaultReader | null
readLoopActive: boolean
isConnected: boolean
isDemoMode: boolean
terminalOutput: string[]           // HTML-строки, макс 2000
rawBuffer: string                  // неполные чанки, макс 65536
baudRate: 115200                   // number
_lineHandlers: Function[]          // подписчики onLine (приватное)
```

### 4.6 Web Serial API

**Используемые возможности:**

| API | Метод | Назначение |
|-----|-------|------------|
| `navigator.serial.requestPort()` | async | Запрос порта у пользователя |
| `port.open({ baudRate })` | async | Открытие порта (115200 бод) |
| `port.readable.getReader()` | sync | Получение reader для чтения |
| `port.writable.getWriter()` | sync | Получение writer для записи |
| `reader.read()` | async | Чтение чанка данных (Uint8Array) |
| `writer.write(data)` | async | Запись команды (TextEncoder) |
| `reader.cancel()` | async | Отмена чтения |
| `port.close()` | async | Закрытие порта |

**Фильтры USB-устройств при запросе порта:**

| Устройство | Vendor ID | Product ID |
|-----------|-----------|------------|
| CP2102 (SiLabs) | `0x10C4` | `0xEA60` |
| CH340 (WCH) | `0x1A86` | `0x7523` |
| FTDI | `0x0403` | `0x6001` |
| CH343 (WCH) | `0x1A86` | `0x55D4` |
| ESP32-S3 | `0x303A` | `0x1001` |

### 4.7 Парсеры (Parser Engine)

**API парсера:**

```js
// Единственная точка входа
parseLine(line: string): void

// Демо-генераторы
parseDemoAP(): void          // 10-25 случайных AP
parseDemoBLE(): void         // 5-12 случайных BLE
parseDemoPacketCounts(): void
parseDemoChannelUtil(): void

// Жизненный цикл
startParser(): void          // запускает интервал очистки
stopParser(): void           // останавливает интервал
```

**MAC-регулярка (используется во всех парсерах):**
```js
const MAC_RE = /([0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2})/
```

**Вендорский кэш:**
```js
const _vendorCache = new Map()  // приватный кэш результатов lookupVendor
```

---

## 5. Дорожная карта (Roadmap)

### 5.1 Текущие задачи

| Задача | Приоритет | Статус |
|--------|-----------|--------|
| Включить GitHub Pages в настройках репозитория | 🔴 High | ⏳ Pending |
| Создать релиз v0.2.1 с описанием изменений | 🟢 Low | ✅ Done |
| Проверить сборку `npm run build` на чистой `node_modules` | 🟡 Medium | ⏳ Pending |

### 5.2 Ближайшие задачи (1-2 недели)

| Задача | Приоритет | Оценка |
|--------|-----------|--------|
| **Виртуализация терминала** — `vue-virtual-scroller` для terminalOutput (2000 строк → DOM-узлы только видимые) | 🔴 High | 4h |
| **Перехват ошибок Web Serial** — обработка потери соединения, авто-переподключение | 🔴 High | 3h |
| **Кэш regex-шаблонов** — все `new RegExp(...)` в парсерах вынести в константы | 🟡 Medium | 1h |
| **Оптимизация sortedAPs** — computed с мемоизацией для больших списков | 🟡 Medium | 2h |
| **Добавить обновление `caniuse-lite`** — `npx update-browserslist-db@latest` | 🟢 Low | 5min |
| **Автоматическая очистка terminalOutput** при достижении лимита (вместо slice) | 🟢 Low | 1h |

### 5.3 Среднесрочные задачи (1-2 месяца)

| Задача | Приоритет | Описание |
|--------|-----------|----------|
| **Темная/светлая тема** | 🟡 Medium | Tailwind dark mode, переключатель в хедере |
| **Drag-and-drop сценариев** | 🟡 Medium | Редактор порядка шагов в WorkflowBuilder |
| **Горячие клавиши** | 🟡 Medium | Ctrl+Enter для отправки команды, Esc для отмены |
| **История команд** | 🟡 Medium | Хранение последних N команд, повторный запуск |
| **Фильтр по типу пакетов** | 🟢 Low | Возможность показывать только beacon/deauth и т.д. |
| **Статистика в реальном времени** | 🟢 Low | Графики RSSI, загрузки каналов |
| **Экспорт в CSV/Wigle** | 🟢 Low | Дополнительные форматы экспорта |
| **Поиск по OUI в AP Explorer** | 🟢 Low | Фильтр по вендору |

### 5.4 Долгосрочные задачи (3+ месяца)

| Задача | Приоритет | Описание |
|--------|-----------|----------|
| **Сохранение сессии в localStorage** | 🟡 Medium | Автосохранение данных между обновлениями |
| **Tauri/Electron десктоп-приложение** | 🟢 Low | Упаковка в нативное приложение |
| **Расширение функционала сценариев** | 🟢 Low | Условные шаги, циклы, параллельное выполнение |
| **Интеграция с внешними API** | 🟢 Low | Wigle.net, Shodan |
| **Поддержка нескольких ESP32** | 🟢 Low | Переключение между устройствами |
| **PWA (Progressive Web App)** | 🟢 Low | Офлайн-режим, установка на рабочий стол |

### 5.5 Архив (выполнено)

| Задача | Версия | Дата |
|--------|--------|------|
| BSSID-based ключи в apStore | v0.2.1 | 29.05.2026 |
| Event-driven очередь команд | v0.2.1 | 29.05.2026 |
| Prompt-диалоги для 13 команд | v0.2.1 | 29.05.2026 |
| Синхронизация выбора AP | v0.2.1 | 29.05.2026 |
| probeStore push+reverse | v0.2.1 | 29.05.2026 |
| beforeunload stopscan | v0.2.1 | 29.05.2026 |
| Export/Import сессии | v0.2.1 | 29.05.2026 |
| Chunked data handling | v0.2.1 | 29.05.2026 |
| sendAndWait prompt fix | v0.2.1 | 30.05.2026 |
| sendSequence → sendAndWait | v0.2.1 | 30.05.2026 |
| Demo mode simulation | v0.2.1 | 30.05.2026 |
| Static imports (race fix) | v0.2.1 | 30.05.2026 |
| GitHub Pages base fix | v0.2.1 | 30.05.2026 |

---

## 6. Известные проблемы, технический долг и ограничения

### 6.1 Критические проблемы

| ID | Проблема | Статус | План |
|----|----------|--------|------|
| P-001 | **GitHub Pages не включён** — workflow падает с ошибкой "Current plan does not support GitHub Pages" | ⏳ | Включить вручную в Settings → Pages → GitHub Actions |
| P-002 | **caniuse-lite устаревшая** (19 месяцев) — не влияет на функционал, но warning при сборке | 🟡 | `npx update-browserslist-db@latest` |

### 6.2 Технический долг

| ID | Долг | Влияние | Приоритет |
|----|------|---------|-----------|
| TD-01 | `sortedAPs` computed пересчитывается при любом изменении Map (даже если не влияет на порядок) | Производительность при >100 AP | 🟡 Medium |
| TD-02 | Нет мемоизации regex-шаблонов в парсерах (каждый вызов `parseLine` создаёт новые RegExp) | Производительность | 🟡 Medium |
| TD-03 | `terminalOutput` — 2000 DOM-узлов в v-for без виртуализации | Производительность, память | 🔴 High |
| TD-04 | Все 5 stores используют `ref` вместо `shallowRef` для больших коллекций (Map/Array) | Производительность (deep reactivity) | 🟡 Medium |
| TD-05 | Нет тестов (unit / e2e) | Надёжность | 🔴 High |
| TD-06 | `WorkflowBuilder` использует busy-wait `while(!input) await sleep(100)` | CPU (хотя и минимально) | 🟢 Low |
| TD-07 | Нет TypeScript — все файлы на чистом JS | Масштабируемость | 🟢 Low |
| TD-08 | Tooltip в CommandBuilder использует фиксированную высоту (150px) | Отображение при длинном тексте | 🟢 Low |
| TD-09 | `clearlist -a` в не-demo режиме не очищает локальный список AP (только clearSelected) | Рассинхронизация с ESP32 | 🟡 Medium |
| TD-10 | Нет интернационализации (i18n) — смесь русского и английского | UX для нерусскоязычных | 🟢 Low |

### 6.3 Ограничения

#### Технологические
- **Только Chrome/Edge** — Web Serial API не поддерживается другими браузерами
- **Только Desktop** — MobileBlocker блокирует мобильные устройства (нет Web Serial)
- **Только HTTPS или localhost** — Web Serial API требует безопасного контекста
- **SPA без бэкенда** — все данные в оперативной памяти, теряются при обновлении страницы
- **Pinia в памяти** — нет персистентности между сессиями (кроме ручного Export/Import)

#### Функциональные
- **Нет автоматического определения порта** — пользователь должен выбрать порт вручную
- **Нет переподключения** — при потере соединения нужно нажать Connect заново
- **Нет батчевого парсинга** — каждая строка парсится отдельно (2000 строк → 2000 вызовов)
- **Ограниченная поддержка GPS** — только отображение, нет карты
- **Нет пакетной обработки проб** — 500 лимит жёсткий (slice), без группировки

#### Аппаратные
- **Зависит от прошивки Marauder** — вывод ESP32 должен соответствовать ожидаемым форматам
- **115200 бод** — фиксированная скорость порта
- **USB-UART драйверы** — требуются драйверы CP2102/CH340/FTDI

### 6.4 Частые проблемы пользователей

#### "Deauth All пишет 'нужно выбрать сеть'"
**Причина:** ESP32 требует `select -a <index>` перед атакой.  
**Решение:** Поставьте галочки напротив нужных AP в AP Explorer → нажмите Deauth All.

#### "Порт не определяется / не подключается"
**Причины:** Нет драйверов, USB-кабель только для питания, порт занят другим приложением (Arduino IDE, PuTTY).  
**Решение:** Установите драйвер CH340/CP2102, используйте data-кабель, закройте другие приложения.

#### "Live Output пустой"
**Причины:** Не на вкладке Dashboard, нет подключения, не включён demo-режим.  
**Решение:** Переключитесь на Dashboard, подключитесь к ESP32 или включите Try Demo.

#### "После атаки пакеты не останавливаются"
**Причина:** Атаки не имеют таймаута.  
**Решение:** Нажмите ■ Stop в шапке или кнопку Stopscan.

#### "Данные пропали после обновления страницы"
**Причина:** SPA хранит всё в оперативной памяти.  
**Решение:** Используйте Export перед обновлением, Import после.

#### "Команда не отправляется"
**Причина:** Prompt-диалог ожидает ввода (для 13 команд с PROMPT_RULES).  
**Решение:** Введите значение или нажмите Cancel (команда не отправится).

---

## 7. Развертывание и конфигурация окружения

### 7.1 Требования

#### Для разработки
- **Node.js** 18+ (проверить: `node --version`)
- **npm** 9+ (проверить: `npm --version`)
- **Git** 2.30+ (проверить: `git --version`)
- **GitHub CLI** (опционально, для релизов: `gh --version`)
- **Chrome 89+** или **Edge 89+** (для Web Serial API)

#### Для подключения ESP32
- **ESP32** с прошивкой Marauder
- **Драйверы USB-UART**: [CH341SER](https://www.wch.cn/download/CH341SER_EXE.html) или CP210x
- **Data-кабель USB** (не только зарядный!)

### 7.2 Локальная разработка

```bash
# 1. Клонировать репозиторий
git clone https://github.com/bapyha-netizen/marauder-ui.git
cd marauder-ui

# 2. Установить зависимости
npm install

# 3. Запустить dev-сервер (с HMR)
npm run dev
# → http://localhost:3000

# 4. Для production-сборки
npm run build
npm run preview
```

**start.bat** (для Windows без ручного запуска команд):
```batch
@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "C:\Users\user\Desktop\ESP32\marauder-ui"
npx vite build
npx serve dist --port 3000 --no-clipboard
pause
```

### 7.3 Сборка для продакшна

```bash
npm run build
# Результат: dist/
#   index.html       0.70 kB (gzip: 0.41 kB)
#   assets/...css    34.88 kB (gzip: 5.77 kB)
#   assets/...js    182.93 kB (gzip: 62.76 kB)
```

**Важно:** После сборки проверить, что `base` в `vite.config.js` правильный:
- Для GitHub Pages: `base: "/marauder-ui/"`
- Для локального теста: можно `base: "/"`

### 7.4 Развертывание на GitHub Pages

**Автоматический (CI/CD):**

В репозитории уже настроен `.github/workflows/deploy.yaml`:
```yaml
on:
  push:
    branches: ['main']
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4 (node-version: 20)
      - run: npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3 (path: ./dist)
      - uses: actions/deploy-pages@v4
```

**Ручная настройка (один раз):**
1. Зайдите в Settings → Pages
2. Source: **GitHub Actions** (выберите workflow deploy.yaml)
3. Готово — при каждом пуше в main сайт будет собираться и деплоиться

**Ручной деплой:**
```bash
npm run build
npx gh-pages -d dist
```

### 7.5 Конфигурация Vite

**Файл:** `vite.config.js`

```js
export default defineConfig({
    base: "/marauder-ui/",           // Для GitHub Pages
    plugins: [vue()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')  // @ → src/
        }
    },
    server: {
        port: 3000                   // dev-сервер на порту 3000
    }
})
```

### 7.6 Конфигурация Tailwind CSS

**Файл:** `tailwind.config.js`

```js
export default {
    content: ["./index.html", "./src/**/*.{vue,js}"],
    theme: {
        extend: {
            fontFamily: {
                mono: ['Consolas', 'Courier New', 'monospace']
            }
        }
    },
    plugins: []
}
```

**Основные кастомные классы (в `src/assets/style.css`):**
- `.panel` — карточка с фоном и скруглением
- `.btn` — базовый стиль кнопки
- `.btn-primary` / `.btn-success` / `.btn-danger` / `.btn-warning` / `.btn-ghost` / `.btn-emergency`
- `.btn-sm` / `.btn-icon` — размеры кнопок
- `.input` — стиль поля ввода
- `.badge-blue` / `.badge-green` / `.badge-red` / `.badge-amber` — бейджи
- `.tag` — метка
- `.scrollbar-thin` — тонкий скроллбар

### 7.7 Переменные окружения

Приложение не использует переменные окружения (`.env`). Все настройки:
- `baudRate` — 115200 (жёстко в serialStore)
- `base` — `/marauder-ui/` (в vite.config.js)
- `port` — 3000 (в vite.config.js)
- `AP_MAX_AGE` — 300000ms (5 мин, в parserEngine.js)
- `CLEANUP_INTERVAL` — 30000ms (30 сек, в parserEngine.js)

---

## 8. Стандарты кодирования

### 8.1 Общие принципы

- **Vue 3 Composition API** с `<script setup>` для всех компонентов
- **Pinia Composition API** (setup-синтаксис) для всех хранилищ
- **ESLint**: нет (проект малый, но рекомендуется добавить)
- **Prettier**: нет (но рекомендуется для единообразия)
- **Комментарии**: только где логика неочевидна (в идеале — самодокументирующийся код)

### 8.2 Vue 3 + Composition API

```js
// ✅ ПРАВИЛЬНО: Composition API с <script setup>
<script setup>
import { ref, computed, watch } from 'vue'
import { useSerialStore } from '../../stores/serialStore'

const serialStore = useSerialStore()
const localState = ref('')

const computedValue = computed(() => localState.value.toUpperCase())

watch(localState, (newVal) => {
    console.log(newVal)
})
</script>
```

```js
// ❌ НЕПРАВИЛЬНО: Options API
export default {
    data() { return { localState: '' } },
    computed: { computedValue() { ... } },
    watch: { localState() { ... } }
}
```

### 8.3 Pinia Stores

```js
// ✅ ПРАВИЛЬНО: Setup-синтаксис
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useMyStore = defineStore('my', () => {
    // Состояние (ref)
    const items = ref(new Map())

    // Геттеры (computed)
    const sortedItems = computed(() => ...)

    // Действия (функции)
    function addItem(item) { ... }
    function clearItems() { items.value = new Map() }

    return { items, sortedItems, addItem, clearItems }
})
```

```js
// ❌ НЕПРАВИЛЬНО: Options-синтаксис
export const useMyStore = defineStore('my', {
    state: () => ({ items: new Map() }),
    getters: { sortedItems() { ... } },
    actions: { addItem() { ... } }
})
```

**Правила для stores:**
- `ref()` для состояния, `computed()` для геттеров, функции для действий
- Всегда возвращайте публичный API в `return`
- Приватные поля начинайте с `_` (например `_lineHandlers`, `_infoAPIndex`)
- Для сложных объектов (Map, Set) используйте ручную реактивность: `new Map(original)` → присваивание

### 8.4 Именование

| Сущность | Стиль | Пример |
|----------|-------|--------|
| Компоненты | PascalCase | `APExplorer.vue`, `DashboardView.vue` |
| Файлы (кроме vue) | camelCase | `serialStore.js`, `parserEngine.js` |
| Функции | camelCase | `sendCommand()`, `updateOrAddAP()` |
| Переменные | camelCase | `isConnected`, `rawBuffer` |
| Константы | UPPER_SNAKE | `MAC_RE`, `CLEANUP_INTERVAL` |
| Stores | camelCase + Store | `useSerialStore`, `useApStore` |
| События | kebab-case в шаблоне | `@navigate="handler"` |
| CSS классы | BEM-like (Tailwind) | `btn-primary`, `badge-blue` |

### 8.5 Компоненты

**Структура SFC:**
```html
<template>
    <!-- 1. HTML-шаблон -->
</template>

<script setup>
// 2. Импорты (сторонние → локальные)
import { ref } from 'vue'
import { useStore } from './store'

// 3. Store-инициализация
const store = useStore()

// 4. Локальное состояние
const localState = ref('')

// 5. Вычисляемые свойства
const comp = computed(() => ...)

// 6. watch, lifecycle
watch(..., () => { ... })
onMounted(() => { ... })

// 7. Функции-обработчики
const handleClick = () => { ... }
</script>
```

**Импорты:**
```js
// 1. Внешние зависимости
import { ref, computed } from 'vue'

// 2. Внутренние модули (по возрастанию глубины)
import { useSerialStore } from '../../stores/serialStore'
import { signalClass } from '../../utils/format'
import { useToast } from '../../utils/toast'
```

### 8.6 Обработка ошибок

```js
// ✅ ПРАВИЛЬНО: try/catch + finally для освобождения ресурсов
try {
    const writer = port.value.writable.getWriter()
    try {
        await writer.write(data)
    } finally {
        writer.releaseLock()  // гарантированное освобождение
    }
} catch (e) {
    addToTerminal(`Failed: ${e.message}`, 'error')
}

// ✅ ПРАВИЛЬНО: игнорирование предсказуемых ошибок
try { await reader.cancel() } catch (_) { /* ignore */ }

// ❌ НЕПРАВИЛЬНО: пустой catch без комментария
try { ... } catch (e) {}
```

### 8.7 Git-конвенции

```bash
# Формат коммитов:
# <type>: <short description>
#
# types:
#   feat    — новый функционал
#   fix     — исправление бага
#   refactor— рефакторинг без изменения поведения
#   perf    — оптимизация производительности
#   docs    — документация
#   style   — форматирование, CSS
#   chore   — технические изменения (зависимости, конфиги)

# Примеры:
git commit -m "fix: sendAndWait prompt detection for trimmed '>' prompt"
git commit -m "feat: add demo mode simulation for all commands"
git commit -m "perf: replace unshift with push+reverse in probeStore"
git commit -m "docs: add comprehensive project architecture guide"
```

**Ветки:**
- `main` — стабильная, production-ready
- `develop` — для разработки (если команда > 1)
- `feature/*` — для новых фич
- `fix/*` — для багфиксов

### 8.8 Безопасность

- **Экранирование HTML**: Всегда через `escHtml()` перед вставкой в `v-html`
  ```js
  const escHtml = (s) => s
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
  ```
- **Никаких секретов** в коде (токенов, паролей, ключей API)
- **v-html** только для терминала (где контент экранирован)
- **Никаких eval()**, Function(), innerHTML из непроверенных источников

---

## 9. Приложение: Все команды и сценарии

*Полный список 66 команд и 18 сценариев — см. вкладку Help в приложении.*

**Быстрый доступ к DOCUMENTATION.md** — в корне проекта, 606 строк, с детальным описанием каждой кнопки.

---

*Документация создана 30.05.2026 для версии 0.2.1*  
*Автор: bapyha-netizen*  
*Репозиторий: https://github.com/bapyha-netizen/marauder-ui*  
*GitHub Pages: https://bapyha-netizen.github.io/marauder-ui/*  
