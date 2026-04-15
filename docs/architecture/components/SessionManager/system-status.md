# Комбинированное состояние системы (ESystemStatus)

`ESystemStatus` — агрегированный статус системы для клиентов, вычисляемый селектором `sessionSelectors.selectSystemStatus`.

## Назначение

- Дать клиенту одно стабильное значение вместо ручного анализа нескольких state machine.
- Упростить UI-реакции на состояние системы (подключение, готовность, активный звонок).
- Инкапсулировать приоритеты между `connection`, `call` и `autoConnector`.

## Входные данные селектора

- `connection.value` (`ConnectionStateMachine`)
- `call.value` (`CallStateMachine`)
- `autoConnector.value` (`AutoConnectorStateMachine`)

`incoming` и `presentation` присутствуют в session snapshot, но напрямую не участвуют в расчёте `selectSystemStatus`.
Для активных call-состояний (`CALL_ACTIVE`) остальные машины фактически игнорируются из-за приоритета первой проверки.

## Логика приоритетов

Порядок проверки в `selectSystemStatus` (сверху вниз):

1. Если `call` в активном состоянии -> `CALL_ACTIVE`.
2. Если `connection=DISCONNECTING` или `autoConnector=DISCONNECTING` -> `DISCONNECTING`.
3. Если `autoConnector` в стадии попытки (`ATTEMPTING_CONNECT`, `ATTEMPTING_GATE`, `WAITING_BEFORE_RETRY`) -> `CONNECTING`.
4. Если `autoConnector=CONNECTED_MONITORING` и `connection != ESTABLISHED` -> `CONNECTING`.
5. Если `connection=IDLE` или `connection=DISCONNECTED` -> `DISCONNECTED`.
6. Если `connection` в `PREPARING/CONNECTING/CONNECTED/REGISTERED` -> `CONNECTING`.
7. Если `connection=ESTABLISHED`, статус определяется по `call`:
   - `IDLE` -> `READY_TO_CALL`
   - `CONNECTING` -> `CALL_CONNECTING`
   - `DISCONNECTING` -> `CALL_DISCONNECTING`
   - прочее -> fallback `READY_TO_CALL`

## Подтверждённые edge cases

- `CALL_ACTIVE` возвращается даже если `connection=IDLE`, `DISCONNECTING` или `DISCONNECTED`.
- `DISCONNECTING` имеет приоритет над connecting-ветками `autoConnector` (`ATTEMPTING_CONNECT`, `ATTEMPTING_GATE`, `WAITING_BEFORE_RETRY`).
- `CALL_DISCONNECTING` возвращается только при комбинации `connection=ESTABLISHED` + `call=DISCONNECTING`.
- `autoConnector=CONNECTED_MONITORING`:
  - при `connection != ESTABLISHED` -> `CONNECTING`;
  - при `connection = ESTABLISHED` и `call=IDLE` -> `READY_TO_CALL`.

## Активные call-состояния

Для `CALL_ACTIVE` используются состояния:

- `PRESENTATION_CALL`
- `ROOM_PENDING_AUTH`
- `IN_ROOM`
- `PURGATORY`
- `P2P_ROOM`
- `DIRECT_P2P_ROOM`

## Состояния ESystemStatus

| `ESystemStatus`      | Когда возвращается                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCONNECTED`       | `connection=IDLE` или `DISCONNECTED`, если выше по приоритету не сработали active/disconnecting/connecting-ветки                                                 |
| `DISCONNECTING`      | `connection=DISCONNECTING` или `autoConnector=DISCONNECTING`                                                                                                     |
| `CONNECTING`         | `connection` в `PREPARING/CONNECTING/CONNECTED/REGISTERED` или `autoConnector` в attempting-ветках; также при `CONNECTED_MONITORING` до `connection=ESTABLISHED` |
| `READY_TO_CALL`      | `connection=ESTABLISHED` и `call=IDLE` (или fallback при неизвестном call-статусе)                                                                               |
| `CALL_CONNECTING`    | `connection=ESTABLISHED` и `call=CONNECTING`                                                                                                                     |
| `CALL_DISCONNECTING` | `connection=ESTABLISHED` и `call=DISCONNECTING`                                                                                                                  |
| `CALL_ACTIVE`        | `call` в одном из активных состояний (имеет наивысший приоритет)                                                                                                 |

## Критерии корректности (по тестам)

- Приоритеты выполняются в том же порядке, что и в `selectSystemStatus`.
- Для активных call-состояний (`ROOM_PENDING_AUTH`, `IN_ROOM`, `PURGATORY`, `P2P_ROOM`, `DIRECT_P2P_ROOM`, `PRESENTATION_CALL`) всегда возвращается `CALL_ACTIVE` независимо от остальных машин.
- Для `connection=ESTABLISHED` проверяются ветки:
  - `call=IDLE` -> `READY_TO_CALL`;
  - `call=CONNECTING` -> `CALL_CONNECTING`;
  - `call=DISCONNECTING` -> `CALL_DISCONNECTING`;
  - неизвестный `call` -> fallback `READY_TO_CALL`.

## Использование

```typescript
import { sessionSelectors, ESystemStatus } from '@krivega/sip-connector';

sipConnector.session.subscribe(sessionSelectors.selectSystemStatus, (status) => {
  switch (status) {
    case ESystemStatus.READY_TO_CALL:
      break;
    case ESystemStatus.CALL_CONNECTING:
      break;
    case ESystemStatus.CALL_DISCONNECTING:
      break;
    case ESystemStatus.CALL_ACTIVE:
      break;
    default:
      break;
  }
});
```
