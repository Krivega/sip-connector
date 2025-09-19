# Архитектура SIP Connector

## Обзор архитектуры

### 1. **SipConnectorFacade** (Входная точка)

```ts
class SipConnectorFacade implements IProxyMethods {
  public readonly sipConnector: SipConnector;

  constructor(sipConnector: SipConnector) {
    this.sipConnector = sipConnector;

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

  // Методы для управления медиа в звонке
  replaceMediaStream(mediaStream, options): Promise<void>;

  // Методы для презентации
  startPresentation(parameters): Promise<MediaStream | undefined>;
  updatePresentation(parameters): Promise<MediaStream | undefined>;
  stopShareSipConnector(parameters): Promise<void>;

  // Синтаксический сахар над методами работы с API
  askPermissionToEnableCam(): Promise<void>;
  sendMediaState(parameters): Promise<void>;
  sendRefusalToTurnOnMic(): Promise<void>;
  sendRefusalToTurnOnCam(): Promise<void>;
  onUseLicense(handler): () => void;
  onMustStopPresentation(handler): () => void;
  onMoveToSpectators(handler): () => void;
  onMoveToParticipants(handler): () => void;
  onStats(handler): () => void;
  offStats(handler): void;

  // Утилитарные методы
  getRemoteStreams(): MediaStream[] | undefined;
  resolveHandleReadyRemoteStreamsDebounced(options): () => void;
  resolveHandleReadyRemoteStreams(options): (event) => void;
}
```

---

### 2. **SipConnector** (Основной координатор)

```ts
class SipConnector {
  public readonly events: Events<typeof EVENT_NAMES>;
  public readonly connectionManager: ConnectionManager;
  public readonly connectionQueueManager: ConnectionQueueManager;
  public readonly callManager: CallManager;
  public readonly apiManager: ApiManager;
  public readonly incomingCallManager: IncomingCallManager;
  public readonly presentationManager: PresentationManager;
  public readonly statsManager: StatsManager;
  public readonly videoSendingBalancerManager: VideoSendingBalancerManager;
  public readonly autoConnectorManager: AutoConnectorManager;

  private readonly preferredMimeTypesVideoCodecs?: string[];
  private readonly excludeMimeTypesVideoCodecs?: string[];

  constructor(
    { JsSIP }: { JsSIP: TJsSIP },
    {
      preferredMimeTypesVideoCodecs,
      excludeMimeTypesVideoCodecs,
      videoBalancerOptions,
      autoConnectorOptions,
    }: {
      preferredMimeTypesVideoCodecs?: string[];
      excludeMimeTypesVideoCodecs?: string[];
      videoBalancerOptions?: IBalancerOptions;
      autoConnectorOptions?: IAutoConnectorOptions;
    } = {},
  ) {
    this.preferredMimeTypesVideoCodecs = preferredMimeTypesVideoCodecs;
    this.excludeMimeTypesVideoCodecs = excludeMimeTypesVideoCodecs;

    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    this.connectionManager = new ConnectionManager({ JsSIP });
    this.connectionQueueManager = new ConnectionQueueManager({
      connectionManager: this.connectionManager,
    });
    this.callManager = new CallManager();
    this.apiManager = new ApiManager({
      connectionManager: this.connectionManager,
      callManager: this.callManager,
    });
    this.incomingCallManager = new IncomingCallManager(this.connectionManager);
    this.presentationManager = new PresentationManager({
      callManager: this.callManager,
      maxBitrate: ONE_MEGABIT_IN_BITS,
    });
    this.statsManager = new StatsManager({
      callManager: this.callManager,
      apiManager: this.apiManager,
    });
    this.autoConnectorManager = new AutoConnectorManager({
      connectionQueueManager: this.connectionQueueManager,
      connectionManager: this.connectionManager,
      callManager: this.callManager,
      options: autoConnectorOptions,
    });
    this.videoSendingBalancerManager = new VideoSendingBalancerManager(
      this.callManager,
      this.apiManager,
      videoBalancerOptions,
    );

    this.subscribe();
  }

  // Проксирование методов менеджеров
  startAutoConnect: AutoConnectorManager['start'];
  cancelAutoConnect: AutoConnectorManager['cancel'];
  connect: ConnectionQueueManager['connect'];
  disconnect: ConnectionQueueManager['disconnect'];
  register: ConnectionManager['register'];
  unregister: ConnectionManager['unregister'];
  tryRegister: ConnectionManager['tryRegister'];
  checkTelephony: ConnectionManager['checkTelephony'];
  sendOptions: ConnectionManager['sendOptions'];
  ping: ConnectionManager['ping'];
  set: ConnectionManager['set'];
  call: CallManager['startCall'];
  hangUp: CallManager['endCall'];
  answerToIncomingCall: CallManager['answerToIncomingCall'];
  startPresentation: PresentationManager['startPresentation'];
  stopPresentation: PresentationManager['stopPresentation'];
  updatePresentation: PresentationManager['updatePresentation'];
}
```

