# События `ApiManager`

`ApiManager` генерирует события при получении сообщений от сервера через SIP INFO. Все события доступны через префикс `api:*` в `SipConnector`.

## События

| Имя события                                                | Описание                                                      | Тип данных                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `api:enter-room`                                           | Генерируется при входе в комнату                              | `{ room: string; participantName: string; bearerToken?: string; isDirectPeerToPeer?: boolean }`  |
| `api:main-cam-control`                                     | Генерируется при управлении главной камерой                   | `{ mainCam?: EContentMainCAM; resolutionMainCam?: string }`        |
| `api:use-license`                                          | Генерируется при использовании лицензии                       | `EContentUseLicense`                                               |
| `api:new-dtmf`                                             | Генерируется при получении DTMF сигнала                       | `{ originator: string }`                                           |
| `api:conference:participant-token-issued`                  | Генерируется при выдаче токена участника конференции          | `TParametersConferenceParticipantTokenIssued`                      |
| `api:contented-stream:available`                           | Генерируется при доступности второго удаленного потока        | `{ codec?: EContentedStreamCodec }`                                |
| `api:contented-stream:not-available`                       | Генерируется при недоступности второго удаленного потока      | `Record<string, never>`                                            |
| `api:presentation:must-stop`                               | Генерируется при требовании остановить презентацию            | `Record<string, never>`                                            |
| `api:channels:all`                                         | Генерируется при получении информации о каналах               | `TChannels`                                                        |
| `api:channels:notify`                                      | Генерируется при уведомлении о каналах                        | `TChannels`                                                        |
| `api:participant:added-to-list-moderators`                 | Генерируется при добавлении участника в список модераторов    | `TParametersModeratorsList`                                        |
| `api:participant:removed-from-list-moderators`             | Генерируется при удалении участника из списка модераторов     | `TParametersModeratorsList`                                        |
| `api:participant:move-request-to-stream`                   | Генерируется при запросе перемещения участника в поток        | `TParametersModeratorsList`                                        |
| `api:participant:move-request-to-spectators`               | Генерируется при запросе перемещения участника в зрители      | `{ isSynthetic: true } \| { isSynthetic: false; audioId: string }` |
| `api:participant:move-request-to-spectators-synthetic`     | Генерируется при синтетическом запросе перемещения в зрители  | `Record<string, never>`                                            |
| `api:participant:move-request-to-spectators-with-audio-id` | Генерируется при запросе перемещения в зрители с audioId      | `{ audioId: string }`                                              |
| `api:participant:move-request-to-participants`             | Генерируется при запросе перемещения участника в участники    | `Record<string, never>`                                            |
| `api:participation:accepting-word-request`                 | Генерируется при принятии запроса на слово                    | `TParametersModeratorsList`                                        |
| `api:participation:cancelling-word-request`                | Генерируется при отмене запроса на слово                      | `TParametersModeratorsList`                                        |
| `api:webcast:started`                                      | Генерируется при запуске вебкаста                             | `TParametersWebcast`                                               |
| `api:webcast:stopped`                                      | Генерируется при остановке вебкаста                           | `TParametersWebcast`                                               |
| `api:account:changed`                                      | Генерируется при изменении аккаунта                           | `Record<string, never>`                                            |
| `api:account:deleted`                                      | Генерируется при удалении аккаунта                            | `Record<string, never>`                                            |
| `api:admin:start-main-cam`                                 | Генерируется при административном включении главной камеры    | `{ isSyncForced: boolean }`                                        |
| `api:admin:stop-main-cam`                                  | Генерируется при административном отключении главной камеры   | `{ isSyncForced: boolean }`                                        |
| `api:admin:start-mic`                                      | Генерируется при административном включении микрофона         | `{ isSyncForced: boolean }`                                        |
| `api:admin:stop-mic`                                       | Генерируется при административном отключении микрофона        | `{ isSyncForced: boolean }`                                        |
| `api:admin:force-sync-media-state`                         | Генерируется при принудительной синхронизации медиа-состояния | `{ isSyncForced: boolean }`                                        |

## Структуры данных

### `TChannels`

```typescript
{
  inputChannels: string;
  outputChannels: string;
}
```

### `TParametersModeratorsList`

```typescript
{
  conference: string;
}
```

### `TParametersWebcast`

```typescript
{
  conference: string;
  type: string;
}
```

### `TParametersConferenceParticipantTokenIssued`

```typescript
{
  conference: string;
  participant: string;
  jwt: string;
}
```

### `EContentMainCAM`

```typescript
enum EContentMainCAM {
  PAUSE_MAIN_CAM = 'PAUSEMAINCAM',
  RESUME_MAIN_CAM = 'RESUMEMAINCAM',
  MAX_MAIN_CAM_RESOLUTION = 'MAXMAINCAMRESOLUTION',
  ADMIN_STOP_MAIN_CAM = 'ADMINSTOPMAINCAM',
  ADMIN_START_MAIN_CAM = 'ADMINSTARTMAINCAM',
}
```

### `EContentUseLicense`

```typescript
enum EContentUseLicense {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  AUDIOPLUSPRESENTATION = 'AUDIOPLUSPRESENTATION',
}
```

### `EContentedStreamCodec`

```typescript
enum EContentedStreamCodec {
  H264 = 'H264',
  VP8 = 'VP8',
  VP9 = 'VP9',
  AV1 = 'AV1',
}
```
