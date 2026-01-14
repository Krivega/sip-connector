# События AutoConnectorManager

`AutoConnectorManager` генерирует события в процессе автоматического переподключения к SIP-серверу. Все события доступны через префикс `auto-connect:*` в `SipConnector`.

## События

| Имя события                           | Описание                                               | Тип данных              |
| ------------------------------------- | ------------------------------------------------------ | ----------------------- |
| `auto-connect:before-attempt`         | Генерируется перед началом попытки подключения         | `Record<string, never>` |
| `auto-connect:success`                | Генерируется при успешном подключении                  | `never`                 |
| `auto-connect:failed-all-attempts`    | Генерируется при неудаче всех попыток подключения      | `Error`                 |
| `auto-connect:cancelled-attempts`     | Генерируется при отмене попыток подключения            | `unknown`               |
| `auto-connect:changed-attempt-status` | Генерируется при изменении статуса попытки подключения | `TAttemptStatus`        |
| `auto-connect:stop-attempts-by-error` | Генерируется при остановке попыток из-за ошибки        | `unknown`               |
| `auto-connect:limit-reached-attempts` | Генерируется при достижении лимита попыток подключения | `Error`                 |

## Структуры данных

### `TAttemptStatus`

```typescript
{
  isInProgress: boolean;
}
```