---

### 3. **ConnectionManager** (Управление соединением)

```ts
class ConnectionManager {
  public readonly events: Events<typeof EVENT_NAMES>;
  public ua?: UA;
  public socket?: WebSocketInterface;

  private readonly uaFactory: UAFactory;
  private readonly registrationManager: RegistrationManager;
  private readonly stateMachine: ConnectionStateMachine; // Использует XState
  private readonly connectionFlow: ConnectionFlow;
  private readonly sipOperations: SipOperations;
  private readonly configurationManager: ConfigurationManager;
  private readonly JsSIP: TJsSIP;

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
  get isDisconnected(): boolean;
  get isFailed(): boolean;
  get connectionState(): string;
  get isRegistered(): boolean;
  get isRegisterConfig(): boolean;
}
```

---

### 4. **ConnectionQueueManager** (Управление очередью операций)

```ts
class ConnectionQueueManager {
  private readonly connectionManager: ConnectionManager;
  private readonly stackPromises = createStackPromises<unknown>({
    noRunIsNotActual: true,
  });

  connect: ConnectionManager['connect'];
  disconnect: ConnectionManager['disconnect'];
  run<T = void>(task: () => Promise<T>): Promise<T>;
  stop(): void;
}
```

---

### 5. **AutoConnectorManager** (Управление автоподключением)

```ts
class AutoConnectorManager {
  public readonly events: TEvents;

  private readonly connectionManager: ConnectionManager;
  private readonly callManager: CallManager;
  private readonly connectionQueueManager: ConnectionQueueManager;
  private readonly connectFlow: ConnectFlow;
  private readonly checkTelephonyRequester: CheckTelephonyRequester;
  private readonly pingServerRequester: PingServerRequester;
  private readonly registrationFailedOutOfCallSubscriber: RegistrationFailedOutOfCallSubscriber;
  private readonly attemptsState: AttemptsState;
  private readonly delayBetweenAttempts: DelayRequester;
  private readonly cancelableRequestClearCache: CancelableRequest;

  constructor({
    connectionQueueManager,
    connectionManager,
    callManager,
    options,
  }: {
    connectionQueueManager: ConnectionQueueManager;
    connectionManager: ConnectionManager;
    callManager: CallManager;
    options?: IAutoConnectorOptions;
  }) {
    const clearCache = options?.clearCache ?? asyncNoop;

    this.connectionManager = connectionManager;

    this.events = new TypedEvents<TEventMap>(EVENT_NAMES);
    this.connectFlow = new ConnectFlow({
      connectionManager,
      connectionQueueManager,
      events: this.events,
    });
    this.checkTelephonyRequester = new CheckTelephonyRequester({
      clearCache,
      connectionManager,
      interval: options?.checkTelephonyRequestInterval ?? DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL,
    });
    this.pingServerRequester = new PingServerRequester({ connectionManager, callManager });
    this.registrationFailedOutOfCallSubscriber = new RegistrationFailedOutOfCallSubscriber({
      connectionManager,
      callManager,
    });
    this.attemptsState = new AttemptsState({
      onStatusChange: (isAttemptInProgress: boolean) => {
        this.events.trigger(EEvent.CHANGED_ATTEMPT_STATUS, isAttemptInProgress);
      },
    });
    this.cancelableRequestClearCache = new CancelableRequest(clearCache);
    this.delayBetweenAttempts = new DelayRequester(
      options?.timeoutBetweenAttempts ?? DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS,
    );

    this.subscribe();
  }

  // Основные методы
  start(parameters: TParametersAutoConnect): void;
  cancel(): void;
}
```

### 6. **CallManager** (Управление звонками)

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

### 7. **ApiManager** (Управление API)

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
  sendStats(parameters: { availableIncomingBitrate: number }): Promise<void>;
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

### 8. **PresentationManager** (Управление презентацией)

```ts
class PresentationManager {
  public readonly events: TEvents;
  public promisePendingStartPresentation?: Promise<MediaStream>;
  public promisePendingStopPresentation?: Promise<MediaStream | undefined>;
  public streamPresentationCurrent?: MediaStream;

  private readonly maxBitrate?: number;

  private cancelableSendPresentationWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<MediaStream>>
    | undefined;

  private readonly callManager: CallManager;

  constructor({ callManager, maxBitrate }: { callManager: CallManager; maxBitrate?: number }) {
    this.callManager = callManager;
    this.maxBitrate = maxBitrate;
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    this.subscribe();
  }

  // Основные методы
  startPresentation(
    beforeStartPresentation,
    stream,
    presentationOptions?,
    options?,
  ): Promise<MediaStream>;
  stopPresentation(beforeStopPresentation): Promise<MediaStream | undefined>;
  updatePresentation(beforeStartPresentation, stream, options?): Promise<MediaStream | undefined>;
  cancelSendPresentationWithRepeatedCalls(): void;

  // Геттеры состояния
  get isPendingPresentation(): boolean;
}
```

