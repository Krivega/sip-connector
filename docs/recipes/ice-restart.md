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

## Параметры перезапуска ICE

| Параметр                | Тип      | Описание                                 | По умолчанию |
| ----------------------- | -------- | ---------------------------------------- | ------------ |
| `useUpdate`             | boolean  | Использовать SIP UPDATE вместо re-INVITE | `false`      |
| `extraHeaders`          | string[] | Дополнительные SIP заголовки             | `[]`         |
| `rtcOfferConstraints`   | object   | Ограничения для создания SDP offer       | `{}`         |
| `sendEncodings`         | array    | Параметры кодирования для видеопотока    | `[]`         |
| `degradationPreference` | string   | Приоритет при ухудшении качества         | `undefined`  |
