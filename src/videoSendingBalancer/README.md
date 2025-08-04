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
balancer.reset();
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

### Публичные методы

- `subscribe()`: Подписаться на события управления камерой
- `unsubscribe()`: Отписаться от событий управления камерой
- `reBalance()`: Выполнить балансировку вручную
- `reset()`: Сбросить состояние управления камерой

### Приватные методы

- `balanceByTrack()`: Базовая функция балансировки без параметров камеры
- `balance()`: Основная логика балансировки с поддержкой параметров камеры
- `processSender()`: Логика обработки сендера в зависимости от состояния камеры
- `handleMainCamControl()`: Обработчик событий управления камерой
- `runStackPromises()`: Управление стеком промисов
- `run()`: Добавление действий в стек промисов
- `addToStackScaleResolutionDownBySender()`: Настройка параметров сендера
- `downgradeResolutionSender()`: Понижение разрешения (PAUSE_MAIN_CAM)
- `setBitrateByTrackResolution()`: Установка битрейта по разрешению трека
- `setResolutionSender()`: Установка конкретного разрешения

## Внутренняя логика

Класс использует следующие компоненты:

- `findVideoSender`: Поиск видео-сендера в соединении
- `getCodecFromSender`: Получение кодека из сендера
- `hasIncludesString`: Проверка включения строки в кодеки
- `setEncodingsToSender`: Установка параметров кодирования
- `scaleResolutionAndBitrate`: Масштабирование разрешения и битрейта
- `getMaxBitrateByWidthAndCodec`: Получение максимального битрейта по ширине и кодеку

## Состояния камеры

Класс обрабатывает следующие состояния камеры:

- `PAUSE_MAIN_CAM`: Понижение разрешения до минимума
- `RESUME_MAIN_CAM`: Восстановление битрейта по разрешению трека
- `MAX_MAIN_CAM_RESOLUTION`: Установка максимального разрешения
- `ADMIN_STOP_MAIN_CAM` / `ADMIN_START_MAIN_CAM`: Административные команды

## Обратная совместимость

Для обратной совместимости доступна фабричная функция:

```typescript
import { resolveVideoSendingBalancer } from './videoSendingBalancer';

const balancer = resolveVideoSendingBalancer(sipConnector, options);
```

## Рефакторинг

Класс был создан в результате рефакторинга функционального подхода в объектно-ориентированный:

- Перенесена логика из `balance.ts` в метод `balance()`
- Перенесена логика из `processSender.ts` в метод `processSender()`
- Инкапсулированы все вспомогательные функции
- Улучшена организация кода и читаемость
