### Архитектура

#### 1. **SipConnectorFacade** (Входная точка)

```ts
class SipConnectorFacade implements IProxyMethods {
  public readonly sipConnector: SipConnector;
  private readonly preferredMimeTypesVideoCodecs?: string[];
  private readonly excludeMimeTypesVideoCodecs?: string[];

  constructor(
    sipConnector: SipConnector,
    {
      preferredMimeTypesVideoCodecs,
      excludeMimeTypesVideoCodecs,
    }: {
      preferredMimeTypesVideoCodecs?: string[];
      excludeMimeTypesVideoCodecs?: string[];
    } = {},
  ) {
    // Proxy для проксирования методов из SipConnector
    return new Proxy(this, {
      get: (target, property, receiver) => {
        if (proxyMethods.has(property as keyof IProxyMethods)) {
          return Reflect.get(this.sipConnector, property, this.sipConnector);
        }
        return Reflect.get(target, property, receiver);
      },
    });
  }

  // Основные методы для работы с сервером
  connectToServer(parameters): Promise<{ ua?: UA; isSuccessful: boolean }>;
  disconnectFromServer(): Promise<{ isSuccessful: boolean }>;
  callToServer(parameters): Promise<RTCPeerConnection>;
  answerToIncomingCall(parameters): Promise<RTCPeerConnection | undefined>;

  // Методы для презентации
  startPresentation(parameters): Promise<MediaStream | undefined>;
  updatePresentation(parameters): Promise<MediaStream | undefined>;
  stopShareSipConnector(parameters): Promise<void>;

  // Методы для управления медиа
  replaceMediaStream(mediaStream, options): Promise<void>;
  sendMediaState(parameters): Promise<void>;
  sendRefusalToTurnOnMic(): Promise<void>;
  sendRefusalToTurnOnCam(): Promise<void>;

  // Утилитарные методы
  getRemoteStreams(): MediaStream[] | undefined;
  onUseLicense(handler): () => void;
  onMustStopPresentation(handler): () => void;
  onMoveToSpectators(handler): () => void;
  onMoveToParticipants(handler): () => void;
}
```

---

#### 2. **SipConnector** (Основной координатор)

```ts
class SipConnector {
  public readonly events: Events<typeof EVENT_NAMES>;
  public readonly connectionManager: ConnectionManager;
  public readonly callManager: CallManager;
  public readonly apiManager: ApiManager;
  public readonly incomingCallManager: IncomingCallManager;
  public readonly presentationManager: PresentationManager;

  constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    this.connectionManager = new ConnectionManager({ JsSIP });
    this.callManager = new CallManager();
    this.apiManager = new ApiManager({
      connectionManager: this.connectionManager,
      callManager: this.callManager,
    });
    this.incomingCallManager = new IncomingCallManager(this.connectionManager);
    this.presentationManager = new PresentationManager({
      callManager: this.callManager,
    });

    this.subscribe();
  }

  // Проксирование методов менеджеров
  connect: ConnectionManager['connect'];
  disconnect: ConnectionManager['disconnect'];
  call: CallManager['startCall'];
  hangUp: CallManager['endCall'];
  answerToIncomingCall: CallManager['answerToIncomingCall'];
  startPresentation: PresentationManager['startPresentation'];
  stopPresentation: PresentationManager['stopPresentation'];
  updatePresentation: PresentationManager['updatePresentation'];
}
```

---

#### 3. **ConnectionManager** (Управление соединением)

