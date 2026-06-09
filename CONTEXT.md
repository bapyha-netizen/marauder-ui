# PROJECT CONTEXT

## Проект

Название: ESP32 Marauder UI

Назначение:
PWA-интерфейс для ESP32 Marauder — анализатор Wi-Fi/BLE сетей. Связь с ESP32 через Web Serial API.

Среда:
- Домашнее использование
- ПК с Chrome/Edge (Web Serial)
- Подключение ESP32 по USB
- Один активный пользователь

---

## Архитектура

```
ESP32 Marauder firmware
  ↑ serial (USB)
  ↑ Web Serial API
Marauder UI (Vue 3 + Pinia + Tailwind)
  ├─ serialStore (Pinia) — подключение, терминал
  ├─ commandExecutor — единый пайплайн команд (очередь 100, rate limit 100ms)
  ├─ actionDispatcher — пререквизиты, подтверждения
  ├─ serialReader — UTF-8 буфер, 64KB, разделение строк
  ├─ parserEngine — профиль marauderV1, dispatch + fallback парсеры
  ├─ stores: apStore, bleStore, probeStore, dashboardStore
  └─ components: DashboardView, CommandBuilder, WorkflowBuilder, Terminal
```

---

## Технологический стек

- Vue 3.5.12 (Composition API, `<script setup>`)
- Pinia 2.2.6 (state management)
- Tailwind CSS 3.4.14 (UI)
- Vite 6.4.3 (сборка)
- Vitest 4.1.8 (unit тесты)
- Playwright (E2E тесты)
- TypeScript 5.9.3
- PWA (Workbox)

---

## Версия

v0.7.5.2 — последний релиз

Тег: `v0.7.5.2`
Remote: `https://github.com/bapyha-netizen/marauder-ui.git`

---

## Ключевые файлы

- `src/utils/actionDispatcher.ts` — диспетчер команд с пререквизитами (runAction → _execute)
- `src/services/commandExecutor.ts` — пайплайн: queue → rate limit → write + sendAndWait c последовательным mutex (RC-1 fix: глобальная очередь `_sendAndWaitQueue`, флаг `_sendAndWaitInProgress`)
- `src/services/serialReader.ts` — чтение из serial, UTF-8 boundary, 64KB buffer
- `src/services/parserEngine.ts` — парсинг строк Marauder
- `src/services/commandRegistry.ts` — реестр всех команд (68 команд) и workflow (16 шт)
- `src/services/commandMeta.ts` — severity, prerequisites, confirmations
- `src/services/serialReconnect.ts` — авто-реконнект (1s→30s, 6 попыток)
- `src/services/firmwareProfiles/marauderV1.ts` — профиль парсера Marauder
- `src/stores/serialStore.ts` — Pinia store для serial (cancelPending при disconnect — RC-4 fix)
- `src/stores/apStore.ts` — точки доступа (Map индексы, persistence)
- `src/stores/bleStore.ts` — BLE устройства (LRU eviction)
- `src/stores/probeStore.ts` — probe requests (макс. 500)
- `src/stores/dashboardStore.ts` — события, пакеты, каналы
- `src/utils/sanitize.ts` — очистка ANSI, control chars, HTML
- `src/utils/persist.ts` — debounce persistence в IDB
- `src/components/dashboard/DashboardView.vue` — главный дашборд (6 прямых sendCommand — обход actionDispatcher)
- `src/components/CommandBuilder.vue` — панель команд с confirm, чёрный список опасных команд
- `src/components/workflow/WorkflowBuilder.vue` — конструктор сценариев (3 прямых sendAndWait — обход actionDispatcher)
- `vite.config.ts` — CSP, PWA, TypeScript checker

---

## Безопасность (v0.7.5)

- Единый пайплайн команд через `commandExecutor`
- Очередь команд: макс. 100, rate limit 100ms
- Чёрный список опасных команд: `reboot`, `update`, `factoryreset`
- Валидация firmware banner
- CSP заголовки в production
- Sanitize ANSI escape sequences, control characters
- Кастомные команды проходят валидацию в CommandBuilder (черный список + длина)
- Демо-режим заблокирован при реальном подключении (App.vue guard)

