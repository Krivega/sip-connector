# CallStateMachine (Состояния звонка)

Внутренний компонент `CallManager`, управляющий состояниями звонка через XState с валидацией переходов и предотвращением недопустимых операций (проверка `snapshot.can(event)` перед отправкой).

## События

- `CALL.CONNECTING` — начало установки звонка
- `CALL.ENTER_ROOM` — вход в комнату
- `CALL.TOKEN_ISSUED` — получение токена участника
- `CALL.START_DISCONNECT` — начало отключения звонка
- `CALL.RESET` — сброс состояния звонка

События `end-call`, `ended`, `failed` от `CallManager.events` приводят к соответствующим переходам.

## Публичный API

### Геттеры состояний

- `isIdle` — проверка состояния IDLE
- `isConnecting` — проверка состояния CONNECTING
- `isRoomPendingAuth` — проверка состояния ROOM_PENDING_AUTH
- `isInPurgatory` — проверка состояния PURGATORY
- `isP2PRoom` — проверка состояния P2P_ROOM
- `isDirectP2PRoom` — проверка состояния DIRECT_P2P_ROOM
- `isInRoom` — проверка состояния IN_ROOM
- `isDisconnecting` — проверка состояния DISCONNECTING

### Комбинированные геттеры

- `isPending` — проверка состояний connecting/disconnecting
- `isActive` — проверка активных состояний (roomPendingAuth, inRoom, purgatory, p2pRoom или directP2pRoom)

### Геттер контекста

- `inRoomContext` — возвращает контекст только в состоянии IN_ROOM

### Методы управления

- `reset()` — сброс состояния
- `send(event)` — отправка события в машину
- `subscribeToApiEvents(apiManager)` — привязка к API событиям (enter-room, conference:participant-token-issued)

## Граф переходов

### Из IDLE

- **IDLE → CONNECTING** — при `CALL.CONNECTING`

### Из CONNECTING

- **CONNECTING → PURGATORY** — при `CALL.ENTER_ROOM` с room=purgatory без token
- **CONNECTING → P2P_ROOM** — при `CALL.ENTER_ROOM` с room, соответствующим паттерну `/^p2p.+to.+$/i`, без token
- **CONNECTING → DIRECT_P2P_ROOM** — при `CALL.ENTER_ROOM` с `isDirectPeerToPeer=true` или room, соответствующим паттерну `/^directP2P.+to.+$/i`, без token
- **CONNECTING → ROOM_PENDING_AUTH** — при `CALL.ENTER_ROOM` для обычной комнаты без token
- **CONNECTING → IN_ROOM** — при получении room + participantName и token через `CALL.ENTER_ROOM` и `CALL.TOKEN_ISSUED`
- **CONNECTING → DISCONNECTING** — при `CALL.START_DISCONNECT` или событии `end-call`
- **CONNECTING → IDLE** — при `CALL.RESET` (в т.ч. при событии `ended` или `failed`)

### Из ROOM_PENDING_AUTH

- **ROOM_PENDING_AUTH → IN_ROOM** — при появлении token через `CALL.ENTER_ROOM` с bearerToken или `CALL.TOKEN_ISSUED`
- **ROOM_PENDING_AUTH → PURGATORY** — при `CALL.ENTER_ROOM` с room=purgatory без token
- **ROOM_PENDING_AUTH → P2P_ROOM** — при `CALL.ENTER_ROOM` с p2p-room без token
- **ROOM_PENDING_AUTH → DIRECT_P2P_ROOM** — при `CALL.ENTER_ROOM` с `isDirectPeerToPeer=true` или direct p2p-room без token
- **ROOM_PENDING_AUTH → DISCONNECTING** — при `CALL.START_DISCONNECT` или событии `end-call`
- **ROOM_PENDING_AUTH → IDLE** — при `CALL.RESET`

### Из PURGATORY

