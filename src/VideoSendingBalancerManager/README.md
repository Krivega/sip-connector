# VideoSendingBalancerManager

Менеджер для управления VideoSendingBalancer, который автоматически запускает балансировку видеопотоков через настраиваемое время после начала звонка.

## Особенности

- **Автоматический запуск**: Балансировка начинается через настраиваемое время (по умолчанию 10 секунд) после подтверждения WebRTC соединения: пока браузер прогревает отправку, скалирование не применяется (кроме ручного `balance()`)
- **Настраиваемая задержка**: Возможность указать кастомную задержку запуска через `balancingStartDelay`
- **Управление жизненным циклом**: Автоматически останавливается при завершении звонка
- **Режим зрителя**: Останавливает балансировку при входе в режим зрителя (`recv-session-started`), при смене качества (`recv-quality-changed`) и планирует запуск при выходе (`recv-session-ended`)
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
  getMaxResolution: () => connectionConfiguration?.maxAvailableResolution,
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
type TOptions = IBalancerOptions & {
  balancingStartDelay?: number; // Задержка запуска в мс (по умолчанию 10000)
};

interface IBalancerOptions {
  ignoreForCodec?: string;
  onSetParameters?: TOnSetParameters;
  getMaxResolution: () => TResolutionSize | undefined; // Обязательный
  isExcludedSender?: (sender: RTCRtpSender) => boolean; // Senders, которые балансировщик не трогает
}
```

При создании через `SipConnector` callback `getMaxResolution` добавляется автоматически. При прямом
использовании менеджера его нужно передать явно.

### Примеры конфигурации

```typescript
// Базовая конфигурация (задержка 10 секунд по умолчанию)
const basicOptions = {
  getMaxResolution: () => undefined,
};

// Кастомная задержка (5 секунд)
const customDelayOptions = {
  getMaxResolution: () => ({ width: 1920, height: 1080 }),
  balancingStartDelay: 5000,
  ignoreForCodec: 'H264',
};

// Полная конфигурация с обработчиком
const fullOptions = {
  getMaxResolution: () => connectionConfiguration?.maxAvailableResolution,
  balancingStartDelay: 30_000,
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

- `isBalancingActive` - Активна ли балансировка
- `isBalancingScheduled` - Запланирован ли запуск балансировки
- `events` - Система событий для подписки

### События

- `balancing-scheduled` - Запуск балансировки запланирован
- `balancing-started` - Балансировка запущена
- `balancing-stopped` - Балансировка остановлена
- `parameters-updated` - Параметры видео обновлены

## Интеграция с жизненным циклом звонка

Менеджер слушает события звонка и команды сервера и переводит `VideoSendingBalancer` между
состояниями. Что именно применяется отправителю в каждом состоянии, описано в
[правилах модуля](../VideoSendingBalancer/README.md#правила-модуля) — здесь только связь событий с
переходами.

| Событие                                                                              | Действие менеджера                   | Состояние балансировщика |
| ------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------ |
| `peerconnection:confirmed`, `recv-session-ended`                                     | планирует запуск: таймер, `warmUp()` | `warmup`                 |
| таймер, `startBalancing()`                                                           | `start()`, затем `balancing-started` | `started`                |
| `ended`, `failed`, `recv-session-started`, `recv-quality-changed`, `stopBalancing()` | `stop()`, `balancing-stopped`        | `idle`                   |
| `main-cam-control` от `ApiManager`                                                   | `handleServerHeaders()`              | не меняется              |

`balancingStartDelay` нужна, потому что в начале звонка браузер прогревает отправку — постепенно
наращивает разрешение; пока прогрев не завершён, `scaleResolutionDownBy` применять нельзя. Поэтому
команда, пришедшая во время прогрева, только запоминается, и последнюю из них применяет старт по
таймеру. Вне прогрева и активной балансировки команда не принимается. Ошибка балансировки по
команде при активной балансировке пишется в лог `handleMainCamControl: error`. `stopBalancing()`
стирает команду вместе со сбросом параметров отправителя.

Если запуск планируется при уже активной балансировке (`recv-session-ended` без
`recv-session-started`), таймер и `balancing-scheduled` остаются, а балансировка продолжает
работать: `isBalancingScheduled` и `isBalancingActive` в это время оба равны `true`.

### `balancing-started`

Без соединения (`callManager.connection`) `startBalancing()` отклоняется ошибкой
`connection is not exist`: таймер запланированного запуска, прогрев и `isBalancingActive` не
меняются, `balancing-started` не приходит.

С соединением `startBalancing()` помечает балансировку активной, выполняет первую балансировку и
после неё — каким бы ни был её исход — генерирует `balancing-started`: запуск включает режим, а первая
балансировка — только первая попытка применить параметры. Менеджер берёт у балансировщика токен запуска сразу после вызова
`start()` и сверяет его прямо перед отправкой события, поэтому:

- если балансировку остановили во время первой балансировки, событие не генерируется, и после
  `balancing-stopped` событие `balancing-started` остановленного запуска не приходит;
- если её за это время остановили и запустили заново, событие генерирует только новый запуск;
- если первая балансировка завершилась ошибкой, метод всё равно завершается успешно и генерирует
  событие, а ошибку пишет в лог; балансировку повторит сверка по тику или следующая команда сервера;
- если запрос кодека первой балансировки не отвечает, она применяет параметры по последнему
  известному кодеку, и `startBalancing()` завершается не позже чем через ~1 с;
- первая балансировка, а с ней и событие, ждёт незавершённую замену трека на том же отправителе.

### Ручной `balance()`

`balance()` передаёт вызов балансировщику: при активной балансировке применяется текущая команда,
в остальное время параметры применяются один раз по разрешению трека и `maxAvailableResolution`,
без команды сервера. Так же метод работает во время прогрева, в том числе оставшегося после
неудачного старта по таймеру без соединения: команда, запомненная в прогреве, не применяется, а
параметры могут стать строже текущих — правило прогрева «только ослабление» на ручной вызов не
распространяется. Сверку по тику ручной вызов не включает, `isBalancingActive`, таймер и
запомненную команду не меняет: команду применит старт — по таймеру, а если старт по таймеру уже не
удался, то следующее планирование (`peerconnection:confirmed`, `recv-session-ended`) или
`startBalancing()`. Промис отклоняется ошибкой `connection is not exist` без соединения, ошибкой
запроса кодека или применения параметров.

## Ограничение разрешения (`maxAvailableResolution`)

При создании через `SipConnector` менеджер получает `getMaxResolution` в `balancerOptions` — ссылку
на `connectionConfiguration.maxAvailableResolution`. Опции передаются в конструктор
`VideoSendingBalancer` один раз; `SenderBalancer` вызывает callback при каждой балансировке и сбросе.

## Senders демонстрации

`SipConnector` передаёт в `balancerOptions` и `isExcludedSender` — проверку
`PresentationManager.isPresentationSender()`. Пока демонстрация идёт (от старта до остановки, сбоя
или конца звонка), балансировщик не выбирает её sender, даже если у основного потока нет видеотрека
(нет камеры или видео только на приём): тогда он ничего не записывает, а кадр демонстрации ограничивает
`PresentationManager`. Её sender не получает ничего, даже если балансировщик подключил его раньше
(демонстрация снова стартовала на sender, который балансировался после её остановки): ни команду
сервера, ни сброс от `stopBalancing()`, ни задачи, поставленные до старта демонстрации. После
остановки демонстрации тот же sender (например, с камерой) балансируется как обычно. В
`videoBalancerOptions` эту опцию не передают.

Подробнее: [рецепт видеобалансировки](../../docs/recipes/video-balancing.md).

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