### Security Audit Findings (v0.7.5)

- **USB VID/PID whitelist**: фильтр в `requestPort({ filters })` — рекомендательный, не принудительный. Браузерный диалог выбора порта позволяет пользователю подключить ЛЮБОЙ serial-девайс. Необходима runtime-проверка после получения порта.
- **XSS через v-html**: `DashboardView.vue:42` использует `v-html="line.text"` для вывода терминала. Sanitizer разрешает `<span style="...">` — потенциальный CSS injection. Фикс: заменить на `v-text`.
- **Чёрный список команд неполный**: 6 команд (`reboot`, `update`, `factoryreset`, `erase`, `write`, `format`) — легко обходится, не покрывает многие опасные. Необходим allowlist в `commandExecutor.ts`.
- **Обход actionDispatcher**: DashboardView (6 прямых `sendCommand`) и WorkflowBuilder (3 прямых `sendAndWait`) не проходят через единый шлюз валидации команд.
- **TextDecoder без streaming**: `serialReader.ts:171` — multi-byte UTF-8 символ, разрезанный границей чанка, вызывает decode error и потерю строки.
- **Парсер без CPU budget**: злонамеренная прошивка может заливать UI данными, вызывая CPU load от парсинга и re-render.

---

## Парсер

Профиль `marauderV1` содержит **15 парсер-функций**:
- `parseAPBeacon`, `parseAPList`, `parseStationDetect`, `parseStationList`
- `parseDeauthSniff`, `parseProbeSniff`, `parsePMKID`
- `parseBLESniff`, `parseBLEMeta`, `parseSignalMonitor`
- `parsePacketCount`, `parseChannelAnalyzer`, `parseAPInfo`, `parseIPList`
- `parseSystemMsg` (fallback)

Покрытие по валидатору: **423/567 строк (74.6%)** в реальных captures.
**16+ форматов ESP32 не имеют реализации парсера** (boot, help, settings, info, bracket, mgmt-stats, nmea, gps, deauth-tx, probe-empty, airtag-list, ssid-list, probe-list, pwnagotchi, pineapplescan, sae, skimmer).

Детальный аудит: см. раздел «Аудит парсера (2026-06-09)».

---

## Известные проблемы