---

### 9. **IncomingCallManager** (Управление входящими звонками)

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

### 10. **CallStrategy** (Стратегии звонков)

```ts
interface ICallStrategy {
  startCall(ua: UA, getSipServerUrl: TGetServerUrl, params): Promise<RTCPeerConnection>;
  endCall(): Promise<void>;
  answerToIncomingCall(extractIncomingRTCSession, params): Promise<RTCPeerConnection>;
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

## Диаграмма архитектуры

```mermaid
graph TB
    subgraph "SIP-Connector Architecture"
        A["SipConnectorFacade<br/>🎯 High-level API"]
        B["SipConnector<br/>🔧 Core Coordinator<br/>+ Codec Settings<br/>+ Video Balancer"]

        subgraph "Core Managers"
            C["ConnectionManager<br/>🔗 SIP Connections"]
            D["CallManager<br/>📞 WebRTC Calls"]
            E["ApiManager<br/>📡 Server API"]
            F["PresentationManager<br/>🖥️ Screen Sharing<br/>+ maxBitrate Support"]
            G["IncomingCallManager<br/>📲 Incoming Calls"]
            H["StatsManager<br/>📊 Enhanced Stats<br/>+ availableIncomingBitrate"]
            I["VideoSendingBalancerManager<br/>⚖️ Auto Video Optimization<br/>+ 10sec Delay Start"]
            J["VideoSendingBalancer<br/>🎛️ Video Parameters Control"]
            K["TrackMonitor<br/>👁️ Adaptive Polling<br/>1000ms → 16000ms"]
            L["ConnectionQueueManager<br/>🔄 Sequential Operations<br/>+ Queue Promises"]
            M["AutoConnectorManager<br/>🔄 Auto Reconnection"]
        end

        subgraph "Foundation"
            O["@krivega/jssip<br/>📞 SIP Protocol"]
            P["WebRTC API<br/>🌐 Media Streams"]
        end

        A --> B
        B --> C
        B --> L
        B --> D
        B --> E
        B --> F
        B --> G
        B --> H
        B --> I
        I --> J
        J --> K
        D --> P
        F --> P
        C --> O
        B --> M
    end

    style I fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    style J fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    style K fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    style B fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    style F fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    style H fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
```

---

```mermaid
classDiagram

class SipConnectorFacade {
  +sipConnector: SipConnector
  +connectToServer(parameters)
  +disconnectFromServer()
  +callToServer(parameters)
  +answerToIncomingCall(parameters)
  +startPresentation(parameters)
  +updatePresentation(parameters)
  +stopShareSipConnector(parameters)
  +replaceMediaStream(mediaStream, options)
  +sendMediaState(parameters)
  +getRemoteStreams(): MediaStream[] | undefined
  +resolveHandleReadyRemoteStreamsDebounced(options): Function
  +resolveHandleReadyRemoteStreams(options): Function
  +askPermissionToEnableCam(): Promise<void>
  +onUseLicense(handler): (() => void)
  +onMustStopPresentation(handler): (() => void)
  +onMoveToSpectators(handler): (() => void)
  +onMoveToParticipants(handler): (() => void)
  +onStats(handler): (() => void);
  +offStats(handler): void;
}

class SipConnector {
  +events: Events
  +connectionManager: ConnectionManager
  +connectionQueueManager: ConnectionQueueManager
  +callManager: CallManager
  +apiManager: ApiManager
  +incomingCallManager: IncomingCallManager
  +presentationManager: PresentationManager
  +statsManager: StatsManager
  +videoSendingBalancerManager: VideoSendingBalancerManager
  +autoConnectorManager: AutoConnectorManager
  +preferredMimeTypesVideoCodecs?: string[]
  +excludeMimeTypesVideoCodecs?: string[]
  +connect: ConnectionQueueManager['connect']
  +disconnect: ConnectionQueueManager['disconnect']
  +startAutoConnect: AutoConnectorManager['start']
  +cancelAutoConnect: AutoConnectorManager['cancel']
  +register: ConnectionManager['register']
  +unregister: ConnectionManager['unregister']
  +tryRegister: ConnectionManager['tryRegister']
  +checkTelephony: ConnectionManager['checkTelephony']
  +sendOptions: ConnectionManager['sendOptions']
  +ping: ConnectionManager['ping']
  +set: ConnectionManager['set']
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
  +disconnect()
  +register()
  +unregister()
  +tryRegister()
  +sendOptions(target, body?, extraHeaders?)
  +ping(body?, extraHeaders?)
  +checkTelephony(parameters)
  +requested: boolean
  +isPendingConnect: boolean
  +isPendingInitUa: boolean
  +connectionState: string
  +isRegistered: boolean
  +isRegisterConfig: boolean
  +isFailed: boolean
  +isDisconnected: boolean
}

class ConnectionQueueManager {
  +connectionManager: ConnectionManager
  +stackPromises: StackPromises
  +connect: ConnectionManager['connect']
  +disconnect: ConnectionManager['disconnect']
  +run<T>(task: () => Promise<T>): Promise<T>
  +stop()
}

