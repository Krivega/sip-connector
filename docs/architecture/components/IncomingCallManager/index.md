# IncomingCallManager (Входящие звонки)

`IncomingCallManager` обрабатывает входящие SIP-сессии и предоставляет API для приёма/отклонения вызова.

## Назначение

- Детектирование входящих звонков (`newRTCSession` с `originator=remote`).
- Хранение и выдача данных звонящего.
- Передача принятой входящей сессии в `CallManager`.

## Ключевые возможности

- Обнаружение входящих звонков
- Управление данными вызывающего
- Принятие и отклонение звонков
- Извлечение RTCSession для CallManager
- Валидация переходов состояний через IncomingCallStateMachine

## Основные методы

| Метод                         | Назначение                                                        |
| ----------------------------- | ----------------------------------------------------------------- |
| `getIncomingRTCSession()`     | Получение текущей входящей RTC-сессии (с ошибкой при отсутствии). |
| `extractIncomingRTCSession()` | Извлечение сессии для `CallManager` с переводом в `consumed`.     |
| `declineToIncomingCall()`     | Отклонение входящего вызова с заданным SIP-кодом.                 |
| `busyIncomingCall()`          | Быстрое отклонение кодом "занято" (`486`).                        |
| `start()` / `stop()`          | Управление подписками на события и очистка внутреннего состояния. |

## Внутренние компоненты

| Компонент                           | Роль                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `IncomingCallStateMachine`          | Модель состояния входящего вызова (XState).                                       |
| `ConnectionManager.events` подписки | Источник `newRTCSession`, `disconnected`, `registrationFailed`, `connect-failed`. |
| Внутренний `incomingRTCSession`     | Текущая входящая SIP-сессия и источник `remoteCallerData`.                        |

`RTCSession` хранится только во внутреннем runtime-поле `incomingRTCSession`.  
В `remoteCallerData` и контекстах state machine передаются только сериализуемые данные звонящего
(`displayName`, `host`, `incomingNumber`).

## Связанная state machine

- [IncomingCallStateMachine](./state-machine.md)
