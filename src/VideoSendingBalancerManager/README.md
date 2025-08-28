# VideoSendingBalancerManager

Менеджер для управления VideoSendingBalancer, который автоматически запускает балансировку видеопотоков через настраиваемое время после начала звонка.

## Особенности

- **Автоматический запуск**: Балансировка начинается через настраиваемое время (по умолчанию 10 секунд) после подтверждения WebRTC соединения
- **Настраиваемая задержка**: Возможность указать кастомную задержку запуска через `balancingStartDelay`
- **Управление жизненным циклом**: Автоматически останавливается при завершении звонка
- **События**: Полная система событий для мониторинга состояния балансировки
- **Ручное управление**: Возможность принудительного запуска и остановки

## Использование

### Автоматическое использование через SipConnector

```typescript
import { SipConnector } from 'sip-connector';

// VideoSendingBalancerManager автоматически создается в SipConnector
const sipConnector = new SipConnector(
  { JsSIP },
  {
    videoBalancerOptions: {
      ignoreForCodec: 'H264',
      onSetParameters: (result) => {
        console.log('Video parameters updated:', result);
      },
    },
  },
);

// Подписка на события балансировки
sipConnector.on('video-balancer:balancing-scheduled', (data) => {
  console.log(`Balancing scheduled in ${data.delay}ms`);
});

sipConnector.on('video-balancer:balancing-started', (data) => {
  console.log(`Balancing started after ${data.delay}ms delay`);
});

sipConnector.on('video-balancer:balancing-stopped', () => {
  console.log('Balancing stopped');
});

sipConnector.on('video-balancer:parameters-updated', (result) => {
  console.log('Parameters updated:', result);
});

// Ручное управление балансировкой через менеджер
sipConnector.videoSendingBalancerManager.startBalancing(); // Принудительный запуск
sipConnector.videoSendingBalancerManager.stopBalancing(); // Остановка

// Проверка состояния
console.log('Is balancing active:', sipConnector.videoSendingBalancerManager.isBalancingActive);
console.log(
  'Is balancing scheduled:',
  sipConnector.videoSendingBalancerManager.isBalancingScheduled,
);
```

### Прямое использование VideoSendingBalancerManager

```typescript
import { VideoSendingBalancerManager } from './VideoSendingBalancerManager';

const manager = new VideoSendingBalancerManager(callManager, apiManager, {
  ignoreForCodec: 'H264',
  onSetParameters: (result) => {
    console.log('Parameters updated:', result);
  },
  balancingStartDelay: 5000, // 5 секунд
});

// Подписка на события
manager.on('balancing-scheduled', (data) => {
  console.log(`Balancing will start in ${data.delay}ms`);
});

manager.on('balancing-started', (data) => {
  console.log(`Balancing started (delay was ${data.delay}ms)`);
});

manager.on('balancing-stopped', () => {
  console.log('Balancing stopped');
});

manager.on('parameters-updated', (result) => {
  console.log('Video parameters updated:', result);
});

// Ручное управление
manager.startBalancing();
manager.stopBalancing();

// Проверка состояния
console.log('Active:', manager.isBalancingActive);
console.log('Scheduled:', manager.isBalancingScheduled);
```

## Конфигурация

### Опции VideoSendingBalancerManager

```typescript
interface IBalancerOptions {
  ignoreForCodec?: string; // Игнорировать балансировку для указанного кодека
  onSetParameters?: TOnSetParameters; // Callback при обновлении параметров
  balancingStartDelay?: number; // Задержка запуска балансировки в миллисекундах (по умолчанию 10000)
}
```

### Примеры конфигурации

```typescript
// Базовая конфигурация (задержка 10 секунд по умолчанию)
const basicOptions = {};

// Кастомная задержка (5 секунд)
const customDelayOptions = {
  balancingStartDelay: 5000,
  ignoreForCodec: 'H264',
};

// Полная конфигурация с обработчиком
const fullOptions = {
  balancingStartDelay: 30000,
  ignoreForCodec: 'H264',
  onSetParameters: (result) => {
    console.log('Video parameters updated:', result);
  },
};
```

## API

### Методы

- `startBalancing()` - Принудительно запустить балансировку
- `stopBalancing()` - Остановить балансировку
- `balance()` - Выполнить ручную балансировку (async)
- `on(eventName, handler)` - Подписка на события
- `once(eventName, handler)` - Однократная подписка на события
- `onceRace(eventNames, handler)` - Подписка на одно из нескольких событий
- `wait(eventName)` - Ожидание события
- `off(eventName, handler)` - Отписка от событий

### Свойства

- `videoSendingBalancer` - Текущий экземпляр VideoSendingBalancer
- `isBalancingActive` - Активна ли балансировка
- `isBalancingScheduled` - Запланирован ли запуск балансировки
- `events` - Система событий для подписки

### События

- `balancing-scheduled` - Запуск балансировки запланирован
- `balancing-started` - Балансировка запущена
- `balancing-stopped` - Балансировка остановлена
- `parameters-updated` - Параметры видео обновлены

## Интеграция с жизненным циклом звонка

VideoSendingBalancerManager автоматически интегрируется с CallManager:

1. **При событии `peerconnection:confirmed`**: Планирует запуск балансировки через настраиваемое время (по умолчанию 10 секунд)
2. **При событии `ended` или `failed`**: Останавливает балансировку

Это обеспечивает автоматическое управление балансировкой без необходимости ручного вмешательства.

## Конфигурация через SipConnector

Все опции VideoSendingBalancer доступны через параметр `videoBalancerOptions` в конструкторе SipConnector:

```typescript
const sipConnector = new SipConnector(
  { JsSIP },
  {
    videoBalancerOptions: {
      ignoreForCodec: 'H264', // Игнорировать балансировку для H264
      onSetParameters: (result) => {
        // Обработчик обновления параметров
        console.log('Video parameters updated:', result);
      },
    },
  },
);
```
