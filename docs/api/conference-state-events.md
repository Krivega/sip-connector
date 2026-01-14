# События `ConferenceStateManager`

`ConferenceStateManager` генерирует события при изменении состояния конференции. Все события доступны через префикс `conference-state:*` в `SipConnector`.

## События

| Имя события                      | Описание                                         | Тип данных                                                                                      |
| -------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `conference-state:state-changed` | Генерируется при изменении состояния конференции | `{ previous: TConferenceState; current: TConferenceState; updates: Partial<TConferenceState> }` |
| `conference-state:state-reset`   | Генерируется при сбросе состояния конференции    | `Record<string, never>`                                                                         |

## Структуры данных

### `TConferenceState`

```typescript
{
  token?: string; // JWT токен
  room?: string;
  participantName?: string;
  channels?: TChannels; // См. TChannels в событиях ApiManager
  conference?: string;
  participant?: string;
  number?: string;
  answer?: boolean;
}
```

**Примечание**: Тип `TChannels` описан в [событиях ApiManager](./api-events.md#tchannels).
