# Модель состояний сеанса (XState)

Sip-connector публикует единый XState-актор сеанса, агрегирующий параллельные машины по доменам: соединение, звонок, входящий звонок, шаринг экрана. Клиент получает только подписку на их статусы, бизнес-логика остаётся внутри sip-connector.

## Диаграмма состояний

```mermaid
stateDiagram-v2
    [*] --> session
    state session {
        state connection {
            idle --> preparing: start
            preparing --> connecting: initUa
            preparing --> disconnected: disconnected
            preparing --> failed: failed
            connecting --> connected: uaConnected
            connecting --> registered: uaRegistered
            connecting --> disconnected: disconnected
            connecting --> failed: failed
            connected --> established: always
            connected --> registered: uaRegistered
            connected --> disconnected: disconnected
            registered --> established: always
            registered --> connected: uaUnregistered
            registered --> disconnected: disconnected
            established --> disconnected: disconnected
            established --> idle: reset
            disconnected --> idle: reset
            disconnected --> preparing: start
            failed --> idle: reset
            failed --> preparing: start
        }
        state call {
            idle --> connecting: call.connecting
            connecting --> accepted: call.accepted
            connecting --> ended: call.ended
            connecting --> failed: call.failed
            accepted --> inCall: call.confirmed
            accepted --> ended: call.ended
            accepted --> failed: call.failed
            inCall --> ended: call.ended
            inCall --> failed: call.failed
            ended --> idle: call.reset
            ended --> connecting: call.connecting
            failed --> idle: call.reset
            failed --> connecting: call.connecting
            failed --> ended: call.ended
        }
        state incoming {
            idle --> ringing: incomingRinging
            ringing --> ringing: incomingRinging
            ringing --> consumed: incomingConsumed
            ringing --> declined: incomingDeclined
            ringing --> terminated: incomingTerminated
            ringing --> failed: incomingFailed
            ringing --> idle: clear
            consumed --> idle: clear
            consumed --> ringing: incomingRinging
            declined --> idle: clear
            declined --> ringing: incomingRinging
            terminated --> idle: clear
            terminated --> ringing: incomingRinging
            failed --> idle: clear
            failed --> ringing: incomingRinging
        }
        state presentation {
            idle --> starting: screenStarting
            starting --> active: screenStarted
            starting --> failed: screenFailed / callFailed
            starting --> idle: screenEnded / callEnded
            active --> stopping: screenEnding
            active --> idle: screenEnded / callEnded
            active --> failed: screenFailed / callFailed
            stopping --> idle: screenEnded / callEnded
            stopping --> failed: screenFailed / callFailed
            failed --> starting: screenStarting
            failed --> idle: reset / screenEnded
        }
    }
```

## Слои

- Каждая машина поднимается внутри своего менеджера: `connectionActor`, `callActor`, `incomingActor`, `presentationActor`.
- Менеджеры сами отправляют доменные события в свои акторы.
- Агрегатор: `createSession()` / `sipConnector.session` подписывается на `.subscribe` акторов менеджеров и отдает объединённый снапшот + типобезопасные селекторы.

## Доменные статусы и события

| Домен        | Статусы                                                                                               | Источники событий                                                                                                                                                                                     | Доменные события                                                                                                                         |
| :----------- | :---------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| Connection   | `idle`, `preparing`, `connecting`, `connected`, `registered`, `established`, `disconnected`, `failed` | `ConnectionManager.events` (`connect-started`, `connecting`, `connect-parameters-resolve-success`, `connected`, `registered`, `unregistered`, `disconnected`, `registrationFailed`, `connect-failed`) | `START_CONNECT`, `START_INIT_UA`, `UA_CONNECTED`, `UA_REGISTERED`, `UA_UNREGISTERED`, `UA_DISCONNECTED`, `CONNECTION_FAILED`, `RESET`    |
| Call         | `idle`, `connecting`, `accepted`, `inCall`, `ended`, `failed`                                         | `CallManager.events` (`connecting`, `accepted`, `confirmed`, `ended`, `failed`)                                                                                                                       | `CALL.CONNECTING`, `CALL.ACCEPTED`, `CALL.CONFIRMED`, `CALL.ENDED`, `CALL.FAILED`, `CALL.RESET`                                          |
| Incoming     | `idle`, `ringing`, `consumed`, `declined`, `terminated`, `failed`                                     | `IncomingCallManager.events` (`incomingCall`, `declinedIncomingCall`, `terminatedIncomingCall`, `failedIncomingCall`) + синтетика при ответе на входящий                                              | `INCOMING.RINGING`, `INCOMING.CONSUMED`, `INCOMING.DECLINED`, `INCOMING.TERMINATED`, `INCOMING.FAILED`, `INCOMING.CLEAR`                 |
| Presentation | `idle`, `starting`, `active`, `stopping`, `failed`                                                    | `CallManager.events` (`presentation:start\|started\|end\|ended\|failed`), `ConnectionManager.events` (`disconnected`, `registrationFailed`, `connect-failed`)                                         | `SCREEN.STARTING`, `SCREEN.STARTED`, `SCREEN.ENDING`, `SCREEN.ENDED`, `SCREEN.FAILED`, `CALL.ENDED`, `CALL.FAILED`, `PRESENTATION.RESET` |

