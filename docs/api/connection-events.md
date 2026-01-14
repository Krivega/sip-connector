# События `ConnectionManager`

`ConnectionManager` генерирует события на различных этапах жизненного цикла SIP-соединения. Все события доступны через префикс `connection:*` в `SipConnector`.

## События

| Имя события                                     | Описание                                                                        | Тип данных                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| `connection:connecting`                         | Генерируется при начале процесса подключения к SIP-серверу                      | `ConnectingEventUA`                            |
| `connection:connected`                          | Генерируется при успешном установлении WebSocket соединения с SIP-сервером      | `ConnectedEvent`                               |
| `connection:disconnected`                       | Генерируется при разрыве соединения с SIP-сервером                              | `DisconnectEvent`                              |
| `connection:newRTCSession`                      | Генерируется при создании новой RTC сессии (для входящих или исходящих звонков) | `RTCSessionEvent`                              |
| `connection:registered`                         | Генерируется при успешной регистрации на SIP-сервере (SIP REGISTER)             | `RegisteredEvent`                              |
| `connection:unregistered`                       | Генерируется при отмене регистрации на SIP-сервере                              | `UnRegisteredEvent`                            |
| `connection:registrationFailed`                 | Генерируется при неудачной попытке регистрации на SIP-сервере                   | `UnRegisteredEvent`                            |
| `connection:newMessage`                         | Генерируется при получении или отправке SIP MESSAGE                             | `IncomingMessageEvent \| OutgoingMessageEvent` |
| `connection:sipEvent`                           | Генерируется при получении произвольного SIP события                            | `{ event: unknown; request: IncomingRequest }` |
| `connection:disconnecting`                      | Генерируется при начале процесса отключения от сервера                          | `Record<string, never>`                        |
| `connection:connect-started`                    | Генерируется при начале процесса подключения (до инициализации UA)              | `Record<string, never>`                        |
| `connection:connect-parameters-resolve-success` | Генерируется при успешном разрешении параметров подключения                     | `TParametersConnection`                        |
| `connection:connect-parameters-resolve-failed`  | Генерируется при ошибке разрешения параметров подключения                       | `unknown`                                      |
| `connection:connect-succeeded`                  | Генерируется при успешном завершении процесса подключения                       | `TConnectionConfigurationWithUa`               |
| `connection:connected-with-configuration`       | Генерируется при установлении соединения с полной конфигурацией                 | `TConnectionConfigurationWithUa`               |
| `connection:connect-failed`                     | Генерируется при неудачной попытке подключения                                  | `unknown`                                      |

## Структуры данных

### `TParametersConnection`

```typescript
{
  sipServerIp: string;
  sipServerUrl: string;
  displayName: string;
  register?: boolean;
  user?: string;
  password?: string;
  remoteAddress?: string;
  userAgent?: string;
  sessionTimers?: boolean;
  registerExpires?: number;
  connectionRecoveryMinInterval?: number;
  connectionRecoveryMaxInterval?: number;
  extraHeaders?: string[];
}
```

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