1. ~~**Обход actionDispatcher**: DashboardView (6 мест) и WorkflowBuilder (3 места) вызывают `serialStore.sendCommand/sendAndWait` напрямую~~ — **ИСПРАВЛЕНО**, все через `runAction()`
2. ~~**Двойной wrapper side effects**: `_sendWithSideEffects` + `actionDispatcher._execute` дублируют логику~~ — **ИСПРАВЛЕНО**, side effects только в actionDispatcher
3. **E2E тесты**: playwright.config.js использует port 3010, соответствует vite.config.ts — исправлено
4. ~~**console.log в apStore.ts строка 491**: debug logging~~ — **ИСПРАВЛЕНО**, нет console.log
5. **Тесты**: `--exclude "tests/e2e/**"` при запуске vitest (E2E требуют Playwright browsers + dev server)
6. **package.json**: скрипты `lint`, `typecheck`, `test:unit` присутствуют — исправлено
7. **USB device whitelist не принудительный**: `requestPort({ filters })` не блокирует подключение произвольного USB-устройства через браузерный диалог. Необходима runtime-проверка VID/PID после получения порта и в `serialReconnect.ts`. Файлы: `src/stores/serialStore.ts:145-152`, `src/services/serialReconnect.ts:129-134`.
8. ~~**v-html в DashboardView — вектор XSS**:~~ — **ИСПРАВЛЕНО**, `v-text` + удалён `html: true` из `sanitizeText`
9. ~~**Чёрный список команд неполный и обходимый**:~~ — **ИСПРАВЛЕНО**, allowlist в `commandExecutor.ts`
10. **Терминальный буфер без защиты от rate-limit атаки**: 64KB буфер, 4096 макс. длина строки. Злонамеренная прошивка может заливать UI данными, вызывая CPU load от парсинга и re-render. Фикс: парсерный budget (CPU time) и детекция аномальной частоты строк.
11. ~~**TextDecoder без streaming-режима**:~~ — **ИСПРАВЛЕНО**, `TextDecoder` создаётся в streaming-режиме
12. ~~**parseAPList bssid: m[3] (`marauderV1.ts:65`)**:~~ — **ИСПРАВЛЕНО**, `bssid` не присваивается из m[3]
13. ~~**parseIPList ложно потребляет SSID (`marauderV1.ts:330`)**:~~ — **ИСПРАВЛЕНО**, добавлен guard (MAC + IP check)
14. ~~**parseAPInfo — silent discard (`marauderV1.ts:317-319`)**:~~ — **ИСПРАВЛЕНО**, сохраняет в dashStore events
15. ~~**parseSignalMonitor игнорирует неизвестные SSID**:~~ — **ИСПРАВЛЕНО**, создаёт временный AP
16. **parserMisses невидимы пользователю**: метрика инкрементится, но не отображается в UI.
17. **validate-parser.mjs не синхронизирован с marauderV1.ts**: 16+ паттернов есть в валидаторе, но нет реализации.
18. **Покрытие ~74.6%, а не 100%**: 423/567 строк в capture-файлах, 144 unmatched/ignored.
19. ~~**BR-01 — apStore.removeOldAPs() без triggerRef**:~~ — **ИСПРАВЛЕНО**, `triggerRef` + `_recomputeStats` есть
20. ~~**BR-02 — bleStore.hydrate() без triggerRef**:~~ — **ИСПРАВЛЕНО**, `triggerRef(devices)` в конце `hydrate()`
21. ~~**BR-03 — serialStore.disconnect() не чистит сторы**:~~ — **ИСПРАВЛЕНО**, добавлен `clearAllStores()` helper
22. ~~**BR-04 — clearlist -a неполная очистка сторов**:~~ — **ИСПРАВЛЕНО**, расширен на все stores
23. ~~**BR-07 — parserEngine чистит только AP**:~~ — **ИСПРАВЛЕНО**, BLE + probe cleanup добавлены
24. ~~**BR-08 — clearListAndScan не сбрасывает dashboard**:~~ — **ИСПРАВЛЕНО**

### Async Flow — известные риски (v0.7.5.2)

#### 🔴 CRITICAL

1. **Deadlock очереди sendAndWait при disconnect** (`commandExecutor.ts:105-147`, `serialStore.ts:209`)
   disconnect() очищает `_lineHandlers = []`, но `_doSendAndWait` висит в ожидании PROMPT_RE, которое не придёт. `_sendAndWaitInProgress` не сбрасывается → очередь команд блокируется на 15s (таймаут).
   **Fix**: в disconnect() форсированно разрешить все висящие `_doSendAndWait` (reject/resolve + сброс `_sendAndWaitInProgress`).

2. ~~**Deadlock _isConnecting при cancel requestPort** (`serialStore.ts:241-255`)~~ — **ИСПРАВЛЕНО**: добавлен 30s таймаут сброса `_isConnecting`.

3. ~~**Bypass actionDispatcher в WorkflowBuilder** (`WorkflowBuilder.vue:353, 402, 424`)~~ — **ИСПРАВЛЕНО**: заменены на `runAction()`.

4. ~~**disconnect во время sendAndWait в WorkflowBuilder** (`WorkflowBuilder.vue:172-178`)~~ — **ИСПРАВЛЕНО**: shared AbortController (`getWorkflowSignal()`) в serialStore.

#### 🟠 HIGH

5. ~~**AbortController: команда уходит на устройство после abort** (`commandExecutor.ts:139-145`)~~ — **ИСПРАВЛЕНО**: проверка `signal?.aborted` перед `_send()`.

