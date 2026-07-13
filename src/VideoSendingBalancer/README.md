# VideoSendingBalancer

Класс для управления балансировкой видео-потоков в SIP-соединении.

## Архитектура

Класс полностью инкапсулирует всю логику балансировки видео, включая:

- Поиск видео-сендера в соединении
- Проверку кодеков и их игнорирование
- Обработку событий управления камерой
- Управление состоянием балансировки
- Логику обработки сендера (processSender)
- Управление стеком промисов для последовательных операций

## Использование

### Создание экземпляра

```typescript
import VideoSendingBalancer from './VideoSendingBalancer';

const balancer = new VideoSendingBalancer(apiManager, getConnection, {
  ignoreForCodec: 'H264',
  onSetParameters: (parameters) => {
    console.log('Параметры обновлены:', parameters);
  },
  pollIntervalMs: 1000,
});
```

### Контекст балансировки

Методы `subscribe`, `balance`, `reset` и `unsubscribe` принимают `TBalancingContext` — контекст
активной сессии балансировки. Через него передаётся лимит разрешения подключения:

```typescript
type TBalancingContext = {
  getMaxResolution?: () => TResolutionSize | undefined;
};
```

`getMaxResolution` вызывается при каждой балансировке и сбросе, чтобы учесть актуальное значение
`maxAvailableResolution` из конфигурации подключения. В типичном сценарии контекст передаёт
`VideoSendingBalancerManager`.

### Подписка на события

```typescript
const context = {
  getMaxResolution: () => ({ width: 1920, height: 1080 }),
};

balancer.subscribe(context);
balancer.unsubscribe(context);
```

### Балансировка

```typescript
const result = await balancer.balance(context);
console.log('Результат балансировки:', result);
```

### Сброс состояния

```typescript
balancer.reset(context);
```

## API

### Конструктор

```typescript
constructor(
  apiManager: ApiManager,
  getConnection: () => RTCPeerConnection | undefined,
  options?: {
    ignoreForCodec?: string;
    onSetParameters?: TOnSetParameters;
    pollIntervalMs?: number;
  }
)
```

### Публичные методы

- `subscribe(context: TBalancingContext)`: Подписаться на события управления камерой
- `unsubscribe(context?: TBalancingContext)`: Отписаться от событий и сбросить состояние
- `balance(context?: TBalancingContext)`: Выполнить балансировку вручную
- `reset(context?: TBalancingContext)`: Сбросить состояние и восстановить параметры отправителя

### Приватные методы

- `handleMainCamControl(headers, context)`: Обработчик событий `main-cam-control`

## Внутренняя логика

Класс использует следующие компоненты:

- `VideoSendingEventHandler`: Обработка событий управления камерой
- `SenderBalancer`: Бизнес-логика балансировки
- `ParametersSetterWithQueue`: Управление очередью установки параметров
- `TrackMonitor`: Мониторинг изменений видеотреков
- `SenderFinder`: Поиск видео-сендера в соединении
- `CodecProvider`: Получение кодека из сендера

## Ограничение разрешения

При наличии `getMaxResolution` в контексте:

- `balance` и `reset` передают лимит в `SenderBalancer`
- для `MAX_MAIN_CAM_RESOLUTION` применяется более строгое из двух ограничений: команда сервера и
  `maxAvailableResolution` подключения (`Math.max` по `scaleResolutionDownBy`)
- при смене трека перебалансировка использует тот же `context`, что и текущий вызов `balance`

## Состояния камеры

Класс обрабатывает следующие состояния камеры:

- `PAUSE_MAIN_CAM`: Понижение разрешения до минимума
- `RESUME_MAIN_CAM`: Восстановление битрейта по разрешению трека
- `MAX_MAIN_CAM_RESOLUTION`: Установка максимального разрешения
- `ADMIN_STOP_MAIN_CAM` / `ADMIN_START_MAIN_CAM`: Административные команды

## Обратная совместимость

Для обратной совместимости доступна фабричная функция:

```typescript
import { resolveVideoSendingBalancer } from './VideoSendingBalancer';

const balancer = resolveVideoSendingBalancer(apiManager, getConnection, options);
```
