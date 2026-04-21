# События `ConnectionManager`

`ConnectionManager` генерирует события жизненного цикла SIP-соединения.  
В `SipConnector` они пробрасываются с префиксом `connection:*`.

## События

| Имя события                                     | Описание                                                           | Тип данных                                     |
| ----------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| `connection:connecting`                         | Старт подключения UA к серверу                                     | `ConnectingEventUA`                            |
| `connection:connected`                          | WebSocket подключён                                                | `ConnectedEvent`                               |
| `connection:disconnected`                       | Соединение разорвано                                               | `DisconnectEvent`                              |
| `connection:disconnecting`                      | Запущен процесс отключения                                         | `Record<string, never>`                        |
| `connection:newRTCSession`                      | Создана новая RTC-сессия                                           | `RTCSessionEvent`                              |
| `connection:registered`                         | Успешная SIP-регистрация                                           | `RegisteredEvent`                              |
| `connection:unregistered`                       | Успешная SIP-разрегистрация                                        | `UnRegisteredEvent`                            |
| `connection:registrationFailed`                 | Ошибка SIP-регистрации                                             | `RegistrationFailedEvent`                      |
| `connection:newMessage`                         | SIP MESSAGE входящее/исходящее                                     | `IncomingMessageEvent \| OutgoingMessageEvent` |
| `connection:sipEvent`                           | Произвольное SIP-событие                                           | `{ event: unknown; request: IncomingRequest }` |
| `connection:connect-started`                    | Начат `connect()` (до resolve параметров)                          | `Record<string, never>`                        |
| `connection:connect-parameters-resolve-success` | Параметры подключения успешно получены                             | `TParametersConnection`                        |
| `connection:connect-parameters-resolve-failed`  | Ошибка получения параметров подключения                            | `unknown`                                      |
| `connection:connect-succeeded`                  | `connect()` завершён успешно                                       | `TConnectionConfiguration`                     |
| `connection:connected-with-configuration`       | Получен `connected` + доступна конфигурация подключения            | `TConnectionConfiguration`                     |
| `connection:connect-failed`                     | `connect()` завершился ошибкой (кроме отменённых/cancelled ошибок) | `unknown`                                      |

## Структуры данных

### `TParametersConnection`

```typescript
{
  sipServerIp: string;
  sipServerUrl: string;
  remoteAddress: string;
  iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
  displayName: string;
  register?: boolean;
  user?: string;
  password?: string;
  userAgent?: string;
  sessionTimers?: boolean;
  registerExpires?: number;
  connectionRecoveryMinInterval?: number;
  connectionRecoveryMaxInterval?: number;
  extraHeaders?: string[];
}
```

### `TConnectionConfiguration`

```typescript
{
  sipServerIp: string;
  sipServerUrl: string;
  remoteAddress: string;
  iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
  displayName: string;
  authorizationUser: string;
  register?: boolean;
  user?: string;
  password?: string;
}
```