## API для клиентов

- `createSipSession(deps)` / `sipConnector.session`: агрегатор снапшотов акторов менеджеров и утилиты подписки.
- `getSnapshot()` — текущее состояние всех доменов.
- `subscribe(selector, listener)` — типобезопасная подписка на срез состояния (например, `selectConnectionStatus`).
- `stop()` — очистка подписок на акторы менеджеров.

## Инварианты и гварды

- `presentation` может быть `active` только если `call` в `inCall`.
- `incoming` сбрасывается в `idle` при `call.ended` или `call.failed`.
- `connection` `failed` / `disconnected` приводит к `call` → `ended`, `presentation` → `idle`.
- `call`: `CALL.CONFIRMED` обрабатывается только из состояния `accepted` (не из `connecting`).

## Детальное описание машин состояний

### ConnectionStateMachine (Состояния соединения)

- Внутренний компонент ConnectionManager
- Управление состояниями SIP соединения через XState
- Валидация допустимых операций с предотвращением некорректных переходов
- Типобезопасная обработка ошибок (error: Error | undefined)
- Детальная информация об ошибках регистрации (status_code + reason_phrase)
- **Логика состояний:**
  - `PREPARING` — подготовка к подключению (до инициализации UA, до вызова `ua.start()`)
  - `CONNECTING` — UA запущен, идет подключение (после `ua.start()`, когда приходят события `connecting`, `connected`, `registered`)
  - `CONNECTED` — UA подключен к серверу (промежуточное состояние, автоматически переходит в `ESTABLISHED`)
  - `REGISTERED` — UA зарегистрирован на сервере (промежуточное состояние, автоматически переходит в `ESTABLISHED`)
  - `ESTABLISHED` — соединение установлено и готово к работе (финальное активное состояние, автоматически достигается из `CONNECTED` или `REGISTERED`)
  - Состояния переименованы для соответствия реальной последовательности операций: сначала подготовка, затем подключение UA
- Публичный API:
  - Геттеры состояний: `isIdle`, `isPreparing`, `isConnecting`, `isConnected`, `isRegistered`, `isEstablished`, `isDisconnected`, `isFailed`
  - Комбинированные геттеры: `isPending` (preparing/connecting), `isPendingConnect`, `isPendingInitUa`, `isActiveConnection` (connected/registered/established)
  - Геттер ошибки: `error`
  - Методы управления: `startConnect()`, `startInitUa()`, `reset()`
  - Методы валидации: `canTransition()`, `getValidEvents()`
  - Подписка на изменения: `onStateChange(listener)`
- Корректный граф переходов:
  - IDLE → PREPARING → CONNECTING → CONNECTED → ESTABLISHED (автоматически)
  - IDLE → PREPARING → CONNECTING → REGISTERED → ESTABLISHED (автоматически)
  - Прямой переход CONNECTING → REGISTERED (для быстрой регистрации без явного connected)
  - Переход REGISTERED → CONNECTED → ESTABLISHED (через `UA_UNREGISTERED`, затем автоматически)
  - Переходы в DISCONNECTED из PREPARING/CONNECTING/CONNECTED/REGISTERED/ESTABLISHED
  - Переходы в FAILED из PREPARING/CONNECTING
  - Переходы RESET: ESTABLISHED→IDLE, DISCONNECTED→IDLE, FAILED→IDLE
  - Переходы из DISCONNECTED/FAILED: → PREPARING (повторное подключение через `START_CONNECT`)
  - Автоматические переходы через `always`: CONNECTED → ESTABLISHED, REGISTERED → ESTABLISHED
  - В состоянии ESTABLISHED события `UA_REGISTERED` и `UA_UNREGISTERED` игнорируются (нет обработчиков)
