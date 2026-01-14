# Лучшие практики

## Обработка ошибок

```typescript
try {
  await facade.connectToServer(config);
} catch (error) {
  if (error.code === 'CONNECTION_FAILED') {
    // Повторная попытка подключения
    await retryConnection();
  } else {
    // Логирование и уведомление пользователя
    logError(error);
    notifyUser('Ошибка подключения');
  }
}
```

## Восстановление соединения

```typescript
// Мониторинг качества соединения
facade.onStats(({ outbound, inbound }) => {
  // Проверка качества соединения
  if (outbound.packetsLost > 0.05) {
    // 5% потерь пакетов
    console.warn('Высокие потери пакетов, перезапуск ICE');

    // Перезапуск ICE для восстановления соединения
    sipConnector.callManager
      .restartIce({
        useUpdate: true,
        extraHeaders: ['X-Restart-Reason: High-Packet-Loss'],
      })
      .catch((error) => {
        console.error('Ошибка перезапуска ICE:', error);
      });
  }
});
```

## Управление ресурсами

```typescript
// Всегда отписывайтесь от событий
const unsubscribe = facade.onStats(handleStats);

// Очистка при размонтировании
useEffect(() => {
  return () => {
    unsubscribe();
    facade.disconnectFromServer();
  };
}, []);
```

## Оптимизация производительности

```typescript
// Используйте debounce для частых событий
const debouncedStatsHandler = debounce(handleStats, 1000);
facade.onStats(debouncedStatsHandler);

// Приоритизируйте современные кодеки и настройте балансировку
const sipConnector = new SipConnector(
  { JsSIP: { UA, WebSocketInterface } },
  {
    preferredMimeTypesVideoCodecs: ['video/AV1', 'video/VP9'],
    videoBalancerOptions: {
      ignoreForCodec: 'H264',
      balancingStartDelay: 5000, // Быстрее запуск для критичных приложений
    },
  },
);
const facade = new SipConnectorFacade(sipConnector);
```
