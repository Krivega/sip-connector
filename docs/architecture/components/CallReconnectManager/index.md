# CallReconnectManager (Автоматический редиал звонка)

`CallReconnectManager` отвечает за автоматический повторный набор (редиал) звонка после обрыва по сетевой причине и позволяет пользователю в любой момент остановить процесс восстановления.

## Ключевые возможности

- Автоматически детектирует обрыв звонка по сетевому сбою и запускает цикл повтора `startCall`.
- Поддерживает экспоненциальный backoff с jitter и cap по времени (`ICallReconnectOptions`).
- Координируется с `ConnectionManager` — дожидается восстановления сигнализации до попытки.
- Позволяет принудительно прервать (`disarm`) или перезапустить (`forceReconnect`) цикл в любой момент.
- Отдаёт подробный поток событий и snapshot-машины для интеграции с UI через `SessionManager`.

## Назначение

- Детектировать обрыв звонка, вызванный сетевым сбоем (через JsSIP-причины).
- Проводить конечное число попыток повтора `startCall` с экспоненциальной задержкой и jitter.
- Координироваться с `ConnectionManager` — ждать готовности сигнализации (UA registered/connected), прежде чем делать попытку.
- Отдавать наружу поток событий (`armed`, `failure-detected`, `attempt-scheduled`, `attempt-started`, `attempt-succeeded`, `attempt-failed`, `waiting-signaling`, `limit-reached`, `cancelled`, `disarmed`, `status-changed`) и агрегированный state-машиный snapshot для UI.
- Предоставлять API для отмены (`disarm`), принудительного повтора сверх лимита (`forceReconnect`) и отмены только текущей попытки (`cancelCurrentAttempt`).

Менеджер намеренно не пересекается с `MainStreamRecovery` (восстановление медиапотока в активном звонке) и с `AutoConnectorManager` (восстановление _подключения_ к серверу): `CallReconnectManager` работает _только со звонком_, опираясь на уже установленное подключение.

## Публичный API

| Метод/поле               | Назначение                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `arm(parameters)`        | Активирует наблюдение и запоминает `getCallParameters`. В ролях spectator ранний выход с `cancelled`. |
| `disarm(reason?)`        | Отменяет in-flight (delay + startCall), уводит машину в `idle`, эмитит `disarmed`/`cancelled`.        |
| `forceReconnect()`       | Немедленный новый цикл из `limitReached`/`errorTerminal` (сбрасывает счётчик попыток).                |
| `cancelCurrentAttempt()` | Отмена in-flight без `disarm` — машина возвращается в `armed`.                                        |
| `stop()`                 | Останавливает машину и отписывается от менеджеров-источников событий.                                 |
| `isReconnecting`         | `true`, если state ≠ `idle`.                                                                          |
| `state`                  | Текущее значение `ECallReconnectStatus`.                                                              |
| `stateMachine`           | Публичный snapshot-ориентированный доступ к машине (используется в `SessionManager.getSnapshot()`).   |

## Структура

| Компонент                                                      | Роль                                                                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@CallReconnectManager.ts`                                     | Фасад, подписки на `CallManager`/`ConnectionManager`, проброс событий фасада с префиксом `call-reconnect:*`.           |
| `CallReconnectRuntime.ts`                                      | Побочные эффекты: `CancelableRequest<startCall>`, `DelayRequester` для backoff, `AttemptsState`, `waitSignalingReady`. |
| `CallReconnectStateMachine/createCallReconnectMachine.ts`      | Декларативный XState-автомат (состояния и переходы).                                                                   |
| `CallReconnectStateMachine/createCallReconnectMachineSetup.ts` | Actors/guards/actions/assign — тонкий адаптер между машиной и `TCallReconnectMachineDeps`.                             |
| `createMachineDeps.ts`                                         | Склейка runtime + events для предоставления машине узкого contract.                                                    |
| `policies/NetworkFailurePolicy.ts`                             | «Это сетевой сбой?» — классификация `EndEvent.cause` и `originator=system`.                                            |
| `policies/BackoffPolicy.ts`                                    | Вычисление следующей задержки: `base × factor^(attempt-1)`, cap `maxBackoffMs`, jitter `none/full/equal`.              |
| `AttemptsState.ts`                                             | Счётчик попыток с callback `isInProgress` для UI-сигналов.                                                             |

## Опции конструктора (`ICallReconnectOptions`)

| Поле                      | По умолчанию | Описание                                                                       |
| ------------------------- | ------------ | ------------------------------------------------------------------------------ |
| `maxAttempts`             | `5`          | Максимум попыток до `limit-reached`.                                           |
| `baseBackoffMs`           | `1000`       | Базовая задержка перед первой попыткой.                                        |
| `maxBackoffMs`            | `30_000`     | Верхняя граница задержки.                                                      |
| `backoffFactor`           | `2`          | Экспонента роста задержки.                                                     |
| `jitter`                  | `'equal'`    | `none` \| `full` \| `equal` — алгоритм размытия задержек.                      |
| `waitSignalingTimeoutMs`  | `20_000`     | Ждём до этого значения готовности сигнализации в состоянии `waitingSignaling`. |
| `isNetworkFailure(event)` | default      | Кастомный детектор сетевого сбоя (default покрывает основные JsSIP-коды).      |
| `canRetryOnError(error)`  | `() => true` | Политика «ретраить ли ошибку `startCall`» (non-retry → `errorTerminal`).       |

## Связанная state machine

- [CallReconnectStateMachine](./state-machine.md)

## События (наружу в фасад/SipConnector)

См. [docs/api/call-reconnect-events.md](../../../api/call-reconnect-events.md). В `SipConnector` события приходят с префиксом `call-reconnect:*`.

## Сценарии использования

- Базовый сценарий и типичная настройка — [рецепт call-auto-redial](../../../recipes/call-auto-redial.md).
