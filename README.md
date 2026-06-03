# Marauder UI — документация

**Версия:** 0.5.2 (build 2026-06-03)
**Прошивка:** [ESP32 Marauder](https://github.com/justcallmekoko/ESP32Marauder) by justcallmekoko
**Назначение:** Desktop/web UI для управления ESP32 с прошивкой Marauder через Web Serial API

---

## Содержание

1. [Что это такое](#что-это-такое)
2. [Архитектура](#архитектура)
3. [Быстрый старт](#быстрый-старт)
4. [Подключение к ESP32](#подключение-к-esp32)
5. [Интерфейс](#интерфейс)
6. [Команды](#команды)
7. [Сценарии](#сценарии)
8. [Speaker Hunter](#speaker-hunter)
9. [Парсер данных](#парсер-данных)
10. [Demo-режим](#demo-режим)
11. [Советы](#советы)
12. [Производительность](#производительность)
13. [Безопасность](#безопасность)
14. [Changelog](#changelog)
15. [Юридическое предупреждение](#юридическое-предупреждение)

---

## Что это такое

Marauder UI — графический интерфейс для **ESP32 Marauder**. Приложение работает полностью локально в браузере (Chrome/Edge). Весь обмен данными — через USB (Web Serial API). Никаких серверов, никакого бэкенда.

### Возможности

- 📡 **Сканирование WiFi** — `scanall`, `sniffbeacon`, `sniffprobe`, `sniffdeauth`, `sniffpmkid`, `sniffraw`, `sniffsae`, `sigmon`, `mactrack`
- 🔵 **Bluetooth** — `sniffbt` (AirTag/Flipper/Flock/Meta/Speakers), `blespam` (11 типов), `sniffskim`, `spoofat`
- 🔊 **Атаки на колонки** — Speaker Hunter (поиск + атака), Speaker Kill (агрессивный спам), целевые атаки по брендам (JBL/Bose/Sony/Marshall)
- ⚡ **Атаки** — deauth, beacon spam (random/list/clone), probe spam, rickroll, badmsg, sleep, sae, csa, quiet, funny
- 📊 **Дашборд** — Live Output, статистика AP/Stations/BLE/Pkts, топ-10 AP, лента событий
- 📋 **Таблицы** — AP Explorer (с раскрытием станций, сортировкой, поиском), BLE Explorer (с подсветкой AirTag)
- 🗺 **Wardraving** — GPS-трекинг с записью в Wigle-формате, отметки POI, NMEA
- ⚡ **Сценарии** — 20 готовых сценариев (рекон, атаки, BLE, GPS, колонки)
- 🔌 **Demo-режим** — работа без ESP32 для ознакомления
- 🆘 **Emergency Stop** — кнопка немедленной остановки в хедере
- ⚡ **Производительность** — 10-100x оптимизации для потокового режима (1000 строк/сек)
- 🔒 **Безопасность** — USB vendor whitelist, beforeunload persistence, memory bounds, ARIA labels

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

### Структура проекта

```
src/
├── stores/                      # Pinia stores (TypeScript)
│   ├── serialStore.ts           # Serial-порт, терминал, команды
│   ├── apStore.ts               # Точки доступа + станции + maintained indexes
│   ├── bleStore.ts              # BLE-устройства
│   ├── dashboardStore.ts        # Статистика, события, парсинг станций
│   └── probeStore.ts            # Probe-запросы
├── services/                    # Business logic (TypeScript)
│   ├── parserEngine.ts          # Парсер-диспетчер → firmware profile
│   ├── firmwareProfiles/
│   │   ├── marauderV1.ts        # Парсеры для текущей прошивки
│   │   └── index.ts             # Реестр профилей
│   ├── serialReader.ts          # Read loop, TextDecoder, buffer trimming
│   ├── commandExecutor.ts       # sendCommand, sendAndWait, sendSequence
│   ├── serialReconnect.ts       # Auto-reconnect, device plug/unplug
│   ├── commandRegistry.ts       # 77 команд, 9 групп, 20 сценариев
│   └── commandMeta.ts           # Метаданные команд (severity, target, needsTarget)
├── components/
│   ├── dashboard/               # DashboardView (Live Output + статистика + кнопки атак)
│   ├── ap/                      # APExplorer (таблица AP/станций)
│   ├── ble/                     # BLEExplorer (таблица BLE)
│   ├── probes/                  # ProbesView (таблица probe-запросов)
│   ├── workflow/                # WorkflowBuilder (сценарии)
│   ├── help/                    # HelpGuide (справка с поиском)
│   └── ConfirmDialog.vue        # Диалог подтверждения
├── utils/                       # Утилиты (TypeScript)
│   ├── sanitize.ts              # sanitizeText, sanitizeAscii, normalizeMac, safeParseInt
│   ├── uuid.ts                  # UUID v4 + recordKey для IndexedDB
│   ├── logger.ts                # Ring-buffer logger с уровнями
│   ├── metrics.ts               # Rolling counters: lines/sec, parser dispatches
│   ├── persist.ts               # Debounced IndexedDB persistence + beforeunload
│   ├── idb.ts                   # IndexedDB wrapper
│   ├── format.ts                # signalClass, fmtTime, dotClass
│   ├── toast.ts                 # Система toast-уведомлений
│   ├── oui.ts                   # OUI vendor lookup
│   ├── demoData.ts              # Демо-генератор
│   └── wigle.ts                 # Wigle CSV экспорт
├── composables/
│   └── useContextAction.ts      # Композабл для действий над AP/BLE
├── types/                       # TypeScript definitions
│   ├── index.ts                 # Core types (AccessPoint, BLEDevice, etc.)
│   ├── parser.ts                # ParserContext, FirmwareProfile
│   ├── serial.ts                # SerialPortInfo, TerminalLineType
│   └── command.ts               # CommandDef, Scenario
├── assets/
│   └── style.css                # Tailwind + компонентные классы
├── App.vue                      # Root: tabs + header + status bar + toasts
├── main.js                      # Точка входа
├── env.d.ts                     # Web Serial API type declarations
├── tsconfig.json                # TypeScript config (incremental migration)
└── vite.config.ts               # Vite + vue-tsc checker
```

---

## Быстрый старт

```bash
git clone https://github.com/anomalyco/marauder-ui.git
cd marauder-ui
npm install
npm run dev
```

Откройте `http://localhost:3000`

**Требования:**
- Chrome 89+ или Edge 89+
- ESP32 с прошивкой Marauder (CH340/CP2102 драйвер)
- Node.js 18+

---

## Подключение к ESP32

1. Подключите ESP32 к USB
2. Откройте `http://localhost:3000` в Chrome/Edge
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
| Espressif | ESP32-S2 | `303A:1001` |

**Если не подключается:**
- Убедитесь, что ESP32 не занят другим приложением (Arduino IDE, PuTTY)
- Нажмите **RST** на ESP32 и попробуйте снова
- Проверьте драйвер: [CH341SER](https://www.wch.cn/download/CH341SER_EXE.html)

---

## Интерфейс

### Вкладки

| Вкладка | Содержание |
|---------|-----------|
| 📊 **Dashboard** | Live Output (1/3 слева), статистика AP/Stations/BLE/Pkts (2/3 справа), топ-10 AP, лента событий, кнопки по категориям |
| 📶 **APs** | Таблица AP с сортировкой по RSSI/ESSID/Channel/Stations, поиск, раскрытие станций по клику, цветовая индикация сигнала |
| 🔵 **BLE** | Таблица BLE-устройств с автоопределением типа (AirTag/Speaker/BLE), OUI vendor lookup, multi-select для массовых атак, сортировка по Signal/Name/Type/Packets |
| 🔊 **Probes** | Таблица probe-запросов от клиентов |
| ⚡ **Scenarios** | Карточки 20 сценариев, запуск с пошаговым выполнением и прогресс-баром |
| ❓ **Help** | Поиск по всем командам, копирование по клику, секция со сценариями |

### Status Bar (всегда внизу)

При подключении отображает: статус соединения, количество AP/BLE/Pkts и длительность сессии.

### Emergency Stop

Красная кнопка **■ Stop** в хедере (видна при подключении) — отправляет `stopscan` на ESP32 и показывает toast-уведомление.

### Toast-уведомления

Всплывают в правом верхнем углу при коннекте/дисконнекте/экстренной остановке. Автоматически исчезают через 3 секунды, клик закрывает досрочно.

### Панель команд (CommandBuilder)

Все команды в едином `flex-wrap` контейнере, сгруппированы по категориям. При наведении — тултип с русским описанием. Снизу поле для произвольной команды.

**9 групп:**
| Группа | Команд | Тип |
|--------|--------|-----|
| 📡 Сканирование | 11 | scanall, sniffbeacon, sniffprobe, sniffdeauth, sniffpmkid, sniffraw и др. |
| ⚡ Атаки | 13 | deauth, beacon (random/list/clone/funny), probe, rickroll, badmsg, sleep, sae, csa, quiet |
| 🔵 Bluetooth | 19 | sniffbt (с фильтрами + колонки), blespam (11 типов), sniffskim, spoofat |
| 📋 Списки | 6 | list -a/-c/-s/-t/-p/-i |
| ✅ Выбор | 8 | select, clearlist, фильтры contains/equals |
| 🏷 SSID | 6 | ssid gen/add/remove, save/load |
| 🎭 MAC | 4 | randapmac, randstamac, cloneapmac, clonestamac |
| 🌐 Сеть | 10 | join, add, pingscan, arpscan, portscan |
| ⚙ Админ | 18 | info, settings, channel, reboot, led, gps, wardrive, evilportal, karma, ls, update, packetcount, mactrack, sigmon |

---

## Команды (полный справочник)

Полный список доступен во вкладке **Help** с поиском и копированием по клику.

### Сканирование и сниффинг

| Команда | Описание |
|---------|----------|
| `scanall` | Сканирование AP и станций одновременно |
| `sniffbeacon` | Перехват beacon-фреймов (AP) |
| `sniffprobe` | Перехват probe-запросов от клиентов |
| `sniffdeauth` | Перехват deauth-пакетов |
| `sniffpmkid [-c ch] [-d] [-l]` | Захват PMKID (EAPOL): `-d` с deauth, `-l` только по списку |
| `sniffraw` | Перехват всех WiFi-пакетов (raw) |
| `sniffsae` | Перехват SAE (WPA3) commit-пакетов |
| `sniffpwn` | Обнаружение Pwnagotchi |
| `sniffpinescan` | Обнаружение WiFi Pineapple |
| `sniffmultissid` | Обнаружение Multi-SSID устройств |
| `sigmon` | Мониторинг уровня сигнала выбранных AP |
| `mactrack` | Отслеживание MAC-адресов |
| `packetcount` | Счётчик пакетов по типам |
| `stopscan` | Остановка сканирования/атаки |

### Атаки

| Команда | Описание |
|---------|----------|
| `attack -t deauth [-c]` | Deauth-флуд, `-c` по списку станций |
| `attack -t beacon -l` | Beacon spam из списка SSID |
| `attack -t beacon -r` | Beacon spam случайными SSID |
| `attack -t beacon -a` | Beacon spam клонами выбранных AP |
| `attack -t probe` | Probe-запросы от выбранных AP |
| `attack -t rickroll` | Beacon с текстами Rick Astley |
| `attack -t funny` | Beacon с забавными SSID |
| `attack -t badmsg` | Bad-Message атака (EAPOL) |
| `attack -t sleep` | Association Sleep атака |
| `attack -t sae` | SAE Commit атака (WPA3) |
| `attack -t csa` | Channel Switch Announcement |
| `attack -t quiet` | Quiet Time атака |

### Bluetooth

| Команда | Описание |
|---------|----------|
| `sniffbt` | Сканирование всех BLE-устройств |
| `sniffbt -t airtag` | Поиск AirTag |
| `sniffbt -t flipper` | Обнаружение Flipper Zero |
| `sniffbt -t flock` | Обнаружение Flock Penguin |
| `sniffbt -t meta` | Обнаружение Meta/Ray-Ban |
| `sniffbt -t speaker` | Поиск Bluetooth-колонок |
| `sniffbt -t jbl` | Обнаружение JBL колонок |
| `sniffbt -t bose` | Обнаружение Bose колонок |
| `sniffbt -t sony` | Обнаружение Sony колонок |
| `sniffbt -t marshall` | Обнаружение Marshall колонок |
| `sniffskim` | Поиск BLE-скиммеров (HC-03/05/06) |
| `blespam -t all` | Все типы BLE-спама сразу |
| `blespam -t sourapple` | BLE-спам Apple (Sour Apple) |
| `blespam -t applejuice` | Apple Juice BLE-спам |
| `blespam -t google` | Google Fast Pair спам |
| `blespam -t samsung` | Samsung Galaxy Watch спам |
| `blespam -t windows` | Microsoft Swift Pair спам |
| `blespam -t speaker` | Спам на Bluetooth-колонки (общий) |
| `blespam -t jbl` | Спам на JBL колонки |
| `blespam -t bose` | Спам на Bose колонки |
| `blespam -t sony` | Спам на Sony колонки |
| `blespam -t marshall` | Спам на Marshall колонки |
| `spoofat -t <index>` | Спуфинг AirTag по индексу из list -t |

### Списки

| Команда | Описание |
|---------|----------|
| `list -a` | Список AP с индексами, каналом и RSSI |
| `list -c` | Список станций (сгруппированы по AP) |
| `list -s` | Список SSID |
| `list -t` | Список AirTag |
| `list -p` | Список probe-запросов |
| `list -i` | Список IP-адресов |

### Выбор целей и управление списками

| Команда | Описание |
|---------|----------|
| `select -a <idx/all>` | Выбрать AP |
| `select -c <idx/all>` | Выбрать станцию |
| `select -a -f "equals <name>"` | Фильтр: точное совпадение SSID |
| `select -a -f "contains <name>"` | Фильтр: частичное совпадение |
| `select -s <idx>` | Выбрать SSID |
| `clearlist -a` | Очистить список AP |
| `clearlist -c` | Очистить список станций |
| `clearlist -s` | Очистить список SSID |
| `ssid -a -g <n>` | Сгенерировать N случайных SSID |
| `ssid -a -n <name>` | Добавить SSID по имени |
| `ssid -r <idx>` | Удалить SSID по индексу |
| `save -a / save -s` | Сохранить AP/SSID на SD |
| `load -a / load -s` | Загрузить AP/SSID с SD |

### MAC-адреса

| Команда | Описание |
|---------|----------|
| `randapmac` | Случайный MAC для AP |
| `randstamac` | Случайный MAC для STA |
| `cloneapmac -a <idx>` | Клонировать MAC выбранной AP |
| `clonestamac -s <idx>` | Клонировать MAC выбранной станции |

### Сеть и утилиты

| Команда | Описание |
|---------|----------|
| `join -a <idx> -p <pass>` | Подключиться к WiFi |
| `add -a -b <mac> [-ch <ch>] [-e <ssid>]` | Добавить AP вручную |
| `add -c -b <mac> -ap <idx>` | Добавить станцию к AP |
| `pingscan` | Ping-сканирование сети |
| `arpscan` | ARP-сканирование |
| `portscan -a -t <ip>` | Полный порт-скан |
| `portscan -s <ssh/http/https>` | Сканирование конкретного порта |
| `evilportal -c start/setap/sethtml` | Evil Portal |
| `karma -p <idx>` | Karma-атака |
| `channel -s <n>` | Переключить канал (1-13) |
| `info` | Информация о системе |
| `info -a <idx>` | Детальная информация об AP |
| `settings` | Показать/изменить настройки |
| `reboot` | Перезагрузка ESP32 |
| `led -s <hex>` / `led -p rainbow` | Управление LED |
| `brightness -s <0-9>` | Яркость дисплея |
| `ls <dir>` | Список файлов на SD |
| `update -s` | Обновление с SD |
| `gpsdata` / `nmea` | GPS-данные |
| `gpspoi -s/-m/-e` | GPS POI |
| `gpstracker -c start/stop` | GPS-трекер |
| `wardrive` | Вардрайвинг (требуется GPS) |
| `wardrivepoi <label>` | Отметить POI |

---

## Сценарии

20 готовых сценариев во вкладке **Scenarios**. Пошаговое выполнение с прогресс-баром и возможностью отмены.

| Сценарий | Шаги | Предупреждение |
|----------|------|----------------|
| **Quick Recon** | scanall → list -a → list -c → sniffpmkid -d | — |
| **Beacon Flood** | ssid -a -g 50 → list -s → attack -t beacon -l | ⚠️ |
| **Deauth Flood** | scanall → list -a (input) → select -a → attack -t deauth | ⚠️ |
| **Deauth Targeted** | scanall → list -c → attack -t deauth -c | ⚠️ |
| **AP Clone Spam** | scanall → list -a (input) → select -a → attack -t beacon -a | ⚠️ |
| **Clone + Deauth** | scanall → list -a (input) → select -a → beacon -a → deauth | ⚠️ |
| **PMKID Capture** | scanall → list -a (input) → select -a → sniffpmkid -d -l | — |
| **BLE Scan** | sniffbt | — |
| **BLE Discovery** | sniffbt → sniffbt -t airtag → sniffbt -t flipper → sniffbt -t meta | — |
| **AirTag Hunt** | sniffbt -t airtag → list -t | — |
| **BLE Spam** | blespam -t all | ⚠️ |
| **Funny Beacon** | attack -t funny | ⚠️ |
| **Evil Portal** | scanall → list -a (input) → setap → evilportal -c start | ⚠️ |
| **Network Scan** | pingscan → arpscan → list -i | — |
| **GPS Wardrive** | gpsdata → wardrive | — |
| **MAC Randomize** | randapmac → randstamac | ⚠️ |
| **Save Session** | scanall → list -a → save -a → save -s | — |
| **AP Info Dump** | list -a → info -a {idx} (для каждого AP) | — |
| **Speaker Hunter** | sniffbt → sniffbt -t speaker/jbl/bose/sony/marshall → list → blespam -t speaker | ⚠️ |
| **Speaker Kill** | sniffbt → blespam -t all | ⚠️ |

---

## Speaker Hunter

Набор инструментов для поиска и атаки на Bluetooth-колонки.

### Как работает

1. **Сканирование** — `sniffbt -t speaker` ищет BLE-устройства с сигнатурами колонок
2. **Определение бренда** — целевой скан по каждому бренду (JBL/Bose/Sony/Marshall)
3. **Атака** — `blespam -t speaker` отправляет BLE-пакеты, вызывающие popup-уведомления на колонке
4. **Отключение** — постоянный спам забивает канал связи колонки

### Доступные команды

| Команда | Описание |
|---------|----------|
| `sniffbt -t speaker` | Поиск всех BLE-колонок |
| `sniffbt -t jbl` | Поиск JBL колонок |
| `sniffbt -t bose` | Поиск Bose колонок |
| `sniffbt -t sony` | Поиск Sony колонок |
| `sniffbt -t marshall` | Поиск Marshall колонок |
| `blespam -t speaker` | Спам на все колонки |
| `blespam -t jbl` | Спам на JBL |
| `blespam -t bose` | Спам на Bose |
| `blespam -t sony` | Спам на Sony |
| `blespam -t marshall` | Спам на Marshall |

### Сценарии

- **Speaker Hunter** — полное сканирование всех брендов + атака
- **Speaker Kill** — агрессивная атака всеми типами BLE-спама

### Кнопки в Dashboard

В разделе **BLE** доступны:
- 🔵 **Scan**: Speakers, JBL, Bose, Sony, Marshall
- ⚠️ **Attack**: Spk Spam, JBL Spam, Bose Spam, Sony Spam, Mshall Spam

> **Важно:** Команды `blespam -t speaker/jbl/bose/sony/marshall` требуют поддержки в прошивке ESP32 Marauder. Если прошивка не поддерживает эти варианты, `blespam -t all` работает как универсальная атака.

---

## Парсер данных

Parser Engine автоматически преобразует вывод Marauder в структурированные данные.

### Поддерживаемые форматы

| Тип | Пример вывода | Куда |
|-----|--------------|------|
| AP beacon | `-45 Ch: 1 AA:BB:CC:DD:EE:FF ESSID: MyWiFi` | apStore |
| AP list | `[0][CH:6] MyWiFi -65 (selected)` | apStore |
| Station detect | `5: ap: AA:BB:CC:DD:EE:FF -> sta: 11:22:33:44:55:66` | apStore |
| Station list | `[0] MyWiFi -65:` / ` [0] AA:BB:CC:DD:EE:FF` | apStore |
| Deauth sniff | `-65 Ch: 6 SRC -> DST` | events |
| Probe sniff | `-45 Ch: 1 Client: MAC Requesting: SSID` | events |
| PMKID/EAPOL | `Received EAPOL: AA:BB:CC:DD:EE:FF` | events |
| BLE sniff | `-45 Device: iPhone` | bleStore |
| BLE generic | `-45 AA:BB:CC:DD:EE:FF` | bleStore |
| BLE Meta | `Meta Device: -45 RayBan` | bleStore |
| Signal mon | `MyWiFi RSSI: -45` | apStore |

---

## Demo-режим

1. ESP32 **не должен быть подключён**
2. Нажмите **Try Demo** в хедере
3. Интерфейс заполнится демо-данными: AP, BLE, терминал
4. Каждые 5 секунд — новые данные
5. Нажмите **Exit Demo** для выхода (очищает все данные)

---

## Советы

### ESP32 не определяется
- Установите драйвер [CH341SER](https://www.wch.cn/download/CH341SER_EXE.html)
- Попробуйте другой USB-кабель (не только зарядный)
- Проверьте Диспетчер устройств → COM-порты

### Web Serial не работает
- Только Chrome или Edge (89+)
- Сайт по `localhost` или HTTPS (`file://` не работает)
- Проверьте, что порт не занят другим приложением

### Медленное сканирование после очистки
- ESP32 переходит в monitor mode после команд
- Перед новым сканированием нажмите **Clear List** (отправляет `clearlist -a`)
- Затем **Scan All** — сканирование будет быстрым

### AP не отображаются
- Запустите `sniffbeacon` или `scanall` — дайте 5-10 секунд
- `list -a` — вывод накопленного списка

### Ошибка "Port is in use"
```bash
netstat -ano | findstr :3000
taskkill /PID <номер> /F
```

---

## Производительность и архитектура

### Оптимизации парсера

- **O(1) dispatch по первому символу** — `_DISPATCH` map с 14 кодпоинтами
- **Firmware profiles** — парсер вынесен в `services/firmwareProfiles/marauderV1.ts` для поддержки разных версий прошивки
- **O(1) поиск AP** — maintained indexes `_byBssid` и `_byIndex`

### Рефакторинг serialStore (SRP)

Ранее `serialStore.js` содержал 6+ ответственностей. Теперь:

| Модуль | Ответственность |
|--------|----------------|
| `serialStore.ts` | Состояние, терминал, public API |
| `services/serialReader.ts` | Read loop, TextDecoder, buffer trimming |
| `services/commandExecutor.ts` | sendCommand, sendAndWait, sendSequence |
| `services/serialReconnect.ts` | Auto-reconnect, device plug/unplug |

### Централизованная санитизация

- `utils/sanitize.ts` — `sanitizeText()`, `sanitizeAscii()`, `normalizeMac()`, `safeParseInt()`
- Все входящие данные проходят через `sanitizeText()` перед отображением
- Защита от ANSI escape, control characters, non-printable unicode

### Сервисы общего назначения

- `utils/uuid.ts` — RFC 4122 v4 UUID + `recordKey()` для IndexedDB (вместо `JSON.stringify`)
- `utils/logger.ts` — Ring-buffer logger с уровнями (debug/info/warn/error)
- `utils/metrics.ts` — Rolling counters: lines/sec, parser dispatches, misses

### Оптимизации stores

- **Maintained indexes** — `_byBssid` и `_byIndex` обновляются инкрементально
- **shallowRef + triggerRef** — мутации in-place вместо `new Map(...)` копирования
- **push/shift вместо spread** — O(1) вместо O(N) для FIFO буферов
- **debounced + throttle save** — debounce 1s + max wait 5s + beforeunload flush

### Оптимизации UI

- **Windowed terminal rendering** — рендерится только ~40 видимых строк из 2000
- **v-text вместо v-html** — нативное экранирование Vue

### Batch processing

- **queueMicrotask** — батчит строки в один microtask, не блокирует serial read loop

### Безопасность

- **CSP strict в production** — `script-src 'self'` без `unsafe-eval`/`unsafe-inline` (Vite-плагин `cspPlugin()`)
- **Excel Formula Injection** — CSV-экспорт экранирует `=+−@` префиксы (OWASP)
- **USB vendor whitelist** — только CP2102, CH340, FTDI, ESP32-S2
- **beforeunload persistence** — данные сохраняются при закрытии вкладки
- **Memory bounds** — max 1000 APs, 2000 BLE devices в store, LRU eviction
- **Graceful disconnect** — очистка terminalOutput при отключении
- **ARIA labels** — accessibility для кнопок и навигации
- **Keyboard navigation** — tabindex на строках таблиц AP/BLE

### Метрики

| Метрика | До | После |
|---------|-----|-------|
| Parser throughput | 1x | 10-50x |
| Store update alloc | O(N) copy | O(1) mutation |
| Terminal render | 2000 nodes | ~40 visible |
| SerialStore responsibilities | 6+ | 4 modules |
| IDB key generation | JSON.stringify | UUID/recordKey |
| Data sanitization | ad-hoc | centralized |

---

## Changelog

### v0.5.2 (2026-06-03) — Security Hardening

- **A5: CSP strict в production** — Vite-плагин `cspPlugin()` через `transformIndexHtml`. В build-режиме CSP: `script-src 'self'` (без `unsafe-eval`/`unsafe-inline`). Dev сохраняет relaxed CSP для HMR.
- **BLE Explorer redesign** — полный перепис компонента:
  - Multi-select (checkbox + click) с Select All / Deselect All
  - Contextual action bar: Sniff, Stop, Spoof AirTag, Speaker Spam, BLE Spam All, Copy MACs
  - Сортировка по Signal / Name / Type / Packets
  - Auto-detection типа: AirTag (red), Speaker (amber), BLE (gray)
  - Per-row actions: Copy MAC, Spoof (AirTag only), Spam (Speaker only)
  - ConfirmDialog для деструктивных действий
- **BLE device identification** — OUI vendor lookup через `lookupVendor(mac)` для всех BLE-устройств (~1148 MAC prefixes). Поиск фильтрует по vendor.
- **BLE cleanup removal** — убран 30-секундный таймер автоудаления устройств. Устройства сохраняются до явной очистки. Добавлен `MAX_BLE_DEVICES = 2000` с LRU eviction.
- **Speaker auto-detection** — автоматическое определение колонок по имени (jbl, bose, sony, marshall, etc.)

### v0.5.1 (2026-06-03) — TypeScript Migration

- Все 5 stores, 7 services, 11 utils, 1 composable, 4 type definition files мигрированы на TypeScript
- Остались JS только: `main.js` (entry point), `ouiData.js` (28KB data file)
- `tsconfig.json`: `strict: false`, `noImplicitAny: false` — 28 `any` типов в 11 файлах
- 177/177 тестов проходят

### v0.5.0 (2026-06-02) — Audit-Driven Refactoring

- **SRP split serialStore** — разделён на 4 модуля:
  - `serialStore.ts` — состояние, терминал, public API
  - `services/serialReader.ts` — read loop, TextDecoder, buffer trimming
  - `services/commandExecutor.ts` — sendCommand, sendAndWait, sendSequence
  - `services/serialReconnect.ts` — auto-reconnect state machine
- **ParserEngine firmware profiles** — парсеры вынесены в `services/firmwareProfiles/marauderV1.ts`
- **Утилиты** — `sanitize.ts`, `uuid.ts`, `logger.ts`, `metrics.ts`
- 9 bug fixes по результатам deep audit:
  - **B1**: Exit Demo стирает IndexedDB → убраны `clearAPs()/clearDevices()/clearProbes()` из exit path
  - **B2**: False "error" в Action Log → regex `/(?:^|\n)\s*(?:\[ERROR\]|error\b|failed\b)/i` вместо `includes('error')`
  - **B3**: `blespam`/`spoofat` без `needsTarget: true` → добавлено в 12 команд
  - **B4**: Double Connect error → убран дубликат из handleConnect
  - **B5**: Select всегда ставил `isSelected: true` → toggle через `!selectedAP.value.isSelected`
  - **B6**: Workflow "Done ✓" после error → guard `if (!aborted.value)`
  - **B7**: Dead code `actions = []` → `clearActions()` + import
  - **B8**: `waitForInput` через `requestAnimationFrame` → `setTimeout(check, 100)`
  - **B9**: bleStore без device limit → `MAX_BLE_DEVICES = 2000` + eviction

### v0.4.3 (2026-06-01) — Performance Audit

- `terminalOutput` push+shift+triggerRef вместо spread
- Parser O(1) dispatch по первому символу (14 кодпоинтов)
- BSSID/index maintained indexes в apStore
- `eventsReversed` computed вместо `slice().reverse()`
- `queueMicrotask` batching для serial line processing
- BLE cleanup 30s timer (позже убран в v0.5.2)
- Debounced persistence (1s debounce + 5s max wait + beforeunload flush)

---

## Юридическое предупреждение

**Только для:**
- Тестирования собственных сетей
- Лабораторных работ
- Авторизованных пентестов
- Образовательных целей

**Запрещено использовать для атак на чужие сети без письменного разрешения.**

---

*Документация обновлена 3 июня 2026*
