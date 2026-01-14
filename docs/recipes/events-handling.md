# Обработка событий

> 📖 **Подробная документация**: Полное описание всех событий доступно в [API](../api/README.md).

## Архитектура событий

SDK использует **событийно-ориентированную архитектуру** с префиксами для группировки:

| Префикс            | Описание                 | Примеры событий                                                                |
| ------------------ | ------------------------ | ------------------------------------------------------------------------------ |
| `connection:*`     | События подключения      | `connected`, `disconnected`                                                    |
| `call:*`           | События звонков          | `accepted`, `ended`, `failed`, `remote-streams-changed`                        |
| `api:*`            | События от сервера       | `enterRoom`, `useLicense`, `restart`, `participant:move-request-to-spectators` |
| `incoming-call:*`  | События входящих звонков | `incomingCall`                                                                 |
| `presentation:*`   | События презентаций      | `started`, `stopped`                                                           |
| `stats:*`          | События статистики       | `collected`                                                                    |
| `video-balancer:*` | События балансировки     | `balancing-started`, `parameters-updated`                                      |

## Основные события

### События подключения

```typescript
// Подписка на события соединения
sipConnector.on('connection:connected', () => {
  console.log('Подключено к серверу');
});

sipConnector.on('connection:registered', () => {
  console.log('Зарегистрировано на сервере');
});

sipConnector.on('connection:disconnected', () => {
  console.log('Отключено от сервера');
});
```

### События звонка

```typescript
// Подписка на события звонка
sipConnector.on('call:connecting', () => {
  console.log('Идет подключение...');
});

sipConnector.on('call:confirmed', () => {
  console.log('Звонок установлен');
});

sipConnector.on('call:accepted', () => {
  console.log('Звонок принят');
});

sipConnector.on('call:ended', () => {
  console.log('Звонок завершен');
});

sipConnector.on('call:failed', (error) => {
  console.error('Ошибка звонка:', error);
});
```

### События входящих звонков

```typescript
// Подписка на события входящих звонков
sipConnector.on('incoming-call:ringing', (event) => {
  console.log('Входящий звонок от:', event.remoteCallerData);
});
```

### События презентации

```typescript
// Подписка на события презентации
sipConnector.on('presentation:started', () => {
  console.log('Презентация началась');
});

sipConnector.on('presentation:ended', () => {
  console.log('Презентация завершена');
});
```

### События участников

```typescript
// Подписка на события участников
sipConnector.on('api:participant:move-request-to-spectators', (event) => {
  console.log('Перемещение в зрители:', event);
});
```

### API события

```typescript
sipConnector.on('api:enterRoom', ({ room }) => {
  console.log('Вход в комнату:', room);
});

sipConnector.on('api:useLicense', (license) => {
  console.log('Лицензия:', license);
});
```

### Изменения удаленных потоков

```typescript
sipConnector.on('call:remote-streams-changed', (event) => {
  console.log('Изменение удаленных потоков:', {
    participantId: event.participantId,
    changeType: event.changeType, // 'added' | 'removed'
    trackId: event.trackId,
    streams: event.streams,
  });
});
```

## Детальная таблица событий

### События звонков (`call:*`)

| Событие                       | Описание                    | Данные                                                                                                 |
| ----------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `call:accepted`               | Звонок принят               | -                                                                                                      |
| `call:ended`                  | Звонок завершен             | `EndEvent`                                                                                             |
| `call:failed`                 | Звонок завершился с ошибкой | `EndEvent`                                                                                             |
| `call:remote-streams-changed` | Изменение удаленных потоков | `{ participantId: string, changeType: 'added' \| 'removed', trackId: string, streams: MediaStream[] }` |

### События участников (`api:participant:*`)

| Событие                                                | Описание                       | Данные                                                             |
| ------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------ |
| `api:participant:move-request-to-spectators`           | Перемещение в зрители (новый)  | `{ isSynthetic: true } \| { isSynthetic: false, audioId: string }` |
| `api:participant:move-request-to-spectators-synthetic` | Перемещение в зрители (старый) | -                                                                  |
| `api:participant:move-request-to-participants`         | Перемещение в участники        | -                                                                  |

## Продвинутые паттерны

```typescript
// Ожидание одного из нескольких событий
sipConnector.onceRace(['call:ended', 'call:failed'], (_payload, eventName) => {
  console.log('Звонок завершен событием:', eventName);
  cleanupCall();
});

// Ожидание конкретного события
const roomData = await sipConnector.wait('api:enterRoom');
console.log('Данные комнаты:', roomData);
```
