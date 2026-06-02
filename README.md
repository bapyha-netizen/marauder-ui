# Marauder UI — документация

**Версия:** 0.4.1
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
8. [Парсер данных](#парсер-данных)
9. [Demo-режим](#demo-режим)
10. [Советы](#советы)
11. [Юридическое предупреждение](#юридическое-предупреждение)

---

## Что это такое

Marauder UI — графический интерфейс для **ESP32 Marauder**. Приложение работает полностью локально в браузере (Chrome/Edge). Весь обмен данными — через USB (Web Serial API). Никаких серверов, никакого бэкенда.

### Возможности

- 📡 **Сканирование WiFi** — `scanall`, `sniffbeacon`, `sniffprobe`, `sniffdeauth`, `sniffpmkid`, `sniffraw`, `sniffsae`, `sigmon`, `mactrack`
- 🔵 **Bluetooth** — `sniffbt` (AirTag/Flipper/Flock/Meta), `blespam` (6 типов), `sniffskim`, `spoofat`
- ⚡ **Атаки** — deauth, beacon spam (random/list/clone), probe spam, rickroll, badmsg, sleep, sae, csa, quiet, funny
- 📊 **Дашборд** — Live Output, статистика AP/Stations/BLE/Pkts, топ-10 AP, лента событий
- 📋 **Таблицы** — AP Explorer (с раскрытием станций, сортировкой, поиском), BLE Explorer (с подсветкой AirTag)
- 🗺 **Wardraving** — GPS-трекинг с записью в Wigle-формате, отметки POI, NMEA
- ⚡ **Сценарии** — 18 готовых сценариев (рекон, атаки, BLE, GPS)
- 🔌 **Demo-режим** — работа без ESP32 для ознакомления
- 🆘 **Emergency Stop** — кнопка немедленной остановки в хедере

---

## Архитектура

```
┌──────────────────────────────────────────────────────┐
│                   Браузер (Chrome/Edge)               │
│                                                        │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Vue 3 UI    │  │  Pinia   │  │  Parser Engine    │  │
│  │  (табы)      │◄─┤  Stores  │◄─┤  (10+ форматов)   │  │
│  └──────┬───────┘  └──────────┘  └──────────────────┘  │
│         │                                               │
│  ┌──────▼───────┐                                      │
│  │ Web Serial API│                                      │
│  └──────┬───────┘                                      │
└─────────┼────────────────────────────────────────────┘
          │ USB
┌─────────▼────────────────────────────────────────────┐
│              ESP32 + Marauder Firmware                 │
│  WiFi · BLE · GPS · SD · Packet Monitor                │
└───────────────────────────────────────────────────────┘
```

### Структура проекта

```
src/
├── stores/
│   ├── serialStore.js       # Serial-порт, терминал, команды
│   ├── apStore.js           # Точки доступа + станции
│   ├── bleStore.js          # BLE-устройства
│   └── dashboardStore.js    # Статистика, события, парсинг станций
├── services/
│   ├── parserEngine.js      # Парсер вывода Marauder (11 форматов)
│   └── commandRegistry.js   # 66 команд, 9 групп, 18 сценариев
├── components/
│   ├── dashboard/           # DashboardView (Live Output + статистика)
│   ├── ap/                  # APExplorer (таблица AP/станций)
│   ├── ble/                 # BLEExplorer (таблица BLE)
│   ├── workflow/            # WorkflowBuilder (сценарии)
│   └── help/                # HelpGuide (справка с поиском)
├── utils/
│   ├── format.js            # signalClass, fmtTime, dotClass
│   ├── toast.js             # Система toast-уведомлений
│   └── demoData.js          # Демо-генератор
├── assets/
│   └── style.css            # Tailwind + компонентные классы
├── App.vue                  # Root: tabs + header + status bar + toasts
└── main.js                  # Точка входа
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

**Если не подключается:**
- Убедитесь, что ESP32 не занят другим приложением (Arduino IDE, PuTTY)
- Нажмите **RST** на ESP32 и попробуйте снова
- Проверьте драйвер: [CH341SER](https://www.wch.cn/download/CH341SER_EXE.html)

---

## Интерфейс

### Вкладки

| Вкладка | Содержание |
|---------|-----------|
| 📊 **Dashboard** | Live Output (1/3 слева), статистика AP/Stations/BLE/Pkts (2/3 справа), топ-10 AP, лента событий, кнопки Scan All / Scan BLE / Clear List / Clear |
| 📶 **APs** | Таблица AP с сортировкой по RSSI/ESSID/Channel/Stations, поиск, раскрытие станций по клику, цветовая индикация сигнала |
| 🔵 **BLE** | Таблица BLE-устройств с подсветкой AirTag, поиск, кнопки Scan/Clear |
| ⚡ **Scenarios** | Карточки 18 сценариев, запуск с пошаговым выполнением и возможностью отмены |
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
| 🔵 Bluetooth | 13 | sniffbt (с фильтрами), blespam (6 типов + all), sniffskim, spoofat |
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
| `sniffskim` | Поиск BLE-скиммеров (HC-03/05/06) |
| `blespam -t all` | Все типы BLE-спама сразу |
| `blespam -t sourapple` | BLE-спам Apple (Sour Apple) |
| `blespam -t applejuice` | Apple Juice BLE-спам |
| `blespam -t google` | Google Fast Pair спам |
| `blespam -t samsung` | Samsung Galaxy Watch спам |
| `blespam -t windows` | Microsoft Swift Pair спам |
| `blespam -t flipper` | Flipper Zero BLE-спам |
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

18 готовых сценариев во вкладке **Scenarios**. Пошаговое выполнение с возможностью отмены.

| Сценарий | Шаги |
|----------|------|
| **Quick Recon** | scanall → list -a → list -c → sniffpmkid -d |
| **Beacon Flood** | ssid -a -g 50 → list -s → attack -t beacon -l |
| **Deauth Flood** | scanall → list -a (input) → select -a → attack -t deauth |
| **Deauth Targeted** | scanall → list -c → attack -t deauth -c |
| **AP Clone Spam** | scanall → list -a (input) → select -a → attack -t beacon -a |
| **Clone + Deauth** | scanall → list -a (input) → select -a → beacon -a → deauth |
| **PMKID Capture** | scanall → list -a (input) → select -a → sniffpmkid -d -l |
| **BLE Scan** | sniffbt |
| **BLE Discovery** | sniffbt → sniffbt -t airtag → sniffbt -t flipper → sniffbt -t meta |
| **AirTag Hunt** | sniffbt -t airtag → list -t |
| **BLE Spam** | blespam -t all |
| **Funny Beacon** | attack -t funny |
| **Evil Portal** | scanall → list -a (input) → setap → evilportal -c start |
| **Network Scan** | pingscan → arpscan → list -i |
| **GPS Wardrive** | gpsdata → wardrive |
| **MAC Randomize** | randapmac → randstamac |
| **Save Session** | scanall → list -a → save -a → save -s |
| **AP Info Dump** | list -a → info -a 0 → info -a 1 → info -a 2 |

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

## Юридическое предупреждение

**Только для:**
- Тестирования собственных сетей
- Лабораторных работ
- Авторизованных пентестов
- Образовательных целей

**Запрещено использовать для атак на чужие сети без письменного разрешения.**

---

*Документация обновлена 29 мая 2026*
