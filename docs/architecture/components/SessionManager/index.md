# SessionManager (Агрегатор состояний сеанса)

**Назначение**: Предоставляет единый интерфейс для работы с состоянием всех машин состояний (connection, call, incoming, presentation, autoConnector) через XState. Агрегирует снапшоты всех машин и предоставляет типобезопасные селекторы для подписки на изменения.

## Ключевые возможности

- Агрегация снапшотов всех машин состояний в единый объект `TSessionSnapshot`
- Типобезопасная подписка на изменения состояния через селекторы
- Автоматическое уведомление подписчиков при изменении выбранного среза состояния
- Прямой доступ к машинам состояний для расширенного использования
- События при изменении снапшота
- Комбинированное состояние системы (ESystemStatus) для упрощения работы клиентов

## Публичный API

### Свойства

- `machines: TSessionMachines` — прямой доступ к машинам состояний
- `events: TEvents` — система событий для уведомлений об изменениях

### Методы

#### `getSnapshot(): TSessionSnapshot`

Возвращает текущий агрегированный снапшот всех машин состояний.

> Важно: объект снапшота обновляется при каждом событии из машин, но для подписки без селектора (`subscribe(listener)`) уведомления идут только при изменении `value` хотя бы одной машины. Изменения только в `context` без смены `value` по умолчанию не триггерят callback.

```typescript
const snapshot = sessionManager.getSnapshot();
console.log(snapshot.connection.value); // EConnectionStatus
console.log(snapshot.call.value); // ECallStatus
console.log(snapshot.incoming.value); // EIncomingStatus
console.log(snapshot.presentation.value); // EPresentationStatus
console.log(snapshot.autoConnector.value); // EAutoConnectorState
```

#### `subscribe(listener): () => void`

Подписка на изменения всего снапшота.

Для этой перегрузки используется оптимизация `defaultSnapshotEquals`: сравниваются только поля `value` у `connection/call/incoming/presentation/autoConnector`.

```typescript
const unsubscribe = sessionManager.subscribe((snapshot) => {
  console.log('Snapshot changed:', snapshot);
});
```

#### `subscribe<T>(selector, listener, equals?): () => void`

Типобезопасная подписка на срез состояния через селектор.