```ts
class ConnectionManager {
  public readonly events: Events<typeof EVENT_NAMES>;
  public ua?: UA;
  public socket?: WebSocketInterface;

  private readonly uaFactory: UAFactory;
  private readonly registrationManager: RegistrationManager;
  private readonly stateMachine: ConnectionStateMachine;
  private readonly connectionFlow: ConnectionFlow;
  private readonly sipOperations: SipOperations;
  private readonly configurationManager: ConfigurationManager;

  constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.JsSIP = JsSIP;
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    this.uaFactory = new UAFactory(JsSIP);
    this.registrationManager = new RegistrationManager({
      events: this.events,
      getUaProtected: this.getUaProtected,
    });
    this.stateMachine = new ConnectionStateMachine(this.events);
    this.configurationManager = new ConfigurationManager({
      getUa: this.getUa,
    });
    this.sipOperations = new SipOperations({
      uaFactory: this.uaFactory,
      getUaProtected: this.getUaProtected,
    });
    this.connectionFlow = new ConnectionFlow({
      JsSIP: this.JsSIP,
      events: this.events,
      uaFactory: this.uaFactory,
      stateMachine: this.stateMachine,
      registrationManager: this.registrationManager,
      getUa: this.getUa,
      getConnectionConfiguration: this.getConnectionConfiguration,
      setConnectionConfiguration: (config) => {
        this.configurationManager.set(config);
      },
      updateConnectionConfiguration: (key: 'displayName', value: string) => {
        this.configurationManager.update(key, value);
      },
      setUa: (ua: UA | undefined) => {
        this.ua = ua;
      },
      setSipServerUrl: (getSipServerUrl: TGetServerUrl) => {
        this.getSipServerUrl = getSipServerUrl;
      },
      setSocket: (socket: WebSocketInterface) => {
        this.socket = socket;
      },
    });
  }

  // Основные методы
  connect: TConnect;
  set: TSet;
  disconnect(): Promise<void>;
  register(): Promise<RegisteredEvent>;
  unregister(): Promise<UnRegisteredEvent>;
  tryRegister(): Promise<void>;
  sendOptions(target, body?, extraHeaders?): Promise<void>;
  ping(body?, extraHeaders?): Promise<void>;
  checkTelephony(parameters): Promise<void>;

  // Геттеры состояния
  get requested(): boolean;
  get isPendingConnect(): boolean;
  get isPendingInitUa(): boolean;
  get connectionState(): string;
  get isRegistered(): boolean;
  get isRegisterConfig(): boolean;
}
```

---

#### 4. **CallManager** (Управление звонками)

```ts
class CallManager {
  public readonly events: TEvents;
  private strategy: ICallStrategy;

  constructor(strategy?: ICallStrategy) {
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    this.strategy = strategy ?? new MCUCallStrategy(this.events);
  }

  // Основные методы
  setStrategy(strategy: ICallStrategy): void;
  startCall: ICallStrategy['startCall'];
  endCall: ICallStrategy['endCall'];
  answerToIncomingCall: ICallStrategy['answerToIncomingCall'];
  getEstablishedRTCSession: ICallStrategy['getEstablishedRTCSession'];
  getCallConfiguration: ICallStrategy['getCallConfiguration'];
  getRemoteStreams: ICallStrategy['getRemoteStreams'];
  replaceMediaStream: ICallStrategy['replaceMediaStream'];

  // Геттеры состояния
  get requested(): boolean;
  get connection(): RTCPeerConnection | undefined;
  get establishedRTCSession(): RTCSession | undefined;
  get isCallActive(): boolean;
}
```

---

#### 5. **ApiManager** (Управление API)

```ts
class ApiManager {
  public readonly events: TEvents;
  private readonly connectionManager: ConnectionManager;
  private readonly callManager: CallManager;

  constructor({
    connectionManager,
    callManager,
  }: {
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }) {
    this.connectionManager = connectionManager;
    this.callManager = callManager;
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    this.subscribe();
  }

  // Основные методы
  waitChannels(): Promise<TChannels>;
  waitSyncMediaState(): Promise<{ isSyncForced: boolean }>;
  sendDTMF(tone: number | string): Promise<void>;
  sendChannels(channels: TChannels): Promise<void>;
  sendMediaState(mediaState: TMediaState, options?): Promise<void>;
  sendRefusalToTurnOn(type: 'cam' | 'mic', options?): Promise<void>;
  sendRefusalToTurnOnMic(options?): Promise<void>;
  sendRefusalToTurnOnCam(options?): Promise<void>;
  sendMustStopPresentationP2P(): Promise<void>;
  sendStoppedPresentationP2P(): Promise<void>;
  sendStoppedPresentation(): Promise<void>;
  askPermissionToStartPresentationP2P(): Promise<void>;
  askPermissionToStartPresentation(): Promise<void>;
  askPermissionToEnableCam(options?): Promise<void>;
}
```

---

#### 6. **PresentationManager** (Управление презентацией)

