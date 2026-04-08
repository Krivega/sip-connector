import CallStateManager, { type TCallState } from './CallStateManager';
import CallStatsManager from './CallStatsManager';
import ConferenceStateDisplay from './ConferenceStateDisplay';
import { dom } from './dom';
import LoaderManager from './LoaderManager';
import { LocalMediaStreamManager } from './LocalMediaStreamManager';
import LogsManager from './LogsManager';
import NotificationManager from './NotificationManager';
import PresentationManager from './PresentationManager';
import RemoteMediaStreamManager from './RemoteMediaStreamManager';
import { Session, sipConnectorFacade } from './Session';
import FormStateManager from './state/FormStateManager';
import Statuses from './Statuses';
import getAppInfo from './utils/getAppInfo';
import getBrowserInfo from './utils/getBrowserInfo';
import VideoPlayer from './VideoPlayer';

import type { TRemoteStreams } from '@/index';
import type { IFormState } from './state/FormState';

/**
 * Главный класс приложения
 * Объединяет все компоненты для работы SIP-звонков
 */
class App {
  public readonly sipConnectorFacade = sipConnectorFacade;

  private readonly notificationManager: NotificationManager;

  private readonly formStateManager: FormStateManager;

  private readonly localMediaStreamManager: LocalMediaStreamManager;

  private readonly presentationManager: PresentationManager;

  private readonly remoteMediaStreamManager: RemoteMediaStreamManager;

  private readonly loaderManager: LoaderManager;

  private readonly callStateManager: CallStateManager;

  private readonly callStatsManager: CallStatsManager;

  private session: Session | undefined = undefined;

  /**
   * Создает экземпляр App
   */
  public constructor() {
    this.notificationManager = new NotificationManager();
    this.formStateManager = new FormStateManager();
    this.localMediaStreamManager = new LocalMediaStreamManager();
    this.presentationManager = new PresentationManager();
    this.remoteMediaStreamManager = new RemoteMediaStreamManager();
    this.loaderManager = new LoaderManager();
    this.callStateManager = new CallStateManager();
    this.callStatsManager = new CallStatsManager();

    const statusesManager = new Statuses();

    statusesManager.subscribe((statuses) => {
      this.updateSessionStatuses(statuses);
    });

    const conferenceStateDisplay = new ConferenceStateDisplay();

    conferenceStateDisplay.subscribe((state) => {
      this.updateConferenceState(state);
    });

    const logsManager = new LogsManager();

    logsManager.subscribe();
    this.callStatsManager.subscribe();

    const idNotificationInboundVideoProblemDetected = 'inbound-video-problem-detected';

    sipConnectorFacade.on(
      'main-stream-health:inbound-video-problem-detected',
      ({ reason, consecutiveProblemSamplesCount }) => {
        this.notificationManager.show({
          type: 'error',
          message: `Обнаружена проблема: ${reason} (подряд ${consecutiveProblemSamplesCount} раз)`,
          id: idNotificationInboundVideoProblemDetected,
        });
      },
    );
    sipConnectorFacade.on('main-stream-health:health-snapshot', (healthSnapshot) => {
      const problemStatuses = Object.entries(healthSnapshot).filter(([_key, value]) => {
        return value;
      });

      if (problemStatuses.length === 0) {
        return;
      }

      this.notificationManager.show({
        type: 'info',
        message: `Текущее состояние основного входящего видеопотока: ${problemStatuses
          .map(([key]) => {
            return key;
          })
          .join(', ')}`,
        isAutoHide: true,
        timeoutMs: 3000,
      });
    });
    sipConnectorFacade.on('main-stream-health:inbound-video-problem-resolved', () => {
      this.notificationManager.hide(idNotificationInboundVideoProblemDetected);
    });
    sipConnectorFacade.on('main-stream-health:inbound-video-problem-reset', () => {
      this.notificationManager.hide(idNotificationInboundVideoProblemDetected);
    });

    this.initialize();
  }