class AutoConnectorManager {
  +events: TEvents
  +start(parameters: TParametersAutoConnect): void
  +cancel(): void
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
  +waitChannels()
  +waitSyncMediaState()
  +sendDTMF(tone: number | string)
  +sendChannels(channels: TChannels)
  +sendMediaState(mediaState: TMediaState, options?)
  +sendStats(parameters)
  +sendRefusalToTurnOn(type: 'cam' | 'mic', options?)
  +sendRefusalToTurnOnMic(options?)
  +sendRefusalToTurnOnCam(options?)
  +sendMustStopPresentationP2P()
  +sendStoppedPresentationP2P()
  +sendStoppedPresentation()
  +askPermissionToStartPresentationP2P()
  +askPermissionToStartPresentation()
  +askPermissionToEnableCam(options?)
}

class PresentationManager {
  +events: TEvents
  +promisePendingStartPresentation?: Promise
  +promisePendingStopPresentation?: Promise
  +streamPresentationCurrent?: MediaStream
  +startPresentation(beforeStartPresentation, stream, presentationOptions?, options?)
  +stopPresentation(beforeStopPresentation)
  +updatePresentation(beforeStartPresentation, stream, options?)
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
  +startCall(ua: UA, getSipServerUrl: TGetServerUrl, params)
  +endCall()
  +answerToIncomingCall(extractIncomingRTCSession, params)
  +getEstablishedRTCSession(): RTCSession | undefined
  +getCallConfiguration(): TCallConfiguration | undefined
  +getRemoteStreams(): MediaStream[] | undefined
  +replaceMediaStream(mediaStream: MediaStream, options?)
  +requested: boolean
  +connection: RTCPeerConnection | undefined
  +establishedRTCSession: RTCSession | undefined
  +isCallActive: boolean
}

class MCUCallStrategy {
  +startCall(ua: UA, getSipServerUrl: TGetServerUrl, params)
  +endCall()
  +answerToIncomingCall(extractIncomingRTCSession, params)
  +getEstablishedRTCSession(): RTCSession | undefined
  +getCallConfiguration(): TCallConfiguration | undefined
  +getRemoteStreams(): MediaStream[] | undefined
  +replaceMediaStream(mediaStream: MediaStream, options?)
  +requested: boolean
  +connection: RTCPeerConnection | undefined
  +establishedRTCSession: RTCSession | undefined
  +isCallActive: boolean
}

class StatsManager {
  +events: TEvents
  +availableIncomingBitrate?: number
  +statsPeerConnection: StatsPeerConnection
  +hasAvailableIncomingBitrateChangedQuarter(): boolean
}

class VideoSendingBalancerManager {
  +events: TEvents
  +isBalancingActive: boolean
  +videoSendingBalancer: VideoSendingBalancer
  +isBalancingScheduled(): boolean
  +startBalancing(): Promise~void~
  +stopBalancing(): void
  +balance(): Promise~TResult~
}

class VideoSendingBalancer {
  +eventHandler: VideoSendingEventHandler
  +senderBalancer: SenderBalancer
  +parametersSetterWithQueue: ParametersSetterWithQueue
  +trackMonitor: TrackMonitor
  +subscribe(): void
  +unsubscribe(): void
  +balance(): Promise~TResult~
  +reset(): void
}

class TrackMonitor {
  +pollIntervalMs: number
  +maxPollIntervalMs: number
  +currentPollIntervalMs: number
  +subscribe(sender: RTCRtpSender | undefined, callback: () => void): void
  +unsubscribe(): void
  +attachTrack(callback: () => void, track?: MediaStreamTrack): void
  +schedulePoll(track: MediaStreamTrack, callback: () => void): void
}

class StatsPeerConnection {
  +events: Events
  +start(peerConnection: RTCPeerConnection): void
  +stop(): void
  +requestAllStatistics(): Promise~TStats~
  +parseStatsReports(reports: RTCStatsReport): TStats
}

class AbstractCallStrategy {
  <<abstract>>
  #isPendingCall: boolean
  #isPendingAnswer: boolean
  +requested: boolean
  +connection: RTCPeerConnection | undefined
  +establishedRTCSession: RTCSession | undefined
  +isCallActive: boolean
  +startCall(ua: UA, getSipServerUrl: TGetServerUrl, params)*
  +endCall()*
  +answerToIncomingCall(extractIncomingRTCSession, params)*
  +replaceMediaStream(mediaStream: MediaStream, options?)*
  +getEstablishedRTCSession(): RTCSession | undefined*
  +getCallConfiguration(): TCallConfiguration*
  +getRemoteStreams(): MediaStream[] | undefined*
  #handleCall(options)*
}