```ts
class PresentationManager {
  public readonly events: TEvents;
  public promisePendingStartPresentation?: Promise<MediaStream>;
  public promisePendingStopPresentation?: Promise<MediaStream | undefined>;
  public streamPresentationCurrent?: MediaStream;

  private cancelableSendPresentationWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<MediaStream>>
    | undefined;

  private readonly callManager: CallManager;

  constructor({ callManager }: { callManager: CallManager }) {
    this.callManager = callManager;
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    this.subscribe();
  }

  // Основные методы
  startPresentation(beforeStartPresentation, stream, options?): Promise<MediaStream>;
  stopPresentation(beforeStopPresentation): Promise<MediaStream | undefined>;
  updatePresentation(beforeStartPresentation, stream, options?): Promise<MediaStream | undefined>;
  cancelSendPresentationWithRepeatedCalls(): void;

  // Геттеры состояния
  get isPendingPresentation(): boolean;
}
```

---

#### 7. **IncomingCallManager** (Управление входящими звонками)

```ts
class IncomingCallManager {
  public readonly events: Events<typeof EVENT_NAMES>;
  private incomingRTCSession?: RTCSession;
  private readonly connectionManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    this.start();
  }

  // Основные методы
  start(): void;
  stop(): void;
  getIncomingRTCSession(): RTCSession;
  extractIncomingRTCSession(): RTCSession;
  declineToIncomingCall(options?): Promise<void>;
  busyIncomingCall(): Promise<void>;

  // Геттеры состояния
  get remoteCallerData(): TRemoteCallerData;
  get isAvailableIncomingCall(): boolean;
}
```

---

#### 8. **CallStrategy** (Стратегии звонков)

```ts
interface ICallStrategy {
  startCall(ua: UA, getSipServerUrl: TGetServerUrl, params): Promise<RTCPeerConnection>;
  endCall(): Promise<void>;
  answerToIncomingCall(ua: UA, getSipServerUrl: TGetServerUrl, params): Promise<RTCPeerConnection>;
  getEstablishedRTCSession(): RTCSession | undefined;
  getCallConfiguration(): TCallConfiguration | undefined;
  getRemoteStreams(): MediaStream[] | undefined;
  replaceMediaStream(mediaStream: MediaStream, options?): Promise<void>;

  // Геттеры состояния
  get requested(): boolean;
  get connection(): RTCPeerConnection | undefined;
  get establishedRTCSession(): RTCSession | undefined;
  get isCallActive(): boolean;
}

class MCUCallStrategy implements ICallStrategy {
  // Реализация для MCU
}

class SFUCallStrategy implements ICallStrategy {
  // Реализация для SFU
}
```

---

