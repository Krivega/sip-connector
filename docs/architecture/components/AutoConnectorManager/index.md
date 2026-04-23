# AutoConnectorManager (Автоматическое переподключение)

`AutoConnectorManager` управляет автоматическим восстановлением соединения и retry-политикой поверх `ConnectionManager`.

## Назначение

- Автоматический цикл переподключения после сбоев/разрывов.
- Координация retry-попыток, задержек и лимитов.
- Мониторинг состояния соединения и телефонии.

## Ключевые возможности

- Автоматические попытки переподключения с задержками
- Проверка доступности телефонии
- Мониторинг состояния соединения
- Управление событиями попыток подключения
- Реакция на сетевые события клиента (online/offline/change): встроенный браузерный подписчик по умолчанию + опциональная подмена через `networkEventsSubscriber`; политики `onNetworkChangePolicy` / `onNetworkOnlinePolicy` (`probe` по умолчанию — проверка SIP OPTIONS-пингом перед реконнектом)
- Единая точка запросов на рестарт (`requestReconnect`) с причиной (`start`, `manual-restart`, `telephony-disconnected`, `telephony-check-failed`, `registration-failed-out-of-call`, `network-online`, `network-change`, ...)
- Operational-правила coalescing и приоритеты причин: [рецепт автопереподключения](../../../recipes/auto-reconnection.md#приоритеты-причин-рестарта-coalescing)

## Основные методы

| Метод                  | Назначение                                                             |
| ---------------------- | ---------------------------------------------------------------------- |
| `start(parameters)`    | Запуск цикла автоподключения (cold start или через disconnect-phase).  |
| `restart()`            | Принудительный рестарт с параметрами из контекста предыдущего цикла.   |
| `stop()`               | Остановка текущего цикла автоподключения и сброс coalescing-состояния. |
| `cancelPendingRetry()` | Тестовый/служебный хук отмены отложенного retry.                       |

## Внутренние компоненты

| Компонент                              | Роль                                                                                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@AutoConnectorManager.ts`             | Фасад публичного API и точка `requestReconnect`.                                                                                                           |
| `AutoConnectorStateMachine/*`          | Декларативная state machine автоконнектора (XState).                                                                                                       |
| `AutoConnectorRuntime.ts`              | Побочные эффекты: attempts, connect/disconnect, triggers, telephony policy.                                                                                |
| `createMachineDeps.ts`                 | Адаптер между машиной и runtime, включая нормализацию terminal-ошибок.                                                                                     |
| `ReconnectRequestCoalescer`            | Coalescing рестартов в коротком окне с приоритетами причин.                                                                                                |
| `createBrowserNetworkEventsSubscriber` | Дефолтный браузерный адаптер (`online`/`offline`/`connection.change`) для `NetworkEventsReconnector`.                                                      |
| `NetworkEventsReconnector`             | Мост между `INetworkEventsSubscriber` клиента и `requestReconnect`/`toStop`; политики `probe`/`reconnect`/`ignore` + grace-окно для offline.               |
| Telephony/Ping/Registration watchers   | `CheckTelephonyRequester`, `PingServerRequester` (периодический SIP OPTIONS в фоне, в том числе во время звонка), `RegistrationFailedOutOfCallSubscriber`. |

## Связанная state machine

- [AutoConnectorStateMachine](./state-machine.md)
