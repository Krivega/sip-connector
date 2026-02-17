# События `CallManager`

`CallManager` генерирует события в процессе установления и управления звонками. Все события доступны через префикс `call:*` в `SipConnector`.

## События

| Имя события                                      | Описание                                                            | Тип данных                                        |
| ------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------- |
| `call:start-call`                                | Генерируется при инициации исходящего звонка или ответа на входящий | `{ number: string; answer: boolean }`             |
| `call:peerconnection`                            | Генерируется при создании RTCPeerConnection                         | `{ peerconnection: RTCPeerConnection }`           |
| `call:connecting`                                | Генерируется при начале процесса подключения звонка                 | `unknown`                                         |
| `call:purgatory`                                 | Генерируется при входе в комнату ожидания (purgatory) без token     | `unknown`                                         |
| `call:inRoom`                                    | Генерируется при входе в комнату конференции с token                | `unknown`                                         |
| `call:sending`                                   | Генерируется при отправке SIP INVITE                                | `unknown`                                         |
| `call:progress`                                  | Генерируется при получении SIP 180 Ringing                          | `unknown`                                         |
| `call:accepted`                                  | Генерируется при принятии звонка (SIP 200 OK)                       | `unknown`                                         |
| `call:confirmed`                                 | Генерируется при подтверждении звонка                               | `unknown`                                         |
| `call:ended`                                     | Генерируется при завершении звонка                                  | `EndEvent`                                        |
| `call:failed`                                    | Генерируется при неудаче звонка                                     | `EndEvent`                                        |
| `call:newDTMF`                                   | Генерируется при получении DTMF сигнала                             | `{ originator: 'local' \| 'remote' \| 'system' }` |
| `call:newInfo`                                   | Генерируется при получении или отправке SIP INFO                    | `IncomingInfoEvent \| OutgoingInfoEvent`          |
| `call:hold`                                      | Генерируется при постановке звонка на удержание                     | `unknown`                                         |
| `call:unhold`                                    | Генерируется при снятии звонка с удержания                          | `unknown`                                         |
| `call:muted`                                     | Генерируется при отключении звука                                   | `unknown`                                         |
| `call:unmuted`                                   | Генерируется при включении звука                                    | `unknown`                                         |
| `call:reinvite`                                  | Генерируется при повторном INVITE                                   | `unknown`                                         |
| `call:update`                                    | Генерируется при SIP UPDATE                                         | `unknown`                                         |
| `call:refer`                                     | Генерируется при SIP REFER                                          | `unknown`                                         |
| `call:replaces`                                  | Генерируется при SIP REPLACES                                       | `unknown`                                         |
| `call:sdp`                                       | Генерируется при изменении SDP                                      | `unknown`                                         |
| `call:icecandidate`                              | Генерируется при получении ICE кандидата                            | `unknown`                                         |
| `call:getusermediafailed`                        | Генерируется при ошибке получения медиа-потока                      | `unknown`                                         |
| `call:peerconnection:createofferfailed`          | Генерируется при ошибке создания SDP offer                          | `unknown`                                         |
| `call:peerconnection:createanswerfailed`         | Генерируется при ошибке создания SDP answer                         | `unknown`                                         |
| `call:peerconnection:setlocaldescriptionfailed`  | Генерируется при ошибке установки локального SDP описания           | `unknown`                                         |
| `call:peerconnection:setremotedescriptionfailed` | Генерируется при ошибке установки удаленного SDP описания           | `unknown`                                         |
| `call:presentation:start`                        | Генерируется при начале запуска презентации                         | `MediaStream`                                     |
| `call:presentation:started`                      | Генерируется при успешном запуске презентации                       | `MediaStream`                                     |
| `call:presentation:end`                          | Генерируется при начале остановки презентации                       | `MediaStream`                                     |
| `call:presentation:ended`                        | Генерируется при успешной остановке презентации                     | `MediaStream`                                     |
| `call:presentation:failed`                       | Генерируется при ошибке презентации                                 | `Error`                                           |
| `call:peerconnection:confirmed`                  | Генерируется при подтверждении RTCPeerConnection                    | `RTCPeerConnection`                               |
| `call:peerconnection:ontrack`                    | Генерируется при получении нового медиа-трека                       | `RTCTrackEvent`                                   |
| `call:ended:fromserver`                          | Генерируется при завершении звонка от сервера                       | `EndEvent`                                        |
| `call:call-status-changed`                       | Генерируется при изменении статуса звонка                           | `{ isCallActive: boolean }`                       |
| `call:remote-tracks-changed`                     | Генерируется при изменении треков в удаленных медиа-потоках         | `TRemoteTracksChangedEvent`                       |
| `call:remote-streams-changed`                    | Генерируется при изменении удаленных медиа-потоков                  | `{ streams: TRemoteStreams }`                     |
| `call:recv-session-started`                      | Генерируется при успешном запуске recv-сессии (режим зрителя)       | `never`                                           |
| `call:recv-session-ended`                        | Генерируется при остановке recv-сессии (режим зрителя)              | `never`                                           |
| `call:recv-quality-changed`                      | Результат изменения качества приема (только режим зрителя)          | `TRecvQualityChangedEvent`                        |

## Структуры данных

### `TRemoteTracksChangedEvent` (событие `call:remote-tracks-changed`)

```typescript
{
  streams: TRemoteStreams;
  changeType: TRemoteTracksChangeType;
  participantId: string;
  trackId: string;
}
```

### `TRemoteStreams` (в т.ч. в событиях `call:remote-tracks-changed`, `call:remote-streams-changed`)

```typescript
{
  mainStream?: MediaStream;
  contentedStream?: MediaStream;
}
```

### `TRemoteTracksChangeType`

```typescript
'added' | 'removed' | 'updated';
```

### `TRecvQuality` / `TEffectiveQuality`

```typescript
type TRecvQuality = 'low' | 'medium' | 'high' | 'auto';
type TEffectiveQuality = 'low' | 'medium' | 'high';
```

### `TRecvQualityChangedEvent` (событие `call:recv-quality-changed`)

```typescript
{
  previousQuality: TRecvQuality;
  quality: TRecvQuality;
  effectiveQuality: TEffectiveQuality;
}
```

### `EndEvent`

Тип из `@krivega/jssip`, содержит информацию о завершении звонка.

### `IncomingInfoEvent` / `OutgoingInfoEvent`

Типы из `@krivega/jssip`, содержат информацию о SIP INFO сообщениях.