```mermaid
classDiagram

class SipConnectorFacade {
  +sipConnector: SipConnector
  +preferredMimeTypesVideoCodecs?: string[]
  +excludeMimeTypesVideoCodecs?: string[]
  +connectToServer(parameters): Promise~{ ua?: UA; isSuccessful: boolean }~
  +disconnectFromServer(): Promise~{ isSuccessful: boolean }~
  +callToServer(parameters): Promise~RTCPeerConnection~
  +answerToIncomingCall(parameters): Promise~RTCPeerConnection | undefined~
  +startPresentation(parameters): Promise~MediaStream | undefined~
  +updatePresentation(parameters): Promise~MediaStream | undefined~
  +stopShareSipConnector(parameters): Promise~void~
  +replaceMediaStream(mediaStream, options): Promise~void~
  +sendMediaState(parameters): Promise~void~
  +getRemoteStreams(): MediaStream[] | undefined
  +onUseLicense(handler): (() => void)
  +onMustStopPresentation(handler): (() => void)
  +onMoveToSpectators(handler): (() => void)
  +onMoveToParticipants(handler): (() => void)
}

class SipConnector {
  +events: Events
  +connectionManager: ConnectionManager
  +callManager: CallManager
  +apiManager: ApiManager
  +incomingCallManager: IncomingCallManager
  +presentationManager: PresentationManager
  +connect: ConnectionManager['connect']
  +disconnect: ConnectionManager['disconnect']
  +call: CallManager['startCall']
  +hangUp: CallManager['endCall']
  +answerToIncomingCall: CallManager['answerToIncomingCall']
  +startPresentation: PresentationManager['startPresentation']
  +stopPresentation: PresentationManager['stopPresentation']
  +updatePresentation: PresentationManager['updatePresentation']
}

class ConnectionManager {
  +events: Events
  +ua?: UA
  +socket?: WebSocketInterface
  +connect: TConnect
  +set: TSet
  +disconnect(): Promise~void~
  +register(): Promise~RegisteredEvent~
  +unregister(): Promise~UnRegisteredEvent~
  +tryRegister(): Promise~void~
  +sendOptions(target, body?, extraHeaders?): Promise~void~
  +ping(body?, extraHeaders?): Promise~void~
  +checkTelephony(parameters): Promise~void~
  +requested: boolean
  +isPendingConnect: boolean
  +isPendingInitUa: boolean
  +connectionState: string
  +isRegistered: boolean
  +isRegisterConfig: boolean
}

class CallManager {
  +events: TEvents
  +setStrategy(strategy: ICallStrategy): void
  +startCall: ICallStrategy['startCall']
  +endCall: ICallStrategy['endCall']
  +answerToIncomingCall: ICallStrategy['answerToIncomingCall']
  +getEstablishedRTCSession: ICallStrategy['getEstablishedRTCSession']
  +getCallConfiguration: ICallStrategy['getCallConfiguration']
  +getRemoteStreams: ICallStrategy['getRemoteStreams']
  +replaceMediaStream: ICallStrategy['replaceMediaStream']
  +requested: boolean
  +connection: RTCPeerConnection | undefined
  +establishedRTCSession: RTCSession | undefined
  +isCallActive: boolean
}

class ApiManager {
  +events: TEvents
  +waitChannels(): Promise~TChannels~
  +waitSyncMediaState(): Promise~{ isSyncForced: boolean }~
  +sendDTMF(tone: number | string): Promise~void~
  +sendChannels(channels: TChannels): Promise~void~
  +sendMediaState(mediaState: TMediaState, options?): Promise~void~
  +sendRefusalToTurnOn(type: 'cam' | 'mic', options?): Promise~void~
  +sendRefusalToTurnOnMic(options?): Promise~void~
  +sendRefusalToTurnOnCam(options?): Promise~void~
  +sendMustStopPresentationP2P(): Promise~void~
  +sendStoppedPresentationP2P(): Promise~void~
  +sendStoppedPresentation(): Promise~void~
  +askPermissionToStartPresentationP2P(): Promise~void~
  +askPermissionToStartPresentation(): Promise~void~
  +askPermissionToEnableCam(options?): Promise~void~
}

class PresentationManager {
  +events: TEvents
  +promisePendingStartPresentation?: Promise~MediaStream~
  +promisePendingStopPresentation?: Promise~MediaStream | undefined~
  +streamPresentationCurrent?: MediaStream
  +startPresentation(beforeStartPresentation, stream, options?): Promise~MediaStream~
  +stopPresentation(beforeStopPresentation): Promise~MediaStream | undefined~
  +updatePresentation(beforeStartPresentation, stream, options?): Promise~MediaStream | undefined~
  +cancelSendPresentationWithRepeatedCalls(): void
  +isPendingPresentation: boolean
}

class IncomingCallManager {
  +events: Events
  +start(): void
  +stop(): void
  +getIncomingRTCSession(): RTCSession
  +extractIncomingRTCSession(): RTCSession
  +declineToIncomingCall(options?): Promise~void~
  +busyIncomingCall(): Promise~void~
  +remoteCallerData: TRemoteCallerData
  +isAvailableIncomingCall: boolean
}

class ICallStrategy {
  <<interface>>
  +startCall(ua: UA, getSipServerUrl: TGetServerUrl, params): Promise~RTCPeerConnection~
  +endCall(): Promise~void~
  +answerToIncomingCall(ua: UA, getSipServerUrl: TGetServerUrl, params): Promise~RTCPeerConnection~
  +getEstablishedRTCSession(): RTCSession | undefined
  +getCallConfiguration(): TCallConfiguration | undefined
  +getRemoteStreams(): MediaStream[] | undefined
  +replaceMediaStream(mediaStream: MediaStream, options?): Promise~void~
  +requested: boolean
  +connection: RTCPeerConnection | undefined
  +establishedRTCSession: RTCSession | undefined
  +isCallActive: boolean
}

class MCUCallStrategy {
  +startCall(ua: UA, getSipServerUrl: TGetServerUrl, params): Promise~RTCPeerConnection~
  +endCall(): Promise~void~
  +answerToIncomingCall(ua: UA, getSipServerUrl: TGetServerUrl, params): Promise~RTCPeerConnection~
  +getEstablishedRTCSession(): RTCSession | undefined
  +getCallConfiguration(): TCallConfiguration | undefined
  +getRemoteStreams(): MediaStream[] | undefined
  +replaceMediaStream(mediaStream: MediaStream, options?): Promise~void~
  +requested: boolean
  +connection: RTCPeerConnection | undefined
  +establishedRTCSession: RTCSession | undefined
  +isCallActive: boolean
}

class SFUCallStrategy {
  +startCall(ua: UA, getSipServerUrl: TGetServerUrl, params): Promise~RTCPeerConnection~
  +endCall(): Promise~void~
  +answerToIncomingCall(ua: UA, getSipServerUrl: TGetServerUrl, params): Promise~RTCPeerConnection~
  +getEstablishedRTCSession(): RTCSession | undefined
  +getCallConfiguration(): TCallConfiguration | undefined
  +getRemoteStreams(): MediaStream[] | undefined
  +replaceMediaStream(mediaStream: MediaStream, options?): Promise~void~
  +requested: boolean
  +connection: RTCPeerConnection | undefined
  +establishedRTCSession: RTCSession | undefined
  +isCallActive: boolean
}

SipConnectorFacade --> SipConnector : depends on
SipConnector --> ConnectionManager : depends on
SipConnector --> CallManager : depends on
SipConnector --> ApiManager : depends on
SipConnector --> IncomingCallManager : depends on
SipConnector --> PresentationManager : depends on

ApiManager --> ConnectionManager : depends on
ApiManager --> CallManager : depends on

IncomingCallManager --> ConnectionManager : depends on

PresentationManager --> CallManager : depends on

CallManager --> ICallStrategy : depends on
MCUCallStrategy ..|> ICallStrategy : implements
SFUCallStrategy ..|> ICallStrategy : implements
```