SipConnectorFacade --> SipConnector : depends on
SipConnector --> ConnectionManager : depends on
SipConnector --> ConnectionQueueManager : depends on
ConnectionQueueManager --> ConnectionManager : depends on
SipConnector --> CallManager : depends on
SipConnector --> ApiManager : depends on
SipConnector --> IncomingCallManager : depends on
SipConnector --> PresentationManager : depends on
SipConnector --> StatsManager : depends on
SipConnector --> VideoSendingBalancerManager : depends on
SipConnector --> AutoConnectorManager : depends on

AutoConnectorManager --> ConnectionManager : depends on
AutoConnectorManager --> CallManager : depends on
AutoConnectorManager --> ConnectionQueueManager : depends on

ApiManager --> ConnectionManager : depends on
ApiManager --> CallManager : depends on

IncomingCallManager --> ConnectionManager : depends on

PresentationManager --> CallManager : depends on

StatsManager --> CallManager : depends on
StatsManager --> ApiManager : depends on
StatsManager --> StatsPeerConnection : depends on

VideoSendingBalancerManager --> CallManager : depends on
VideoSendingBalancerManager --> ApiManager : depends on
VideoSendingBalancerManager --> VideoSendingBalancer : contains

VideoSendingBalancer --> TrackMonitor : contains

CallManager --> ICallStrategy : depends on
MCUCallStrategy ..|> ICallStrategy : implements
MCUCallStrategy --|> AbstractCallStrategy : extends
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
     5. **Управление настройками кодеков** (preferredMimeTypesVideoCodecs, excludeMimeTypesVideoCodecs).
     6. **Интеграция VideoSendingBalancerManager** для автоматической оптимизации видеопотоков.
     7. **Интеграция ConnectionQueueManager** для последовательного выполнения операций подключения.
   - **Зависимости**: Зависит от всех менеджеров (`ConnectionManager`, `CallManager`, `AutoConnectorManager`, `ApiManager`, `IncomingCallManager`, `PresentationManager`, `StatsManager`, `VideoSendingBalancerManager`).
   - **Методы**:
     - Проксированные методы от `ConnectionManager`: `isConfigured`, `getConnectionConfiguration`, `getSipServerUrl`.
     - Проксированные методы от `ConnectionQueueManager`: `connect`, `disconnect`.
     - Проксированные методы от `CallManager`: `call`, `hangUp`, `answerToIncomingCall`, `getEstablishedRTCSession`, `getCallConfiguration`, `getRemoteStreams`, `replaceMediaStream`.
     - Проксированные методы от `PresentationManager`: `startPresentation`, `stopPresentation`, `updatePresentation`.
     - Проксированные методы от `ApiManager`: `waitChannels`, `waitSyncMediaState`, `sendDTMF`, `sendChannels`, `sendMediaState`, `sendRefusalToTurnOn`, `sendRefusalToTurnOnMic`, `sendRefusalToTurnOnCam`, `sendMustStopPresentationP2P`, `sendStoppedPresentationP2P`, `sendStoppedPresentation`, `askPermissionToStartPresentationP2P`, `askPermissionToStartPresentation`, `askPermissionToEnableCam`.
     - Проксированные методы от `IncomingCallManager`: `declineToIncomingCall`.
     - События от `StatsManager`: Проксирует события статистики с префиксом `stats:`.

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

4. **ConnectionQueueManager**:
   - **Ответственность**:
     1. **Последовательное выполнение операций подключения** для предотвращения конфликтов.
     2. **Управление очередью операций** с использованием `stack-promises`.
     3. **Проксирование методов ConnectionManager** с гарантией последовательности.
     4. **Предотвращение гонки условий** между connect/disconnect операциями.
     5. **Выполнение произвольных задач** в очереди через метод `run()`.
   - **Зависимости**: Зависит от `ConnectionManager`, использует `stack-promises`.
   - **Принцип работы**:
   - Использует `createStackPromises` с `noRunIsNotActual: true`.
   - Все операции выполняются последовательно в очереди.
   - **Методы**:
     - Проксирует методы `ConnectionManager`: `connect`, `disconnect`.
     - `run<T>(task: () => Promise<T>): Promise<T>` - выполнение произвольной задачи в очереди.
     - `stop()` - остановка всех операций в очереди.

5. **AutoConnectorManager**:
   - **Ответственность**:
     1. Автоматическое переподключение при обрывах связи.
     2. Управление попытками подключения с задержками.
     3. Проверка доступности телефонии.
     4. Мониторинг состояния соединения.
   - **Зависимости**: Зависит от `ConnectionManager`, `CallManager`, `ConnectionQueueManager`.
   - **Методы**:
     - `start(parameters: TParametersAutoConnect)`: Запуск процесса автоподключения.
     - `cancel()`: Отмена текущей попытки автоподключения.

