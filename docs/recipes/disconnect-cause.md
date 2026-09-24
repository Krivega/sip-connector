# Причина отключения от сервера

При завершении сессии входящим SIP BYE/CANCEL с заголовком
`X-VINTEO-DISCONNECT-CAUSE` коннектор добавляет `disconnectCause` в событие:

- `call:ended`, `call:failed`, `call:ended:fromserver` — основной звонок;
- `incoming-call:failedIncomingCall` — входящий вызов до ответа.

Заголовок читается без учёта регистра. Локализованный текст и его отображение
реализует приложение; коннектор передаёт причину, полученную от сервера.

## Данные причины

Из корня `sip-connector` экспортируются `EDisconnectCause`, `TDisconnectCause`
и `TCallEndEvent` — стандартный `EndEvent` JsSIP с необязательным `disconnectCause`.

```typescript
type TDisconnectCause = {
  raw: string; // Значение заголовка из JsSIP до числового преобразования.
  code?: number;
  key?: EDisconnectCause;
};
```

| Ситуация | Результат |
| --- | --- |
| Заголовка нет | `disconnectCause` равен `undefined`, прежние данные события сохраняются |
| Код известен | Заполнены `raw`, `code`, `key` |
| Целое число неизвестно | Заполнены `raw`, `code`; `key` равен `undefined` |
| Значение некорректно | Сохраняется только `raw`, исключение не возникает |

## Справочник кодов

| Код | `EDisconnectCause` |
| --- | --- |
| 1000 | `INSUFFICIENT_LICENSES` |
| 1001 | `P2P_NO_ANSWER` |
| 1002 | `ROOM_CONNECTION_LIMIT` |
| 1003 | `DISCONNECTED_BY_MODERATOR` |
| 1004 | `CONFERENCE_FINISHED` |
| 1006 | `P2P_REMOTE_UNAVAILABLE` |
| 1007 | `MODERATOR_LEFT` |
| 1008 | `ANONYMOUS_CONNECTION_FORBIDDEN` |
| 1009 | `MODERATOR_REQUIRED` |

Коды 1005, 1010 и 1011 обрабатываются как неизвестные.

## Использование в приложении

```typescript
import type { TCallEndEvent } from 'sip-connector';

const handleCallEnd = ({ disconnectCause }: TCallEndEvent) => {
  if (disconnectCause === undefined) {
    // Прежняя обработка завершения звонка.
    return;
  }

  // По key выбрать локализованное сообщение.
  // Если key отсутствует — показать общую причину отключения.
};

sipConnector.on('call:ended', handleCallEnd);
sipConnector.on('call:failed', handleCallEnd);
```

`call:ended:fromserver` — производное событие: не показывайте причину одновременно
из него и из `call:ended`/`call:failed`. При завершении во время установления звонка
причина также попадает в отклонение Promise; согласуйте обработку с `.catch`, чтобы
не показывать второе уведомление.

Для диагностики включите debug namespace `sip-connector:DisconnectCause`:
он записывает `raw`, `code`, `key`, SIP-метод и доступные `Call-ID` и `CSeq`.
