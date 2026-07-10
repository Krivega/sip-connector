# События `CallReconnectManager`

`CallReconnectManager` отвечает за автоматический редиал звонка после обрыва по сетевой причине. Все события доступны через префикс `call-reconnect:*` в `SipConnector` и через нативные имена на самом `CallReconnectManager`.

## События

| Имя события                             | Описание                                                                         | Тип данных                    |
| --------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------- |
| `call-reconnect:armed`                  | Менеджер активирован и ждёт сетевого обрыва (`state=armed`).                     | `Record<string, never>`       |
| `call-reconnect:disarmed`               | Менеджер деактивирован (`state=idle`): вручную или из-за локального `hangUp`.    | `Record<string, never>`       |
| `call-reconnect:failure-detected`       | Обнаружен сетевой обрыв звонка (успешный `isNetworkFailure`).                    | `TFailureDetectedEvent`       |
| `call-reconnect:attempt-scheduled`      | Запланирована следующая попытка с задержкой `delayMs`.                           | `TAttemptScheduledEvent`      |
| `call-reconnect:attempt-started`        | Попытка запущена (перед `startCall`).                                            | `TAttemptLifecycleEvent`      |
| `call-reconnect:attempt-succeeded`      | Попытка завершилась успехом; счётчик попыток сброшен.                            | `TAttemptLifecycleEvent`      |
| `call-reconnect:attempt-failed`         | Попытка не удалась (ошибка `startCall`); машина принимает решение о ретрае.      | `TAttemptFailedEvent`         |
| `call-reconnect:waiting-signaling`      | Менеджер ждёт готовности сигнализации (UA `connected`/`registered`) с таймаутом. | `TWaitingSignalingEvent`      |
| `call-reconnect:limit-reached`          | Достигнут лимит попыток; дальнейший повтор только через `forceReconnect()`.      | `TLimitReachedEvent`          |
| `call-reconnect:cancelled`              | Цикл отменён: `disarm`/локальный `hangUp`/`spectator-role`/`manual`.             | `TCancelledEvent`             |
| `call-reconnect:status-changed`         | Изменился UI-флаг активности (`isReconnecting`), удобно для индикации.           | `TStatusChangedEvent`         |
| `call-reconnect:termination-classified` | Завершение классифицировано как `redial` или финальный `finish`.                 | `TTerminationClassifiedEvent` |
| `call-reconnect:terminal`               | Redial завершён из-за лимита или terminal error.                                 | `TTerminalEvent`              |

## Структуры данных

### `TFailureDetectedEvent`

```typescript
{
  cause: string;
  originator: 'local' | 'remote' | 'system';
  attempt: number;
}
```

### `TAttemptScheduledEvent`

```typescript
{
  attempt: number;
  delayMs: number;
}
```

### `TAttemptLifecycleEvent`

```typescript
{
  attempt: number;
}
```

### `TAttemptFailedEvent`

```typescript
{
  attempt: number;
  error: unknown;
}
```

### `TWaitingSignalingEvent`

```typescript
{
  timeoutMs: number;
}
```

### `TLimitReachedEvent`

```typescript
{
  attempts: number;
}
```

### `TCancelledEvent`

```typescript
{
  reason: 'disarm' | 'manual' | 'local-hangup' | 'spectator-role';
}
```

### `TStatusChangedEvent`

```typescript
{
  isReconnecting: boolean;
}
```

### `TTerminationClassifiedEvent`

```typescript
{
  decision: 'redial' | 'finish';
  event: EndEvent;
}
```

### `TTerminalEvent`

```typescript
{ reason: 'limit-reached'; attempts: number }
| { reason: 'error-terminal'; error: unknown }
```

## Пример использования

```typescript
import type { SipConnector } from 'sip-connector';

const handleReconnect = (sipConnector: SipConnector): void => {
  sipConnector.on('call-reconnect:status-changed', ({ isReconnecting }) => {
    toggleSpinner(isReconnecting);
  });

  sipConnector.on('call-reconnect:attempt-scheduled', ({ attempt, delayMs }) => {
    showToast(`Повтор #${attempt} через ${delayMs} мс`);
  });

  sipConnector.on('call-reconnect:limit-reached', ({ attempts }) => {
    showFatalBanner(`Не удалось восстановить звонок после ${attempts} попыток`);
  });
};
```

Для сброса счётчика и немедленного повтора из `limitReached`/`errorTerminal` вызовите `SipConnector.forceCallReconnect()`. Для завершения всех попыток — `SipConnector.hangUp()` или `SipConnector.disarmCallAutoRedial('manual')`. При активной connect + call session `hangUp()` делегируется ей, выполняет `disarm('manual')` и полностью отключает signaling; без session сохраняется legacy-вызов `disarm('local-hangup')`.