- **PURGATORY → IN_ROOM** — при появлении token: `CALL.ENTER_ROOM` с bearerToken (можно сменить комнату) или `CALL.TOKEN_ISSUED` (room остаётся purgatory)
- **PURGATORY → DISCONNECTING** — при `CALL.START_DISCONNECT` или событии `end-call`
- **PURGATORY → IDLE** — при `CALL.RESET`

### Из P2P_ROOM

- **P2P_ROOM → IN_ROOM** — при появлении token через `CALL.ENTER_ROOM` с bearerToken или `CALL.TOKEN_ISSUED`
- **P2P_ROOM → DISCONNECTING** — при `CALL.START_DISCONNECT` или событии `end-call`
- **P2P_ROOM → IDLE** — при `CALL.RESET`

### Из DIRECT_P2P_ROOM

- **DIRECT_P2P_ROOM → IN_ROOM** — при появлении token через `CALL.ENTER_ROOM` с bearerToken или `CALL.TOKEN_ISSUED`
- **DIRECT_P2P_ROOM → DISCONNECTING** — при `CALL.START_DISCONNECT` или событии `end-call`
- **DIRECT_P2P_ROOM → IDLE** — при `CALL.RESET`

### Из IN_ROOM

- **IN_ROOM → PURGATORY** — при `CALL.ENTER_ROOM` с room=purgatory без token (в setRoomInfo token сбрасывается только для room=purgatory)
- **IN_ROOM → P2P_ROOM** — при `CALL.ENTER_ROOM` с room, соответствующим паттерну `/^p2p.+to.+$/i`, без token
- **IN_ROOM → DIRECT_P2P_ROOM** — при `CALL.ENTER_ROOM` с `isDirectPeerToPeer=true` или room, соответствующим паттерну `/^directP2P.+to.+$/i`, без token
- **IN_ROOM → DISCONNECTING** — при `CALL.START_DISCONNECT` или событии `end-call`
- **IN_ROOM → IDLE** — при `CALL.RESET`
- **IN_ROOM → FAILED** — при событии `failed`

### Из DISCONNECTING

- **DISCONNECTING → IDLE** — при `CALL.RESET` (в т.ч. при событии `ended` или `failed`)

### Из FAILED

- **FAILED → IDLE** — при `CALL.RESET`
- **FAILED → CONNECTING** — при `CALL.CONNECTING`

## Внутреннее состояние EVALUATE

Переход в DISCONNECTING идёт через EVALUATE:

- `CALL.START_DISCONNECT` → `EVALUATE` (action `prepareDisconnect`: очистка контекста + флаг `pendingDisconnect`) → `DISCONNECTING` (action `reset` для сброса флага)

EVALUATE также может перейти в IN_ROOM, DIRECT_P2P_ROOM, P2P_ROOM, PURGATORY, CONNECTING или IDLE по контексту после действий.

## Логика определения состояний

### DIRECT_P2P_ROOM

Приоритет выше P2P_ROOM. Определяется по:

- Флагу `isDirectPeerToPeer=true` в событии `enter-room`
- Паттерну имени комнаты `/^directP2P.+to.+$/i`

### P2P_ROOM

Определяется по паттерну имени комнаты `/^p2p.+to.+$/i` (без префикса `direct`).

### ROOM_PENDING_AUTH

Определяется для обычной комнаты, когда `room` и `participantName` уже известны, но `token` ещё не выдан. Это валидное активное состояние звонка, но не состояние готовности для `RecvSession`.

### Общие правила для P2P состояний

Оба состояния P2P не требуют токена (как и PURGATORY), но могут перейти в IN_ROOM при получении токена.

## Зависимость для перевода в зрители

Запуск RecvSession (и вызов sendOffer) возможен только при наличии токена (состояние IN_ROOM). Состояние ROOM_PENDING_AUTH не считается достаточным для JWT-зависимых операций.

При гонке событий (`participant:move-request-to-spectators-with-audio-id` приходит до `conference:participant-token-issued`) CallManager использует `DeferredCommandRunner`: команда откладывается и выполняется при переходе в IN_ROOM.

## Логирование

Недопустимые переходы логируются через `console.warn` для отладки.
