# CallManager (WebRTC-звонки)

`CallManager` управляет жизненным циклом звонка и потоками поверх SIP/WebRTC.

## Назначение

- Запуск и завершение исходящих/входящих звонков.
- Управление MCU-сессией и receive-only сессией зрителя.
- Оркестрация состояния звонка через `CallStateMachine`.
- Использование `CallSessionState` (инжектируется из `SipConnector`) для role-orchestration.

## Ключевые возможности

- Управление WebRTC-соединением и медиа-потоками.
- Обработка переходов роли участника и переключение активного stream manager.
- Отложенный запуск `RecvSession` при гонке API-событий и выдачи JWT.
- Поддержка presentation-call через заголовок `x-vinteo-presentation-call: yes`.

## Основные методы

| Метод                                    | Назначение                                                           |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `startCall()` / `answerToIncomingCall()` | Запуск звонка (с передачей `extraHeaders` в state-machine контекст). |
| `endCall()`                              | Завершение текущего звонка.                                          |
| `replaceMediaStream()`                   | Замена локального медиа-потока в активной сессии.                    |
| `restartIce()`                           | Перезапуск ICE-процедуры соединения.                                 |
| `subscribeToApiEvents(apiManager)`       | Подписка на API-события state-machine и `CallSessionState`.          |

## Внутренние компоненты

| Компонент               | Роль                                                               |
| ----------------------- | ------------------------------------------------------------------ |
| `MCUSession`            | Основная SIP/RTC-сессия участника конференции.                     |
| `RecvSession`           | Receive-only сессия для spectator-режима.                          |
| `DeferredCommandRunner` | Отложенный запуск `RecvSession` до достижения состояния `IN_ROOM`. |
| `RemoteStreamsManager`  | Управление удалёнными потоками (`main` и `recv`).                  |
| `CallStateMachine`      | Валидация переходов и нормализация контекста звонка.               |
| `CallSessionState`      | Внешний read-model: роль, `license`, производные role-флаги.       |

## Связанная state machine

- [CallStateMachine](./state-machine.md)
