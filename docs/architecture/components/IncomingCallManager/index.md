# IncomingCallManager (Входящие звонки)

**Назначение**: Обработка входящих SIP-звонков.

## Ключевые возможности

- Обнаружение входящих звонков
- Управление данными вызывающего
- Принятие и отклонение звонков
- Извлечение RTCSession для CallManager
- Валидация переходов состояний через IncomingCallStateMachine

## Основные методы

- `getIncomingRTCSession()` - получение сессии
- `declineToIncomingCall()` - отклонение звонка
- `busyIncomingCall()` - ответ "занято"

## Внутренние компоненты

### IncomingCallStateMachine

Управление состояниями входящих SIP-звонков (XState)

- Валидация переходов между состояниями
- Публичный API с геттерами: `isIdle`, `isRinging`, `isConsumed`, `isDeclined`, `isTerminated`, `isFailed`, `isActive`, `isFinished`
- Хранение данных вызывающего абонента (remoteCallerData)
- Геттеры контекста: `remoteCallerData`, `lastReason`
- Методы: `reset()`, `toConsumed()`
- Полное логирование всех переходов состояний

Подробнее см. [State Machine](./state-machine.md).
