# sip-connector

[![npm](https://img.shields.io/npm/v/sip-connector?style=flat-square)](https://www.npmjs.com/package/sip-connector)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/sip-connector?style=flat-square)

TypeScript SDK для подключения к Vinteo по WebRTC через SIP (на базе `@krivega/jssip`). Предоставляет высокий уровень API для:

- подключения/регистрации на SIP-сервере;
- исходящих/входящих звонков;
- управления презентацией (share screen/video);
- отправки служебных сообщений (DTMF, каналы, синхронизация медиа-состояния);
- подписки на события платформы.

## Установка

```sh
npm install sip-connector
# или
yarn add sip-connector
```

Минимально требуется передать `JsSIP` из `@krivega/jssip` при создании `SipConnector`.

## Быстрый старт

```ts
import { UA, WebSocketInterface } from '@krivega/jssip';
import { SipConnector, SipConnectorFacade, tools } from 'sip-connector';

// 1) Инициализация низкоуровневого коннектора
const sipConnector = new SipConnector({ JsSIP: { UA, WebSocketInterface } });

// 2) Фасад с готовыми сценариями и проксированием событий/методов
const facade = new SipConnectorFacade(sipConnector, {
  // опционально: приоритезировать/исключить кодеки видео
  preferredMimeTypesVideoCodecs: ['video/AV1', 'video/VP9'],
  excludeMimeTypesVideoCodecs: ['video/H264'],
});

// 3) Подключение к серверу
await facade.connectToServer({
  userAgent: tools.getUserAgent({ appName: 'MyApp' }),
  sipWebSocketServerURL: 'wss://sip.example.com/ws',
  sipServerUrl: 'sip:example.com',
  name: '1001', // пользователь (SIP URI user)
  password: 'secret',
  isRegisteredUser: true, // включить SIP REGISTER
});

// 4) Исходящий звонок
const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
const pc = await facade.callToServer({
  conference: '12345',
  mediaStream: localStream,
  setRemoteStreams: (streams) => {
    // отобразите удалённые потоки в плеере
    console.log('remote streams', streams);
  },
});

// 5) Завершение
await facade.disconnectFromServer();
```

## Входящий звонок (пример)

```ts
// Подписка на входящие события
sipConnector.on('incoming-call:incoming', () => {
  // ответить с локальным стримом
  facade.answerToIncomingCall({
    mediaStream: localStream,
    setRemoteStreams: (streams) => {
      /* ... */
    },
  });
});
```

## Управление презентацией

```ts
// старт
const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
await facade.startPresentation({
  mediaStream: displayStream,
  isP2P: false,
  contentHint: 'detail',
  simulcastEncodings: [
    { width: 1920, height: 1080, scalabilityMode: 'L3T3_KEY' },
    { width: 1280, height: 720 },
  ],
});

// обновление (например, смена потока)
await facade.updatePresentation({ mediaStream: displayStream, isP2P: false });

// стоп
await facade.stopShareSipConnector();
```

## События

События агрегируются и отдаются с префиксами менеджеров. Полный перечень смотрите в:

- `src/SipConnector/eventNames.ts`
- `src/ApiManager/eventNames.ts`

Примеры часто используемых событий:

- `connection:connected`, `connection:disconnected` — состояние подключения;
- `call:accepted`, `call:ended`, `call:failed` — жизненный цикл звонка;
- `api:enterRoom`, `api:useLicense`, `api:mustStopPresentation`, `api:newDTMF` — события от сервера;
- `incoming-call:incoming`, `incoming-call:failed` — входящие вызовы;
- `presentation:started`, `presentation:stopped` — презентация.

Подписка:

```ts
const unsubscribe = sipConnector.on('api:enterRoom', ({ room }) => {
  console.log('entered room', room);
});

// разовая подписка на несколько событий
sipConnector.onceRace(['call:ended', 'call:failed'], (_payload, eventName) => {
  console.log('call finished by', eventName);
});
```

## Экспорты

```ts
import {
  SipConnector,
  SipConnectorFacade,
  debug,
  enableDebug,
  disableDebug,
  ECallCause,
  hasCanceledCallError,
  EUseLicense,
  EMimeTypesVideoCodecs,
  type TContentHint,
  type TCustomError,
  type TJsSIP,
  tools, // { getUserAgent, getExtraHeaders, hasPurgatory, ... }
} from 'sip-connector';
```

## Заметки по API

- `SipConnector` — низкоуровневый класс, инкапсулирующий менеджеры подключения/звонков/презентаций. Требует `JsSIP` при создании.
- `SipConnectorFacade` — удобный фасад с готовыми сценариями: `connectToServer`, `callToServer`, `answerToIncomingCall`, `disconnectFromServer`, `replaceMediaStream`, `sendMediaState`, `sendRefusalToTurnOnMic/Cam`, `onUseLicense`, `onMustStopPresentation`, `onMoveToSpectators/Participants` и др. Также проксирует методы `on/once/onceRace/wait/off`, `ping`, `hangUp`, `sendDTMF`, `checkTelephony`, `connection`, `isConfigured`, `isRegistered`.
- Поддерживаются настройки качества: `contentHint`, `degradationPreference`, `simulcastEncodings`, `sendEncodings`, фильтрация кодеков видео через `preferredMimeTypesVideoCodecs`/`excludeMimeTypesVideoCodecs`.

## Отладка

```ts
import { enableDebug, disableDebug } from 'sip-connector';

enableDebug();
// ...
disableDebug();
```

## Тесты

```sh
npm test
```

## Поддержка браузеров

SDK использует стандартные WebRTC API. Для максимально старых браузеров проверьте поддержку необходимых возможностей (кодеки, Unified Plan, `getDisplayMedia`).

## Maintainer

Krivega Dmitriy

- Website: [krivega.com](https://krivega.com)
- Github: [@Krivega](https://github.com/Krivega)

## Contributing

Contributions, issues and feature requests are welcome!
Feel free to check [issues page](https://github.com/Krivega/sip-connector/issues). You can also take a look at the [contributing guide](https://github.com/Krivega/sip-connector/blob/master/CONTRIBUTING.md).

## 📝 License

Copyright © 2021‑2025 [Krivega Dmitriy](https://github.com/Krivega).
This project is [MIT](https://github.com/Krivega/sip-connector/blob/master/LICENSE) licensed.