- Автоматическое создание Error из ошибок регистрации с форматом: "Registration failed: {status_code} {reason_phrase}"
- Логирование всех переходов и недопустимых операций

### CallStateMachine (Состояния звонка)

- Внутренний компонент CallManager
- Управление состояниями звонка через XState
- Валидация переходов с предотвращением недопустимых операций
- Типобезопасная обработка ошибок (lastError: Error вместо unknown)
- Публичный API:
  - Геттеры состояний: `isIdle`, `isConnecting`, `isAccepted`, `isInCall`, `isEnded`, `isFailed`
  - Комбинированные геттеры: `isPending` (connecting), `isActive` (accepted/inCall)
  - Геттер ошибки: `lastError`
  - Метод сброса: `reset()` для перехода в IDLE
- Корректный граф переходов:
  - IDLE → CONNECTING → ACCEPTED → IN_CALL → ENDED
  - Переходы в ENDED/FAILED из любого активного состояния
  - Переходы RESET: ENDED→IDLE, FAILED→IDLE
  - Переходы из ENDED/FAILED: → CONNECTING (новый звонок)
  - Инвариант: CALL.CONFIRMED обрабатывается только из ACCEPTED
- Автоматическая конвертация ошибок из unknown в Error
- Логирование недопустимых переходов через console.warn

### PresentationStateMachine (Состояния демонстрации экрана)

- Внутренний компонент PresentationManager
- Управление состояниями демонстрации экрана через XState
- Валидация допустимых операций с предотвращением некорректных переходов
- Типобезопасная обработка ошибок (lastError: Error | undefined)
- Публичный API:
  - Геттеры состояний: `isIdle`, `isStarting`, `isActive`, `isStopping`, `isFailed`
  - Комбинированные геттеры: `isPending` (starting/stopping), `isActiveOrPending` (active/starting/stopping)
  - Геттер ошибки: `lastError`
  - Методы управления: `reset()`
- Корректный граф переходов:
  - IDLE → STARTING → ACTIVE → STOPPING → IDLE
  - Переходы в FAILED из STARTING/ACTIVE/STOPPING (через SCREEN.FAILED или CALL.FAILED)
  - Переход RESET: FAILED → IDLE
  - Убран нелогичный переход IDLE → FAILED (презентация не может зафейлиться до старта)
  - Прерывание через CALL.ENDED из любого активного состояния (STARTING/ACTIVE/STOPPING)
  - Фейл звонка (CALL.FAILED) обрабатывается во всех активных состояниях
- Автоматическое создание Error из не-Error значений (JSON.stringify для объектов)
- Полное логирование всех переходов состояний и недопустимых операций через console.warn

### IncomingCallStateMachine (Состояния входящих звонков)

- Внутренний компонент IncomingCallManager
- Управление состояниями входящих SIP-звонков через XState
- Валидация допустимых операций с предотвращением некорректных переходов
- Хранение данных вызывающего абонента (remoteCallerData)
- Публичный API:
  - Геттеры состояний: `isIdle`, `isRinging`, `isConsumed`, `isDeclined`, `isTerminated`, `isFailed`
  - Комбинированные геттеры: `isActive` (ringing), `isFinished` (consumed/declined/terminated/failed)
  - Геттеры контекста: `remoteCallerData`, `lastReason`
  - Методы управления: `reset()`, `toConsumed()`
- Корректный граф переходов:
  - IDLE → RINGING (новый входящий звонок)
  - RINGING → CONSUMED (принят) / DECLINED (отклонен) / TERMINATED (обрыв) / FAILED (ошибка)
  - Все финальные состояния → IDLE (через CLEAR)
  - Все финальные состояния → RINGING (новый входящий звонок)
  - Self-transition: RINGING → RINGING (повторный входящий звонок)
- Автоматическая очистка при потере соединения (через ConnectionManager events: disconnected, registrationFailed, connect-failed)
- Полное логирование всех переходов состояний и недопустимых операций через console.warn

## Тестирование

- Табличные тесты для переходов каждой машины.
- Контрактный тест адаптера событий: события менеджеров → доменные события → ожидаемые статусы.
- Smoke-тест фасада `createSipSession`: подписка, снапшоты, очистка.
