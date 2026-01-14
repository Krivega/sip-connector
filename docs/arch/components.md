# Компоненты SIP Connector

Детальное описание всех менеджеров и их внутренних компонентов.

## ConnectionManager (SIP-соединения)

**Назначение**: Управление SIP-соединениями и регистрацией на сервере.

**Ключевые возможности**:

- Создание и управление SIP User Agent
- Регистрация/отмена регистрации на сервере
- Управление состояниями соединения через ConnectionStateMachine (XState)
- WebSocket соединения
- SIP-операции (OPTIONS, PING)
- Валидация переходов состояний с логированием

**Основные методы**:

- `connect()` / `disconnect()` - управление соединением
- `register()` / `unregister()` - регистрация на сервере
- `sendOptions()` / `ping()` - SIP-операции
- `checkTelephony()` - проверка телефонии

**Внутренние компоненты**:

- **ConnectionStateMachine** - управление состояниями SIP-соединения (XState)
  - Валидация переходов между состояниями
  - Публичный API с геттерами: `isIdle`, `isConnecting`, `isInitializing`, `isConnected`, `isRegistered`, `isDisconnected`, `isFailed`, `isPending`, `isPendingConnect`, `isPendingInitUa`, `isActiveConnection`
  - Типобезопасная обработка ошибок (error: Error | undefined)
  - Детальная информация об ошибках регистрации с status_code и reason_phrase
  - Методы: `reset()`, `startConnect()`, `startInitUa()`, `onStateChange()`, `canTransition()`, `getValidEvents()`
  - События: `START_CONNECT`, `START_INIT_UA`, `UA_CONNECTED`, `UA_REGISTERED`, `UA_UNREGISTERED`, `UA_DISCONNECTED`, `CONNECTION_FAILED`, `RESET`
  - Автоматическое логирование всех переходов состояний

---

## ConnectionQueueManager (Очередь операций)

**Назначение**: Обеспечивает последовательное выполнение операций подключения.

**Ключевые возможности**:

- Предотвращение конфликтов между операциями
- Последовательное выполнение connect/disconnect
- Управление очередью через stack-promises

**Основные методы**:

- `connect()` / `disconnect()` - проксирование методов ConnectionManager
- `stop()` - остановка всех операций в очереди

**Принцип работы**: Все операции выполняются последовательно в очереди для предотвращения гонки условий.

---

## AutoConnectorManager (Автоматическое переподключение)

**Назначение**: Обеспечивает автоматическое переподключение.

**Ключевые возможности**:

- Автоматические попытки переподключения с задержками
- Проверка доступности телефонии
- Мониторинг состояния соединения
- Управление событиями попыток подключения

**Основные методы**:

- `start(parameters)` - запуск процесса автоподключения
- `stop()` - отмена текущей попытки автоподключения

---

## CallManager (WebRTC-звонки)

**Назначение**: Управление WebRTC-звонками через паттерн Стратегия.

**Ключевые возможности**:

- Исходящие и входящие звонки
- Управление WebRTC соединениями
- Управление медиа-потоками
- Поддержка различных протоколов
- Отслеживание изменений удаленных потоков через события
- Управление ролями участников (participant/spectator)
- Валидация переходов состояний через CallStateMachine

**Основные методы**:

- `startCall()` / `endCall()` - управление звонками
- `replaceMediaStream()` - замена медиа-потоков
- `restartIce()` - перезапуск соединения

**События**:

- `call:remote-streams-changed` - уведомление об изменении удаленных потоков (заменяет callback `setRemoteStreams`)

**Внутренние компоненты**:

- **CallStateMachine** - управление состояниями звонка (XState)
  - Валидация переходов между состояниями
  - Публичный API с геттерами: `isIdle`, `isConnecting`, `isRinging`, `isAccepted`, `isInCall`, `isEnded`, `isFailed`, `isPending`, `isActive`
  - Типобезопасная обработка ошибок (lastError: Error)
  - Метод `reset()` для перехода в начальное состояние
  - События: `CALL.CONNECTING`, `CALL.RINGING`, `CALL.ACCEPTED`, `CALL.CONFIRMED`, `CALL.ENDED`, `CALL.FAILED`, `CALL.RESET`
  - Предотвращение недопустимых переходов с логированием

- **MCUSession** - управление основным RTCSession для участников конференции
  - Создание и управление SIP-звонками через @krivega/jssip
  - Обработка событий peerconnection и track
  - Управление жизненным циклом звонка

- **RecvSession** - управление receive-only сессией для зрителей
  - Создание отдельного RTCPeerConnection для приема потоков
  - Поддержка receive-only transceiver'ов
  - Используется при перемещении участника в режим spectator

- **RemoteStreamsManager** (два экземпляра: main и recv)
  - **MainRemoteStreamsManager** - управление потоками для участников
  - **RecvRemoteStreamsManager** - управление потоками для зрителей
  - Группировка треков по участникам и потокам
  - Генерация событий `remote-streams-changed` при изменениях
  - Отслеживание окончания треков и автоматическая очистка

- **RoleManager** - управление ролями участника
  - Переключение между ролями: `participant`, `spectator`, `spectator_synthetic`
  - Выбор активного RemoteStreamsManager (main или recv)
  - Управление жизненным циклом RecvSession при смене роли

**Зависимости**:

- `ConferenceStateManager` - для хранения состояния звонка (number, answer)

---

## ConferenceStateManager (Состояние конференции)

