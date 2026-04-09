# ConnectionManager (SIP-соединения)

**Назначение**: Управление SIP-соединениями и регистрацией на сервере.

## Ключевые возможности

- Создание и управление SIP User Agent
- Регистрация/отмена регистрации на сервере
- Управление состояниями соединения через ConnectionStateMachine (XState)
- WebSocket соединения
- SIP-операции (OPTIONS, PING)
- Валидация переходов состояний с логированием

## Основные методы

- `connect()` / `disconnect()` - управление соединением
- `register()` / `unregister()` - регистрация на сервере
- `sendOptions()` / `ping()` - SIP-операции
- `checkTelephony()` - проверка телефонии

## Внутренние компоненты

### ConnectionStateMachine

Управление состояниями SIP-соединения (XState)

- Валидация переходов между состояниями
- Публичный API с геттерами: `isIdle`, `isPreparing`, `isConnecting`, `isConnected`, `isRegistered`, `isEstablished`, `isDisconnected`, `isPending`, `isPendingConnect`, `isPendingInitUa`, `isActiveConnection`, `isDisconnecting`
- Методы: `reset()`, `startConnect()`, `startInitUa()`, `onStateChange()`, `canTransition()`, `getValidEvents()`
- При ошибках (registrationFailed, connect-failed) переход сразу в DISCONNECTED
- Автоматическое логирование всех переходов состояний

Подробнее см. [State Machine](./state-machine.md).
