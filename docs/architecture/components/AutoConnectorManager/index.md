# AutoConnectorManager (Автоматическое переподключение)

**Назначение**: Обеспечивает автоматическое переподключение.

- [Машина состояний (XState)](./state-machine.md) — `AutoConnectorStateMachine`

## Ключевые возможности

- Автоматические попытки переподключения с задержками
- Проверка доступности телефонии
- Мониторинг состояния соединения
- Управление событиями попыток подключения
- Единая точка запросов на рестарт (`requestReconnect`) с причиной (`start`, `telephony-disconnected`, `registration-failed-out-of-call`, ...)
- Operational-правила coalescing и приоритеты причин: [рецепт автопереподключения](../../../recipes/auto-reconnection.md#приоритеты-причин-рестарта-coalescing)

## Архитектура компонентов

- `@AutoConnectorManager.ts` — фасад: публичный API (`start`/`stop`) и coalescing запросов на рестарт.
- `AutoConnectorStateMachine/*` — декларативная машина состояний XState (policy и переходы).
- `AutoConnectorRuntime.ts` — единая оркестрация побочных эффектов (attempts, connect/disconnect, triggers, telephony), включая правило `shouldDisconnectBeforeAttempt`.
- `createMachineDeps.ts` — тонкий адаптер между машиной и runtime, включая нормализацию terminal-ошибок.
- `CheckTelephonyRequester`, `PingServerIfNotActiveCallRequester`, `RegistrationFailedOutOfCallSubscriber` — инфраструктурные наблюдатели и периодические проверки.

## Основные методы

- `start(parameters)` - запуск процесса автоподключения:
  - cold start: сразу в цикл попытки без лишнего `disconnect`;
  - при активном/переходном соединении: сначала `disconnect`, затем попытка подключения.
- `stop()` - отмена текущей попытки автоподключения