---

Данный модуль инкапсулирует логику SIP-соединений и видеозвонков. Архитектура модуля построена с использованием принципов **SOLID** и нескольких **паттернов проектирования**, что делает её гибкой, расширяемой и легко поддерживаемой.

---

### Основные компоненты и их зоны ответственности

1. **SipConnectorFacade** (Входная точка):
   - **Ответственность**:
     1. Предоставление упрощённого API для работы с SIP-соединениями.
     2. Проксирование методов из `SipConnector` через Proxy.
     3. Обработка ошибок и возврат структурированных результатов.
     4. Управление конфигурацией кодеков (preferred/exclude MIME types).
   - **Зависимости**: Зависит от `SipConnector`.
   - **Методы**:
     - `connectToServer(parameters)`: Подключение к серверу с обработкой ошибок.
     - `disconnectFromServer()`: Отключение от сервера.
     - `callToServer(parameters)`: Исходящий звонок с полным жизненным циклом.
     - `answerToIncomingCall(parameters)`: Ответ на входящий звонок.
     - `startPresentation(parameters)`: Начало презентации.
     - `updatePresentation(parameters)`: Обновление презентации.
     - `stopShareSipConnector(parameters)`: Остановка презентации.
     - `replaceMediaStream(mediaStream, options)`: Замена медиапотока.
     - `sendMediaState(parameters)`: Отправка состояния медиа.
     - `getRemoteStreams()`: Получение удалённых потоков.
     - Проксированные методы: `on`, `once`, `onceRace`, `wait`, `off`, `sendDTMF`, `hangUp`, `declineToIncomingCall`, `sendChannels`, `checkTelephony`, `waitChannels`, `ping`, `connection`, `isConfigured`, `isRegistered`.

