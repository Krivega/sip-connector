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

### Подписка на события

```typescript
// Подписаться на события управления камерой
balancer.subscribe();

// Отписаться от событий
balancer.unsubscribe();
```

### Балансировка

```typescript
// Выполнить балансировку вручную
const result = await balancer.balance();
console.log('Результат балансировки:', result);
```

### Сброс состояния

```typescript
// Сбросить состояние управления камерой
balancer.reset();
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

- `subscribe()`: Подписаться на события управления камерой
- `unsubscribe()`: Отписаться от событий управления камерой
- `balance()`: Выполнить балансировку вручную
- `reset()`: Сбросить состояние управления камерой

### Приватные методы

- `handleMainCamControl()`: Обработчик событий управления камерой

## Внутренняя логика

Класс использует следующие компоненты:

- `VideoSendingEventHandler`: Обработка событий управления камерой
- `SenderBalancer`: Бизнес-логика балансировки
- `ParametersSetterWithQueue`: Управление очередью установки параметров
- `TrackMonitor`: Мониторинг изменений видеотреков
- `SenderFinder`: Поиск видео-сендера в соединении
- `CodecProvider`: Получение кодека из сендера

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

## Рефакторинг

Класс был создан в результате рефакторинга функционального подхода в объектно-ориентированный:

- Перенесена логика из `balance.ts` в метод `balance()`
- Перенесена логика из `processSender.ts` в метод `processSender()`
- Инкапсулированы все вспомогательные функции
- Улучшена организация кода и читаемость
