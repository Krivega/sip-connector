# SessionManager (Агрегатор состояний сеанса)

**Назначение**: Предоставляет единый интерфейс для работы с состоянием всех машин состояний (connection, call, incoming, presentation) через XState. Агрегирует снапшоты всех машин и предоставляет типобезопасные селекторы для подписки на изменения.

## Ключевые возможности

- Агрегация снапшотов всех машин состояний в единый объект `TSessionSnapshot`
- Типобезопасная подписка на изменения состояния через селекторы
- Автоматическое уведомление подписчиков при изменении любого состояния
- Прямой доступ к машинам состояний для расширенного использования
- События при изменении снапшота
- Комбинированное состояние системы (ESystemStatus) для упрощения работы клиентов

## Архитектура

SessionManager является фасадом над четырьмя машинами состояний:

- `connection` — ConnectionStateMachine (состояния SIP соединения)
- `call` — CallStateMachine (состояния звонка)
- `incoming` — IncomingCallStateMachine (состояния входящих звонков)
- `presentation` — PresentationStateMachine (состояния демонстрации экрана)

Каждая машина поднимается внутри своего менеджера и управляется им. SessionManager подписывается на изменения всех машин и агрегирует их снапшоты.

## Публичный API

### Свойства

- `machines: TSessionMachines` — прямой доступ к машинам состояний
- `events: TEvents` — система событий для уведомлений об изменениях

### Методы

#### `getSnapshot(): TSessionSnapshot`

Возвращает текущий агрегированный снапшот всех машин состояний.

```typescript
const snapshot = sessionManager.getSnapshot();
console.log(snapshot.connection.value); // EConnectionStatus
console.log(snapshot.call.value); // ECallStatus
console.log(snapshot.incoming.value); // EIncomingStatus
console.log(snapshot.presentation.value); // EPresentationStatus
```

#### `subscribe(listener): () => void`

Подписка на изменения всего снапшота.

```typescript
const unsubscribe = sessionManager.subscribe((snapshot) => {
  console.log('Snapshot changed:', snapshot);
});
```

#### `subscribe<T>(selector, listener, equals?): () => void`

Типобезопасная подписка на срез состояния через селектор.

```typescript
import { sessionSelectors } from '@krivega/sip-connector';

const unsubscribe = sessionManager.subscribe(sessionSelectors.selectConnectionStatus, (status) => {
  console.log('Connection status:', status);
});
```

Параметры:

- `selector: TSelector<T>` — функция селектора для извлечения значения из снапшота
- `listener: (value: T) => void` — обработчик изменений
- `equals?: TEqualityFunction<T>` — функция сравнения для предотвращения лишних вызовов (по умолчанию используется `Object.is`)

#### `stop(): void`

Останавливает все подписки и очищает ресурсы. Отписывается от всех машин состояний и очищает список подписчиков.

#### `on<T>(eventName, handler): () => void`

Подписка на события SessionManager.

```typescript
const unsubscribe = sessionManager.on('snapshot-changed', ({ previous, current }) => {
  console.log('Snapshot changed:', { previous, current });
});
```

#### `off<T>(eventName, handler): void`

Отписка от событий SessionManager.

## Типы

### TSessionSnapshot

Агрегированный снапшот всех машин состояний:

```typescript
type TSessionSnapshot = {
  connection: TConnectionSnapshot;
  call: TCallSnapshot;
  incoming: TIncomingSnapshot;
  presentation: TPresentationSnapshot;
};
```

### TSessionMachines

Доступ к машинам состояний:

```typescript
type TSessionMachines = {
  connection: ConnectionStateMachine;
  call: CallStateMachine;
  incoming: IncomingCallStateMachine;
  presentation: PresentationStateMachine;
};
```

## Селекторы

SessionManager предоставляет набор готовых селекторов через `sessionSelectors`:

- `selectConnectionStatus` — статус соединения (`EConnectionStatus`)
- `selectCallState` — снапшот машины звонка (`TSessionSnapshot['call']`: `{ value: ECallStatus; context: TContext }`)
- `selectCallStatus` — статус звонка (`ECallStatus`)
- `selectIncomingStatus` — статус входящего звонка (`EIncomingStatus`)
- `selectIncomingRemoteCaller` — данные вызывающего абонента (`TRemoteCallerData | undefined`)
- `selectPresentationStatus` — статус презентации (`EPresentationStatus`)
- `selectIsInCall` — проверка активности звонка (`boolean`)
- `selectSystemStatus` — комбинированное состояние системы (`ESystemStatus`)

