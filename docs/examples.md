# Примеры использования

## Базовый пример

```typescript
// 1. Создание и настройка
const sipConnector = new SipConnector(
  { JsSIP },
  {
    preferredMimeTypesVideoCodecs: ['video/AV1', 'video/VP9'],
    videoBalancerOptions: { ignoreForCodec: 'H264' },
  },
);
const facade = new SipConnectorFacade(sipConnector);

// 2. Подключение
await facade.connectToServer({
  sipServerUrl: 'example.com', // Путь /webrtc/wss/ добавляется автоматически
  sipServerIp: 'sip.example.com',
  user: 'user123',
  password: 'secret',
  register: true,
});

// 3. Подписка на изменения удаленных потоков
const unsubscribeRemoteStreams = sipConnector.on('call:remote-streams-changed', (event) => {
  console.log('Изменение удаленных потоков:', {
    participantId: event.participantId,
    changeType: event.changeType, // 'added' | 'removed'
    trackId: event.trackId,
  });
  displayStreams(event.streams);
});

// 4. Звонок
const mediaStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true,
});

await facade.callToServer({
  conference: 'room123',
  mediaStream,
});

// 5. Презентация
await facade.startPresentation({
  mediaStream: presentationStream,
  isP2P: false,
  contentHint: 'detail',
});

// 6. Управление медиа
await facade.sendMediaState({
  isEnabledCam: true,
  isEnabledMic: false,
});

// 7. Очистка при завершении
unsubscribeRemoteStreams();
```

## Работа с сессией (XState)

```typescript
import { createSipSession } from '@krivega/sip-connector';

// Создание сессии
const session = createSipSession({
  connectionActor: connectionManager.connectionActor,
  callActor: callManager.callActor,
  incomingActor: incomingCallManager.incomingActor,
  presentationActor: presentationManager.presentationActor,
});

// Получение текущего снапшота
const snapshot = session.getSnapshot();
console.log('Connection status:', snapshot.connection.status);
console.log('Call status:', snapshot.call.status);

// Подписка на изменения состояния соединения
const unsubscribe = session.subscribe(
  (snapshot) => snapshot.connection.status,
  (status) => {
    console.log('Connection status changed:', status);
  }
);

// Очистка подписок
session.stop();
```

## Обработка событий

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

// Подписка на события звонка
sipConnector.on('call:connecting', () => {
  console.log('Идет подключение...');
});

sipConnector.on('call:ringing', () => {
  console.log('Звонок звонит...');
});

sipConnector.on('call:confirmed', () => {
  console.log('Звонок установлен');
});

// Подписка на события входящих звонков
sipConnector.on('incoming-call:ringing', (event) => {
  console.log('Входящий звонок от:', event.remoteCallerData);
});

// Подписка на события презентации
sipConnector.on('presentation:started', () => {
  console.log('Презентация началась');
});

sipConnector.on('presentation:ended', () => {
  console.log('Презентация завершена');
});

// Подписка на события участников
sipConnector.on('api:participant:move-request-to-spectators', (event) => {
  console.log('Перемещение в зрители:', event);
});
```

## Управление медиа-потоками

```typescript
// Замена медиа-потока
const newMediaStream = await navigator.mediaDevices.getUserMedia({
  video: { deviceId: newCameraId },
  audio: { deviceId: newMicrophoneId },
});

await facade.replaceMediaStream(newMediaStream);

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

## Работа с входящими звонками

```typescript
// Подписка на входящие звонки
sipConnector.on('incoming-call:ringing', async (event) => {
  console.log('Входящий звонок:', event.remoteCallerData);
  
  // Принять звонок
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  
  await facade.answerToIncomingCall({ mediaStream });
  
  // Или отклонить
  // await facade.declineToIncomingCall();
});
```

## Автоматическое переподключение

```typescript
// AutoConnectorManager автоматически обрабатывает переподключение
// Можно настроить параметры через события
sipConnector.on('auto-connect:attempt', (event) => {
  console.log(`Попытка переподключения ${event.attemptNumber}`);
});

sipConnector.on('auto-connect:success', () => {
  console.log('Переподключение успешно');
});

sipConnector.on('auto-connect:failed', () => {
  console.log('Переподключение не удалось');
});
```
