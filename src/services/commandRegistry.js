export const COMMAND_GROUPS = [
  {
    name: 'Scanning',
    nameRu: 'Сканирование',
    commands: [
      { label: 'Scan All', command: 'scanall', icon: '📡',
        ru: 'Сканирование точек доступа и станций одновременно. Останавливается командой stopscan. Результат: RSSI Ch BSSID ESSID.' },
      { label: 'Sniff Beacon', command: 'sniffbeacon', icon: '📶',
        ru: 'Перехват beacon-фреймов — служебных пакетов, которые точки доступа рассылают для анонса своих сетей.' },
      { label: 'Sniff Probe', command: 'sniffprobe', icon: '📱',
        ru: 'Перехват probe-запросов от клиентов. Показывает, какие сети ищут устройства поблизости.' },
      { label: 'Sniff Deauth', command: 'sniffdeauth', icon: '🔪',
        ru: 'Перехват deauthentication-пакетов. Позволяет видеть, когда клиентов принудительно отключают от сети.' },
      { label: 'Sniff PMKID', command: 'sniffpmkid', icon: '🔑',
        ru: 'Захват PMKID-хэшей из WPA2-рукопожатия. Используется для офлайн-взлома пароля сети.' },
      { label: 'Sniff Raw', command: 'sniffraw', icon: '📻',
        ru: 'Перехват всех WiFi-пакетов в эфире без фильтрации. Сырые данные.' },
      { label: 'Sniff SAE', command: 'sniffsae', icon: '🛡',
        ru: 'Перехват SAE (WPA3) commit-пакетов для анализа рукопожатий WPA3.' },
      { label: 'Sniff PWN', command: 'sniffpwn', icon: '🤖',
        ru: 'Обнаружение Pwnagotchi-устройств поблизости.' },
      { label: 'Sniff Pine', command: 'sniffpinescan', icon: '🍍',
        ru: 'Обнаружение WiFi Pineapple устройств в эфире по OUI и капабилити.' },
      { label: 'Sniff Multi', command: 'sniffmultissid', icon: '🔗',
        ru: 'Поиск устройств, транслирующих несколько SSID с одного MAC-адреса.' },
      { label: 'Stop', command: 'stopscan', icon: '⏹', color: 'red',
        ru: 'Немедленная остановка любого текущего сканирования, сниффинга или атаки.' }
    ]
  },
  {
    name: 'Attacks',
    nameRu: 'Атаки ⚠',
    commands: [
      { label: 'Deauth All', command: 'attack -t deauth', icon: '⚡', warning: true,
        ru: 'Массовая рассылка deauth-пакетов выбранным точкам доступа. Требует предварительного выбора целей через select -a.' },
      { label: 'Deauth Targeted', command: 'attack -t deauth -c', icon: '🎯', warning: true,
        ru: 'Deauth-атака на конкретные станции (клиенты) по списку.' },
      { label: 'Beacon Random', command: 'attack -t beacon -r', icon: '📯', warning: true,
        ru: 'Рассылка beacon-фреймов со случайными именами сетей. Засоряет эфир ложными WiFi-сетями.' },
      { label: 'Beacon List', command: 'attack -t beacon -l', icon: '📋', warning: true,
        ru: 'Рассылка beacon-фреймов из списка SSID. Предварительно добавьте SSID через ssid -a.' },
      { label: 'Beacon Clone', command: 'attack -t beacon -a', icon: '🔄', warning: true,
        ru: 'Клонирование выбранных точек доступа — рассылка beacon с их SSID и BSSID.' },
      { label: 'Funny Beacon', command: 'attack -t funny', icon: '😂', warning: true,
        ru: 'Рассылка beacon с забавными SSID: "Abraham Linksys", "FBI Surveillance Van", "404 Wi-Fi Unavailable" и другими.' },
      { label: 'Probe Spam', command: 'attack -t probe', icon: '📨', warning: true,
        ru: 'Массовая рассылка probe-запросов от выбранных точек доступа.' },
      { label: 'Rick Roll', command: 'attack -t rickroll', icon: '🎵', warning: true,
        ru: 'Рассылка beacon-фреймов с названиями песен Rick Astley.' },
      { label: 'Bad Msg', command: 'attack -t badmsg', icon: '💥', warning: true,
        ru: 'Атака bad-message — отправка повреждённых EAPOL-кадров. Может вызвать сбой на клиентах.' },
      { label: 'Sleep Attack', command: 'attack -t sleep', icon: '💤', warning: true,
        ru: 'Атака ассоциацией в спящий режим. Отправляет клиентам запрос на переход в сон.' },
      { label: 'Quiet Attack', command: 'attack -t quiet', icon: '🔇', warning: true,
        ru: 'Quiet Time атака — отправка Quiet-элементов в beacon-фреймах. Может заставить клиентов временно отключиться от сети.' },
      { label: 'SAE Attack', command: 'attack -t sae', icon: '🔐', warning: true,
        ru: 'Отправка SAE commit-кадров (WPA3). Может нарушить аутентификацию WPA3.' },
      { label: 'CSA Attack', command: 'attack -t csa', icon: '🔀', warning: true,
        ru: 'Channel Switch Announcement — ложное объявление о смене канала.' }
    ]
  },
  {
    name: 'Bluetooth',
    nameRu: 'Bluetooth',
    commands: [
      { label: 'Scan BLE', command: 'sniffbt', icon: '🔵',
        ru: 'Сканирование всех Bluetooth LE устройств поблизости.' },
      { label: 'Sniff AirTag', command: 'sniffbt -t airtag', icon: '🏷',
        ru: 'Поиск и отслеживание AirTag-устройств в зоне действия.' },
      { label: 'Sniff Flipper', command: 'sniffbt -t flipper', icon: '🐬',
        ru: 'Обнаружение Flipper Zero устройств по BLE-сигнатуре.' },
      { label: 'Sniff Flock', command: 'sniffbt -t flock', icon: '📷',
        ru: 'Обнаружение камер Flock Penguin (XUNTONG).' },
      { label: 'Sniff Meta', command: 'sniffbt -t meta', icon: '🕶',
        ru: 'Обнаружение Meta/Ray-Ban устройств по BLE.' },
      { label: 'Skim Sniff', command: 'sniffskim', icon: '💳',
        ru: 'Поиск BLE-скиммеров (HC-03, HC-05, HC-06).' },
      { label: 'BT Spam All', command: 'blespam -t all', icon: '📤', warning: true,
        ru: 'Рассылка всех типов BLE-спама одновременно.' },
      { label: 'Sour Apple', command: 'blespam -t sourapple', icon: '🍎', warning: true,
        ru: 'BLE-спам с идентификаторами Apple (Sour Apple атака).' },
      { label: 'Apple Juice', command: 'blespam -t applejuice', icon: '🧃', warning: true,
        ru: 'Apple Juice — вариант BLE-спама с Apple-пакетами.' },
      { label: 'Google Spam', command: 'blespam -t google', icon: '🔔', warning: true,
        ru: 'BLE-спам с Fast Pair пакетами Google.' },
      { label: 'Samsung Spam', command: 'blespam -t samsung', icon: '⌚', warning: true,
        ru: 'BLE-спам с идентификаторами Samsung Galaxy Watch.' },
      { label: 'Windows Spam', command: 'blespam -t windows', icon: '🪟', warning: true,
        ru: 'BLE-спам с Microsoft Swift Pair пакетами.' },
      { label: 'Spoof AirTag', command: 'spoofat -t 0', icon: '🔄',
        ru: 'Спуфинг перехваченного AirTag (выберите индекс через list -t).' }
    ]
  },
  {
    name: 'Lists',
    nameRu: 'Списки',
    commands: [
      { label: 'List APs', command: 'list -a', icon: '📋',
        ru: 'Показать список найденных точек доступа с индексами и уровнем сигнала.' },
      { label: 'List Stations', command: 'list -c', icon: '📋',
        ru: 'Показать список станций (клиентов), сгруппированных по точкам доступа.' },
      { label: 'List SSIDs', command: 'list -s', icon: '📋',
        ru: 'Показать сгенерированные или добавленные SSID для beacon-атак.' },
      { label: 'List AirTags', command: 'list -t', icon: '📋',
        ru: 'Показать список обнаруженных AirTag устройств.' },
      { label: 'List Probes', command: 'list -p', icon: '📋',
        ru: 'Показать список probe-запросов, перехваченных от клиентов.' },
      { label: 'List IPs', command: 'list -i', icon: '📋',
        ru: 'Показать список IP-адресов в локальной сети.' }
    ]
  },
  {
    name: 'Selection',
    nameRu: 'Выбор',
    commands: [
      { label: 'Sel AP 0', command: 'select -a 0', icon: '✅',
        ru: 'Выбрать точку доступа с индексом 0. Повторный вызов снимает выбор.' },
      { label: 'Sel AP All', command: 'select -a all', icon: '☑',
        ru: 'Инвертировать выбор всех точек доступа.' },
      { label: 'Sel Stations', command: 'select -c all', icon: '📱',
        ru: 'Выбрать/снять все станции.' },
      { label: 'Filter "contains"', command: `select -a -f "contains Home"`, icon: '🔍',
        ru: 'Выбрать все AP, в имени которых есть "Home". Работает с любым текстом.' },
      { label: 'Filter "equals"', command: `select -a -f "equals MyWiFi"`, icon: '🎯',
        ru: 'Выбрать AP с точным совпадением имени "MyWiFi".' },
      { label: 'Clear APs', command: 'clearlist -a', icon: '🗑',
        ru: 'Очистить список точек доступа.' },
      { label: 'Clear SSIDs', command: 'clearlist -s', icon: '🗑',
        ru: 'Очистить список SSID.' },
      { label: 'Clear Stations', command: 'clearlist -c', icon: '🗑',
        ru: 'Очистить список станций.' }
    ]
  },
  {
    name: 'SSID',
    nameRu: 'SSID',
    commands: [
      { label: 'Gen 10', command: 'ssid -a -g 10', icon: '🎲',
        ru: 'Сгенерировать 10 случайных SSID для beacon-атак.' },
      { label: 'Gen 50', command: 'ssid -a -g 50', icon: '🎲',
        ru: 'Сгенерировать 50 случайных SSID для массовой beacon-атаки.' },
      { label: 'Add Name', command: 'ssid -a -n "MySSID"', icon: '➕',
        ru: 'Добавить конкретное имя SSID в список.' },
      { label: 'Remove SSID', command: 'ssid -r 0', icon: '➖',
        ru: 'Удалить SSID из списка по индексу (укажите номер из list -s).' },
      { label: 'Save SSIDs', command: 'save -s', icon: '💾',
        ru: 'Сохранить список SSID на SD-карту.' },
      { label: 'Load SSIDs', command: 'load -s', icon: '📂',
        ru: 'Загрузить список SSID с SD-карты.' },
      { label: 'Save APs', command: 'save -a', icon: '💾',
        ru: 'Сохранить список AP на SD-карту.' },
      { label: 'Load APs', command: 'load -a', icon: '📂',
        ru: 'Загрузить список AP с SD-карты.' }
    ]
  },
  {
    name: 'MAC',
    nameRu: 'MAC-адреса',
    commands: [
      { label: 'Random AP', command: 'randapmac', icon: '🎭',
        ru: 'Установить случайный MAC-адрес для режима точки доступа.' },
      { label: 'Random STA', command: 'randstamac', icon: '🎭',
        ru: 'Установить случайный MAC-адрес для режима клиента.' },
      { label: 'Clone AP MAC', command: 'cloneapmac -a 0', icon: '📋',
        ru: 'Клонировать MAC-адрес выбранной точки доступа (укажите индекс).' },
      { label: 'Clone STA', command: 'clonestamac -s 0', icon: '📋',
        ru: 'Клонировать MAC-адрес выбранной станции (укажите индекс).' }
    ]
  },
  {
    name: 'Network',
    nameRu: 'Сеть',
    commands: [
      { label: 'Join AP', command: 'join -a 0 -p "password"', icon: '🔗',
        ru: 'Подключиться к точке доступа с индексом 0 и указанным паролем.' },
      { label: 'Join Saved', command: 'join -s', icon: '🔗',
        ru: 'Подключиться к сохранённой WiFi-сети (SSID и пароль из настроек).' },
      { label: 'Add AP', command: 'add -a -b AA:BB:CC:DD:EE:FF -e "SSID"', icon: '➕',
        ru: 'Добавить точку доступа вручную: MAC и имя сети.' },
      { label: 'Add Station', command: 'add -c -b AA:BB:CC:DD:EE:FF -ap 0', icon: '➕',
        ru: 'Добавить станцию вручную: MAC и индекс AP, к которой она подключена.' },
      { label: 'Ping Scan', command: 'pingscan', icon: '📶',
        ru: 'Ping-сканирование локальной сети (требуется подключение к WiFi).' },
      { label: 'ARP Scan', command: 'arpscan', icon: '🔍',
        ru: 'ARP-сканирование сети для обнаружения устройств.' },
      { label: 'Port Scan All', command: 'portscan -a -t 0', icon: '🔌',
        ru: 'Сканирование всех портов устройства по индексу из list -i.' },
      { label: 'Port Scan SSH', command: 'portscan -s ssh', icon: '🔑',
        ru: 'Проверка открытых портов: SSH (22).' },
      { label: 'Port Scan HTTP', command: 'portscan -s http', icon: '🌐',
        ru: 'Проверка открытых портов: HTTP (80).' },
      { label: 'Port Scan HTTPS', command: 'portscan -s https', icon: '🔒',
        ru: 'Проверка открытых портов: HTTPS (443).' }
    ]
  },
  {
    name: 'Admin',
    nameRu: 'Админ',
    commands: [
      { label: 'System Info', command: 'info', icon: 'ℹ',
        ru: 'Показать информацию о системе: версия прошивки, MAC-адреса, размер SD, уровень батареи.' },
      { label: 'AP Info', command: 'info -a 0', icon: 'ℹ',
        ru: 'Показать детальную информацию о точке доступа: ESSID, BSSID, канал, RSSI, security, EAPOL, производитель.' },
      { label: 'Settings', command: 'settings', icon: '⚙',
        ru: 'Показать текущие настройки ESP32 Marauder в JSON-формате.' },
      { label: 'Channel 1', command: 'channel -s 1', icon: '📺',
        ru: 'Переключить WiFi-чип на 1-й канал (2412 МГц).' },
      { label: 'Channel 6', command: 'channel -s 6', icon: '📺',
        ru: 'Переключить WiFi-чип на 6-й канал (2437 МГц).' },
      { label: 'Channel 11', command: 'channel -s 11', icon: '📺',
        ru: 'Переключить WiFi-чип на 11-й канал (2462 МГц).' },
      { label: 'Reboot', command: 'reboot', icon: '🔄',
        ru: 'Перезагрузка ESP32.' },
      { label: 'LED Color', command: 'led -s #FF0000', icon: '💡',
        ru: 'Установить цвет LED (hex): красный (#FF0000), зелёный (#00FF00), синий (#0000FF).' },
      { label: 'LED Rainbow', command: 'led -p rainbow', icon: '🌈',
        ru: 'Включить режим rainbow на LED.' },
      { label: 'Brightness', command: 'brightness -s 5', icon: '☀',
        ru: 'Установить яркость дисплея (0-9).' },
      { label: 'Packet Count', command: 'packetcount', icon: '📊',
        ru: 'Показать статистику перехваченных пакетов: beacon, probe, deauth, eapol, mgmt, data.' },
      { label: 'Signal Mon', command: 'sigmon', icon: '📈',
        ru: 'Мониторинг уровня сигнала выбранных точек доступа в реальном времени.' },
      { label: 'Ch Analyzer', command: 'channelanalyzer', icon: '📊',
        ru: 'Анализ загрузки каналов WiFi. Показывает количество фреймов на каждом канале.' },
      { label: 'MAC Tracker', command: 'mactrack', icon: '📍',
        ru: 'Отслеживание MAC-адресов в эфире: количество фреймов, RSSI, время последнего появления.' },
      { label: 'GPS Data', command: 'gpsdata', icon: '🛰',
        ru: 'Поток GPS-данных: широта, долгота, высота, скорость, количество спутников.' },
      { label: 'NMEA', command: 'nmea', icon: '📡',
        ru: 'Поток сырых NMEA-предложений с GPS-модуля.' },
      { label: 'GPS POI', command: 'gpspoi -s', icon: '📍',
        ru: 'Режим отметки POI (точек интереса) с GPS-координатами.' },
      { label: 'GPS Tracker', command: 'gpstracker -c start', icon: '🏃',
        ru: 'GPS-трекер — непрерывное отслеживание текущих координат.' },
      { label: 'Wardrive', command: 'wardrive', icon: '🗺',
        ru: 'Режим вардрайвинга: непрерывное сканирование WiFi с записью GPS-координат в Wigle-формат.' },
      { label: 'POI Tag', command: 'wardrivepoi Метка', icon: '📌',
        ru: 'Отметить точку интереса (POI) во время вардрайва. Можно указать название.' },
      { label: 'Evil Portal', command: 'evilportal -c start', icon: '👿',
        ru: 'Запуск Evil Portal — captive portal для перехвата учётных данных.' },
      { label: 'Karma', command: 'karma -p 0', icon: '🔄',
        ru: 'Karma-атака — отвечает на probe-запросы, заставляя клиенты подключаться к поддельному AP.' },
      { label: 'ls SD', command: 'ls /', icon: '📁',
        ru: 'Показать список файлов на SD-карте.' },
      { label: 'SD Update', command: 'update -s', icon: '⬆',
        ru: 'Обновить прошивку с SD-карты (файл firmware.bin в корне).' }
    ]
  }
]