  /**
   * Инициализирует приложение
   */
  private initialize(): void {
    // Подключаем видео-плеер к локальному медиа-менеджеру
    const localVideoPlayer = new VideoPlayer(dom.localVideoElement);

    this.localMediaStreamManager.setVideoPlayer(localVideoPlayer);

    const presentationVideoPlayer = new VideoPlayer(dom.presentationVideoElement);

    this.presentationManager.setVideoPlayer(presentationVideoPlayer);

    // Подписываемся на отправку формы по Enter
    this.formStateManager.onSubmit((_state, event) => {
      event.preventDefault();
      this.handleFormSubmit();
    });

    dom.connectButtonElement.addEventListener('click', () => {
      this.handleConnectOnly();
    });

    dom.disconnectButtonElement.addEventListener('click', () => {
      this.handleDisconnectOnly();
    });

    // Подписываемся на кнопку "Позвонить"
    dom.callButtonElement.addEventListener('click', () => {
      this.handleFormSubmit();
    });

    dom.mainStreamSettingsFormElement.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleMainStreamSettingsSubmit();
    });

    // Подписываемся на изменения состояния звонка
    this.callStateManager.onChange((state) => {
      this.handleCallStateChange(state);
    });

    // Подписываемся на кнопку завершения звонка
    dom.endCallButtonElement.addEventListener('click', () => {
      this.handleEndCall();
    });

    // Подписываемся на кнопки включения/выключения камеры
    dom.muteCameraButtonElement.addEventListener('click', () => {
      this.handleToggleCamera();
    });

    dom.unmuteCameraButtonElement.addEventListener('click', () => {
      this.handleToggleCamera();
    });

    // Подписываемся на кнопки включения/выключения микрофона
    dom.muteMicButtonElement.addEventListener('click', () => {
      this.handleToggleMic();
    });

    dom.unmuteMicButtonElement.addEventListener('click', () => {
      this.handleToggleMic();
    });

    this.localMediaStreamManager.onMediaStateChange((state) => {
      this.session?.sendMediaState(state).catch((error: unknown) => {
        this.handleError(error);
      });
    });
  }

  /**
   * Обрабатывает отправку формы
   */
  private handleFormSubmit() {
    const state = this.formStateManager.getState();

    if (!this.formStateManager.validate()) {
      return;
    }

    Promise.resolve()
      .then(async () => {
        if (this.session?.hasConnected() === true) {
          return undefined;
        }

        return this.connect(state);
      })
      .then(async () => {
        return this.callToServer(state);
      })
      .then(() => {
        this.presentationManager.activate();
      })
      .catch((error: unknown) => {
        this.handleError(error);
      });
  }

  private handleConnectOnly(): void {
    const state = this.formStateManager.getState();

    if (!this.formStateManager.validate()) {
      return;
    }

    if (this.session?.hasConnected() === true) {
      return;
    }

    Promise.resolve()
      .then(async () => {
        return this.connect(state);
      })
      .catch((error: unknown) => {
        this.handleError(error);
      });
  }

  private handleDisconnectOnly(): void {
    const { session } = this;

    if (session === undefined) {
      return;
    }

    if (!session.hasConnected()) {
      return;
    }

    this.loaderManager.show('Отключение от сервера...');

    Promise.resolve()
      .then(async () => {
        await session.disconnectFromServer();
        this.session = undefined;
        this.callStateManager.reset();
        this.loaderManager.hide();
      })
      .catch((error: unknown) => {
        this.handleError(error);
      });
  }

  private handleMainStreamSettingsSubmit(): void {
    const minConsecutiveProblemSamplesCount = Number.parseInt(
      dom.minConsecutiveProblemSamplesCountInputElement.value,
      10,
    );
    const throttleRecoveryTimeout = Number.parseInt(
      dom.throttleRecoveryTimeoutInputElement.value,
      10,
    );

    if (
      !Number.isInteger(minConsecutiveProblemSamplesCount) ||
      minConsecutiveProblemSamplesCount < 1
    ) {
      this.notificationManager.show({
        type: 'warning',
        message: 'Порог детекта проблемы должен быть положительным целым числом',
        isAutoHide: true,
      });

      return;
    }

    if (!Number.isInteger(throttleRecoveryTimeout) || throttleRecoveryTimeout < 1) {
      this.notificationManager.show({
        type: 'warning',
        message: 'Интервал восстановления должен быть положительным целым числом (мс)',
        isAutoHide: true,
      });

      return;
    }

    try {
      this.sipConnectorFacade.sipConnector.setMinConsecutiveProblemSamplesCount(
        minConsecutiveProblemSamplesCount,
      );
      this.sipConnectorFacade.sipConnector.setThrottleRecoveryTimeout(throttleRecoveryTimeout);

      this.notificationManager.show({
        type: 'success',
        message: 'Настройки восстановления применены',
        isAutoHide: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.notificationManager.show({
        type: 'error',
        message: `Ошибка применения настроек восстановления: ${errorMessage}`,
        isAutoHide: true,
      });
    }
  }

  private async callToServer(state: IFormState): Promise<void> {
    const { session } = this;

    if (!session) {
      throw new Error('Session is not initialized. Call connect() first.');
    }

    try {
      this.loaderManager.show('Инициализация медиа...');
      // Инициализируем локальный медиа-поток
      await this.localMediaStreamManager.initialize();

      this.callStateManager.setState('calling');
      this.loaderManager.setMessage('Установление звонка...');

      // Запускаем звонок
      const mediaStream = this.localMediaStreamManager.getStream();

      if (!mediaStream) {
        throw new Error('MediaStream не инициализирован');
      }

      session.onChangeParticipantRole((participantRoleState) => {
        if (
          participantRoleState?.role === 'participant' ||
          participantRoleState?.isAvailableSendingMedia === true
        ) {
          dom.muteMicButtonElement.classList.remove('disabled');
          dom.unmuteMicButtonElement.classList.remove('disabled');
          dom.muteCameraButtonElement.classList.remove('disabled');
          dom.unmuteCameraButtonElement.classList.remove('disabled');
        } else {
          dom.muteMicButtonElement.classList.add('disabled');
          dom.unmuteMicButtonElement.classList.add('disabled');
          dom.muteCameraButtonElement.classList.add('disabled');
          dom.unmuteCameraButtonElement.classList.add('disabled');
        }

        if (
          participantRoleState?.role === 'spectatorSynthetic' ||
          participantRoleState?.role === 'spectator'
        ) {
          this.localMediaStreamManager.disableAll();
        }

        this.updateMediaButtonsState();
      });

      await session.callToServer({
        mediaStream,
        conference: state.conferenceNumber,
        setRemoteStreams: (streams: TRemoteStreams) => {
          this.handleRemoteStreams(streams);
        },
      });

      this.callStateManager.setState('active');
      this.loaderManager.hide();

      // Обновляем состояние кнопок после успешного подключения
      this.updateMediaButtonsState();
    } catch (error) {
      this.callStateManager.reset();
      this.loaderManager.hide();
      throw error;
    }
  }

  private async connect(state: IFormState): Promise<void> {
    try {
      this.callStateManager.setState('connecting');
      this.loaderManager.setMessage('Подключение к серверу...');

      // Создаем сессию
      const browserInfo = getBrowserInfo();
      const appInfo = getAppInfo();

      this.session = new Session({
        serverParametersRequesterParams: {
          appVersion: appInfo.appVersion,
          appName: appInfo.appName,
          browserName: browserInfo.name,
          browserVersion: browserInfo.version,
        },
      });

      await this.session.connect({
        serverUrl: state.serverAddress,
        isRegistered: state.authEnabled,
        displayName: state.displayName,
        user: state.userNumber,
        password: state.password,
      });

      this.callStateManager.setState('connected');
      this.loaderManager.hide();

      // Обновляем состояние кнопок после успешного подключения
      this.updateMediaButtonsState();
    } catch (error) {
      this.callStateManager.reset();
      this.loaderManager.hide();
      throw error;
    }
  }

  /**
   * Обрабатывает получение удаленных потоков
   */
  private handleRemoteStreams({ mainStream, contentedStream }: TRemoteStreams): void {
    const streams = [mainStream, contentedStream]
      .filter((stream) => {
        return stream !== undefined;
      })
      .map((stream) => {
        return { streamId: stream.id, stream };
      });

    this.remoteMediaStreamManager.setStreams(streams);
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private updateSessionStatuses(statuses: {
    connection: string;
    call: string;
    incoming: string;
    presentation: string;
    system: string;
  }): void {
    dom.connectionStatusElement.textContent = statuses.connection;
    dom.callStatusElement.textContent = statuses.call;
    dom.incomingStatusElement.textContent = statuses.incoming;
    dom.presentationStatusElement.textContent = statuses.presentation;
    dom.systemStatusElement.textContent = statuses.system;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private updateConferenceState(state: {
    room: string;
    participantName: string;
    token: string;
    conferenceForToken: string;
    number: string;
    answer: string;
    pendingDisconnect: string;
  }): void {
    dom.conferenceStateRoomElement.textContent = state.room;
    dom.conferenceStateParticipantNameElement.textContent = state.participantName;
    dom.conferenceStateTokenElement.textContent = state.token;
    dom.conferenceStateConferenceForTokenElement.textContent = state.conferenceForToken;
    dom.conferenceStateNumberElement.textContent = state.number;
    dom.conferenceStateAnswerElement.textContent = state.answer;
    dom.conferenceStatePendingDisconnectElement.textContent = state.pendingDisconnect;
  }

  /**
   * Обрабатывает завершение звонка
   */
  private handleEndCall() {
    this.loaderManager.show('Завершение звонка...');
    this.callStateManager.setState('idle');
    // Сбрасываем состояние презентации
    this.presentationManager.deactivate();

    // Останавливаем локальный медиа-поток
    this.localMediaStreamManager.stop();

    // Очищаем удаленные потоки
    this.remoteMediaStreamManager.clear();
    (this.session ? this.session.stopCall() : Promise.resolve())
      .then(() => {
        this.session = undefined;

        this.loaderManager.hide();
      })
      .catch((error: unknown) => {
        this.handleError(error);
        this.loaderManager.hide();
      });
  }

  /**
   * Обрабатывает изменения состояния звонка
   */

  private handleCallStateChange(state: TCallState): void {
    const isConnecting = state === 'connecting';
    const isConnected = state === 'connected';
    const isCallInProgress = state === 'calling' || state === 'active';

    dom.callButtonElement.disabled = isCallInProgress;
    dom.endCallButtonElement.disabled = state !== 'active';
    dom.connectButtonElement.disabled = isConnecting;
    dom.disconnectButtonElement.disabled = isConnecting;

    if (state === 'idle') {
      dom.show(dom.connectButtonElement);
      dom.hide(dom.disconnectButtonElement);
    } else if (isConnecting) {
      dom.show(dom.connectButtonElement);
      dom.hide(dom.disconnectButtonElement);
    } else if (isConnected) {
      dom.hide(dom.connectButtonElement);
      dom.show(dom.disconnectButtonElement);
    } else {
      dom.hide(dom.connectButtonElement);
      dom.hide(dom.disconnectButtonElement);
    }

    if (state === 'active') {
      dom.hide(dom.callButtonElement);
      dom.show(dom.endCallButtonElement);
    } else {
      dom.show(dom.callButtonElement);
      dom.hide(dom.endCallButtonElement);
    }

    // Показываем/скрываем секции в зависимости от состояния
    // Локальное видео показываем когда идет процесс
    const shouldShowLocalVideo = isCallInProgress;

    if (shouldShowLocalVideo) {
      dom.show(dom.localVideoSectionElement);
    } else {
      dom.hide(dom.localVideoSectionElement);
    }

    // Общий контейнер для секций активного звонка показываем только когда звонок активен
    const shouldShowActiveCallSection = state === 'active';

    if (shouldShowActiveCallSection) {
      dom.show(dom.activeCallSectionElement);
    } else {
      dom.hide(dom.activeCallSectionElement);
    }

    // Обновляем состояние кнопок камеры и микрофона
    this.updateMediaButtonsState();
  }

  /**
   * Обновляет состояние кнопок камеры и микрофона
   */
  private updateMediaButtonsState(): void {
    const isCallActive = this.callStateManager.isActive();

    if (isCallActive) {
      this.updateCamButtonsState();
      this.updateMicButtonsState();
    } else {
      dom.hide(dom.muteCameraButtonElement);
      dom.hide(dom.unmuteCameraButtonElement);
      dom.hide(dom.muteMicButtonElement);
      dom.hide(dom.unmuteMicButtonElement);
    }
  }

  private updateCamButtonsState(): void {
    const isEnabledCam = this.localMediaStreamManager.isEnabledCam();

    if (isEnabledCam) {
      dom.show(dom.muteCameraButtonElement);
      dom.hide(dom.unmuteCameraButtonElement);
    } else {
      dom.show(dom.unmuteCameraButtonElement);
      dom.hide(dom.muteCameraButtonElement);
    }
  }

  private updateMicButtonsState(): void {
    const isEnabledMic = this.localMediaStreamManager.isEnabledMic();

    if (isEnabledMic) {
      dom.show(dom.muteMicButtonElement);
      dom.hide(dom.unmuteMicButtonElement);
    } else {
      dom.show(dom.unmuteMicButtonElement);
      dom.hide(dom.muteMicButtonElement);
    }
  }

  /**
   * Обрабатывает переключение камеры
   */
  private handleToggleCamera(): void {
    this.localMediaStreamManager.toggleCamera();
    this.updateMediaButtonsState();
  }

  /**
   * Обрабатывает переключение микрофона
   */
  private handleToggleMic(): void {
    this.localMediaStreamManager.toggleMic();
    this.updateMediaButtonsState();
  }

  /**
   * Обрабатывает ошибки
   */
  private handleError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);

    // eslint-disable-next-line no-console
    console.error('Ошибка:', error);

    this.notificationManager.show({
      type: 'error',
      message: `Ошибка: ${errorMessage}`,
    });

    this.callStateManager.reset();
    this.loaderManager.hide();
  }
}

export default App;
