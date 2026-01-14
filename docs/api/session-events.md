# События `SessionManager`

`SessionManager` генерирует события при изменении снапшота сессии. Все события доступны через префикс `session:*` в `SipConnector`.

## События

| Имя события                | Описание                                   | Тип данных                                                  |
| -------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `session:snapshot-changed` | Генерируется при изменении снапшота сессии | `{ previous: TSessionSnapshot; current: TSessionSnapshot }` |

## Структуры данных

### `TSessionSnapshot`

```typescript
{
  connection: TConnectionSnapshot;
  call: TCallSnapshot;
  incoming: TIncomingSnapshot;
  presentation: TPresentationSnapshot;
}
```

Каждый снапшот содержит состояние соответствующего актора XState:

- `connection` - состояние соединения (ConnectionStateMachine)
- `call` - состояние звонка (CallStateMachine)
- `incoming` - состояние входящего звонка (IncomingCallStateMachine)
- `presentation` - состояние презентации (PresentationStateMachine)

## Пример использования

```typescript
import { SipConnector } from '@krivega/sip-connector';

const sipConnector = new SipConnector({ JsSIP });

sipConnector.on('session:snapshot-changed', ({ previous, current }) => {
  console.log('Previous snapshot:', previous);
  console.log('Current snapshot:', current);

  // Проверка изменений
  if (previous.call.value !== current.call.value) {
    console.log('Call status changed:', current.call.value);
  }
});
```