export const WORKFLOWS = [
  {
    id: 'quick-recon',
    name: 'Quick Recon',
    description: 'Full WiFi recon: APs, stations, PMKID',
    ru: 'Полный сбор информации: сканирование AP + станций + захват PMKID.',
    icon: '🔍',
    steps: [
      { command: 'scanall', desc: 'Scanning APs & stations', delay: 8000 },
      { command: 'stopscan', desc: 'Stop scanning' },
      { command: 'list -a', desc: 'Listing APs', delay: 2000 },
      { command: 'list -c', desc: 'Listing stations', delay: 2000 },
      { command: 'sniffpmkid', desc: 'Capturing PMKID', delay: 20000 },
      { command: 'stopscan', desc: 'Stop PMKID capture' }
    ]
  },
  {
    id: 'beacon-flood',
    name: 'Beacon Flood',
    description: 'Generate random SSIDs and broadcast',
    ru: 'Генерация 50 SSID и массовая рассылка beacon-фреймов.',
    icon: '📯',
    warning: true,
    steps: [
      { command: 'ssid -a -g 50', desc: 'Generate 50 SSIDs' },
      { command: 'list -s', desc: 'Show generated' },
      { command: 'attack -t beacon -l', desc: 'Broadcast beacons (stop manually)' }
    ]
  },
  {
    id: 'deauth-all',
    name: 'Deauth Flood',
    description: 'Deauth clients from selected APs',
    ru: 'Deauth-атака на выбранные точки доступа.',
    icon: '⚡',
    warning: true,
    steps: [
      { command: 'scanall', desc: 'Scanning APs', delay: 5000 },
      { command: 'stopscan', desc: 'Stop scanning' },
      { command: 'list -a', desc: 'Listing APs', delay: 2000 },
      { command: 'select -a {input}', desc: 'Select targets (comma-separated)', requiresInput: true, splitInput: true, label: 'AP indices', placeholder: '0,1,2' },
      { command: 'attack -t deauth', desc: 'Deauth flood (stop manually)' }
    ]
  },
  {
    id: 'deauth-targeted',
    name: 'Deauth Targeted',
    description: 'Deauth specific clients by station list',
    ru: 'Deauth-атака на конкретные станции через -c.',
    icon: '🎯',
    warning: true,
    steps: [
      { command: 'scanall', desc: 'Scanning', delay: 5000 },
      { command: 'stopscan', desc: 'Stop scanning' },
      { command: 'list -c', desc: 'View stations', delay: 2000 },
      { command: 'attack -t deauth -c', desc: 'Targeted deauth (stop manually)' }
    ]
  },
  {
    id: 'clone-spam',
    name: 'AP Clone Spam',
    description: 'Clone selected APs and broadcast',
    ru: 'Клонирование выбранных AP и рассылка beacon с их SSID.',
    icon: '🔄',
    warning: true,
    steps: [
      { command: 'scanall', desc: 'Scanning APs', delay: 5000 },
      { command: 'stopscan', desc: 'Stop scanning' },
      { command: 'list -a', desc: 'Listing APs', delay: 2000 },
      { command: 'select -a {input}', desc: 'Select targets (comma-separated)', requiresInput: true, splitInput: true, label: 'AP indices', placeholder: '0,1,2' },
      { command: 'attack -t beacon -a', desc: 'Clone broadcast (stop manually)' }
    ]
  },
  {
    id: 'clone-deauth',
    name: 'Clone + Deauth',
    description: 'Clone APs then deauth originals',
    ru: 'Клонировать AP и одновременно деавторизовать оригиналы — клиенты переподключатся к клону.',
    icon: '🕳',
    warning: true,
    steps: [
      { command: 'scanall', desc: 'Scanning APs', delay: 5000 },
      { command: 'stopscan', desc: 'Stop scanning' },
      { command: 'list -a', desc: 'Listing APs', delay: 2000 },
      { command: 'select -a {input}', desc: 'Select targets (comma-separated)', requiresInput: true, splitInput: true, label: 'AP indices', placeholder: '0,1' },
      { command: 'attack -t beacon -a', desc: 'Starting clone broadcast' },
      { command: 'attack -t deauth', desc: 'Deauth originals (stop manually)' }
    ]
  },
  {
    id: 'pmkid-capture',
    name: 'PMKID Capture',
    description: 'Active PMKID on selected APs with deauth',
    ru: 'Целевой захват PMKID-хэшей с deauth для ускорения получения рукопожатия.',
    icon: '🔑',
    steps: [
      { command: 'scanall', desc: 'Scanning APs', delay: 5000 },
      { command: 'stopscan', desc: 'Stop scanning' },
      { command: 'list -a', desc: 'Listing APs', delay: 2000 },
      { command: 'select -a {input}', desc: 'Select targets (comma-separated)', requiresInput: true, splitInput: true, label: 'AP indices', placeholder: '0,1' },
      { command: 'sniffpmkid', desc: 'PMKID capture with deauth', delay: 30000 },
      { command: 'stopscan', desc: 'Stop PMKID capture' }
    ]
  },
  {
    id: 'ble-scan',
    name: 'BLE Scan',
    description: 'Scan for all BLE devices',
    ru: 'Сканирование всех BLE-устройств поблизости.',
    icon: '🔵',
    steps: [
      { command: 'sniffbt', desc: 'Scanning BLE devices', delay: 10000 },
      { command: 'stopscan', desc: 'Stop BLE scan' }
    ]
  },
  {
    id: 'ble-discovery',
    name: 'BLE Discovery Full',
    description: 'Scan all BLE types: general, AirTag, Flipper, Meta',
    ru: 'Полное BLE-сканирование: общий поиск, AirTag, Flipper Zero, Meta/Ray-Ban.',
    icon: '🔍',
    steps: [
      { command: 'sniffbt', desc: 'General BLE scan', delay: 6000 },
      { command: 'stopscan', desc: 'Stop' },
      { command: 'sniffbt -t airtag', desc: 'AirTag sniff', delay: 6000 },
      { command: 'stopscan', desc: 'Stop' },
      { command: 'sniffbt -t flipper', desc: 'Flipper sniff', delay: 5000 },
      { command: 'stopscan', desc: 'Stop' },
      { command: 'sniffbt -t meta', desc: 'Meta/Ray-Ban sniff', delay: 5000 },
      { command: 'stopscan', desc: 'Stop' }
    ]
  },
  {
    id: 'airtag-sniff',
    name: 'AirTag Hunt',
    description: 'Sniff and list AirTags nearby',
    ru: 'Поиск AirTag устройств поблизости.',
    icon: '🏷',
    steps: [
      { command: 'sniffbt -t airtag', desc: 'Scanning AirTags', delay: 12000 },
      { command: 'stopscan', desc: 'Stop scanning' },
      { command: 'list -t', desc: 'Listing AirTags' }
    ]
  },
  {
    id: 'ble-spam',
    name: 'BLE Spam All',
    description: 'All BLE spam types simultaneously',
    ru: 'Рассылка всех типов BLE-спама: Apple, Samsung, Google, Windows, Flipper.',
    icon: '📤',
    warning: true,
    steps: [
      { command: 'blespam -t all', desc: 'All BLE spam (stop manually)' }
    ]
  },
  {
    id: 'funny-beacon',
    name: 'Funny Beacon',
    description: 'Broadcast funny SSID names',
    ru: 'Рассылка beacon с забавными SSID: FBI Surveillance Van, Abraham Linksys и другие.',
    icon: '😂',
    warning: true,
    steps: [
      { command: 'attack -t funny', desc: 'Funny beacon broadcast (stop manually)' }
    ]
  },
  {
    id: 'evil-portal',
    name: 'Evil Portal',
    description: 'Start captive portal on selected AP',
    ru: 'Запуск Evil Portal на выбранной точке доступа для перехвата учётных данных.',
    icon: '👿',
    warning: true,
    steps: [
      { command: 'scanall', desc: 'Scanning APs', delay: 5000 },
      { command: 'stopscan', desc: 'Stop scanning' },
      { command: 'list -a', desc: 'Listing APs', delay: 2000 },
      { command: 'evilportal -c setap {input}', desc: 'Set target AP index', requiresInput: true, label: 'AP index', placeholder: '0' },
      { command: 'evilportal -c start', desc: 'Starting Evil Portal (stop manually)' }
    ]
  },
  {
    id: 'network-scan',
    name: 'Network Scan',
    description: 'Full network scan: ping, ARP, ports',
    ru: 'Полное сканирование сети: ping, ARP, список IP, порт-скан.',
    icon: '🌐',
    steps: [
      { command: 'pingscan', desc: 'Ping scan', delay: 8000 },
      { command: 'stopscan', desc: 'Stop' },
      { command: 'arpscan', desc: 'ARP scan', delay: 8000 },
      { command: 'stopscan', desc: 'Stop' },
      { command: 'list -i', desc: 'List IPs' }
    ]
  },
  {
    id: 'gps-wardrive',
    name: 'GPS Wardrive',
    description: 'Continuous AP scanning with GPS logging',
    ru: 'Вардрайвинг: непрерывное сканирование AP + GPS-координаты, запись в Wigle-формат.',
    icon: '🗺',
    steps: [
      { command: 'gpsdata', desc: 'Start GPS data', delay: 3000 },
      { command: 'stopscan', desc: 'Stop GPS' },
      { command: 'wardrive', desc: 'Start wardriving (stop manually)' }
    ]
  },
  {
    id: 'mac-randomize',
    name: 'MAC Randomize',
    description: 'Randomize AP and STA MAC addresses',
    ru: 'Смена MAC-адресов перед началом работы: случайный MAC для AP и STA.',
    icon: '🎭',
    warning: true,
    steps: [
      { command: 'randapmac', desc: 'Random AP MAC' },
      { command: 'randstamac', desc: 'Random STA MAC' }
    ]
  },
  {
    id: 'save-session',
    name: 'Save Session',
    description: 'Save AP and SSID lists to SD card',
    ru: 'Сохранение результатов сессии: список AP и SSID на SD-карту.',
    icon: '💾',
    steps: [
      { command: 'scanall', desc: 'Scanning APs', delay: 8000 },
      { command: 'stopscan', desc: 'Stop scanning' },
      { command: 'list -a', desc: 'Listing APs', delay: 2000 },
      { command: 'save -a', desc: 'Saving AP list' },
      { command: 'save -s', desc: 'Saving SSID list' }
    ]
  },
  {
    id: 'info-dump',
    name: 'AP Info Dump',
    description: 'Detailed info about each AP',
    ru: 'Детальная информация по каждой точке доступа: видит ли ESP32 PMKID, какой security, бренд.',
    icon: 'ℹ',
    steps: [
      { command: 'list -a', desc: 'Listing APs', delay: 3000 },
      { command: 'info -a {idx}', desc: 'Info for each AP', forEachAP: true }
    ]
  }
]