### Комбинированное состояние системы (ESystemStatus)

Селектор `selectSystemStatus` объединяет состояния Connection и Call машин в единое состояние для упрощения работы клиентов.

Подробнее см. [Комбинированное состояние системы](./system-status.md).

## События

### `snapshot-changed`

Генерируется при изменении любого состояния в любой из машин.

```typescript
{
  previous: TSessionSnapshot;
  current: TSessionSnapshot;
}
```

## Примеры использования

### Базовое использование

```typescript
import { SipConnector, sessionSelectors, ESystemStatus } from '@krivega/sip-connector';

const sipConnector = new SipConnector({ JsSIP });

// Получение текущего снапшота
const snapshot = sipConnector.session.getSnapshot();
console.log('Connection:', snapshot.connection.value);
console.log('Call:', snapshot.call.value);

// Подписка на изменения соединения
const unsubscribe = sipConnector.session.subscribe(
  sessionSelectors.selectConnectionStatus,
  (status) => {
    console.log('Connection status changed:', status);
  },
);

// Подписка на комбинированное состояние системы
// Подробнее см. system-status.md
const unsubscribeSystem = sipConnector.session.subscribe(
  sessionSelectors.selectSystemStatus,
  (status) => {
    console.log('System status:', status);
  },
);

// Очистка подписок
unsubscribe();
unsubscribeSystem();
```

### Подписка на несколько значений

```typescript
const unsubscribe = sipConnector.session.subscribe(
  (snapshot) => ({
    connection: sessionSelectors.selectConnectionStatus(snapshot),
    call: sessionSelectors.selectCallStatus(snapshot),
    isInCall: sessionSelectors.selectIsInCall(snapshot),
  }),
  ({ connection, call, isInCall }) => {
    console.log('Connection:', connection, 'Call:', call, 'In call:', isInCall);
  },
);
```

### Прямой доступ к машинам

```typescript
const { connection, call } = sipConnector.session.machines;

// Подписка на снапшот конкретной машины
connection.subscribe((snapshot) => {
  console.log('Connection snapshot:', snapshot);
});
```

### Кастомный селектор с кастомной функцией сравнения

```typescript
const unsubscribe = sipConnector.session.subscribe(
  (snapshot) => snapshot.call.context,
  (context) => {
    console.log('Call context changed:', context);
  },
  (prev, next) => {
    // Кастомная логика сравнения
    return prev.room === next.room && prev.token === next.token;
  },
);
```

## Принцип работы

1. **Инициализация**: SessionManager получает ссылки на машины состояний от менеджеров и подписывается на их изменения.

2. **Агрегация**: При изменении любой машины вызывается `notifySubscribers`, который:
   - Собирает новый снапшот из всех машин
   - Проходит по всем подписчикам
   - Вычисляет новое значение через селектор
   - Сравнивает с предыдущим значением через функцию равенства
   - Вызывает listener только если значение изменилось

3. **Оптимизация**: Использование селекторов и функций сравнения позволяет избежать лишних обновлений и перерисовок UI.

## Интеграция с UI

SessionManager идеально подходит для интеграции с системами управления состоянием (MobX, Redux, Zustand):

```typescript
// Пример с MobX
import { makeAutoObservable } from 'mobx';
import { sessionSelectors, ESystemStatus } from '@krivega/sip-connector';

class SessionStore {
  systemStatus: ESystemStatus = ESystemStatus.DISCONNECTED;
  connectionStatus: EConnectionStatus = EConnectionStatus.IDLE;
  callStatus: ECallStatus = ECallStatus.IDLE;

  constructor(private session: SessionManager) {
    makeAutoObservable(this);

    // Подписка на изменения
    this.session.subscribe(sessionSelectors.selectSystemStatus, (status) => {
      this.systemStatus = status;
    });

    this.session.subscribe(sessionSelectors.selectConnectionStatus, (status) => {
      this.connectionStatus = status;
    });

    this.session.subscribe(sessionSelectors.selectCallStatus, (status) => {
      this.callStatus = status;
    });
  }

  dispose() {
    this.session.stop();
  }
}
```

## Зависимости

SessionManager зависит от:

- `ConnectionManager.stateMachine`
- `CallManager.stateMachine`
- `IncomingCallManager.stateMachine`
- `PresentationManager.stateMachine`

Все машины должны быть инициализированы до создания SessionManager.
