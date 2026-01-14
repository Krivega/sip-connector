# События `IncomingCallManager`

`IncomingCallManager` генерирует события при обработке входящих звонков. Все события доступны через префикс `incoming-call:*` в `SipConnector`.

## События

| Имя события                            | Описание                                      | Тип данных          |
| -------------------------------------- | --------------------------------------------- | ------------------- |
| `incoming-call:incomingCall`           | Генерируется при поступлении входящего звонка | `TRemoteCallerData` |
| `incoming-call:declinedIncomingCall`   | Генерируется при отклонении входящего звонка  | `TRemoteCallerData` |
| `incoming-call:terminatedIncomingCall` | Генерируется при завершении входящего звонка  | `TRemoteCallerData` |
| `incoming-call:failedIncomingCall`     | Генерируется при ошибке входящего звонка      | `TRemoteCallerData` |

## Структуры данных

### `TRemoteCallerData`

```typescript
{
  displayName?: string;
  host?: string;
  incomingNumber?: string;
  rtcSession?: RTCSession;
}
```
