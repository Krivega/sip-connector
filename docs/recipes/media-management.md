# Управление медиа-потоками

## Замена медиа-потока

```typescript
// Замена медиа-потока
const newMediaStream = await navigator.mediaDevices.getUserMedia({
  video: { deviceId: newCameraId },
  audio: { deviceId: newMicrophoneId },
});

await facade.replaceMediaStream(newMediaStream);
```

## Отправка состояния медиа

```typescript
// Отправка состояния медиа
await facade.sendMediaState({
  isEnabledCam: true,
  isEnabledMic: false,
});

// Отправка отказов
await facade.sendRefusalToTurnOnMic();
await facade.sendRefusalToTurnOnCam();

// Запрос разрешения на включение камеры
await facade.askPermissionToEnableCam();
```

## Работа с удаленными потоками

```typescript
const unsubscribeRemoteStreams = sipConnector.on('call:remote-streams-changed', (event) => {
  // Обновляем UI
  updateStreamsDisplay(event.streams);
});

// Получение текущих удаленных потоков (синхронный метод)
const { mainStream, contentedStream } = facade.getRemoteStreams();
const remoteStreams = [mainStream, contentedStream].filter((stream) => {
  return stream !== undefined;
});

console.log('Активные удаленные потоки:', remoteStreams.length);
remoteStreams.forEach((stream) => {
  displayStream(stream);
});
```

## Качество приема (режим зрителя)

> Управление доступно только в режиме зрителя. В режиме участника `quality` не применяется.

> ⚠️ **Важно**: Перед использованием `setRecvQuality`/`getRecvQuality` необходимо дождаться события `'call:recv-session-started'`. До этого момента recv-сессия не создана, и методы могут вернуть `undefined` или `false`.

```typescript
// Ожидание запуска recv-сессии
await sipConnector.wait('call:recv-session-started');

// Теперь можно использовать методы управления качеством
// Установка качества приема
await sipConnector.setRecvQuality('auto'); // low | medium | high | auto

// Получить текущее запрошенное качество
const quality = sipConnector.getRecvQuality();
console.log('Requested quality:', quality);

// Реакция на изменение качества
const unsubscribe = sipConnector.on('call:recv-quality-changed', (event) => {
  console.log('Quality change result:', event);
  console.log('Previous quality:', event.previousQuality);
  console.log('New quality:', event.quality);
  console.log('Effective quality:', event.effectiveQuality);
});
```

## Обработка готовых потоков

```typescript
// Обработка с debounce (рекомендуется для UI)
const handleReadyRemoteStreamsDebounced = facade.resolveHandleReadyRemoteStreamsDebounced({
  onReadyRemoteStreams: (streams) => {
    console.log('Готовые удаленные потоки:', streams);
    updateStreamsDisplay(streams);
  },
});

// Обработка без debounce (для критичных операций)
const handleReadyRemoteStreams = facade.resolveHandleReadyRemoteStreams({
  onReadyRemoteStreams: () => {
    console.log('Новый поток готов');
    handleNewStream();
  },
});
```

## Управление разрешениями

```typescript
// Запрос разрешения на камеру
try {
  await facade.askPermissionToEnableCam();
  console.log('Разрешение на камеру получено');
} catch (error) {
  console.error('Ошибка получения разрешения:', error);
}
```
