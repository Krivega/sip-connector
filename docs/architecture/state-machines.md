# Модель состояний сеанса (XState)

Sip-connector публикует единый XState-актор сеанса, агрегирующий параллельные машины по доменам: соединение, звонок, входящий звонок, шаринг экрана и auto-connector. Клиент получает только подписку на их статусы, бизнес-логика остаётся внутри sip-connector.

## Диаграмма состояний

```mermaid
stateDiagram-v2
    [*] --> session
    state session {
        state connection {
            idle --> preparing: start
            preparing --> connecting: initUa
            preparing --> disconnected: disconnected
            connecting --> connected: uaConnected
            connecting --> registered: uaRegistered
            connecting --> disconnecting: disconnecting
            connecting --> disconnected: disconnected
            connected --> established: always
            connected --> registered: uaRegistered
            connected --> disconnecting: disconnecting
            connected --> disconnected: disconnected
            registered --> established: always
            registered --> connected: uaUnregistered
            registered --> disconnecting: disconnecting
            registered --> disconnected: disconnected
            established --> disconnecting: disconnecting
            established --> disconnected: disconnected
            established --> idle: reset
            disconnecting --> disconnected: disconnected
            disconnected --> idle: reset
            disconnected --> preparing: start
        }
        state call {
            idle --> connecting: call.connecting
            connecting --> roomPendingAuth: call.enterRoom(regular room, no token)
            connecting --> purgatory: call.enterRoom(room=purgatory, no token)
            connecting --> p2pRoom: call.enterRoom(room matches p2p pattern, no token)
            connecting --> directP2pRoom: call.enterRoom(isDirectPeerToPeer=true or room matches directP2p pattern, no token)
            connecting --> inRoom: call.enterRoom+token / call.tokenIssued
            roomPendingAuth --> inRoom: call.enterRoom+token / call.tokenIssued
            roomPendingAuth --> purgatory: call.enterRoom(room=purgatory, no token)
            roomPendingAuth --> p2pRoom: call.enterRoom(room matches p2p pattern, no token)
            roomPendingAuth --> directP2pRoom: call.enterRoom(isDirectPeerToPeer=true or room matches directP2p pattern, no token)
            roomPendingAuth --> disconnecting: call.endCall
            roomPendingAuth --> idle: call.reset
            connecting --> disconnecting: call.endCall
            connecting --> failed: call.failed
            connecting --> idle: call.reset
            purgatory --> inRoom: call.enterRoom+token / call.tokenIssued
            purgatory --> disconnecting: call.endCall
            purgatory --> idle: call.reset
            p2pRoom --> inRoom: call.enterRoom+token / call.tokenIssued
            p2pRoom --> disconnecting: call.endCall
            p2pRoom --> idle: call.reset
            directP2pRoom --> inRoom: call.enterRoom+token / call.tokenIssued
            directP2pRoom --> disconnecting: call.endCall
            directP2pRoom --> idle: call.reset
            inRoom --> purgatory: call.enterRoom(room=purgatory, no token)
            inRoom --> p2pRoom: call.enterRoom(room matches p2p pattern, no token)
            inRoom --> directP2pRoom: call.enterRoom(isDirectPeerToPeer=true or room matches directP2p pattern, no token)
            inRoom --> disconnecting: call.endCall
            inRoom --> idle: call.reset
            inRoom --> failed: call.failed
            disconnecting --> idle: call.reset
            failed --> idle: call.reset
            failed --> connecting: call.connecting
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
        state autoConnector {
            idle --> disconnecting: auto.restart
            disconnecting --> attemptingGate: stopConnectionFlow.done
            attemptingGate --> attemptingConnect: gate.opened
            attemptingConnect --> connectedMonitoring: connect.success
            attemptingConnect --> waitingBeforeRetry: connect.retryableError
            waitingBeforeRetry --> disconnecting: retry.timeout
            attemptingConnect --> telephonyChecking: attempts.limitReached
            telephonyChecking --> connectedMonitoring: telephony.stillConnected
            attemptingConnect --> errorTerminal: connect.terminalError
            waitingBeforeRetry --> errorTerminal: retry.terminalError
            errorTerminal --> idle: auto.stop
            connectedMonitoring --> disconnecting: flow.restart
            connectedMonitoring --> idle: auto.stop
        }
    }
```

## Слои

- Каждая машина состояний поднимается внутри своего менеджера: `connectionManager.stateMachine`, `callManager.stateMachine`, `incomingCallManager.stateMachine`, `presentationManager.stateMachine`, `autoConnectorManager.stateMachine`.
- Менеджеры сами отправляют доменные события в свои машины.
- Агрегатор: `sipConnector.session` подписывается на `.subscribe` машин менеджеров и отдаёт объединённый снапшот + типобезопасные селекторы.