6. ~~**Reconnect event не отменяет in-flight команды** (`serialReconnect.ts:70-82`)~~ — **ИСПРАВЛЕНО**: `onDisconnect` callback в `discHandler`.

7. **Race updateOrAddAP при параллельных вызовах** (`apStore.ts:255-328`)
   Два быстрых вызова могут прочитать `_findExisting` до записи первого → lost update.
   **Fix**: batch-обработка через `queueMicrotask` или атомарная блокировка.

8. **Double execution scan + action** (`DashboardView.vue:336-354` + `491-548`)
   Кнопка "Scan" и кнопки действий AP не блокируют друг друга.
   **Fix**: проверять `_runningAction` в runScanForTab (уже есть `!!actionRunning` на кнопках, но не на Scan).

#### 🟡 MEDIUM

9. ~~**cancelPending() race с _processQueue** (`commandExecutor.ts:39-44, 194-204`)~~ — **ИСПРАВЛЕНО**: флаг `_cancelling`.

10. ~~**Lost update при быстром disconnect-connect** (`persist.ts`, `apStore.ts:445-453`)~~ — **ИСПРАВЛЕНО**: `cancelPendingSaves()` в `disconnect()`.

11. **serialReader trim теряет данные при пиковой нагрузке** (`serialReader.ts:145-156`)
    Буфер 64KB, trim to 32KB при переполнении — неполные строки теряются.
    **Fix**: увеличить буфер или добавить кольцевой буфер с partial-line tracking.

12. ~~**Side effect double-clear** (`serialStore.ts:230-237, 318-323`)~~ — **ИСПРАВЛЕНО**: перенесено в actionDispatcher.

#### 🟢 LOW

13. ~~**Stale parser context между disconnect/reconnect** (`parserEngine.ts:49-65`)~~ — **ИСПРАВЛЕНО**: `resetCtxCache()` после `reader.start()`.

14. ~~**Handler exception в _notifyLine теряет остаток батча** (`serialStore.ts:49-62`)~~ — **ИСПРАВЛЕНО**: try/catch вокруг каждого handler.

15. ~~**actionDispatcher._execute не блокирует повторный вызов** (`actionDispatcher.ts:119-185`)~~ — **ИСПРАВЛЕНО**: флаг `_executing`.

---

## Необходимые исправления

### 1. Обход actionDispatcher (3 bypasses, 9 прямых вызовов) — ИСПРАВЛЕНО

DashboardView и WorkflowBuilder переведены на `runAction()`. Все команды проходят через actionDispatcher.

### 2. Двойной wrapper side effects (duplicated clearlist logic) — ИСПРАВЛЕНО

Side effects перенесены в `actionDispatcher._execute`. `_sendWithSideEffects` и `_sendAndWaitWithSideEffects` удалены. `sendCommand` → прямой `executor.send`, `sendAndWait` → прямой `executor.sendAndWait`.

### 3. Мёртвый код: scanAll / clearListAndScan — ИСПРАВЛЕНО

`scanAll` и `clearListAndScan` удалены из serialStore.

### 4. Несовпадение портов E2E — ИСПРАВЛЕНО

`playwright.config.js` уже использует port 3010, соответствует `vite.config.ts`.

### 5. package.json: отсутствуют скрипты — ИСПРАВЛЕНО

Скрипты `lint`, `typecheck`, `test:unit` добавлены в `package.json`.

### 6. State Consistency — Pinia (BR-01..BR-08) — ИСПРАВЛЕНО

Все 6 нарушений реактивности устранены:
- **BR-01**: `triggerRef` + `_recomputeStats` в `removeOldAPs()`
- **BR-02**: `triggerRef(devices)` в `hydrate()`
- **BR-03**: `clearAllStores()` helper добавлен
- **BR-04**: clearlist side effects расширены на все stores
- **BR-07**: BLE + probe cleanup в parserEngine
- **BR-08**: `resetStats()` в `clearListAndScan`

---



## Карта байпасов actionDispatcher

