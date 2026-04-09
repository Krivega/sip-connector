# PresentationManager (Презентации)

**Назначение**: Управление демонстрацией экрана и презентациями.

## Ключевые возможности

- Запуск и остановка презентаций
- Обновление потоков презентации
- Управление битрейтом презентации
- Обработка дублированных вызовов
- Поддержка P2P и MCU режимов
- Валидация переходов состояний через PresentationStateMachine

## Основные методы

- `startPresentation()` / `stopPresentation()` - управление презентациями
- `updatePresentation()` - обновление потока
- `cancelSendPresentationWithRepeatedCalls()` - отмена операций

## Внутренние компоненты

### PresentationStateMachine

Управление состояниями демонстрации экрана (XState)

- Валидация переходов между состояниями
- Публичный API с геттерами: `isIdle`, `isStarting`, `isActive`, `isStopping`, `isFailed`, `isPending`, `isActiveOrPending`
- Типобезопасная обработка ошибок (lastError: Error | undefined)
- Методы: `reset()`
- Полное логирование всех переходов состояний

Подробнее см. [State Machine](./state-machine.md).
