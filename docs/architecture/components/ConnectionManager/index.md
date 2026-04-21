# ConnectionManager (SIP-соединения)

`ConnectionManager` управляет SIP User Agent, регистрацией и состоянием транспортного соединения.

## Назначение

- Создание/поддержка SIP-подключения к серверу.
- Управление регистрацией и разрегистрацией.
- Предоставление SIP-операций (`OPTIONS`, `PING`, check-telephony).

## Ключевые возможности

- Создание и управление SIP User Agent
- Регистрация/отмена регистрации на сервере
- Управление состояниями соединения через `ConnectionStateMachine` (XState)
- Безопасный `connect`: сначала инициирует `disconnect()` текущего состояния, затем запускает новый flow
- Retry подключения через `ConnectionFlow` (`numberOfConnectionAttempts`, по умолчанию 3)
- WebSocket соединения
- SIP-операции (OPTIONS, PING)
- Валидация переходов состояний с логированием

## Основные методы

| Метод                         | Назначение                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `connect()` / `disconnect()`  | Управление жизненным циклом SIP-подключения. `connect()` может получать `hasReadyForConnection`. |
| `register()` / `unregister()` | Явная регистрация/разрегистрация UA.                                                             |
| `sendOptions()` / `ping()`    | Отправка SIP OPTIONS и keepalive-запросов.                                                       |
| `checkTelephony()`            | Проверка доступности телефонии/сигнализации через временный UA.                                  |

## Внутренние компоненты

| Компонент                | Роль                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| `ConnectionStateMachine` | Модель состояний SIP-подключения (XState).                         |
| `ConnectionFlow`         | Оркестрация connect/disconnect, retries и инициализации UA.        |
| `RegistrationManager`    | Логика register/unregister поверх UA.                              |
| `UAFactory`              | Создание/конфигурирование User Agent и WebSocket.                  |
| `SipOperations`          | Вспомогательные SIP-операции (`OPTIONS`, `PING`, check-telephony). |

## Связанная state machine

- [ConnectionStateMachine](./state-machine.md)
