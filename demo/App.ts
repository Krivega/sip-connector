import CallStatsManager from './CallStatsManager';
import { dom } from './dom';
import LoaderManager from './LoaderManager';
import { LocalMediaStreamManager } from './LocalMediaStreamManager';
import resolveDebug from './logger';
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
import type { TStatusesByDomain } from './StatusesRoot';

const debug = resolveDebug('demo:app');

const INBOUND_VIDEO_PROBLEM_NOTIFICATION_ID = 'inbound-video-problem-detected';

type TSystemState = {
  isDisconnected: boolean;
  isDisconnecting: boolean;
  isConnecting: boolean;
  isReadyToCall: boolean;
  isCallConnecting: boolean;
  isCallDisconnecting: boolean;
  isCallActive: boolean;
} & TStatusesByDomain;

type TParticipantRoleState = {
  isAvailableSendingMedia: boolean;
  isSpectatorRoleAny: boolean;
  isSpectator: boolean;
  isParticipant: boolean;
};

type TPositiveIntegerParseResult =
  | {
      isValid: true;
      value: number;
    }
  | {
      isValid: false;
      message: string;
    };

const setElementVisible = (element: HTMLElement, isVisible: boolean): void => {
  if (isVisible) {
    dom.show(element);
  } else {
    dom.hide(element);
  }
};

const setMediaActionButtonsDisabled = (isDisabled: boolean): void => {
  dom.toggleDisabled(dom.muteMicButtonElement, isDisabled);
  dom.toggleDisabled(dom.unmuteMicButtonElement, isDisabled);
  dom.toggleDisabled(dom.muteCameraButtonElement, isDisabled);
  dom.toggleDisabled(dom.unmuteCameraButtonElement, isDisabled);
};

const parsePositiveIntegerInput = ({
  input,
  invalidMessage,
}: {
  input: HTMLInputElement;
  invalidMessage: string;
}): TPositiveIntegerParseResult => {
  const value = Number.parseInt(input.value, 10);

  if (!Number.isInteger(value) || value < 1) {
    return { isValid: false, message: invalidMessage };
  }

  return { isValid: true, value };
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  const serializedError = JSON.stringify(error);

  return typeof serializedError === 'string' ? serializedError : String(error);
};

