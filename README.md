# sip-connector

[![npm](https://img.shields.io/npm/v/sip-connector?style=flat-square)](https://www.npmjs.com/package/sip-connector)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/sip-connector?style=flat-square)

---

## 📖 Описание

**sip-connector** — это TypeScript SDK для интеграции WebRTC-приложений с платформой Vinteo через SIP-протокол. Библиотека построена на базе `@krivega/jssip` и предоставляет высокоуровневый API для создания полнофункциональных видеоконференций.

### 🎯 Основные возможности

SDK предоставляет комплексное решение для:

| Категория                    | Возможности                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| **SIP-подключения**          | Регистрация на сервере (SIP REGISTER), управление сессиями    |
| **WebRTC-коммуникации**      | Исходящие/входящие звонки (SIP INVITE/200 OK), медиа-потоки   |
| **Презентации**              | Отправка второго потока (screen sharing, демонстрация экрана) |
| **Системные сообщения**      | DTMF, SIP INFO, синхронизация медиа-состояния                 |
| **Событийная архитектура**   | Подписка на события платформы в реальном времени              |
| **Мониторинг**               | WebRTC-статистика (RTCRtpStats, ICE candidate stats)          |
| **Управление конференциями** | Перемещение участников между ролями (участник/зритель)        |
| **Лицензирование**           | Мониторинг использования лицензий и состояния презентаций     |

### 🏗️ Архитектура

SDK построен по принципу **слоистой архитектуры**:

- **SipConnector** — низкоуровневый слой с менеджерами (Connection, Call, Presentation, API)
- **SipConnectorFacade** — высокоуровневый фасад с готовыми сценариями
- **Специализированные менеджеры** — для статистики, участников, медиа-потоков

---

## 🚀 Установка

### Команды установки

```bash
# npm
npm install sip-connector

# yarn
yarn add sip-connector

# pnpm
pnpm add sip-connector
```

### 📋 Системные требования

#### Обязательные зависимости

| Компонент          | Требование           | Описание                       |
| ------------------ | -------------------- | ------------------------------ |
| `@krivega/jssip`   | peer dependency      | Для SIP-функциональности       |
| WebRTC API         | Поддержка в браузере | Стандартные WebRTC возможности |
| JavaScript runtime | ES2017+              | Современный синтаксис          |

#### Рекомендуемые зависимости

| Компонент  | Версия | Назначение          |
| ---------- | ------ | ------------------- |
| TypeScript | 4.5+   | Полная типизация    |
| Node.js    | 16+    | Сборка и разработка |

---

## 🎯 Быстрый старт

### Шаг 1: Инициализация

```typescript
import { UA, WebSocketInterface } from '@krivega/jssip';
import { SipConnector, SipConnectorFacade, tools } from 'sip-connector';

// Создание низкоуровневого коннектора
const sipConnector = new SipConnector({
  JsSIP: { UA, WebSocketInterface },
});

// Создание фасада с настройками кодеков
const facade = new SipConnectorFacade(sipConnector, {
  // Приоритизация современных кодеков
  preferredMimeTypesVideoCodecs: ['video/AV1', 'video/VP9'],
  excludeMimeTypesVideoCodecs: ['video/H264'],
});
```

### Шаг 2: Подключение к серверу

```typescript
await facade.connectToServer({
  userAgent: tools.getUserAgent({ appName: 'MyApp' }),
  sipWebSocketServerURL: 'wss://sip.example.com/ws',
  sipServerUrl: 'sip:example.com',
  name: '1001', // SIP URI user part
  password: 'secret',
  isRegisteredUser: true, // Включить SIP REGISTER
});
```

### Шаг 3: Исходящий звонок

```typescript
// Получение локального медиа-потока
const localStream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true,
});

// Инициация звонка
const pc = await facade.callToServer({
  conference: '12345',
  mediaStream: localStream,
  setRemoteStreams: (streams) => {
    // Обработка удаленных потоков
    console.log('Получены удаленные потоки:', streams);
  },
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
```

---

## 📞 Входящие звонки

### Обработка входящих вызовов

```typescript
// Подписка на входящие события
sipConnector.on('incoming-call:incoming', () => {
  // Автоматический ответ с локальным потоком
  facade.answerToIncomingCall({
    mediaStream: localStream,
    setRemoteStreams: (streams) => {
      // Отображение удаленных потоков
      displayRemoteStreams(streams);
    },
  });
});
```

### Управление состоянием звонка

```typescript
// Отслеживание жизненного цикла звонка
sipConnector.on('call:accepted', () => {
  console.log('Звонок принят');
});

sipConnector.on('call:ended', () => {
  console.log('Звонок завершен');
});

sipConnector.on('call:failed', (error) => {
  console.error('Ошибка звонка:', error);
});
```

---

## 🖥️ Управление презентациями

### Запуск презентации

```typescript
// Получение потока экрана
const displayStream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: true,
});

// Запуск презентации с настройками качества
await facade.startPresentation({
  mediaStream: displayStream,
  isP2P: false, // MCU режим
  contentHint: 'detail', // Оптимизация для детального контента
  simulcastEncodings: [
    { width: 1920, height: 1080, scalabilityMode: 'L3T3_KEY' },
    { width: 1280, height: 720 },
  ],
});
```

### Обновление и остановка

```typescript
// Обновление потока презентации
await facade.updatePresentation({
  mediaStream: newDisplayStream,
  isP2P: false,
});

// Остановка презентации
await facade.stopShareSipConnector();
```

---

## 👥 Управление участниками конференции

### Отслеживание перемещений

```typescript
// Подписка на перемещение в зрители
const unsubscribeMoveToSpectators = facade.onMoveToSpectators(() => {
  console.log('Участник перемещен в зрители');
  updateParticipantRole('spectator');
});

// Подписка на перемещение в участники
const unsubscribeMoveToParticipants = facade.onMoveToParticipants(() => {
  console.log('Участник перемещен в участники');
  updateParticipantRole('participant');
});

// Отписка при необходимости
unsubscribeMoveToSpectators();
unsubscribeMoveToParticipants();
```

### Административные функции

```typescript
// Принудительная остановка презентации
facade.onMustStopPresentation(() => {
  console.log('Администратор требует остановить презентацию');
  facade.stopShareSipConnector();
});

// Мониторинг лицензий
facade.onUseLicense((license) => {
  console.log('Используется лицензия:', license);
  updateLicenseStatus(license);
});
```

---

## 📊 Управление медиа-потоками

### Работа с удаленными потоками

```typescript
// Получение текущих удаленных потоков
const remoteStreams = facade.getRemoteStreams();
if (remoteStreams) {
  console.log('Активные удаленные потоки:', remoteStreams.length);
  remoteStreams.forEach((stream) => {
    displayStream(stream);
  });
}
```

### Обработка готовых потоков

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

### Управление разрешениями

```typescript
// Запрос разрешения на камеру
try {
  await facade.askPermissionToEnableCam();
  console.log('Разрешение на камеру получено');
} catch (error) {
  console.error('Ошибка получения разрешения:', error);
}
```

---

## 📡 События и их обработка

### Архитектура событий

SDK использует **событийно-ориентированную архитектуру** с префиксами для группировки:

| Префикс          | Описание            | Примеры событий               |
| ---------------- | ------------------- | ----------------------------- |
| `connection:*`   | События подключения | `connected`, `disconnected`   |
| `call:*`         | События звонков     | `accepted`, `ended`, `failed` |
| `api:*`          | События от сервера  | `enterRoom`, `useLicense`     |
| `presentation:*` | События презентаций | `started`, `stopped`          |
| `stats:*`        | События статистики  | `collected`                   |

### Основные события

```typescript
// Подключение
sipConnector.on('connection:connected', () => {
  console.log('Подключение установлено');
});

sipConnector.on('connection:disconnected', () => {
  console.log('Подключение разорвано');
});

// Звонки
sipConnector.on('call:accepted', () => {
  console.log('Звонок принят');
});

sipConnector.on('call:ended', () => {
  console.log('Звонок завершен');
});

// API события
sipConnector.on('api:enterRoom', ({ room }) => {
  console.log('Вход в комнату:', room);
});

sipConnector.on('api:useLicense', (license) => {
  console.log('Лицензия:', license);
});
```

### Продвинутые паттерны

```typescript
// Ожидание одного из нескольких событий
sipConnector.onceRace(['call:ended', 'call:failed'], (_payload, eventName) => {
  console.log('Звонок завершен событием:', eventName);
  cleanupCall();
});

// Ожидание конкретного события
const roomData = await sipConnector.wait('api:enterRoom');
console.log('Данные комнаты:', roomData);
```

---

## 📈 WebRTC Статистика

### Обзор возможностей

SDK предоставляет детальную WebRTC-статистику, основанную на [W3C WebRTC Statistics API](https://www.w3.org/TR/webrtc-stats/), включающую:

| Тип статистики     | Описание              | Метрики                       |
| ------------------ | --------------------- | ----------------------------- |
| **RTP статистика** | Потоковые данные      | Пакеты, байты, jitter, loss   |
| **Кодеки**         | Параметры кодирования | Параметры, реализация         |
| **ICE кандидаты**  | Сетевые соединения    | Типы, приоритеты, состояния   |
| **Транспорт**      | Защищенные соединения | DTLS, соединения, сертификаты |

### Использование статистики

```typescript
import { StatsPeerConnection, EStatsTypes, hasAvailableStats } from 'sip-connector';

// Проверка доступности
if (hasAvailableStats()) {
  const statsCollector = new StatsPeerConnection();

  // Подписка на события статистики
  statsCollector.on('collected', ({ outbound, inbound }) => {
    console.log('Исходящая статистика:', outbound);
    console.log('Входящая статистика:', inbound);

    // Анализ качества соединения
    analyzeConnectionQuality(outbound, inbound);
  });
}
```

### Типы статистики

| Категория              | Типы                              | Описание                                   |
| ---------------------- | --------------------------------- | ------------------------------------------ |
| **Аудио потоки**       | `TInboundAudio`, `TOutboundAudio` | RTP, кодек, jitter buffer, audio level     |
| **Видео потоки**       | `TInboundVideo`, `TOutboundVideo` | RTP, кодек, frames, bitrate, resolution    |
| **Сетевая информация** | `TAdditional`                     | ICE кандидаты, DTLS транспорт, сертификаты |

---

## 🔧 API и экспорты

### Основные классы

```typescript
import {
  SipConnector, // Низкоуровневый API
  SipConnectorFacade, // Высокоуровневый фасад
  StatsPeerConnection, // Сбор статистики
  // ... другие экспорты
} from 'sip-connector';
```

### Утилиты и типы

```typescript
import {
  // Утилиты
  tools, // getUserAgent, getExtraHeaders, hasPurgatory
  hasAvailableStats, // Проверка доступности статистики

  // Константы
  EStatsTypes, // Типы статистики
  EMimeTypesVideoCodecs, // MIME-типы кодеков
  EUseLicense, // Типы лицензий

  // Типы
  type TContentHint, // Подсказки для кодирования
  type TInboundStats, // Входящая статистика
  type TOutboundStats, // Исходящая статистика
} from 'sip-connector';
```

---

## 🏗️ Архитектура и паттерны

### Слоистая архитектура

```shell
┌─────────────────────────────────────┐
│           SipConnectorFacade        │ ← Высокоуровневый API
├─────────────────────────────────────┤
│           SipConnector              │ ← Координация менеджеров
├─────────────────────────────────────┤
│  Connection  │  Call   │  API       │ ← Специализированные менеджеры
│  Manager     │ Manager │ Manager    │
├─────────────────────────────────────┤
│           @krivega/jssip            │ ← SIP-функциональность
└─────────────────────────────────────┘
```

### Паттерны проектирования

| Паттерн         | Описание                          | Применение               |
| --------------- | --------------------------------- | ------------------------ |
| **Фасад**       | Упрощение сложных операций        | `SipConnectorFacade`     |
| **Стратегия**   | Различные стратегии для звонков   | MCU, P2P режимы          |
| **Наблюдатель** | Событийная модель для уведомлений | Event-driven архитектура |
| **Фабрика**     | Создание UA и сессий              | `UAFactory`              |

---

## 📚 Лучшие практики

### Обработка ошибок

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

### Управление ресурсами

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

### Оптимизация производительности

```typescript
// Используйте debounce для частых событий
const debouncedStatsHandler = debounce(handleStats, 1000);
facade.onStats(debouncedStatsHandler);

// Приоритизируйте современные кодеки
const facade = new SipConnectorFacade(sipConnector, {
  preferredMimeTypesVideoCodecs: ['video/AV1', 'video/VP9'],
});
```

---

## 🐛 Отладка и диагностика

### Включение отладочного режима

```typescript
import { enableDebug, disableDebug } from 'sip-connector';

// Включение детального логирования
enableDebug();

// Отключение для продакшена
disableDebug();
```

### Мониторинг состояния

```typescript
// Проверка состояния подключения
console.log('Подключен:', facade.connection.isConnected());
console.log('Зарегистрирован:', facade.isRegistered());

// Проверка конфигурации
console.log('Настроен:', facade.isConfigured());
```

---

## 🧪 Тестирование

### Запуск тестов

```bash
# Все тесты
npm test

# Тесты с покрытием
npm run test:coverage

# Тесты в watch режиме
npm run test:watch
```

### Тестовые фикстуры

SDK включает готовые моки для тестирования:

| Мок                     | Назначение           | Описание                   |
| ----------------------- | -------------------- | -------------------------- |
| `RTCPeerConnectionMock` | WebRTC API           | Имитация WebRTC соединений |
| `UA.mock.ts`            | SIP-функциональность | Имитация SIP User Agent    |
| `BaseSession.mock.ts`   | Сессии               | Имитация SIP сессий        |

---

## 🌐 Совместимость браузеров

### WebRTC поддержка

SDK использует стандартные WebRTC API и совместим с:

| Браузер     | Версия | Уровень поддержки | Особенности                    |
| ----------- | ------ | ----------------- | ------------------------------ |
| **Chrome**  | 67+    | Полная поддержка  | Все возможности WebRTC         |
| **Firefox** | 60+    | Полная поддержка  | Все возможности WebRTC         |
| **Safari**  | 11+    | Базовая поддержка | Ограниченная поддержка кодеков |
| **Edge**    | 79+    | Полная поддержка  | Chromium-based                 |

### Проверка возможностей

```typescript
// Проверка поддержки WebRTC
if (!navigator.mediaDevices?.getUserMedia) {
  throw new Error('WebRTC не поддерживается');
}

// Проверка поддержки презентаций
if (!navigator.mediaDevices?.getDisplayMedia) {
  console.warn('Screen sharing не поддерживается');
}
```

---

## 🤝 Поддержка и сообщество

### Документация

- **API Reference**: Полное описание всех методов и типов
- **Примеры**: Готовые сценарии использования
- **Архитектура**: Детальное описание внутренней структуры

### Сообщество

- **Issues**: [GitHub Issues](https://github.com/Krivega/sip-connector/issues)
- **Discussions**: Обсуждения и вопросы
- **Contributing**: Руководство по участию в разработке

## 👨‍💻 Автор

**Krivega Dmitriy**

- 🌐 Website: [krivega.com](https://krivega.com)
- 📱 Github: [@Krivega](https://github.com/Krivega)
- 📧 Email: <mr.krivega@gmail.com>

## 📄 Лицензия

Copyright © 2021‑2025 [Krivega Dmitriy](https://github.com/Krivega).

This project is licensed under the [MIT License](https://github.com/Krivega/sip-connector/blob/master/LICENSE) - see the LICENSE file for details.