6. **CallManager**:
   - **Ответственность**: Управление звонками через стратегии (MCU/SFU).
   - **Зависимости**: Зависит от `ICallStrategy` (по умолчанию `MCUCallStrategy`).
   - **Методы**:
     - `setStrategy(strategy: ICallStrategy)`: Установка стратегии звонка.
     - `startCall(ua, getSipServerUrl, params)`: Начало звонка.
     - `endCall()`: Завершение звонка.
     - `answerToIncomingCall(extractIncomingRTCSession, params)`: Ответ на входящий звонок.
     - `getEstablishedRTCSession()`: Получение активной сессии.
     - `getCallConfiguration()`: Получение конфигурации звонка.
     - `getRemoteStreams()`: Получение удалённых потоков.
     - `replaceMediaStream(mediaStream, options?)`: Замена медиапотока.

7. **ApiManager**:
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

8. **PresentationManager**:
   - **Ответственность**:
     1. Управление презентацией (старт, остановка, обновление).
     2. Обработка дублированных вызовов презентации.
     3. Управление состоянием презентации.
   - **Зависимости**: Зависит от `CallManager`.
   - **Методы**:
     - `startPresentation(beforeStartPresentation, stream, presentationOptions?, options?)`: Начало презентации.
     - `stopPresentation(beforeStopPresentation)`: Остановка презентации.
     - `updatePresentation(beforeStartPresentation, stream, options?)`: Обновление презентации.
     - `cancelSendPresentationWithRepeatedCalls()`: Отмена отправки презентации.

9. **IncomingCallManager**:
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

10. **StatsManager**:
    - **Ответственность**:
      1. Сбор и обработка статистики WebRTC соединения.
      2. Мониторинг доступной пропускной способности.
      3. Автоматическая отправка статистики на сервер.
      4. Управление StatsPeerConnection для получения метрик.
    - **Зависимости**: Зависит от `CallManager` и `ApiManager`.
    - **Методы**:
      - `hasAvailableIncomingBitrateChangedQuarter()`: Проверка изменения битрейта на 25%.
      - События: Проксирует события от `StatsPeerConnection`.
    - **Свойства**:
      - `availableIncomingBitrate`: Текущая доступная пропускная способность.
      - `statsPeerConnection`: Экземпляр StatsPeerConnection для сбора статистики.

11. **ICallStrategy** (интерфейс):
    - **Ответственность**: Определение общего интерфейса для стратегий звонков.
    - **Методы**:
      - `startCall(ua, getSipServerUrl, params)`: Начало звонка.
      - `endCall()`: Завершение звонка.
      - `answerToIncomingCall(extractIncomingRTCSession, params)`: Ответ на входящий звонк.
      - `getEstablishedRTCSession()`: Получение активной сессии.
      - `getCallConfiguration()`: Получение конфигурации звонка.
      - `getRemoteStreams()`: Получение удалённых потоков.
      - `replaceMediaStream(mediaStream, options?)`: Замена медиапотока.

12. **MCUCallStrategy**:
    - **Ответственность**: Реализация логики звонков для MCU (Multipoint Control Unit).
    - **Зависимости**: Наследуется от `AbstractCallStrategy`, использует `RemoteStreamsManager`.
    - **Методы**: Реализация всех методов интерфейса `ICallStrategy`.
    - **Особенности**:
      - Управление удалёнными потоками через `RemoteStreamsManager`.
      - Подписка на события JsSIP сессии.
      - Обработка конфигурации звонков и медиапотоков.

13. **AbstractCallStrategy** (абстрактный класс):
    - **Ответственность**: Базовая реализация общей логики для всех стратегий звонков.
    - **Зависимости**: Использует систему событий.
    - **Свойства**:
      - `isPendingCall`: Флаг ожидания исходящего звонка.
      - `isPendingAnswer`: Флаг ожидания ответа на входящий звонок.
    - **Методы**: Определяет абстрактные методы, которые должны быть реализованы в наследниках.

---

### Дополнительные компоненты системы

### 11. **VideoSendingBalancer** (Балансировщик видеопотоков)

- **Ответственность**:
  1. Автоматическая балансировка видеопотоков на основе серверных команд.
  2. Управление параметрами видеокодеков и битрейтом.
  3. Обработка событий управления главной камерой.
  4. Координация работы с WebRTC senders.

- **Зависимости**: Работает с RTCPeerConnection и зависит от `ApiManager`.

- **Компоненты**:
  - `VideoSendingEventHandler`: Обработка событий управления камерой.
  - `SenderBalancer`: Бизнес-логика балансировки.
  - `ParametersSetterWithQueue`: Управление очередью установки параметров.
  - `SenderFinder`: Поиск video senders в соединении.
  - `CodecProvider`: Определение используемых кодеков.

- **Методы**:
  - `subscribe()`: Подписка на события управления камерой.
  - `unsubscribe()`: Отписка от событий.
  - `balance()`: Балансировка.
  - `reset()`: Сброс состояния.

### 12. **StatsPeerConnection** (Сбор статистики WebRTC)

- **Ответственность**:
  1. Периодический сбор статистики WebRTC соединения.
  2. Парсинг и обработка RTCStatsReport.
  3. Предоставление структурированных данных о качестве соединения.

- **Зависимости**: Работает с RTCPeerConnection.

