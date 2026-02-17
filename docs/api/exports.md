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
  // Утилиты
  tools, // getUserAgent, getExtraHeaders, hasPurgatory
  hasAvailableStats, // Проверка доступности статистики

  // Константы
  EStatsTypes, // Типы статистики
  EMimeTypesVideoCodecs, // MIME-типы кодеков
  EUseLicense, // Типы лицензий
  ESystemStatus, // Комбинированное состояние системы (Connection + Call)
  ECallStatus, // Состояния звонка
  EConnectionStatus, // Состояния соединения
  EIncomingStatus, // Состояния входящего звонка
  EPresentationStatus, // Состояния презентации

  // Типы
  type TContentHint, // Подсказки для кодирования
  type TInboundStats, // Входящая статистика
  type TOutboundStats, // Исходящая статистика
  type TRestartData, // Данные события restart
  type ITransceiverStorage, // Интерфейс хранения transceiver'ов
} from 'sip-connector';
```
