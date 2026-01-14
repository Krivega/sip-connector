# Управление последовательными операциями

## ConnectionQueueManager

`ConnectionQueueManager` обеспечивает **последовательное выполнение операций** для предотвращения конфликтов и гонки условий:

```typescript
// Все операции ConnectionManager проходят через очередь
const connectionQueueManager = new ConnectionQueueManager({
  connectionManager: connectionManager,
});

// Операции выполняются последовательно
await connectionQueueManager.connect(params);
await connectionQueueManager.disconnect();
```

## Механизм работы

- **Очередь операций**: Использует `stack-promises` с `noRunIsNotActual: true`
- **Предотвращение конфликтов**: Исключает одновременные connect/disconnect операции

## Поддерживаемые операции

| Операция     | Описание                          |
| ------------ | --------------------------------- |
| `connect`    | Подключение к серверу             |
| `disconnect` | Отключение от сервера             |
| `stop`       | Остановка всех операций в очереди |

## Интеграция в SipConnector

```typescript
// SipConnector автоматически использует ConnectionQueueManager
const sipConnector = new SipConnector({ JsSIP });

// Все операции подключения проходят через очередь
await sipConnector.connect(params); // → connectionQueueManager.connect()
await sipConnector.disconnect(); // → connectionQueueManager.disconnect()
```
