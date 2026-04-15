# API и экспорты

## Основные классы

```typescript
import {
  SipConnector, // Низкоуровневый API
  SipConnectorFacade, // Высокоуровневый фасад
  StatsPeerConnection, // Сбор статистики
  // ... другие экспорты
} from 'sip-connector';
```

## Методы управления соединением

```typescript
// SipConnectorFacade методы
const facade = new SipConnectorFacade(sipConnector);

// Замена медиа-потока
await facade.replaceMediaStream(mediaStream, options);

// Получение удаленных потоков
const streams = facade.getRemoteStreams();

// Перезапуск ICE-соединения (низкоуровневый API)
await sipConnector.callManager.restartIce(options);
```

## Управление качеством приема (режим зрителя)

> ⚠️ **Важно**: Перед использованием `setRecvQuality`/`getRecvQuality` необходимо дождаться события `'call:recv-session-started'`.

```typescript
// Ожидание запуска recv-сессии
await sipConnector.wait('call:recv-session-started');

// Установка качества приема (только режим зрителя)
await sipConnector.setRecvQuality('auto'); // low | medium | high | auto

// Текущее запрошенное качество
const quality = sipConnector.getRecvQuality();
```

## Утилиты и типы

```typescript
import {
  // Классы и утилиты
  SipConnector,
  SipConnectorFacade,
  StatsPeerConnection,
  tools,
  hasAvailableStats,
  getCodecFromSender,
  enableDebug,
  disableDebug,
  hasConnectionPromiseIsNotActualError,
  hasCanceledCallError,
  hasCanceledStartPresentationError,

  // Константы и enum
  EStatsTypes,
  EMimeTypesVideoCodecs,
  EContentUseLicense,
  ESystemStatus,
  ECallStatus,
  EConnectionStatus,
  EIncomingStatus,
  EPresentationStatus,

  // Типы
  type TSessionSnapshot,
  type TCustomError,
  type TRemoteStreams,
  type TRecvQuality,
  type TEffectiveQuality,
  type TParametersConnection,
  type TConnectionConfiguration,
  type TInboundStats,
  type TOutboundStats,
  type TContentHint,
  type TJsSIP,
} from 'sip-connector';
```