2. **SipConnector** (Основной координатор):
   - **Ответственность**:
     1. Координация всех менеджеров и их взаимодействия.
     2. Предоставление единого API для всех операций.
     3. Управление событиями и их подписками.
     4. Проксирование методов менеджеров.
   - **Зависимости**: Зависит от всех менеджеров (`ConnectionManager`, `CallManager`, `ApiManager`, `IncomingCallManager`, `PresentationManager`).
   - **Методы**:
     - Проксированные методы от `ConnectionManager`: `connect`, `set`, `disconnect`, `register`, `unregister`, `tryRegister`, `sendOptions`, `ping`, `checkTelephony`, `isConfigured`, `getConnectionConfiguration`, `getSipServerUrl`.
     - Проксированные методы от `CallManager`: `call`, `hangUp`, `answerToIncomingCall`, `getEstablishedRTCSession`, `getCallConfiguration`, `getRemoteStreams`, `replaceMediaStream`.
     - Проксированные методы от `PresentationManager`: `startPresentation`, `stopPresentation`, `updatePresentation`.
     - Проксированные методы от `ApiManager`: `waitChannels`, `waitSyncMediaState`, `sendDTMF`, `sendChannels`, `sendMediaState`, `sendRefusalToTurnOn`, `sendRefusalToTurnOnMic`, `sendRefusalToTurnOnCam`, `sendMustStopPresentationP2P`, `sendStoppedPresentationP2P`, `sendStoppedPresentation`, `askPermissionToStartPresentationP2P`, `askPermissionToStartPresentation`, `askPermissionToEnableCam`.
     - Проксированные методы от `IncomingCallManager`: `declineToIncomingCall`.

3. **ConnectionManager**:
   - **Ответственность**:
     1. Управление SIP-соединением (создание UA, WebSocket, авторизация).
     2. Управление состоянием соединения через `ConnectionStateMachine`.
     3. Регистрация/отмена регистрации через `RegistrationManager`.
     4. Конфигурация соединения через `ConfigurationManager`.
     5. SIP-операции через `SipOperations`.
     6. Поток соединения через `ConnectionFlow`.
   - **Зависимости**: Зависит от `JsSIP`, внутренние менеджеры.
   - **Методы**:
     - `connect(data, options)`: Подключение к серверу.
     - `set({ displayName })`: Обновление конфигурации.
     - `disconnect()`: Отключение от сервера.
     - `register()`: Регистрация на сервере.
     - `unregister()`: Отмена регистрации.
     - `tryRegister()`: Попытка регистрации.
     - `sendOptions(target, body?, extraHeaders?)`: Отправка OPTIONS.
     - `ping(body?, extraHeaders?)`: Отправка PING.
     - `checkTelephony(parameters)`: Проверка телефонии.

4. **CallManager**:
   - **Ответственность**: Управление звонками через стратегии (MCU/SFU).
   - **Зависимости**: Зависит от `ICallStrategy` (по умолчанию `MCUCallStrategy`).
   - **Методы**:
     - `setStrategy(strategy: ICallStrategy)`: Установка стратегии звонка.
     - `startCall(ua, getSipServerUrl, params)`: Начало звонка.
     - `endCall()`: Завершение звонка.
     - `answerToIncomingCall(ua, getSipServerUrl, params)`: Ответ на входящий звонок.
     - `getEstablishedRTCSession()`: Получение активной сессии.
     - `getCallConfiguration()`: Получение конфигурации звонка.
     - `getRemoteStreams()`: Получение удалённых потоков.
     - `replaceMediaStream(mediaStream, options?)`: Замена медиапотока.

5. **ApiManager**:
   - **Ответственность**:
     1. Обработка SIP-событий и INFO-сообщений.
     2. Управление DTMF-сигналами.
     3. Отправка команд на сервер.
     4. Обработка уведомлений о состоянии медиа.
   - **Зависимости**: Зависит от `ConnectionManager` и `CallManager`.
   - **Методы**:
     - `waitChannels()`: Ожидание каналов.
     - `waitSyncMediaState()`: Ожидание синхронизации медиа.
     - `sendDTMF(tone)`: Отправка DTMF.
     - `sendChannels(channels)`: Отправка каналов.
     - `sendMediaState(mediaState, options?)`: Отправка состояния медиа.
     - `sendRefusalToTurnOn(type, options?)`: Отправка отказа включения.
     - `sendMustStopPresentationP2P()`: Отправка команды остановки презентации P2P.
     - `sendStoppedPresentationP2P()`: Отправка уведомления об остановке презентации P2P.
     - `sendStoppedPresentation()`: Отправка уведомления об остановке презентации.
     - `askPermissionToStartPresentationP2P()`: Запрос разрешения на презентацию P2P.
     - `askPermissionToStartPresentation()`: Запрос разрешения на презентацию.
     - `askPermissionToEnableCam(options?)`: Запрос разрешения на включение камеры.

