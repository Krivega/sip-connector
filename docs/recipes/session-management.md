# Работа с сессией (XState)

`SessionManager` предоставляет единый интерфейс для работы с состоянием всех акторов (connection, call, incoming, presentation) через XState.

## Использование SessionManager

`SessionManager` доступен через `sipConnector.session`:

```typescript
import { SipConnector } from '@krivega/sip-connector';

const sipConnector = new SipConnector({ JsSIP });

// Получение текущего снапшота
const snapshot = sipConnector.session.getSnapshot();
console.log('Connection status:', snapshot.connection.value);
console.log('Call status:', snapshot.call.value);
```

## Подписка на изменения состояния

```typescript
// Подписка на изменения состояния соединения
const unsubscribe = sipConnector.session.subscribe(
  (snapshot) => snapshot.connection.value,
  (status) => {
    console.log('Connection status changed:', status);
  },
);

// Очистка подписок
sipConnector.session.stop();
```

## Использование селекторов

```typescript
import { sessionSelectors } from '@krivega/sip-connector';

const unsubscribe = sipConnector.session.subscribe(
  sessionSelectors.selectConnectionStatus,
  (status) => {
    console.log('Connection status:', status);
  },
);

// Подписка на несколько значений
const unsubscribeMultiple = sipConnector.session.subscribe(
  (snapshot) => ({
    connection: sessionSelectors.selectConnectionStatus(snapshot),
    call: sessionSelectors.selectCallStatus(snapshot),
  }),
  ({ connection, call }) => {
    console.log('Connection:', connection, 'Call:', call);
  },
);

// Подписка на комбинированное состояние системы
import { ESystemStatus } from '@krivega/sip-connector';

const unsubscribeSystem = sipConnector.session.subscribe(
  sessionSelectors.selectSystemStatus,
  (status) => {
    switch (status) {
      case ESystemStatus.READY_TO_CALL:
        console.log('Система готова к звонкам');
        break;
      case ESystemStatus.CALL_CONNECTING:
        console.log('Идет установка звонка');
        break;
      case ESystemStatus.CALL_DISCONNECTING:
        console.log('Идет процесс отключения звонка');
        break;
      case ESystemStatus.CALL_ACTIVE:
        console.log('Звонок активен');
        break;
      case ESystemStatus.CONNECTING:
        console.log('Идет подключение');
        break;
      case ESystemStatus.DISCONNECTING:
        console.log('Идет процесс отключения');
        break;
      case ESystemStatus.DISCONNECTED:
        console.log('Система не подключена');
        break;
    }
  },
);

// ...
unsubscribe(); // Когда больше не нужно слушать
```

## Доступные селекторы

- `selectConnectionStatus` - статус соединения
- `selectCallState` - снапшот машины звонка (value + context)
- `selectCallStatus` - статус звонка (ECallStatus: IDLE, CONNECTING, IN_ROOM)
- `selectIncomingStatus` - статус входящего звонка
- `selectIncomingRemoteCaller` - данные входящего звонка
- `selectPresentationStatus` - статус презентации
- `selectIsInCall` - проверка, активен ли звонок (call в состоянии IN_ROOM)
- `selectSystemStatus` - комбинированное состояние системы (объединяет connection и call)

### Комбинированное состояние системы (ESystemStatus)

Селектор `selectSystemStatus` возвращает одно из следующих состояний, объединяющих состояния Connection и Call машин:

- `DISCONNECTED` - система не подключена (connection: IDLE или DISCONNECTED, в т.ч. после ошибок)
- `DISCONNECTING` - идет процесс отключения (connection: DISCONNECTING)
- `CONNECTING` - идет процесс подключения (connection: PREPARING/CONNECTING/CONNECTED/REGISTERED)
- `READY_TO_CALL` - соединение установлено, готово к звонкам (connection: ESTABLISHED, call: IDLE)
- `CALL_CONNECTING` - идет установка звонка (connection: ESTABLISHED, call: CONNECTING)
- `CALL_DISCONNECTING` - идет процесс отключения звонка (connection: ESTABLISHED, call: DISCONNECTING)
- `CALL_ACTIVE` - звонок активен (connection: ESTABLISHED, call: IN_ROOM, PURGATORY, P2P_ROOM или DIRECT_P2P_ROOM)

Этот селектор позволяет клиенту однозначно определить текущее состояние системы без необходимости анализировать комбинации состояний Connection и Call вручную.

## Подписка на события

`SessionManager` генерирует события при изменении снапшота:

```typescript
sipConnector.on('session:snapshot-changed', ({ previous, current }) => {
  console.log('Snapshot changed:', { previous, current });
});
```

## Доступ к машинам состояний

Для прямого доступа к машинам состояний (XState):

```typescript
const { connection, call, incoming, presentation } = sipConnector.session.machines;

// Подписка на снапшот машины соединения
connection.subscribe((snapshot) => {
  console.log('Connection snapshot:', snapshot);
});
```

## Миграция клиента

1. Используйте `sipConnector.session` вместо локальной модели статусов.
2. Подпишитесь через селекторы и синхронизируйте store (MobX/MST/Redux) только по изменившимся срезам.
3. Принимая входящие звонки, используйте `selectIncomingStatus/selectIncomingRemoteCaller` и действуйте по `consumed/declined`.
4. Для UI статусов звонка используйте `selectCallStatus`, для блокировок по соединению — `selectConnectionStatus`.
5. Для определения общего состояния системы используйте `selectSystemStatus` — это упростит логику UI и избавит от необходимости комбинировать состояния Connection и Call вручную.