### DashboardView.vue (6 мест)
- Строка 79: `runAction({ cmd: 'scanall' })` — кнопка "List APs" при пустом списке
- Строка 102: `runAction({ cmd: 'sniffbt' })` — кнопка "Sniff BLE" при пустом списке
- Строка 125: `runAction({ cmd: 'sniffprobe' })` — кнопка "Sniff Probe" при пустом списке
- Строка 150: `runAction({ cmd: 'sniffbeacon' })` — кнопка при пустом списке станций
- Строка 343: `runAction(...)` — кнопка Scan на вкладках (runScanForTab)
- Строка 526: `runAction(...)` — кнопки действий AP/BLE (runActionLocal)

### WorkflowBuilder.vue (3+ места)
- Строка 353: `serialStore.sendAndWait(subCmd, 2000, signal)` — forEachAP loop
- Строка 402: `serialStore.sendAndWait(subCmd, 5000, signal)` — splitInput loop
- Строка 424: `serialStore.sendAndWait(cmd, ..., signal)` — шаги workflow

---

## Аудит парсера (2026-06-09)

### Критические баги

1. **parseAPList bssid: m[3] (`marauderV1.ts:65`)**
   - Regex `/\[(\d+)\]\[CH:(\d+)\]\s+(.+)/` → 3 capture groups
   - `m[3]` = rest (essid+rssi), **не BSSID**
   - `apData.bssid` получает `"HomeNet -65"` вместо MAC
   - Тест (parserEngine.test.js:79-84) не проверяет bssid
   - **Fix**: убрать `bssid: m[3]` из `apData`

2. **parseIPList ложно потребляет SSID (`marauderV1.ts:330`)**
   - Форматы `[N] Name` (SSID list, AirTag list, Probe list) не `[CH:N]` → минуют parseAPList
   - Regex `/^\[(\d+)\]\s+(\S+)/` **захватывает** `[0] HomeNet` как ip=`"HomeNet"`
   - **Fix**: добавить guard — проверять на IP-формат или MAC в строке

### Потеря данных (data loss)

3. **parseAPInfo — silent discard** (`marauderV1.ts:317-319`)
   - `Last seen: 5s` и `Stations: 3` → `return true`, данные не сохранены
   - **Fix**: сохранять в apStore или dashboardStore

4. **parsePacketCount / parseChannelAnalyzer — полный сброс на header**
   - При `"Packet Statistics"` / `"Channel Analyzer"` все счётчики = 0
   - Если заголовок пришёл повторно — предыдущие данные потеряны

5. **parseSignalMonitor — ignore unknown SSID** (`marauderV1.ts:242`)
   - Если AP нет в apStore — сигнал молча дропается
   - Нет механизма временного создания AP

6. **serialReader buffer overflow** (`serialReader.ts:145-156`)
   - При >64KB буфер ужимается до ~32KB

7. **serialReader truncation** (`serialReader.ts:99-101`)
   - Строки >4096 байт обрезаются

### Непокрытые форматы

Валидатор `validate-parser.mjs` определяет 41 паттерн. Из них **не имеют реализации**:

| Паттерн | Пример | Судьба |
|---------|--------|--------|
| `INFO_OUTPUT` | `Firmware: Marauder` | parserMisses |
| `SETTINGS_OUTPUT` | `Name: ForcePMKID` | parserMisses |
| `PKT_MGMT` | `Mgmt: 48` | parserMisses |
| `BOOT_MSG` | `ets Jul 29 2019...` | parserMisses |
| `BOOT_ERROR` | `E (603) esp_core_dump...` | parserMisses |
| `BOOT_INFO` | `ESP-IDF version is:` | parserMisses |
| `HELP_CMD` | `channel [-s ...]` | parserMisses |
| `LIST_SELECTED` | `0 selected` | parserMisses |
| `PROBE_EMPTY` | `Requesting:` (без SSID) | parserMisses |
| `DEAUTH_TX` | `DEAUTH TX: 42 packets` | parserMisses |
| `LIST_SSID` | `[0] HomeNet` | **ложно** в parseIPList |
| `LIST_AIRTAG` | `[0] AirTag XYZ` | **ложно** в parseIPList |
| `LIST_PROBE` | `[0] Name (42)` | **ложно** в parseIPList |
| `SYS_BRACKET` | `[Brightness] Set to level 5` | parserMisses |
| NMEA/GPS | `$GPGGA...` | parserMisses |
| sniffpwn/sae/skim | — | parserMisses |