## Доменные статусы и события

| Домен         | Статусы                                                                                                                                           | Источники событий                                                                                                                                                                                                      | Доменные события                                                                                                                     |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| Connection    | `idle`, `preparing`, `connecting`, `connected`, `registered`, `established`, `disconnecting`, `disconnected`                                      | `ConnectionManager.events` (`connect-started`, `connecting`, `connect-parameters-resolve-success`, `connected`, `registered`, `unregistered`, `disconnecting`, `disconnected`, `registrationFailed`, `connect-failed`) | `START_CONNECT`, `START_INIT_UA`, `START_DISCONNECT`, `UA_CONNECTED`, `UA_REGISTERED`, `UA_UNREGISTERED`, `UA_DISCONNECTED`, `RESET` |
| Call          | `idle`, `connecting`, `roomPendingAuth`, `purgatory`, `p2pRoom`, `directP2pRoom`, `inRoom`, `disconnecting`                                       | `CallManager.events` (`start-call`, `end-call`, `enter-room`, `conference:participant-token-issued`, `ended`, `failed`)                                                                                                | `CALL.CONNECTING`, `CALL.ENTER_ROOM`, `CALL.TOKEN_ISSUED`, `CALL.START_DISCONNECT`, `CALL.RESET`                                     |
| Incoming      | `idle`, `ringing`, `consumed`, `declined`, `terminated`, `failed`                                                                                 | `IncomingCallManager.events` (`incomingCall`, `declinedIncomingCall`, `terminatedIncomingCall`, `failedIncomingCall`) + синтетика при ответе на входящий                                                               | `INCOMING.RINGING`, `INCOMING.CONSUMED`, `INCOMING.DECLINED`, `INCOMING.TERMINATED`, `INCOMING.FAILED`, `INCOMING.CLEAR`             |
| Presentation  | `idle`, `starting`, `active`, `stopping`, `failed`                                                                                                | `CallManager.events` (`presentation:start\|started\|end\|ended\|failed`), `ConnectionManager.events` (`disconnected`, `registrationFailed`, `connect-failed`)                                                          | `SCREEN.STARTING`, `SCREEN.STARTED`, `SCREEN.ENDING`, `SCREEN.ENDED`, `SCREEN.FAILED`, `PRESENTATION.RESET`                          |
| AutoConnector | `idle`, `disconnecting`, `attemptingGate`, `attemptingConnect`, `waitingBeforeRetry`, `connectedMonitoring`, `telephonyChecking`, `errorTerminal` | `AutoConnectorManager` (внутренние триггеры перезапуска/остановки, результаты connect/telephony/check)                                                                                                                 | `AUTO.RESTART`, `AUTO.STOP`, `FLOW.RESTART`, `TELEPHONY.RESULT`                                                                      |

## API для клиентов

- `sipConnector.session`: агрегатор снапшотов машин менеджеров и утилиты подписки.
- `getSnapshot()` — текущее состояние всех доменов.
- `subscribe(selector, listener)` — типобезопасная подписка на срез состояния (например, `selectConnectionStatus`).
- `stop()` — очистка подписок на машины менеджеров.
- Доступ к машинам: `sipConnector.session.machines` (connection, call, incoming, presentation, autoConnector).

## Инварианты и гварды

- `presentation` может быть `active` только если `call` в активном room-состоянии; JWT-зависимые операции по-прежнему требуют `inRoom`.
- `incoming` сбрасывается в `idle` при сбросе/завершении звонка (`CALL.RESET`; событие `ended` или `failed` приводит к CALL.RESET).
- `connection` `disconnecting` / `disconnected` приводит к сбросу `call` и `presentation` → `idle`.

## Детальное описание машин состояний

- [ConnectionStateMachine](./components/ConnectionManager/state-machine.md) — управление состояниями SIP соединения
- [AutoConnectorManager](./components/AutoConnectorManager/state-machine.md) — управление автоматическим подключением
- [CallStateMachine](./components/CallManager/state-machine.md) — управление состояниями звонка
- [PresentationStateMachine](./components/PresentationManager/state-machine.md) — управление состояниями демонстрации экрана
- [IncomingCallStateMachine](./components/IncomingCallManager/state-machine.md) — управление состояниями входящих звонков

## Комбинированное состояние системы

См. [ESystemStatus](./components/SessionManager/system-status.md) — механизм комбинирования состояний Connection, Call и AutoConnector машин в единое состояние для упрощения работы клиентов.

## Тестирование

См. [Тестирование машин состояний](./state-machines-testing.md) — описание подходов к тестированию машин состояний.
