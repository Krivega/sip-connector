# VideoSendingBalancer

Класс для управления балансировкой видео-потоков в SIP-соединении.

## Использование

### Создание экземпляра

```typescript
import VideoSendingBalancer from './videoSendingBalancer';

const balancer = new VideoSendingBalancer(sipConnector, {
  ignoreForCodec: 'H264',
  onSetParameters: (parameters) => {
    console.log('Параметры обновлены:', parameters);
  },
});
```

### Подписка на события

```typescript
// Подписаться на события управления камерой
balancer.subscribe();

// Отписаться от событий
balancer.unsubscribe();
```

### Ручная балансировка

```typescript
// Выполнить балансировку вручную
const result = await balancer.reBalance();
console.log('Результат балансировки:', result);
```

### Сброс состояния

```typescript
// Сбросить состояние управления камерой
balancer.resetMainCamControl();
```

## API

### Конструктор

```typescript
constructor(
  sipConnector: SipConnector,
  options?: {
    ignoreForCodec?: string;
    onSetParameters?: TOnSetParameters;
  }
)
```

### Методы

- `subscribe()`: Подписаться на события управления камерой
- `unsubscribe()`: Отписаться от событий управления камерой
- `reBalance()`: Выполнить балансировку вручную
- `resetMainCamControl()`: Сбросить состояние управления камерой

## Обратная совместимость

Для обратной совместимости доступна фабричная функция:

```typescript
import { resolveVideoSendingBalancer } from './videoSendingBalancer';

const balancer = resolveVideoSendingBalancer(sipConnector, options);
```
