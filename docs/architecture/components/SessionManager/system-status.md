# Комбинированное состояние системы (ESystemStatus)

Для упрощения работы клиентов с состоянием системы создан механизм комбинирования состояний Connection, Call и AutoConnector машин в единое состояние `ESystemStatus`. Это позволяет клиенту однозначно определить текущее состояние системы без необходимости анализировать комбинации состояний вручную.

## Логика приоритетов

При определении комбинированного состояния применяется следующая логика приоритетов:

1. **Активный звонок имеет наивысший приоритет** — если call в активном состоянии (PRESENTATION_CALL, ROOM_PENDING_AUTH, IN_ROOM, PURGATORY, P2P_ROOM, DIRECT_P2P_ROOM), возвращается `CALL_ACTIVE` независимо от состояния connection

2. **Если connection DISCONNECTING или autoConnector DISCONNECTING** → `DISCONNECTING` (если call не в активном состоянии)

3. **Если autoConnector в `ATTEMPTING_CONNECT` / `ATTEMPTING_GATE` / `WAITING_BEFORE_RETRY`** → `CONNECTING`  
   (даже если connection сейчас `IDLE`)

   **Если autoConnector в `CONNECTED_MONITORING`** → `CONNECTING` только пока `connection` **не** `ESTABLISHED` (после установления SIP-соединения общий статус определяется дальше по `connection`/`call`)

4. **Если connection IDLE/DISCONNECTED** → `DISCONNECTED`

5. **Если connection PREPARING/CONNECTING/CONNECTED/REGISTERED** → `CONNECTING` (независимо от состояния call)

6. **Если connection ESTABLISHED**:
   - call IDLE → `READY_TO_CALL`
   - call CONNECTING → `CALL_CONNECTING`
   - call DISCONNECTING → `CALL_DISCONNECTING`
   - call PRESENTATION_CALL, call ROOM_PENDING_AUTH, call PURGATORY, call P2P_ROOM, call DIRECT_P2P_ROOM или call IN_ROOM → `CALL_ACTIVE` (обработано в пункте 1)
   - неизвестный call status → fallback `READY_TO_CALL`

## Состояния ESystemStatus

| Состояние            | Описание                                 | Условия                                                                                                                                                                                                        |
| :------------------- | :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCONNECTED`       | Система не подключена                    | connection: IDLE или DISCONNECTED, если AutoConnector не в attempting/waiting                                                                                                                                  |
| `DISCONNECTING`      | Идет процесс отключения                  | connection: DISCONNECTING **или** autoConnector: DISCONNECTING                                                                                                                                                 |
| `CONNECTING`         | Идет процесс подключения                 | connection: PREPARING, CONNECTING, CONNECTED, REGISTERED **или** autoConnector: ATTEMPTING_CONNECT/ATTEMPTING_GATE/WAITING_BEFORE_RETRY; либо autoConnector: CONNECTED_MONITORING при connection ≠ ESTABLISHED |
| `READY_TO_CALL`      | Соединение установлено, готово к звонкам | connection: ESTABLISHED, call: IDLE                                                                                                                                                                            |
| `CALL_CONNECTING`    | Идет установка звонка                    | connection: ESTABLISHED, call: CONNECTING                                                                                                                                                                      |
| `CALL_DISCONNECTING` | Идет процесс отключения звонка           | connection: ESTABLISHED, call: DISCONNECTING                                                                                                                                                                   |
| `CALL_ACTIVE`        | Звонок активен                           | connection: ESTABLISHED, call в активном состоянии звонка (в т.ч. presentation-call)                                                                                                                           |

Активные состояния call для `CALL_ACTIVE`: `PRESENTATION_CALL`, `ROOM_PENDING_AUTH`, `IN_ROOM`, `PURGATORY`, `P2P_ROOM`, `DIRECT_P2P_ROOM`.

## Использование

```typescript
import { sessionSelectors, ESystemStatus } from '@krivega/sip-connector';

// Подписка на комбинированное состояние
sipConnector.session.subscribe(sessionSelectors.selectSystemStatus, (status) => {
  switch (status) {
    case ESystemStatus.READY_TO_CALL:
      // Система готова к звонкам
      break;
    case ESystemStatus.CALL_CONNECTING:
      // Идет установка звонка
      break;
    case ESystemStatus.CALL_DISCONNECTING:
      // Идет процесс отключения звонка
      break;
    case ESystemStatus.CALL_ACTIVE:
      // Звонок активен
      break;
    // ... другие состояния
  }
});
```

## Преимущества

- **Однозначность**: клиент получает одно значение вместо необходимости анализировать комбинацию двух состояний
- **Приоритет соединения**: состояние соединения автоматически учитывается при определении состояния системы
- **Типобезопасность**: enum обеспечивает проверку типов на этапе компиляции
- **Простота использования**: один селектор вместо комбинации двух
