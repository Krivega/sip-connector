# VideoSendingBalancerManager

Менеджер для управления VideoSendingBalancer, который автоматически запускает балансировку видеопотоков через настраиваемое время после начала звонка.

## Особенности

- **Автоматический запуск**: Балансировка начинается через настраиваемое время (по умолчанию 10 секунд) после подтверждения WebRTC соединения: пока браузер прогревает отправку, скалирование не применяется
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

VideoSendingBalancerManager автоматически интегрируется с CallManager:

1. **При событии `peerconnection:confirmed`**: Планирует запуск балансировки через настраиваемое время (по умолчанию 10 секунд)
2. **При событии `ended` или `failed`**: Останавливает балансировку
3. **При событии `recv-session-started`**: Останавливает балансировку (вход в режим зрителя)
4. **При событии `recv-session-ended`**: Планирует запуск балансировки (выход из режима зрителя)
5. **При событии `recv-quality-changed`**: Останавливает балансировку (смена качества в режиме зрителя)
6. **При событии `main-cam-control` от `ApiManager`**: Применяет команду при активной балансировке; если запуск только запланирован, запоминает команду до старта по таймеру

Это обеспечивает автоматическое управление балансировкой без необходимости ручного вмешательства.

### Команда сервера `main-cam-control`

На `main-cam-control` подписан только менеджер; `VideoSendingBalancer` получает команду через
`setServerHeaders()`. Пока балансировка активна, команда применяется сразу.

`balancingStartDelay` нужна, потому что в начале звонка браузер прогревает отправку — постепенно
наращивает разрешение; пока прогрев не завершён, `scaleResolutionDownBy` применять нельзя. Поэтому
команда (любая: `MAX_MAIN_CAM_RESOLUTION`, `PAUSE_MAIN_CAM`, `RESUME_MAIN_CAM`), пришедшая, пока
запуск только запланирован, лишь запоминается: раньше времени балансировка не стартует, последнюю
запомненную команду применяет старт по таймеру.
Если балансировка не активна и не запланирована (нет звонка, режим зрителя, после
`recv-quality-changed`), команда игнорируется. `stopBalancing()` стирает команду вместе со сбросом
параметров отправителя.

`startBalancing()` помечает балансировку активной, выполняет первую балансировку и после неё
генерирует `balancing-started`. Если первая балансировка завершилась ошибкой, метод отклоняет
промис и событие не генерируется, но балансировка остаётся активной: следующие команды сервера
запускают перебалансировку. Если балансировку остановили во время первой балансировки, событие
тоже не генерируется. Если запрос кодека первой балансировки не завершился, `balancing-started` не
приходит и `startBalancing()` не завершается, хотя балансировка активна: команды сервера и замена
трека работают.

`balance()` при активной балансировке применяет текущую команду и отклоняет промис при ошибке
запроса кодека или применения параметров. Во время прогрева (запуск запланирован) он ничего не
меняет и возвращает `isChanged: false`. Вне прогрева и активной балансировки параметры применяются
один раз по разрешению трека: команда сервера не учитывается, слежение за отправителем не
включается.

Перед заменой видеотрека масштаб (`scaleResolutionDownBy`) для нового трека применяется заранее,
если он строже текущего. Кодек замена не запрашивает; если задано исключение по кодеку
(`ignoreForCodec`), параметры заранее не меняются — ограничение ставит балансировка после замены.
Если применить масштаб не удалось, ошибка логируется, трек всё равно заменяется. Замена отклоняется
только ошибкой самого `replaceTrack`; при этом масштаб оставшегося трека возвращается. После
успешной замены выполняется обычная балансировка; параметры, которые вызывающий код выставляет сразу
после `replaceTrack`, она затем перекрывает.

Кодек балансировка запрашивает до очереди изменений отправителя: зависший `getStats` не задерживает
очередь и замену трека.

## Ограничение разрешения (`maxAvailableResolution`)

При создании через `SipConnector` менеджер получает `getMaxResolution` в `balancerOptions` — ссылку
на `connectionConfiguration.maxAvailableResolution`. Опции передаются в конструктор
`VideoSendingBalancer` один раз; `SenderBalancer` вызывает callback при каждой балансировке и сбросе.

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