### Silent failures

8. **parserMisses невидимы пользователю** — метрика (`metrics.ts:13`) инкрементится (`parserEngine.ts:122`), но не отображается в UI
9. **Строки `> command` отбрасываются** — `parseLine` (parserEngine.ts:101) выходит при `startsWith('> ')`
10. **Комментарии `#[a-z]+` в system events** — `#sniffbeacon`, `#stopscan` регистрируются как события, хотя должны игнорироваться

---

## Правила работы

1. Все команды → через `commandExecutor`
2. Минимальные патчи без переписывания
3. Сохранять совместимость с существующими парсерами
4. Документировать каждое изменение
5. Простое и стабильное > сложное и функциональное

---

## Тестирование

```bash
# Unit тесты (без E2E)
npx vitest run --exclude "tests/e2e/**"

# Сборка
npm run build

# E2E (требует dev server на порту 3010)
npx playwright test
```

---

## Чек-лист после изменений

- [x] `npm run build` проходит
- [x] Unit тесты проходят (298 тестов)
- [x] Парсер: устранён баг parseAPList bssid (убрать m[3])
- [x] Парсер: parseIPList guard от ложного захвата SSID
- [x] Парсер: parseAPInfo сохраняет Last seen / Stations
- [ ] Парсер: реализованы недостающие 16+ форматов (boot, help, settings, info, bracket, mgmt-stats, probe-empty, deauth-tx, ssid-list, airtag-list, probe-list, nmea, gps)
- [ ] Парсер: отображать parserMisses в UI
- [x] Парсер: parseSignalMonitor создаёт временный AP при неизвестном SSID
- [x] Нет console.log в продакшн коде
- [x] Версия в package.json обновлена
- [x] Контекст обновлён
- [ ] USB VID/PID runtime validation после requestPort и в auto-reconnect
- [x] v-html → v-text в DashboardView (удалён XSS вектор)
- [x] html: true mode удалён из sanitizeText
- [x] Allowlist команд вместо blacklist, единая валидация в commandExecutor
- [x] DashboardView и WorkflowBuilder переведены на runAction()
- [x] streaming TextDecoder в serialReader
- [ ] Парсерный CPU budget / rate-limit детекция
- [ ] Async: disconnect разрешает висящие sendAndWait (R1)
- [x] Async: таймаут на requestPort (R2)
- [x] Async: WorkflowBuilder переведён на runAction (R3)
- [x] Async: disconnect пробрасывает abort в WorkflowBuilder (R4)
- [x] Async: AbortController проверка перед _send (R5)
- [x] Async: reconnect отменяет in-flight команды (R6)
- [ ] Async: apStore race condition устранён (R7)
- [x] Async: cancelPending не race'ит с _processQueue (R9)
- [x] Async: cancelPendingSaves в disconnect (R10)
- [x] Async: side effects только в actionDispatcher (R12)
- [x] Async: resetCtxCache на reconnect (R13)
- [x] Async: try/catch в _notifyLine (R14)
- [x] Async: _executing флаг в actionDispatcher (R15)
- [x] BR-01: apStore.removeOldAPs — triggerRef + _recomputeStats
- [x] BR-02: bleStore.hydrate — triggerRef
- [x] BR-03: clearAllStores helper в serialStore
- [x] BR-04: clearlist -a расширен на все data stores
- [x] BR-07: BLE + probe cleanup в parserEngine
- [x] BR-08: clearListAndScan сбрасывает dashboard

---

## Важно

Этот файл — контекст для восстановления в новой сессии.
Не заменяет README.md. Не является инструкцией для изменения логики.