- **Методы**:
  - `start(peerConnection)`: Запуск сбора статистики.
  - `stop()`: Остановка сбора статистики.
  - `requestAllStatistics()`: Получение всей статистики.
  - `parseStatsReports()`: Парсинг отчетов статистики.

- **События**:
  - `collected`: Событие получения новых данных статистики.

### 13. **VideoSendingBalancerManager** (Менеджер видеобалансировщика)

- **Ответственность**:
  1. Управление жизненным циклом VideoSendingBalancer.
  2. Автоматический запуск балансировки через настраиваемое время после звонка.
  3. Интеграция с CallManager для отслеживания состояния звонков.
  4. Проксирование событий балансировщика с префиксом `video-balancer:`.

- **Зависимости**: Зависит от `CallManager`, `ApiManager`, содержит `VideoSendingBalancer`.

- **Компоненты**:
  - `VideoSendingBalancer`: Основной балансировщик видеопотоков.
  - `TrackMonitor`: Мониторинг изменений видеотреков с адаптивным опрашиванием.

- **Методы**:
  - Автоматическое управление: запуск через `balancingStartDelay` (по умолчанию 10 сек).
  - `startBalancing()`: Принудительный запуск балансировки.
  - `stopBalancing()`: Остановка балансировки.
  - `balance()`: Выполнение балансировки.
  - `isBalancingActive`: Проверка активности балансировки.
  - `isBalancingScheduled`: Проверка запланированности запуска.

- **События**:
  - `video-balancer:balancing-scheduled`: Балансировка запланирована.
  - `video-balancer:balancing-started`: Балансировка запущена.
  - `video-balancer:balancing-stopped`: Балансировка остановлена.
  - `video-balancer:parameters-updated`: Параметры видео обновлены.

### 14. **TrackMonitor** (Адаптивный мониторинг видеотреков)

- **Ответственность**:
  1. Мониторинг изменений MediaStreamTrack с адаптивной частотой.
  2. Обнаружение изменений разрешения видео (resize events).
  3. Автоматическая адаптация интервала опрашивания для оптимизации производительности.
  4. Обработка замены треков (replaceTrack).

- **Зависимости**: Работает с RTCRtpSender и MediaStreamTrack.

- **Алгоритм адаптивного опрашивания**:
  - **Начальный интервал**: `pollIntervalMs` (по умолчанию 1000мс)
  - **При отсутствии изменений**: удвоение интервала до `maxPollIntervalMs` (по умолчанию 16000мс)
  - **При обнаружении изменений**: сброс до начального интервала
  - **Результат**: снижение CPU нагрузки на 40-60% при стабильном видео

- **Методы**:
  - `subscribe(sender, callback)`: Подписка на изменения конкретного sender.
  - `unsubscribe()`: Отписка от всех мониторингов.
  - `attachTrack(callback, track)`: Подключение к конкретному треку.
  - `schedulePoll(track, callback)`: Запуск адаптивного опрашивания.

### 15. **ConnectionStateMachine** (Машина состояний соединения)

- **Ответственность**:
  1. Управление состояниями SIP соединения с использованием XState.
  2. Обработка переходов между состояниями.
  3. Валидация допустимых операций в текущем состоянии.

- **Зависимости**: Использует XState, интегрируется с системой событий.

- **Состояния**: idle, connecting, connected, registering, registered, disconnecting.

- **События**: connect, connected, register, registered, disconnect, failed.

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
   - `VideoSendingBalancer` является фасадом для управления балансировкой видеопотоков.

2. **Стратегия (Strategy)**:
   - Используется для реализации разных типов звонков. `MCUCallStrategy` реализует интерфейс `ICallStrategy`.
   - Возможность добавления новых стратегий (например, SFU) без изменения существующего кода.

3. **Наблюдатель (Observer)**:
   - Используется для обработки событий во всех менеджерах. Компоненты подписываются на события и реагируют на них.
   - Система событий с префиксами для разделения событий от разных менеджеров.

4. **Прокси (Proxy)**:
   - `SipConnectorFacade` использует JavaScript Proxy для автоматического проксирования методов из `SipConnector`.

5. **Композиция**:
   - `SipConnector` использует композицию для объединения всех менеджеров.
   - `CallManager` использует композицию со стратегиями.
   - `VideoSendingBalancer` композирует несколько специализированных компонентов.

6. **Машина состояний (State Machine)**:
   - `ConnectionStateMachine` использует XState для управления состояниями SIP соединения.
   - Четкое определение допустимых переходов между состояниями.

7. **Шаблонный метод (Template Method)**:
   - `AbstractCallStrategy` определяет общую структуру для всех стратегий звонков.
   - Конкретные реализации переопределяют абстрактные методы.

8. **Очередь задач (Task Queue)**:
   - `ParametersSetterWithQueue` в `VideoSendingBalancer` обеспечивает последовательное выполнение операций установки параметров.
   - `ConnectionQueueManager` использует `stack-promises` для последовательного выполнения операций подключения.