6. **PresentationManager**:
   - **Ответственность**:
     1. Управление презентацией (старт, остановка, обновление).
     2. Обработка дублированных вызовов презентации.
     3. Управление состоянием презентации.
   - **Зависимости**: Зависит от `CallManager`.
   - **Методы**:
     - `startPresentation(beforeStartPresentation, stream, options?)`: Начало презентации.
     - `stopPresentation(beforeStopPresentation)`: Остановка презентации.
     - `updatePresentation(beforeStartPresentation, stream, options?)`: Обновление презентации.
     - `cancelSendPresentationWithRepeatedCalls()`: Отмена отправки презентации.

7. **IncomingCallManager**:
   - **Ответственность**:
     1. Обработка входящих звонков.
     2. Управление данными вызывающего абонента.
     3. Отклонение входящих звонков.
   - **Зависимости**: Зависит от `ConnectionManager`.
   - **Методы**:
     - `start()`: Запуск обработки входящих звонков.
     - `stop()`: Остановка обработки входящих звонков.
     - `getIncomingRTCSession()`: Получение входящей сессии.
     - `extractIncomingRTCSession()`: Извлечение входящей сессии.
     - `declineToIncomingCall(options?)`: Отклонение входящего звонка.
     - `busyIncomingCall()`: Отклонение с кодом "занято".

8. **ICallStrategy** (интерфейс):
   - **Ответственность**: Определение общего интерфейса для стратегий звонков.
   - **Методы**:
     - `startCall(ua, getSipServerUrl, params)`: Начало звонка.
     - `endCall()`: Завершение звонка.
     - `answerToIncomingCall(ua, getSipServerUrl, params)`: Ответ на входящий звонк.
     - `getEstablishedRTCSession()`: Получение активной сессии.
     - `getCallConfiguration()`: Получение конфигурации звонка.
     - `getRemoteStreams()`: Получение удалённых потоков.
     - `replaceMediaStream(mediaStream, options?)`: Замена медиапотока.

9. **MCUCallStrategy** и **SFUCallStrategy**:
   - **Ответственность**: Реализация логики звонков для MCU и SFU соответственно.
   - **Зависимости**: Нет.
   - **Методы**: Реализация всех методов интерфейса `ICallStrategy`.

#### Детали реализации Proxy в SipConnectorFacade

```ts
const proxyMethods = new Set<keyof IProxyMethods>([
  'on',
  'once',
  'onceRace',
  'wait',
  'off',
  'sendDTMF',
  'hangUp',
  'declineToIncomingCall',
  'sendChannels',
  'checkTelephony',
  'waitChannels',
  'ping',
  'connection',
  'isConfigured',
  'isRegistered',
]);

return new Proxy(this, {
  get: (target, property, receiver) => {
    if (
      typeof property === 'string' &&
      proxyMethods.has(property as keyof IProxyMethods) &&
      property in this.sipConnector
    ) {
      const value = Reflect.get(this.sipConnector, property, this.sipConnector) as unknown;
      return typeof value === 'function' ? value.bind(this.sipConnector) : value;
    }

    const value = Reflect.get(target, property, receiver) as unknown;
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
```

Этот Proxy автоматически проксирует методы из `SipConnector`, что позволяет `SipConnectorFacade` предоставлять упрощённый API, сохраняя при этом доступ ко всем методам базового класса.

---

### Правила зависимостей

1. **Модульность**:
   - Каждый компонент отвечает за свою задачу и не зависит от других, если это не требуется.
   - `SipConnectorFacade` зависит только от `SipConnector`.
   - `SipConnector` координирует все менеджеры, но каждый менеджер независим в своей области.

2. **Инверсия зависимостей**:
   - Высокоуровневые компоненты (например, `SipConnector`) зависят от абстракций (например, `ICallStrategy`), а не от конкретных реализаций.
   - `CallManager` использует стратегии через интерфейс `ICallStrategy`.

3. **Слабая связанность**:
   - Компоненты взаимодействуют через события и интерфейсы.
   - `SipConnectorFacade` использует Proxy для слабой связанности с `SipConnector`.

---

### Применённые паттерны проектирования

1. **Фасад (Facade)**:
   - `SipConnectorFacade` выступает в роли фасада, предоставляя простой интерфейс для работы с модулем и скрывая сложность внутренних компонентов.

2. **Стратегия (Strategy)**:
   - Используется для реализации разных типов звонков (MCU и SFU). Каждая стратегия (`MCUCallStrategy`, `SFUCallStrategy`) реализует общий интерфейс `ICallStrategy`.

