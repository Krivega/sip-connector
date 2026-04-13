# AutoConnectorManager (Автоматическое переподключение)

**Назначение**: Обеспечивает автоматическое переподключение.

- [Машина состояний (XState)](./state-machine.md) — `AutoConnectorStateMachine`

## Ключевые возможности

- Автоматические попытки переподключения с задержками
- Проверка доступности телефонии
- Мониторинг состояния соединения
- Управление событиями попыток подключения
- Единая точка запросов на рестарт (`requestReconnect`) с причиной (`start`, `network-change`, `sleep-resume`, ...)
- Operational-правила coalescing и приоритеты причин: [рецепт автопереподключения](../../../recipes/auto-reconnection.md#приоритеты-причин-рестарта-coalescing)

## Архитектура компонентов

- `@AutoConnectorManager.ts` — фасад и оркестрация внешних триггеров.
- `AutoConnectorStateMachine/*` — декларативная машина состояний XState.
- `createMachineDeps.ts` — адаптер между машиной и побочными эффектами менеджера.
- `CheckTelephonyRequester`, `PingServerIfNotActiveCallRequester`, `RegistrationFailedOutOfCallSubscriber` — инфраструктурные наблюдатели и периодические проверки.

## Основные методы

- `start(parameters)` - запуск процесса автоподключения
- `stop()` - отмена текущей попытки автоподключения
