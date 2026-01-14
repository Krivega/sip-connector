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

// ...
unsubscribe(); // Когда больше не нужно слушать
```

## Доступные селекторы

- `selectConnectionStatus` - статус соединения
- `selectCallStatus` - статус звонка
- `selectIncomingStatus` - статус входящего звонка
- `selectIncomingRemoteCaller` - данные входящего звонка
- `selectPresentationStatus` - статус презентации
- `selectIsInCall` - проверка, активен ли звонок

## Подписка на события

`SessionManager` генерирует события при изменении снапшота:

```typescript
sipConnector.on('session:snapshot-changed', ({ previous, current }) => {
  console.log('Snapshot changed:', { previous, current });
});
```

## Доступ к акторам

Для прямого доступа к акторам XState:

```typescript
const { connection, call, incoming, presentation } = sipConnector.session.actors;

// Прямой доступ к актору соединения
connection.subscribe((snapshot) => {
  console.log('Connection snapshot:', snapshot);
});
```

## Миграция клиента

1. Используйте `sipConnector.session` вместо локальной модели статусов.
2. Подпишитесь через селекторы и синхронизируйте store (MobX/MST/Redux) только по изменившимся срезам.
3. Принимая входящие звонки, используйте `selectIncomingStatus/selectIncomingRemoteCaller` и действуйте по `consumed/declined`.
4. Для UI статусов звонка используйте `selectCallStatus`, для блокировок по соединению — `selectConnectionStatus`.