**Назначение**: Централизованное хранение состояния конференции и звонка.

**Ключевые возможности**:

- Хранение данных конференции: room, participantName, channels, token (jwt), conference, participant
- Хранение данных звонка: number, answer (перенесены из callConfiguration)
- Реактивные обновления через систему событий
- Автоматическое обновление состояния при получении событий от ApiManager

**Основные методы**:

- `getState()` - получение readonly копии состояния
- `updateState(updates)` - обновление состояния с триггером события
- `reset()` - очистка состояния
- Геттеры для удобного доступа: `getToken()`, `getRoom()`, `getParticipantName()`, `getChannels()`, `getConference()`, `getParticipant()`, `getNumber()`, `getAnswer()`

**События**:

- `state-changed` - уведомление об изменении состояния (содержит previous, current, updates)
- `state-reset` - уведомление о сбросе состояния

**Интеграция**:

- Автоматически обновляется при получении событий от ApiManager:
  - `enterRoom` → обновляет `{ room, participantName }`
  - `conference:participant-token-issued` → обновляет `{ token: jwt, conference, participant }`
  - `channels` → обновляет `{ channels }`
- Используется CallManager для хранения данных звонка
- Используется SipConnector для передачи токена в API-запросы (sendOffer)

---

## ApiManager (Серверное API)

**Назначение**: Обработка SIP INFO сообщений и взаимодействие с сервером.

**Ключевые возможности**:

- Обработка команд от сервера
- Отправка состояния медиа
- Управление DTMF-сигналами
- События restart для управления transceiver'ами
- Синхронизация каналов
- Обработка событий перемещения участников

**Основные методы**:

- `sendMediaState()` - отправка состояния медиа
- `sendDTMF()` - отправка DTMF-сигналов
- `waitChannels()` - ожидание каналов
- `askPermissionToEnableCam()` - запрос разрешений

**События участников**:

- `api:participant:move-request-to-spectators` - перемещение в зрители (новый формат с `isSynthetic` или `audioId`)
- `api:participant:move-request-to-spectators-synthetic` - перемещение в зрители (синтетическое событие для обратной совместимости)
- `api:participant:move-request-to-participants` - перемещение в участники

---

## PresentationManager (Презентации)

**Назначение**: Управление демонстрацией экрана и презентациями.

**Ключевые возможности**:

- Запуск и остановка презентаций
- Обновление потоков презентации
- Управление битрейтом презентации
- Обработка дублированных вызовов
- Поддержка P2P и MCU режимов
- Валидация переходов состояний через PresentationStateMachine

**Основные методы**:

- `startPresentation()` / `stopPresentation()` - управление презентациями
- `updatePresentation()` - обновление потока
- `cancelSendPresentationWithRepeatedCalls()` - отмена операций

**Внутренние компоненты**:

- **PresentationStateMachine** - управление состояниями демонстрации экрана (XState)
  - Валидация переходов между состояниями
  - Публичный API с геттерами: `isIdle`, `isStarting`, `isActive`, `isStopping`, `isFailed`, `isPending`, `isActiveOrPending`
  - Типобезопасная обработка ошибок (lastError: Error | undefined)
  - Методы: `reset()`, события: `SCREEN.STARTING`, `SCREEN.STARTED`, `SCREEN.ENDING`, `SCREEN.ENDED`, `SCREEN.FAILED`, `CALL.ENDED`, `CALL.FAILED`, `PRESENTATION.RESET`
  - Полное логирование всех переходов состояний

---

## IncomingCallManager (Входящие звонки)

**Назначение**: Обработка входящих SIP-звонков.

**Ключевые возможности**:

- Обнаружение входящих звонков
- Управление данными вызывающего
- Принятие и отклонение звонков
- Извлечение RTCSession для CallManager
- Валидация переходов состояний через IncomingCallStateMachine

**Основные методы**:

- `getIncomingRTCSession()` - получение сессии
- `declineToIncomingCall()` - отклонение звонка
- `busyIncomingCall()` - ответ "занято"

**Внутренние компоненты**:

- **IncomingCallStateMachine** - управление состояниями входящих SIP-звонков (XState)
  - Валидация переходов между состояниями
  - Публичный API с геттерами: `isIdle`, `isRinging`, `isConsumed`, `isDeclined`, `isTerminated`, `isFailed`, `isActive`, `isFinished`
  - Хранение данных вызывающего абонента (remoteCallerData)
  - Геттеры контекста: `remoteCallerData`, `lastReason`
  - Методы: `reset()`, `toConsumed()`, события: `INCOMING.RINGING`, `INCOMING.CONSUMED`, `INCOMING.DECLINED`, `INCOMING.TERMINATED`, `INCOMING.FAILED`, `INCOMING.CLEAR`
  - Полное логирование всех переходов состояний

---

## StatsManager (Статистика)

**Назначение**: Сбор и мониторинг WebRTC статистики.

**Ключевые возможности**:

- Сбор WebRTC статистики через StatsPeerConnection
- Мониторинг качества соединения
- Отслеживание доступной входящей пропускной способности

---

## VideoSendingBalancerManager (Балансировка видео)

**Назначение**: Автоматическая оптимизация видеопотоков.

**Ключевые возможности**:

- Автоматическая оптимизация видеопотоков с задержкой запуска (10 секунд)
- Адаптивное опрашивание изменений треков
- Управление параметрами кодирования
- Планирование и остановка балансировки
