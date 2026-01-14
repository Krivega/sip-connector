# События `SipConnector`

`SipConnector` генерирует собственные события, которые не относятся к конкретным менеджерам. Эти события являются синтетическими и генерируются на основе условий состояния звонка.

## События

| Имя события                                     | Описание                                                             | Тип данных                       |
| ----------------------------------------------- | -------------------------------------------------------------------- | -------------------------------- |
| `disconnected-from-out-of-call`                 | Генерируется при отключении, если звонок не активен                  | `Record<string, never>`          |
| `connected-with-configuration-from-out-of-call` | Генерируется при подключении с конфигурацией, если звонок не активен | `TConnectionConfigurationWithUa` |
| `stopped-presentation-by-server-command`        | Генерируется при остановке презентации по команде сервера            | `Record<string, never>`          |

## Структуры данных

### `TConnectionConfigurationWithUa`

```typescript
{
  sipServerIp: string;
  sipServerUrl: string;
  displayName: string;
  register: boolean;
  user?: string;
  password?: string;
  ua: UA; // JsSIP User Agent instance
}
```

**Примечание**: Полное описание типа доступно в [событиях ConnectionManager](./connection-events.md#tconnectionconfigurationwithua).
