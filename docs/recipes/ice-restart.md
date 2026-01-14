# Перезапуск ICE-соединения

## Ручной перезапуск

```typescript
// Перезапуск ICE для восстановления соединения
try {
  const success = await sipConnector.callManager.restartIce({
    useUpdate: true, // Использовать SIP UPDATE вместо re-INVITE
    extraHeaders: ['X-Restart-Reason: Connection-Reset'],
    rtcOfferConstraints: {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    },
  });

  if (success) {
    console.log('ICE перезапущен успешно');
  } else {
    console.warn('Перезапуск ICE не удался');
  }
} catch (error) {
  console.error('Ошибка перезапуска ICE:', error);
}
```

## Автоматический перезапуск по событию сервера

SDK автоматически обрабатывает события `restart` от сервера и инициирует перезапуск ICE-соединения с интеллектуальным управлением transceiver'ами:

```typescript
// SDK автоматически подписывается на события restart от ApiManager
// и выполняет следующие действия:
// 1. Проверяет необходимость добавления презентационного transceiver'а
// 2. Вызывает callManager.restartIce()

// Мониторинг событий restart (опционально)
sipConnector.on('api:restart', (data) => {
  console.log('Получено событие restart от сервера:', {
    tracksDirection: data.tracksDirection, // 'incoming', 'outgoing', 'bidirectional'
    audioTrackCount: data.audioTrackCount,
    videoTrackCount: data.videoTrackCount,
  });

  // SDK автоматически:
  // - Добавит презентационный transceiver если videoTrackCount === 2
  // - Вызовет restartIce()
  console.log('ICE будет перезапущен автоматически');

  if (data.videoTrackCount === 2) {
    console.log('Может быть добавлен презентационный transceiver');
  }
});
```

## Параметры перезапуска ICE

| Параметр                | Тип      | Описание                                 | По умолчанию |
| ----------------------- | -------- | ---------------------------------------- | ------------ |
| `useUpdate`             | boolean  | Использовать SIP UPDATE вместо re-INVITE | `false`      |
| `extraHeaders`          | string[] | Дополнительные SIP заголовки             | `[]`         |
| `rtcOfferConstraints`   | object   | Ограничения для создания SDP offer       | `{}`         |
| `sendEncodings`         | array    | Параметры кодирования для видеопотока    | `[]`         |
| `degradationPreference` | string   | Приоритет при ухудшении качества         | `undefined`  |
