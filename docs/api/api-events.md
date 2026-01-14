# События `ApiManager`

`ApiManager` генерирует события при получении сообщений от сервера через SIP INFO. Все события доступны через префикс `api:*` в `SipConnector`.

## События

| Имя события                                                | Описание                                                      | Тип данных                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `api:channels:notify`                                      | Генерируется при уведомлении о каналах                        | `TChannels`                                                        |
| `api:participant:added-to-list-moderators`                 | Генерируется при добавлении участника в список модераторов    | `TParametersModeratorsList`                                        |
| `api:participant:removed-from-list-moderators`             | Генерируется при удалении участника из списка модераторов     | `TParametersModeratorsList`                                        |
| `api:participant:move-request-to-stream`                   | Генерируется при запросе перемещения участника в поток        | `TParametersModeratorsList`                                        |
| `api:participant:move-request-to-participants`             | Генерируется при запросе перемещения участника в участники    | `Record<string, never>`                                            |
| `api:participant:move-request-to-spectators`               | Генерируется при запросе перемещения участника в зрители      | `{ isSynthetic: true } \| { isSynthetic: false; audioId: string }` |
| `api:participant:move-request-to-spectators-synthetic`     | Генерируется при синтетическом запросе перемещения в зрители  | `Record<string, never>`                                            |
| `api:participant:move-request-to-spectators-with-audio-id` | Генерируется при запросе перемещения в зрители с audioId      | `{ audioId: string }`                                              |
| `api:participation:accepting-word-request`                 | Генерируется при принятии запроса на слово                    | `TParametersModeratorsList`                                        |
| `api:participation:cancelling-word-request`                | Генерируется при отмене запроса на слово                      | `TParametersModeratorsList`                                        |
| `api:webcast:started`                                      | Генерируется при запуске вебкаста                             | `TParametersWebcast`                                               |
| `api:webcast:stopped`                                      | Генерируется при остановке вебкаста                           | `TParametersWebcast`                                               |
| `api:account:changed`                                      | Генерируется при изменении аккаунта                           | `Record<string, never>`                                            |
| `api:account:deleted`                                      | Генерируется при удалении аккаунта                            | `Record<string, never>`                                            |
| `api:conference:participant-token-issued`                  | Генерируется при выдаче токена участника конференции          | `TParametersConferenceParticipantTokenIssued`                      |
| `api:channels`                                             | Генерируется при получении информации о каналах               | `TChannels`                                                        |
| `api:enterRoom`                                            | Генерируется при входе в комнату                              | `{ room: string; participantName: string }`                        |
| `api:shareState`                                           | Генерируется при изменении состояния демонстрации             | `Record<string, never>`                                            |
| `api:main-cam-control`                                     | Генерируется при управлении главной камерой                   | `{ mainCam?: EEventsMainCAM; resolutionMainCam?: string }`         |
| `api:useLicense`                                           | Генерируется при использовании лицензии                       | `EUseLicense`                                                      |
| `api:admin-start-main-cam`                                 | Генерируется при административном включении главной камеры    | `{ isSyncForced: boolean }`                                        |
| `api:admin-stop-main-cam`                                  | Генерируется при административном отключении главной камеры   | `{ isSyncForced: boolean }`                                        |
| `api:admin-start-mic`                                      | Генерируется при административном включении микрофона         | `{ isSyncForced: boolean }`                                        |
| `api:admin-stop-mic`                                       | Генерируется при административном отключении микрофона        | `{ isSyncForced: boolean }`                                        |
| `api:admin-force-sync-media-state`                         | Генерируется при принудительной синхронизации медиа-состояния | `{ isSyncForced: boolean }`                                        |
| `api:availableSecondRemoteStream`                          | Генерируется при доступности второго удаленного потока        | `Record<string, never>`                                            |
| `api:notAvailableSecondRemoteStream`                       | Генерируется при недоступности второго удаленного потока      | `Record<string, never>`                                            |
| `api:mustStopPresentation`                                 | Генерируется при требовании остановить презентацию            | `Record<string, never>`                                            |
| `api:newDTMF`                                              | Генерируется при получении DTMF сигнала                       | `{ originator: string }`                                           |

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

### `EEventsMainCAM`

```typescript
enum EEventsMainCAM {
  PAUSE_MAIN_CAM = 'PAUSEMAINCAM',
  RESUME_MAIN_CAM = 'RESUMEMAINCAM',
  MAX_MAIN_CAM_RESOLUTION = 'MAXMAINCAMRESOLUTION',
  ADMIN_STOP_MAIN_CAM = 'ADMINSTOPMAINCAM',
  ADMIN_START_MAIN_CAM = 'ADMINSTARTMAINCAM',
}
```

### `EUseLicense`

```typescript
enum EUseLicense {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  AUDIOPLUSPRESENTATION = 'AUDIOPLUSPRESENTATION',
}
```
