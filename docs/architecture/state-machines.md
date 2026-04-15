# Модель состояний сеанса (XState)

Sip-connector публикует единый XState-актор сеанса, агрегирующий параллельные машины по доменам: соединение, звонок, входящий звонок, шаринг экрана и auto-connector. Клиент получает подписку на их статусы, бизнес-логика остаётся внутри sip-connector.

## Слои

- Каждая машина состояний поднимается внутри своего менеджера.
- Менеджеры сами отправляют доменные события в свои машины.
- Агрегатор: `sipConnector.sessionManager` подписывается на `.subscribe` машин менеджеров и отдаёт объединённый снапшот + типобезопасные селекторы.

## Документация по доменам

- Connection: [ConnectionStateMachine](./components/ConnectionManager/state-machine.md)
- Call: [CallStateMachine](./components/CallManager/state-machine.md)
- Incoming: [IncomingCallStateMachine](./components/IncomingCallManager/state-machine.md)
- Presentation: [PresentationStateMachine](./components/PresentationManager/state-machine.md)
- AutoConnector: [AutoConnectorStateMachine](./components/AutoConnectorManager/state-machine.md)

## Комбинированное состояние системы

См. [ESystemStatus](./components/SessionManager/index.md#комбинированное-состояние-системы-esystemstatus) — механизм комбинирования состояний Connection, Call и AutoConnector машин в единое состояние для упрощения работы клиентов.

## Тестирование

См. [Тестирование машин состояний](./state-machines-testing.md) — описание подходов к тестированию машин состояний.
