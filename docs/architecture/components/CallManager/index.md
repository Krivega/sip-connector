# CallManager (WebRTC-звонки)

**Назначение**: Управление WebRTC-звонками через паттерн Стратегия.

## Ключевые возможности

- Исходящие и входящие звонки
- Управление WebRTC соединениями
- Управление медиа-потоками
- Поддержка различных протоколов
- Отслеживание изменений удаленных потоков через события
- Управление ролями участников (participant/spectator)
- Валидация переходов состояний через CallStateMachine
- Хранение данных конференции: room, participantName, channels, token (jwt), conference, participant
- Хранение данных звонка: number, answer (перенесены из callConfiguration)
- Отложенный старт RecvSession при гонке событий с сервером (паттерн «отложенная команда» через DeferredCommandRunner)

## Основные методы

- `startCall()` / `endCall()` - управление звонками
- `replaceMediaStream()` - замена медиа-потоков
- `restartIce()` - перезапуск соединения

`startCall()` и `answerToIncomingCall()` прокидывают `extraHeaders` в synthetic-событие `start-call`; это позволяет CallStateMachine перейти в `PRESENTATION_CALL` после `confirmed`, если передан заголовок `x-vinteo-presentation-call: yes`.

## Внутренние компоненты

### CallStateMachine

Управление состояниями звонка (XState)

- Валидация переходов между состояниями
- Публичный API с геттерами: `isIdle`, `isConnecting`, `isPresentationCall`, `isRoomPendingAuth`, `isInPurgatory`, `isP2PRoom`, `isDirectP2PRoom`, `isInRoom`, `isDisconnecting`, `isPending`, `isActive`
- Геттер контекста: `inRoomContext` (возвращает контекст только в состоянии IN_ROOM)
- Методы: `reset()`, `send(event)`, `subscribeToApiEvents(apiManager)`
- При вызове `endCall()` переход в состояние `DISCONNECTING` через EVALUATE (событие `end-call` → `CALL.START_DISCONNECT` → `EVALUATE` с action `prepareDisconnect` → `DISCONNECTING`). Контекст очищается при переходе
- Из `DISCONNECTING` переход в `IDLE` при завершении отключения (события `ended` или `failed` → `CALL.RESET`)
- Предотвращение недопустимых переходов с логированием

Подробнее см. [State Machine](./state-machine.md).

### MCUSession

Управление основным RTCSession для участников конференции

- Создание и управление SIP-звонками через @krivega/jssip
- Обработка событий peerconnection и track
- Управление жизненным циклом звонка

### RecvSession

Управление receive-only сессией для зрителей

- Создание отдельного RTCPeerConnection для приема потоков
- Поддержка receive-only transceiver'ов
- Используется при перемещении участника в режим spectator
- Запуск требует наличия токена (sendOffer вызывается с токеном из CallStateMachine)

### DeferredCommandRunner

Паттерн отложенной команды для запуска RecvSession

- Устраняет гонку событий: `participant:move-request-to-spectators-with-audio-id` может прийти раньше `conference:participant-token-issued`
- При отсутствии токена (состояние CONNECTING, PRESENTATION_CALL или ROOM_PENDING_AUTH) команда «запустить RecvSession» сохраняется и подписывается на переход CallStateMachine в IN_ROOM
- При переходе в IN_ROOM команда выполняется (вызывается startRecvSession); при переходе в IDLE (ended/failed → CALL.RESET) — отменяется без выполнения
- Методы: `set(command)` — отложить команду, `cancel()` — отменить подписку и очистить команду
- Вызов `cancel()` при смене роли с зрителя на участника и при reset CallManager

### RemoteStreamsManager

Два экземпляра: main и recv

- **MainRemoteStreamsManager** - управление потоками для участников
- **RecvRemoteStreamsManager** - управление потоками для зрителей
- Группировка треков по участникам и потокам
- Отслеживание окончания треков и автоматическая очистка

### RoleManager

Управление ролями участника

- Переключение между ролями: `participant`, `spectator`, `spectator_synthetic`
- Выбор активного RemoteStreamsManager (main или recv)
- Управление жизненным циклом RecvSession при смене роли
