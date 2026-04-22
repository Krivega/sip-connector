# События `IncomingCallManager`

`IncomingCallManager` генерирует события при обработке входящих звонков. Все события доступны через префикс `incoming-call:*` в `SipConnector`.

## События

| Имя события                            | Описание                                      | Тип данных                        |
| -------------------------------------- | --------------------------------------------- | --------------------------------- |
| `incoming-call:ringing`                | Генерируется при поступлении входящего звонка | `TRemoteCallerDataWithRTCSession` |
| `incoming-call:declinedIncomingCall`   | Генерируется при отклонении входящего звонка  | `TRemoteCallerDataWithRTCSession` |
| `incoming-call:terminatedIncomingCall` | Генерируется при завершении входящего звонка  | `TRemoteCallerDataWithRTCSession` |
| `incoming-call:failedIncomingCall`     | Генерируется при ошибке входящего звонка      | `TRemoteCallerDataWithRTCSession` |

## Структуры данных

### `TRemoteCallerDataWithRTCSession`

```typescript
{
  displayName: string;
  host: string;
  incomingNumber: string;
  rtcSession: RTCSession;
}
```