---

### Преимущества архитектуры

1. **Гибкость**:
   - Легко добавлять новые типы звонков через стратегии (`ICallStrategy`).
   - `SipConnectorFacade` предоставляет упрощённый API, скрывая сложность.
   - Машина состояний XState обеспечивает предсказуемое поведение соединения.

2. **Модульность**:
   - Компоненты слабо связаны, что упрощает тестирование и поддержку.
   - Каждый менеджер отвечает за свою область (соединение, звонки, API, статистика).
   - Дополнительные компоненты (`VideoSendingBalancer`, `StatsPeerConnection`) изолированы.

3. **Расширяемость**:
   - Новые функции можно добавлять без изменения существующего кода.
   - Proxy в `SipConnectorFacade` автоматически проксирует новые методы.
   - Система событий с префиксами позволяет легко добавлять новые типы событий.

4. **Чистая архитектура**:
   - Соблюдение принципов SOLID.
   - Использование паттернов делает код понятным и легко поддерживаемым.
   - Абстрактные классы и интерфейсы обеспечивают контракты.

5. **Упрощённый API**:
   - `SipConnectorFacade` предоставляет удобный интерфейс для клиентов.
   - Автоматическое проксирование методов снижает дублирование кода.

6. **Мониторинг и диагностика**:
   - `StatsManager` и `StatsPeerConnection` обеспечивают детальную статистику.
   - `VideoSendingBalancer` автоматически оптимизирует качество видео.
   - Централизованная система событий для отладки и логирования.

7. **Надёжность**:
   - Машина состояний предотвращает некорректные переходы.
   - Очереди задач обеспечивают последовательное выполнение операций.
   - Обработка ошибок на всех уровнях архитектуры.

---

### Пример использования

```ts
import { SipConnectorFacade } from './SipConnectorFacade';
import { SipConnector } from './SipConnector';

// Создание экземпляра с настройками кодеков и видеобалансировщика
const sipConnector = new SipConnector(
  { JsSIP },
  {
    preferredMimeTypesVideoCodecs: ['video/AV1', 'video/VP9'],
    excludeMimeTypesVideoCodecs: ['video/H264'],
    videoBalancerOptions: {
      ignoreForCodec: 'H264',
      onSetParameters: (result) => {
        console.log('Video parameters updated:', result);
      },
    },
  },
);

const sipConnectorFacade = new SipConnectorFacade(sipConnector);

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
  contentHint: 'detail', // Оптимизация для детального контента
  degradationPreference: 'maintain-resolution', // Приоритет разрешения
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

// Подписка на события автоматической балансировки
sipConnectorFacade.on('video-balancer:balancing-started', (data) => {
  console.log(`Video balancing started after ${data.delay}ms`);
});

sipConnectorFacade.on('video-balancer:parameters-updated', (result) => {
  console.log('Video parameters automatically updated:', result);
});

// Балансировка теперь запускается автоматически через videoSendingBalancerManager

// Подписка на события статистики
sipConnectorFacade.on('stats:collected', (stats) => {
  console.log('WebRTC stats collected:', stats);
});

// Отключение от сервера (балансировщик останавливается автоматически)
await sipConnectorFacade.disconnectFromServer();
```

---

### Итог

Архитектура модуля построена с использованием современных паттернов проектирования: **Фасад**, **Стратегия**, **Наблюдатель**, **Прокси**, **Композиция**, **Машина состояний** и **Шаблонный метод**. Это делает её гибкой, расширяемой и легко поддерживаемой.

**Ключевые особенности:**

1. **Многослойная архитектура**: `SipConnectorFacade` → `SipConnector` → Специализированные менеджеры
2. **Управление состоянием**: XState для ConnectionStateMachine обеспечивает надёжное управление состояниями
3. **🆕 Интегрированная оптимизация**: VideoSendingBalancerManager автоматически управляет видеопотоками
4. **🆕 Адаптивное опрашивание**: TrackMonitor снижает CPU нагрузку на 40-60% при стабильном видео
5. **🆕 Настройки кодеков в SipConnector**: Централизованное управление предпочитаемыми кодеками
6. **🆕 Улучшенная статистика**: availableIncomingBitrate и адаптивные интервалы сбора
7. **🆕 maxBitrate для презентаций**: Точный контроль качества screen sharing
8. **🆕 Последовательные операции**: ConnectionQueueManager предотвращает конфликты между операциями подключения
9. **Мониторинг**: StatsManager и StatsPeerConnection предоставляют детальную телеметрию
10. **Расширяемость**: Система стратегий позволяет легко добавлять новые типы соединений
11. **Надёжность**: Очереди задач и обработка ошибок на всех уровнях

Каждый компонент имеет чёткую зону ответственности, а зависимости между ними минимизированы и управляются через интерфейсы и события. Это позволяет легко адаптировать модуль под новые требования, интегрировать его в различные системы и обеспечивать высокое качество видеозвонков.