const createSession = (): Session => {
  const browserInfo = getBrowserInfo();
  const appInfo = getAppInfo();

  return new Session({
    serverParametersRequesterParams: {
      appVersion: appInfo.appVersion,
      appName: appInfo.appName,
      browserName: browserInfo.name,
      browserVersion: browserInfo.version,
    },
  });
};

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

  private readonly callStatsManager: CallStatsManager;

  private readonly statusesManager: Statuses;

  private session: Session | undefined = undefined;

  private isCallActivePrev = false;

  /**
   * Создает экземпляр App
   */
  public constructor() {
    this.notificationManager = new NotificationManager();
    this.formStateManager = new FormStateManager();
    this.localMediaStreamManager = new LocalMediaStreamManager();
    this.statusesManager = new Statuses();
    this.presentationManager = new PresentationManager(this.statusesManager);
    this.remoteMediaStreamManager = new RemoteMediaStreamManager();
    this.loaderManager = new LoaderManager();
    this.callStatsManager = new CallStatsManager();

    const logsManager = new LogsManager();

    logsManager.subscribe();
    this.callStatsManager.subscribe();

    this.subscribeMainStreamHealthNotifications();
    this.bootstrap();
  }

  private bootstrap(): void {
    this.initialize();
    this.loaderManager.hide();
  }

  private subscribeMainStreamHealthNotifications(): void {
    sipConnectorFacade.on(
      'main-stream-health:inbound-video-problem-detected',
      ({ reason, consecutiveProblemSamplesCount }) => {
        this.notificationManager.show({
          type: 'error',
          message: `Обнаружена проблема: ${reason} (подряд ${consecutiveProblemSamplesCount} раз)`,
          id: INBOUND_VIDEO_PROBLEM_NOTIFICATION_ID,
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
      this.notificationManager.hide(INBOUND_VIDEO_PROBLEM_NOTIFICATION_ID);
    });
    sipConnectorFacade.on('main-stream-health:inbound-video-problem-reset', () => {
      this.notificationManager.hide(INBOUND_VIDEO_PROBLEM_NOTIFICATION_ID);
    });
  }

  /**
   * Инициализирует приложение
   */
  private initialize(): void {
    this.setupVideoPlayers();
    this.setupFormHandlers();
    this.setupCallActionHandlers();
    this.setupMediaHandlers();
    this.setupStatusHandlers();
  }

  private setupVideoPlayers(): void {
    this.localMediaStreamManager.setVideoPlayer(new VideoPlayer(dom.localVideoElement));
    this.presentationManager.setVideoPlayer(new VideoPlayer(dom.presentationVideoElement));
  }

  private setupFormHandlers(): void {
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

    // Подписываемся на кнопку "Подключиться и позвонить"
    dom.connectAndCallButtonElement.addEventListener('click', () => {
      this.handleFormSubmit();
    });

    // Подписываемся на кнопку "Позвонить" (без подключения)
    dom.callButtonElement.addEventListener('click', () => {
      this.handleCallOnly();
    });

    dom.mainStreamSettingsFormElement.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleMainStreamSettingsSubmit();
    });
  }

  private setupStatusHandlers(): void {
    dom.renderSessionStatusDiagrams();
    this.statusesManager.subscribe();

    this.statusesManager.onChangeSystemState((state) => {
      this.handleCallStateChange(state);
    });

    this.statusesManager.onChangeCallReconnect(({ isReconnecting }) => {
      setElementVisible(dom.callReconnectIndicatorElement, isReconnecting);
    });

    this.statusesManager.onChangeParticipantRole((participantRoleState) => {
      this.handleParticipantRoleChange(participantRoleState);
    });
  }

  private setupCallActionHandlers(): void {
    dom.hangupButtonElement.addEventListener('click', () => {
      this.handleHangupOnly();
    });

    dom.endCallButtonElement.addEventListener('click', () => {
      this.handleEndCall();
    });

    dom.muteCameraButtonElement.addEventListener('click', () => {
      this.handleToggleCamera();
    });

    dom.unmuteCameraButtonElement.addEventListener('click', () => {
      this.handleToggleCamera();
    });

    dom.muteMicButtonElement.addEventListener('click', () => {
      this.handleToggleMic();
    });

    dom.unmuteMicButtonElement.addEventListener('click', () => {
      this.handleToggleMic();
    });
  }

  private setupMediaHandlers(): void {
    this.localMediaStreamManager.onMediaStateChange((state) => {
      this.session?.sendMediaState(state).catch((error: unknown) => {
        this.handleError(error);
      });
      this.syncMediaActionButtonsWithStreamState();
    });
  }

  /**
   * Обрабатывает отправку формы
   */
  private handleFormSubmit(): void {
    const state = this.formStateManager.getState();

    if (!this.formStateManager.validate()) {
      return;
    }

    this.runSafely(async () => {
      if (this.session?.hasConnected() !== true) {
        await this.connect(state);
      }

      await this.callToServer(state);
      this.presentationManager.activate();
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

    this.runSafely(async () => {
      await this.connect(state);
    });
  }

  private handleCallOnly(): void {
    const state = this.formStateManager.getState();

    if (!this.formStateManager.validate()) {
      return;
    }

    if (this.session?.hasConnected() !== true) {
      this.showWarning('Сначала подключитесь к серверу');

      return;
    }

    this.runSafely(async () => {
      await this.callToServer(state);
      this.presentationManager.activate();
    });
  }

  private handleDisconnectOnly(): void {
    const { session } = this;

    if (session === undefined) {
      return;
    }

    this.loaderManager.show('Отключение от сервера...');

    this.runSafely(async () => {
      await session.disconnectFromServer();
      this.session = undefined;
      this.loaderManager.hide();
    });
  }

  private runSafely(action: () => Promise<void>): void {
    Promise.resolve()
      .then(action)
      .catch((error: unknown) => {
        this.handleError(error);
      });
  }

  private showWarning(message: string): void {
    this.notificationManager.show({
      type: 'warning',
      message,
      isAutoHide: true,
    });
  }

  private showSuccess(message: string): void {
    this.notificationManager.show({
      type: 'success',
      message,
      isAutoHide: true,
    });
  }

  private resolvePositiveIntegerInput(result: TPositiveIntegerParseResult): number | undefined {
    if (result.isValid) {
      return result.value;
    }

    this.showWarning(result.message);

    return undefined;
  }

  private handleMainStreamSettingsSubmit(): void {
    const minConsecutiveProblemSamplesCount = this.resolvePositiveIntegerInput(
      parsePositiveIntegerInput({
        input: dom.minConsecutiveProblemSamplesCountInputElement,
        invalidMessage: 'Порог детекта проблемы должен быть положительным целым числом',
      }),
    );

    if (minConsecutiveProblemSamplesCount === undefined) {
      return;
    }

    const throttleRecoveryTimeout = this.resolvePositiveIntegerInput(
      parsePositiveIntegerInput({
        input: dom.throttleRecoveryTimeoutInputElement,
        invalidMessage: 'Интервал восстановления должен быть положительным целым числом (мс)',
      }),
    );

    if (throttleRecoveryTimeout === undefined) {
      return;
    }

    try {
      this.sipConnectorFacade.sipConnector.setMinConsecutiveProblemSamplesCount(
        minConsecutiveProblemSamplesCount,
      );
      this.sipConnectorFacade.sipConnector.setThrottleRecoveryTimeout(throttleRecoveryTimeout);

      this.showSuccess('Настройки восстановления применены');
    } catch (error) {
      this.notificationManager.show({
        type: 'error',
        message: `Ошибка применения настроек восстановления: ${getErrorMessage(error)}`,
        isAutoHide: true,
      });
    }
  }

  private async callToServer(state: IFormState): Promise<void> {
    const session = this.getConnectedSession();

    try {
      this.loaderManager.show('Инициализация медиа...');
      await this.localMediaStreamManager.initialize();

      this.loaderManager.setMessage('Установление звонка...');

      const mediaStream = this.localMediaStreamManager.getStream();

      if (!mediaStream) {
        throw new Error('MediaStream не инициализирован');
      }

      await session.callToServer({
        mediaStream,
        conference: state.conferenceNumber,
        autoRedial: state.autoRedialEnabled,
        setRemoteStreams: (streams: TRemoteStreams) => {
          this.handleRemoteStreams(streams);
        },
      });

      this.loaderManager.hide();
    } catch (error) {
      this.loaderManager.hide();
      throw error;
    }
  }

  private getConnectedSession(): Session {
    const { session } = this;

    if (!session) {
      throw new Error('Session is not initialized. Call connect() first.');
    }

    return session;
  }

  private async connect(state: IFormState): Promise<void> {
    try {
      this.loaderManager.setMessage('Подключение к серверу...');

      this.session = createSession();

      await this.session.connect({
        serverUrl: state.serverAddress,
        isRegistered: state.authEnabled,
        displayName: state.displayName,
        user: state.userNumber,
        password: state.password,
      });

      this.loaderManager.hide();
    } catch (error) {
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
  private updateSessionStatuses(statuses: TStatusesByDomain): void {
    debug('updateSessionStatuses', statuses);

    dom.setActiveSessionStatusNode('connection', statuses.connection);
    dom.setActiveSessionStatusNode('autoConnectorManager', statuses.autoConnector);
    dom.setActiveSessionStatusNode('callReconnect', statuses.callReconnect);
    dom.setActiveSessionStatusNode('call', statuses.call);
    dom.setActiveSessionStatusNode('incoming', statuses.incoming);
    dom.setActiveSessionStatusNode('presentation', statuses.presentation);
    dom.setActiveSessionStatusNode('system', statuses.system);
  }

  private handleParticipantRoleChange(participantRoleState: TParticipantRoleState): void {
    const canSendMedia =
      participantRoleState.isParticipant || participantRoleState.isAvailableSendingMedia;

    setMediaActionButtonsDisabled(!canSendMedia);

    if (participantRoleState.isSpectatorRoleAny) {
      this.localMediaStreamManager.disableAll();
    }

    setElementVisible(dom.recvQualitySectionElement, participantRoleState.isSpectator);
    dom.renderStatusesNodeValues(this.statusesManager.getStatusSnapshots());
  }

  /**
   * Обрабатывает завершение звонка
   */
  private handleEndCall(): void {
    this.loaderManager.show('Завершение звонка...');
    this.resetCallMediaState();

    this.runSafely(async () => {
      await (this.session ? this.session.stopCall() : Promise.resolve());
      this.session = undefined;
      this.loaderManager.hide();
    });
  }

  private handleHangupOnly(): void {
    this.loaderManager.show('Завершение звонка...');
    this.resetCallMediaState();

    this.runSafely(async () => {
      await (this.session ? this.session.hangUpCall() : Promise.resolve());
      this.loaderManager.hide();
    });
  }

  private resetCallMediaState(): void {
    this.presentationManager.deactivate();
    this.localMediaStreamManager.stop();
    this.remoteMediaStreamManager.clear();
  }

  /**
   * Обрабатывает изменения состояния звонка
   */

  private handleCallStateChange(state: TSystemState): void {
    const {
      isDisconnected,
      isDisconnecting,
      isConnecting,
      isCallConnecting,
      isCallDisconnecting,
      isCallActive,
    } = state;

    const isCallFinished = this.isCallActivePrev && !isCallActive;

    if (isCallFinished) {
      this.presentationManager.deactivate();
    }

    this.updateSessionStatuses({
      connection: state.connection,
      call: state.call,
      incoming: state.incoming,
      presentation: state.presentation,
      system: state.system,
      autoConnector: state.autoConnector,
      callReconnect: state.callReconnect,
    });

    dom.renderStatusesNodeValues(this.statusesManager.getStatusSnapshots());

    const isBusyWithConnection = isConnecting || isDisconnecting;

    dom.connectAndCallButtonElement.disabled =
      isBusyWithConnection || isCallConnecting || isCallDisconnecting;
    dom.callButtonElement.disabled =
      isBusyWithConnection || isCallConnecting || isCallDisconnecting || isDisconnected;
    dom.hangupButtonElement.disabled = !isCallActive;
    dom.endCallButtonElement.disabled = !isCallActive;
    dom.connectButtonElement.disabled = isBusyWithConnection;
    dom.disconnectButtonElement.disabled = isDisconnecting;

    if (isDisconnected) {
      dom.show(dom.connectButtonElement);
      dom.hide(dom.disconnectButtonElement);
    } else if (isConnecting) {
      dom.hide(dom.connectButtonElement);
      dom.show(dom.disconnectButtonElement);
    } else {
      dom.hide(dom.connectButtonElement);
      dom.show(dom.disconnectButtonElement);
    }

    if (isCallActive) {
      dom.hide(dom.connectAndCallButtonElement);
      dom.hide(dom.callButtonElement);
      dom.show(dom.hangupButtonElement);
      dom.show(dom.endCallButtonElement);
    } else if (isDisconnected) {
      dom.show(dom.connectAndCallButtonElement);
      dom.hide(dom.callButtonElement);
      dom.hide(dom.hangupButtonElement);
      dom.hide(dom.endCallButtonElement);
    } else {
      dom.hide(dom.connectAndCallButtonElement);
      dom.show(dom.callButtonElement);
      dom.hide(dom.hangupButtonElement);
      dom.hide(dom.endCallButtonElement);
    }

    setElementVisible(dom.localVideoSectionElement, isCallConnecting || isCallActive);
    setElementVisible(dom.activeCallSectionElement, isCallActive);

    // Обновляем состояние кнопок камеры и микрофона
    this.updateMediaButtonsState({ isCallActive });
    this.isCallActivePrev = isCallActive;
  }

  /**
   * Обновляет состояние кнопок камеры и микрофона
   */
  private updateMediaButtonsState({ isCallActive }: { isCallActive: boolean }): void {
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
    this.syncMediaActionButtonsWithStreamState();
  }

  /**
   * Обрабатывает переключение микрофона
   */
  private handleToggleMic(): void {
    this.localMediaStreamManager.toggleMic();
    this.syncMediaActionButtonsWithStreamState();
  }

  private syncMediaActionButtonsWithStreamState(): void {
    if (!dom.isVisible(dom.activeCallSectionElement)) {
      return;
    }

    this.updateCamButtonsState();
    this.updateMicButtonsState();
  }

  /**
   * Обрабатывает ошибки
   */
  private handleError(error: unknown): void {
    debug('Ошибка:', error);

    this.notificationManager.show({
      type: 'error',
      message: `Ошибка: ${getErrorMessage(error)}`,
    });

    this.loaderManager.hide();
  }
}

export default App;
