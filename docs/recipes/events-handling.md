# Обработка событий

> 📖 **Подробная документация**: Полное описание всех событий доступно в [API](../api/README.md).

## Архитектура событий

SDK использует **событийно-ориентированную архитектуру** с префиксами для группировки:

| Префикс            | Описание                 |
| ------------------ | ------------------------ |
| `connection:*`     | События подключения      |
| `call:*`           | События звонков          |
| `api:*`            | События от сервера       |
| `incoming-call:*`  | События входящих звонков |
| `presentation:*`   | События презентаций      |
| `stats:*`          | События статистики       |
| `video-balancer:*` | События балансировки     |

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
  console.log('Входящий звонок от:', event);
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
sipConnector.on('api:enter-room', ({ room, participantName, bearerToken, isDirectPeerToPeer }) => {
  console.log('Вход в комнату:', room);
  console.log('Имя участника:', participantName);
  console.log('Direct P2P:', isDirectPeerToPeer);
});

sipConnector.on('api:use-license', (license) => {
  console.log('Лицензия:', license);
});
```

### Изменения удаленных потоков

```typescript
sipConnector.on('call:remote-streams-changed', (event) => {
  console.log('Изменение удаленных потоков:', {
    streams: event.streams,
  });
});
```

### Изменения качества приема (режим зрителя)

```typescript
// Событие запуска recv-сессии (необходимо дождаться перед использованием setRecvQuality/getRecvQuality)
sipConnector.on('call:recv-session-started', () => {
  console.log('Recv-сессия запущена, можно управлять качеством');
});

// Событие остановки recv-сессии
sipConnector.on('call:recv-session-ended', () => {
  console.log('Recv-сессия остановлена');
});

// Изменение качества приема
sipConnector.on('call:recv-quality-changed', (event) => {
  console.log('Результат применения качества:', event);
  console.log('Предыдущее качество:', event.previousQuality);
  console.log('Новое качество:', event.quality);
  console.log('Эффективное качество:', event.effectiveQuality);
});
```

## Продвинутые паттерны

```typescript
// Ожидание одного из нескольких событий
sipConnector.onceRace(['call:ended', 'call:failed'], (_payload, eventName) => {
  console.log('Звонок завершен событием:', eventName);
  cleanupCall();
});

// Ожидание конкретного события
const roomData = await sipConnector.wait('api:enter-room');
console.log('Данные комнаты:', roomData);
```
