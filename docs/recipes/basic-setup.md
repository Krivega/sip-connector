# Базовый пример и быстрый старт

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

## Быстрый старт

### Шаг 1: Инициализация

```typescript
import { UA, WebSocketInterface } from '@krivega/jssip';
import { SipConnector, SipConnectorFacade, tools } from 'sip-connector';

// Создание низкоуровневого коннектора с настройками кодеков
const sipConnector = new SipConnector(
  { JsSIP: { UA, WebSocketInterface } },
  {
    // Приоритизация современных кодеков
    preferredMimeTypesVideoCodecs: ['video/AV1', 'video/VP9'],
    excludeMimeTypesVideoCodecs: ['video/H264'],
    // Настройки видеобалансировщика (опционально)
    videoBalancerOptions: {
      ignoreForCodec: 'H264',
      onSetParameters: (result) => {
        console.log('Video parameters updated:', result);
      },
    },
  },
);

// Создание фасада
const facade = new SipConnectorFacade(sipConnector);
```

### Шаг 2: Подключение к серверу

```typescript
// Подключение с объектом параметров
await facade.connectToServer({
  userAgent: tools.getUserAgent({ appName: 'MyApp' }),
  sipServerUrl: 'sip.example.com', // WebSocket URL (путь /webrtc/wss/ добавляется автоматически)
  sipServerIp: 'sip.example.com', // SIP сервер IP
  user: '1001', // SIP URI user part
  password: 'secret',
  register: true, // Включить SIP REGISTER
});

// Или с функцией для динамического получения параметров
await facade.connectToServer(async () => {
  // Получение актуальных параметров подключения
  const config = await fetchConnectionConfig();
  return {
    userAgent: tools.getUserAgent({ appName: 'MyApp' }),
    sipServerUrl: config.websocketUrl, // Без пути /webrtc/wss/ - он добавляется автоматически
    sipServerIp: config.sipServerIp,
    user: config.username,
    password: config.password,
    register: true,
  };
});

// Доступ к состоянию через ConnectionStateMachine (внутренний компонент)
const connectionStateMachine = sipConnector.connectionManager.connectionStateMachine;

// Проверка текущего состояния соединения
console.log('Состояние соединения:', connectionStateMachine.state);
console.log('Подключено:', connectionStateMachine.isActiveConnection); // true для connected/registered
console.log('В процессе:', connectionStateMachine.isPending); // true для connecting/initializing
console.log('Ошибка:', connectionStateMachine.error);

// Получение списка допустимых событий
const validEvents = connectionStateMachine.getValidEvents();
console.log('Допустимые переходы:', validEvents);

// Подписка на изменения состояния
const unsubscribe = connectionStateMachine.onStateChange((state) => {
  console.log('Новое состояние соединения:', state);
});
```

### Шаг 3: Исходящий звонок

```typescript
// Получение локального медиа-потока
const localStream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true,
});

// Подписка на изменения удаленных потоков
const unsubscribeRemoteStreams = sipConnector.on('call:remote-streams-changed', (event) => {
  // Обновление UI с новыми потоками
  updateRemoteStreamsDisplay(event.streams);
});

// Инициация звонка
const pc = await facade.callToServer({
  conference: '12345',
  mediaStream: localStream,
});

// Подписка на WebRTC-статистику
const unsubscribeStats = facade.onStats(({ outbound, inbound }) => {
  console.log('Исходящая статистика:', outbound);
  console.log('Входящая статистика:', inbound);
});
```

### Шаг 4: Завершение работы

```typescript
await facade.disconnectFromServer();
unsubscribeStats();
unsubscribeRemoteStreams();
```
