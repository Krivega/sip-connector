# VideoSendingBalancer

Класс для управления балансировкой видео-потоков в SIP-соединении.

## Архитектура

Класс полностью инкапсулирует всю логику балансировки видео, включая:

- Поиск видео-sender в соединении
- Проверку кодеков и их игнорирование
- Применение команды управления камерой, переданной `VideoSendingBalancerManager`
- Управление состоянием балансировки
- Расчёт параметров кодирования по команде сервера (`resolveEncodingParameters`)
- Управление очередью установки параметров отправителя

## Использование

### Создание экземпляра

```typescript
import VideoSendingBalancer from './VideoSendingBalancer';

const balancer = new VideoSendingBalancer(getConnection, {
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

### Команда сервера

```typescript
balancer.setServerHeaders(headers);
await balancer.balance();
```

Балансировщик не подписывается на `main-cam-control`: события звонка и команды сервера слушает
`VideoSendingBalancerManager` и решает, когда балансировать. `setServerHeaders()` только сохраняет
команду, применяет её следующий `balance()`.

### Балансировка

```typescript
const result = await balancer.balance();
console.log('Результат балансировки:', result);
```

`balance()` применяет параметры по текущей команде и включает `TrackMonitor` для найденного
отправителя.

### Сброс состояния

```typescript
balancer.reset();
```

`reset()` стирает команду сервера, останавливает `TrackMonitor` и восстанавливает параметры
отправителя по разрешению трека.

## API

### Конструктор

```typescript
constructor(
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

- `setServerHeaders(headers)`: Сохранить команду управления главной камерой
- `balance()`: Выполнить балансировку
- `reset()`: Стереть команду, остановить `TrackMonitor` и восстановить параметры Sender

## Внутренняя логика

Класс использует следующие компоненты:

- `SenderBalancer`: Бизнес-логика балансировки и ограничения разрешения
- `ParametersSetterWithQueue`: Очередь установки параметров отправителя
- `TrackMonitor`: Мониторинг смены видеотрека и перебалансировка
- `SenderFinder`: Поиск видео-сендера в соединении
- `CodecProvider`: Получение кодека из сендера

## Ограничение разрешения

`SenderBalancer` вызывает `getMaxResolution()` при:

- `balance()` без команды MCU и с `RESUME_MAIN_CAM`
- `reset()` при остановке балансировки
- подготовке к замене видеотрека и перебалансировке после неё

Лимит влияет на `scaleResolutionDownBy` и `maxBitrate` в `resolveEncodingParameters`.

Исключения:

- `PAUSE_MAIN_CAM` — фиксированное понижение (`scaleResolutionDownBy: 200`), лимит подключения не
  применяется
- `MAX_MAIN_CAM_RESOLUTION` с `resolutionMainCam` — используется только разрешение из команды MCU

## Замена видеотрека

`TrackMonitor` оборачивает `replaceTrack` отправителя и выполняет вызовы последовательно, в порядке
вызова: каждый следующий ждёт завершения предыдущего, даже если тот завершился ошибкой или монитор
переподписался к тому же отправителю. Перед заменой на непустой трек, отличный от
текущего, вызывается `SenderBalancer.prepareTrackReplacement`: новый трек сразу запоминается как
ожидаемый, затем параметры считаются для старого и нового трека с текущей командой сервера и
`getMaxResolution`. Если для нового трека `scaleResolutionDownBy` больше, ограничение применяется до
замены, чтобы кадры нового трека не ушли в полном разрешении. Иначе параметры до замены не меняются
(ослабления до замены нет). Ошибки хука `beforeReplaceTrack` логирует `TrackMonitor`; замена
выполняется в любом случае.

Пока замена не завершилась, любая балансировка этого отправителя (команда сервера, опрос трека,
`reset`) берёт более строгие параметры из текущего и ожидаемого трека, поэтому параллельный
`balance()` не может ослабить ограничение. Ожидаемый трек сбрасывается после оригинального
`replaceTrack`, в том числе при ошибке (`completeTrackReplacement`), а затем выполняется обычная
перебалансировка.

Если во время замены вызван `reset()`, обёртка `replaceTrack` после замены не возобновляет слежение и
не запускает перебалансировку, раз монитор уже отключён от отправителя.

`ParametersSetterWithQueue` применяет параметры через `TaskQueue`: если задачу вытеснила более новая,
промис `add()` резолвится только после выполнения последней задачи очереди.

## Состояния камеры

- `PAUSE_MAIN_CAM`: Понижение разрешения до минимума
- `RESUME_MAIN_CAM`: Восстановление параметров по разрешению трека с учётом `getMaxResolution`
- `MAX_MAIN_CAM_RESOLUTION`: Установка разрешения по `resolutionMainCam` от сервера
- `ADMIN_STOP_MAIN_CAM` / `ADMIN_START_MAIN_CAM`: Административные команды

## Обратная совместимость

```typescript
import { resolveVideoSendingBalancer } from './VideoSendingBalancer';

const balancer = resolveVideoSendingBalancer(getConnection, options);
```
