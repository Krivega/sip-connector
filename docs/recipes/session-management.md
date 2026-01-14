# Работа с сессией (XState)

## Создание сессии

```typescript
import { createSipSession } from '@krivega/sip-connector';

// Создание сессии
const session = createSipSession({
  connectionActor: connectionManager.connectionActor,
  callActor: callManager.callActor,
  incomingActor: incomingCallManager.incomingActor,
  presentationActor: presentationManager.presentationActor,
});

// Получение текущего снапшота
const snapshot = session.getSnapshot();
console.log('Connection status:', snapshot.connection.status);
console.log('Call status:', snapshot.call.status);
```

## Подписка на изменения состояния

```typescript
// Подписка на изменения состояния соединения
const unsubscribe = session.subscribe(
  (snapshot) => snapshot.connection.status,
  (status) => {
    console.log('Connection status changed:', status);
  },
);

// Очистка подписок
session.stop();
```

## Использование селекторов

```typescript
import { selectConnectionStatus, selectCallStatus } from 'sip-connector';

const unsubscribe = sipConnector.session.subscribe(
  (snapshot) => ({
    connection: selectConnectionStatus(snapshot),
    call: selectCallStatus(snapshot),
  }),
  ({ connection, call }) => {
    console.log('Connection:', connection, 'Call:', call);
  },
);

// ...
unsubscribe(); // Когда больше не нужно слушать
```

## Миграция клиента

1. Включите фича-флаг и подключите `sipConnector.session` вместо локальной модели статусов.
2. Подпишитесь через селекторы и синхронизируйте store (MobX/MST/Redux) только по изменившимся срезам.
3. Принимая входящие звонки, используйте `selectIncomingStatus/RemoteCaller` и действуйте по `consumed/declined`.
4. Для UI статусов звонка используйте `selectCallStatus`, для блокировок по соединению — `selectConnectionStatus`.
