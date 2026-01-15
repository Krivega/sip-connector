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
