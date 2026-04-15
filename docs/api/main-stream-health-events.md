# События `MainStreamHealthMonitor`

`MainStreamHealthMonitor` публикует снимок состояния основного входящего видеопотока и отдельное событие об устойчивой проблеме. Все события доступны через префикс `main-stream-health:*` в `SipConnector`.

## События

| Имя события                                         | Когда генерируется                                                    | Тип данных                                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `main-stream-health:health-snapshot`                | На каждом сэмпле health-monitoring после очередного `stats:collected` | `THealthSnapshot`                                                                      |
| `main-stream-health:inbound-video-problem-detected` | Когда проблема подтверждается несколькими подряд проблемными сэмплами | `THealthSnapshot & { reason: TProblemReason; consecutiveProblemSamplesCount: number }` |
| `main-stream-health:inbound-video-problem-resolved` | Когда ранее подтвержденная проблема исчезла и snapshot стал healthy   | `THealthSnapshot & { reason: TProblemReason }`                                         |
| `main-stream-health:inbound-video-problem-reset`    | Когда подтвержденная проблема сбрасывается из-за смены контекста      | `{ reason: TProblemReason; resetCause: TProblemResetCause }`                           |

## Структуры данных

### `THealthSnapshot`

```ts
type THealthSnapshot = {
  isMutedMainVideoTrack: boolean;
  isInvalidInboundFrames: boolean;
  isNoInboundVideoTraffic: boolean;
  isInboundVideoStalled: boolean;
};
```

Поля:

- `isMutedMainVideoTrack` - основной remote video track находится в `muted`.
- `isInvalidInboundFrames` - пакеты уже приходят, но кадры не приходят или не декодируются.
- `isNoInboundVideoTraffic` - входящий видеотрафик отсутствует: `packetsReceived === 0 && bytesReceived === 0`.
- `isInboundVideoStalled` - видеотрафик уже был, но `packetsReceived` и `bytesReceived` перестали расти.

### `TProblemReason`

```ts
type TProblemReason =
  | 'invalid-inbound-frames'
  | 'no-inbound-video-traffic'
  | 'inbound-video-stalled';
```

### `TProblemResetCause`

```ts
type TProblemResetCause =
  | 'peerconnection:confirmed'
  | 'recv-session-started'
  | 'recv-session-ended'
  | 'recv-quality-changed'
  | 'failed'
  | 'ended';
```

## Пример использования

`SipConnector` подписывается на `main-stream-health:inbound-video-problem-detected` и запускает `MainStreamRecovery.recover()`. Восстановление выполняется через throttled `renegotiate`, без автоматического `endCall`.

Для клиентских приложений типичный паттерн такой:

- на `main-stream-health:inbound-video-problem-detected` показать предупреждение;
- на `main-stream-health:inbound-video-problem-resolved` скрыть предупреждение.
- на `main-stream-health:inbound-video-problem-reset` тоже скрыть предупреждение, но трактовать это как сброс контекста, а не как подтвержденное восстановление потока.