```typescript
import { sessionSelectors } from 'sip-connector';

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

## Архитектура

SessionManager является фасадом над пятью машинами состояний:

- `connection` — ConnectionStateMachine (состояния SIP соединения)
- `call` — CallStateMachine (состояния звонка)
- `incoming` — IncomingCallStateMachine (состояния входящих звонков)
- `presentation` — PresentationStateMachine (состояния демонстрации экрана)
- `autoConnector` — AutoConnectorStateMachine (состояния авто-переподключения)

Каждая машина поднимается внутри своего менеджера и управляется им. SessionManager подписывается на изменения всех машин и агрегирует их снапшоты.

## Типы

### TSessionSnapshot

Агрегированный снапшот всех машин состояний:

```typescript
type TSessionSnapshot = {
  connection: TConnectionSnapshot;
  call: TCallSnapshot;
  incoming: TIncomingSnapshot;
  presentation: TPresentationSnapshot;
  autoConnector: TAutoConnectorSnapshot;
};
```

### TSessionMachines

Доступ к машинам состояний:

```typescript
type TSessionMachines = {
  connection: ConnectionStateMachine;
  call: ICallStateMachine;
  incoming: IncomingCallStateMachine;
  presentation: PresentationStateMachine;
  autoConnector: IAutoConnectorStateMachine;
};
```

## Селекторы

SessionManager предоставляет набор готовых селекторов через `sessionSelectors`:

- `selectConnectionStatus` — статус соединения (`EConnectionStatus`)
- `selectAutoConnectorStatus` — статус авто-коннектора (`EAutoConnectorStatus`)
- `selectCallState` — снапшот машины звонка (`TSessionSnapshot['call']`: `{ value: ECallStatus; context: TContext }`)
- `selectCallStatus` — статус звонка (`ECallStatus`)
- `selectIncomingStatus` — статус входящего звонка (`EIncomingStatus`)
- `selectPresentationStatus` — статус презентации (`EPresentationStatus`)
- `selectIsInCall` — проверка активности звонка (`boolean`, в т.ч. `PRESENTATION_CALL` и room-состояния)
- `selectSystemStatus` — комбинированное состояние системы (`ESystemStatus`) по состояниям `connection`, `call` и `autoConnector`

### Комбинированное состояние системы (ESystemStatus)

`ESystemStatus` — агрегированный статус для клиента, вычисляемый селектором `sessionSelectors.selectSystemStatus`.

Назначение:

- дать клиенту одно стабильное значение вместо ручного анализа нескольких state machine;
- упростить UI-реакции (подключение, готовность, активный звонок);
- инкапсулировать приоритеты между `connection`, `call` и `autoConnector`.

Входные данные селектора:

- `connection.value` (`ConnectionStateMachine`)
- `call.value` (`CallStateMachine`)
- `autoConnector.value` (`AutoConnectorStateMachine`)

`incoming` и `presentation` присутствуют в `TSessionSnapshot`, но напрямую не участвуют в расчёте `selectSystemStatus`.

Порядок приоритетов в `selectSystemStatus` (сверху вниз):

1. `call` в активном состоянии -> `CALL_ACTIVE`.
2. `connection=DISCONNECTING` или `autoConnector=DISCONNECTING` -> `DISCONNECTING`.
3. `autoConnector` в `ATTEMPTING_CONNECT`/`ATTEMPTING_GATE`/`WAITING_BEFORE_RETRY` -> `CONNECTING`.
4. `autoConnector=CONNECTED_MONITORING` и `connection != ESTABLISHED` -> `CONNECTING`.
5. `connection=IDLE` или `connection=DISCONNECTED` -> `DISCONNECTED`.
6. `connection` в `PREPARING/CONNECTING/CONNECTED/REGISTERED` -> `CONNECTING`.
7. `connection=ESTABLISHED`:  
   - `call=IDLE` -> `READY_TO_CALL`;  
   - `call=CONNECTING` -> `CALL_CONNECTING`;  
   - `call=DISCONNECTING` -> `CALL_DISCONNECTING`;  
   - прочее -> fallback `READY_TO_CALL`.

Активные call-состояния для `CALL_ACTIVE`:

- `PRESENTATION_CALL`
- `ROOM_PENDING_AUTH`
- `IN_ROOM`
- `PURGATORY`
- `P2P_ROOM`
- `DIRECT_P2P_ROOM`

Подтверждённые edge cases:

- `CALL_ACTIVE` возвращается даже при `connection=IDLE`, `DISCONNECTING` или `DISCONNECTED`;
- `DISCONNECTING` приоритетнее attempting-веток `autoConnector`;
- `CALL_DISCONNECTING` возможен только при `connection=ESTABLISHED` и `call=DISCONNECTING`;
- при `autoConnector=CONNECTED_MONITORING`:  
  - если `connection != ESTABLISHED` -> `CONNECTING`;  
  - если `connection = ESTABLISHED` и `call=IDLE` -> `READY_TO_CALL`.

## События

### `snapshot-changed`

Генерируется при изменении `value` хотя бы одной из машин.

Изменения только в `context` без смены `value` событие не генерируют.

```typescript
{
  previous: TSessionSnapshot;
  current: TSessionSnapshot;
}
```

## Примеры использования

### Базовое использование

```typescript
import { SipConnector, sessionSelectors, ESystemStatus } from 'sip-connector';

const sipConnector = new SipConnector({ JsSIP });

// Получение текущего снапшота
const snapshot = sipConnector.sessionManager.getSnapshot();
console.log('Connection:', snapshot.connection.value);
console.log('Call:', snapshot.call.value);

// Подписка на изменения соединения
const unsubscribe = sipConnector.sessionManager.subscribe(
  sessionSelectors.selectConnectionStatus,
  (status) => {
    console.log('Connection status changed:', status);
  },
);

// Подписка на комбинированное состояние системы
const unsubscribeSystem = sipConnector.sessionManager.subscribe(
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
const unsubscribe = sipConnector.sessionManager.subscribe(
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
const { connection, call, autoConnector } = sipConnector.sessionManager.machines;

// Подписка на снапшот конкретной машины
connection.subscribe((snapshot) => {
  console.log('Connection snapshot:', snapshot);
});

autoConnector.subscribe((snapshot) => {
  console.log('AutoConnector snapshot:', snapshot);
});
```

### Кастомный селектор с кастомной функцией сравнения

```typescript
const unsubscribe = sipConnector.sessionManager.subscribe(
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
   - Для подписки без селектора сравнивает только `value` каждой машины

3. **Оптимизация**: Использование селекторов и функций сравнения позволяет избежать лишних обновлений и перерисовок UI.

## Интеграция с UI

SessionManager идеально подходит для интеграции с системами управления состоянием (MobX, Redux, Zustand):

```typescript
// Пример с MobX
import { makeAutoObservable } from 'mobx';
import { sessionSelectors, ESystemStatus } from 'sip-connector';

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
- `AutoConnectorManager.stateMachine`

Все машины должны быть инициализированы до создания SessionManager.
