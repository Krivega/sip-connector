# VideoSendingBalancer

Класс для управления балансировкой видео-потоков в SIP-соединении.

## Архитектура

Класс полностью инкапсулирует всю логику балансировки видео, включая:

- Поиск видео-sender в соединении
- Проверку кодеков и их игнорирование
- Обработку событий управления камерой
- Управление состоянием балансировки
- Логику обработки Sender (`processSender`)
- Управление очередью установки параметров отправителя

## Использование

### Создание экземпляра

```typescript
import VideoSendingBalancer from './VideoSendingBalancer';

const balancer = new VideoSendingBalancer(apiManager, getConnection, {
  ignoreForCodec: 'H264',
  getMaxResolution: () => connectionConfiguration?.maxAvailableResolution,
  onSetParameters: (parameters) => {
    console.log('Параметры обновлены:', parameters);
  },
  pollIntervalMs: 1000,
});
```

`getMaxResolution` — обязательная опция `IBalancerOptions`. Callback передаётся в `SenderBalancer`
при создании и вызывается при каждой балансировке и сбросе, чтобы учесть актуальное значение
`maxAvailableResolution` из конфигурации подключения.

В типичном сценарии `getMaxResolution` задаёт `SipConnector` при создании
`VideoSendingBalancerManager`.

### Подписка на события

```typescript
balancer.subscribe();
balancer.unsubscribe();
```

### Балансировка

```typescript
const result = await balancer.balance();
console.log('Результат балансировки:', result);
```

### Сброс состояния

```typescript
balancer.reset();
```

## API

### Конструктор

```typescript
constructor(
  apiManager: ApiManager,
  getConnection: () => RTCPeerConnection | undefined,
  options: IBalancerOptions & {
    pollIntervalMs?: number;
  },
)
```

```typescript
interface IBalancerOptions {
  ignoreForCodec?: string;
  onSetParameters?: TOnSetParameters;
  getMaxResolution: () => TResolutionSize | undefined;
}
```

### Публичные методы

- `subscribe()`: Подписаться на события управления камерой
- `unsubscribe()`: Отписаться от событий и сбросить состояние
- `balance()`: Выполнить балансировку вручную
- `reset()`: Сбросить состояние и восстановить параметры Sender

### Приватные методы

- `handleMainCamControl(headers)`: Обработчик событий управления камерой

## Внутренняя логика

Класс использует следующие компоненты:

- `VideoSendingEventHandler`: Обработка событий управления камерой
- `SenderBalancer`: Бизнес-логика балансировки и ограничения разрешения
- `ParametersSetterWithQueue`: Очередь установки параметров отправителя
- `TrackMonitor`: Мониторинг смены видеотрека и перебалансировка
- `SenderFinder`: Поиск видео-сендера в соединении
- `CodecProvider`: Получение кодека из сендера

## Ограничение разрешения

`SenderBalancer` вызывает `getMaxResolution()` при:

- `balance()` без команды MCU и с `RESUME_MAIN_CAM`
- `reset()` при остановке балансировки
- перебалансировке после смены видеотрека

Лимит влияет на `scaleResolutionDownBy` и `maxBitrate` в `setBitrateByTrackResolution`.

Исключения:

- `PAUSE_MAIN_CAM` — фиксированное понижение (`scaleResolutionDownBy: 200`), лимит подключения не
  применяется
- `MAX_MAIN_CAM_RESOLUTION` с `resolutionMainCam` — используется только разрешение из команды MCU

## Состояния камеры

- `PAUSE_MAIN_CAM`: Понижение разрешения до минимума
- `RESUME_MAIN_CAM`: Восстановление параметров по разрешению трека с учётом `getMaxResolution`
- `MAX_MAIN_CAM_RESOLUTION`: Установка разрешения по `resolutionMainCam` от сервера
- `ADMIN_STOP_MAIN_CAM` / `ADMIN_START_MAIN_CAM`: Административные команды

## Обратная совместимость

```typescript
import { resolveVideoSendingBalancer } from './VideoSendingBalancer';

const balancer = resolveVideoSendingBalancer(apiManager, getConnection, options);
```