3. **Наблюдатель (Observer)**:
   - Используется для обработки событий во всех менеджерах. Компоненты подписываются на события и реагируют на них.

4. **Прокси (Proxy)**:
   - `SipConnectorFacade` использует JavaScript Proxy для автоматического проксирования методов из `SipConnector`.

5. **Композиция**:
   - `SipConnector` использует композицию для объединения всех менеджеров.
   - `CallManager` использует композицию со стратегиями.

---

### Преимущества архитектуры

1. **Гибкость**:
   - Легко добавлять новые типы звонков (например, P2P) или изменять логику существующих через стратегии.
   - `SipConnectorFacade` предоставляет упрощённый API, скрывая сложность.

2. **Модульность**:
   - Компоненты слабо связаны, что упрощает тестирование и поддержку.
   - Каждый менеджер отвечает за свою область.

3. **Расширяемость**:
   - Новые функции можно добавлять без изменения существующего кода.
   - Proxy в `SipConnectorFacade` автоматически проксирует новые методы.

4. **Чистая архитектура**:
   - Соблюдение принципов SOLID.
   - Использование паттернов делает код понятным и легко поддерживаемым.

5. **Упрощённый API**:
   - `SipConnectorFacade` предоставляет удобный интерфейс для клиентов.
   - Автоматическое проксирование методов снижает дублирование кода.

---

### Пример использования

```ts
import { SipConnectorFacade } from './SipConnectorFacade';
import { SipConnector } from './SipConnector';

// Создание экземпляра
const sipConnector = new SipConnector({ JsSIP });
const sipConnectorFacade = new SipConnectorFacade(sipConnector, {
  preferredMimeTypesVideoCodecs: ['video/VP8'],
  excludeMimeTypesVideoCodecs: ['video/H264'],
});

// Подключение к серверу
const { isSuccessful } = await sipConnectorFacade.connectToServer({
  userAgent: 'Chrome',
  sipWebSocketServerURL: 'wss://example.com:8089/ws',
  sipServerUrl: 'sip:example.com',
  displayName: 'User Name',
  name: 'username',
  password: 'password',
  isRegisteredUser: true,
});

if (!isSuccessful) {
  console.error('Connection failed');
  return;
}

// Получение локального медиапотока
const mediaStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true,
});

// Исходящий звонок
const peerConnection = await sipConnectorFacade.callToServer({
  conference: 'conference123',
  mediaStream,
  setRemoteStreams: (streams) => {
    console.log('Remote streams received:', streams);
  },
  onBeforeProgressCall: (conference) => {
    console.log('Starting call to:', conference);
  },
  onSuccessProgressCall: ({ isPurgatory }) => {
    console.log('Call successful, isPurgatory:', isPurgatory);
  },
  onEnterConference: ({ isSuccessProgressCall }) => {
    console.log('Entered conference, success:', isSuccessProgressCall);
  },
  onFailProgressCall: () => {
    console.log('Call failed');
  },
  onEndedCall: () => {
    console.log('Call ended');
  },
});

// Начало презентации
const presentationStream = await sipConnectorFacade.startPresentation({
  mediaStream: presentationMediaStream,
  isP2P: false,
  maxBitrate: 1000000,
  contentHint: 'detail',
});

// Отправка состояния медиа
await sipConnectorFacade.sendMediaState({
  isEnabledCam: true,
  isEnabledMic: false,
});

// Подписка на события
const unsubscribeUseLicense = sipConnectorFacade.onUseLicense((license) => {
  console.log('License used:', license);
});

const unsubscribeMustStopPresentation = sipConnectorFacade.onMustStopPresentation(() => {
  console.log('Must stop presentation');
});

// Отключение от сервера
await sipConnectorFacade.disconnectFromServer();
```

---

### Итог

Архитектура модуля построена с использованием паттернов **Фасад**, **Стратегия**, **Наблюдатель**, **Прокси** и **Композиция**, что делает её гибкой, расширяемой и легко поддерживаемой. `SipConnectorFacade` служит входной точкой и предоставляет упрощённый API, скрывая сложность внутренних компонентов. Каждый компонент имеет чёткую зону ответственности, а зависимости между ними минимизированы и управляются через интерфейсы и события. Это позволяет легко адаптировать модуль под новые требования и интегрировать его в различные системы.
