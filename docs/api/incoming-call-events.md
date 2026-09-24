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

У `incoming-call:failedIncomingCall` дополнительно может присутствовать
`disconnectCause?: TDisconnectCause`, если текущий ожидающий вызов завершён входящим
BYE/CANCEL с заголовком причины. Данные звонящего сохраняются. Подробности:
[причина отключения от сервера](../recipes/disconnect-cause.md).

### `TRemoteCallerDataWithRTCSession`

```typescript
{
  displayName: string;
  host: string;
  incomingNumber: string;
  rtcSession: RTCSession;
}
```
