import { CallReconnectIndicatorPresenter } from './app/CallReconnectIndicatorPresenter';
import { createDemoSession } from './app/createDemoSession';
import { DemoCallFlowService } from './app/DemoCallFlowService';
import { DemoCallStatePresenter } from './app/DemoCallStatePresenter';
import { getErrorMessage } from './app/inputParsing';
import { MainStreamHealthNotificationsBinder } from './app/MainStreamHealthNotificationsBinder';
import { MainStreamRecoverySettingsApplier } from './app/MainStreamRecoverySettingsApplier';
import CallStatsManager from './CallStatsManager';
import { dom } from './dom';
import LoaderManager from './LoaderManager';
import { LocalMediaStreamManager } from './LocalMediaStreamManager';
import resolveDebug from './logger';
import LogsManager from './LogsManager';
import NotificationManager from './NotificationManager';
import PresentationManager from './PresentationManager';
import RemoteMediaStreamManager from './RemoteMediaStreamManager';
import { sipConnectorFacade } from './Session';
import FormStateManager from './state/FormStateManager';
import Statuses from './Statuses';
import VideoPlayer from './VideoPlayer';

import type { TRemoteStreams } from '@/index';

const debug = resolveDebug('demo:app');

/**
 * Композиция демо-приложения: координирует сценарии SIP и делегирует UI специализированным модулям.
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

  private readonly callStatePresenter: DemoCallStatePresenter;

  private readonly mainStreamRecoverySettingsApplier: MainStreamRecoverySettingsApplier;

  private readonly callFlow: DemoCallFlowService;

  private readonly callReconnectIndicatorPresenter: CallReconnectIndicatorPresenter;

  public constructor() {
    this.notificationManager = new NotificationManager();
    this.formStateManager = new FormStateManager();
    this.localMediaStreamManager = new LocalMediaStreamManager();
    this.statusesManager = new Statuses();
    this.presentationManager = new PresentationManager(this.statusesManager);
    this.remoteMediaStreamManager = new RemoteMediaStreamManager();
    this.loaderManager = new LoaderManager();
    this.callStatsManager = new CallStatsManager();

    this.callFlow = new DemoCallFlowService({
      loader: this.loaderManager,
      sessionFactory: { createSession: createDemoSession },
      media: this.localMediaStreamManager,
    });

    this.callReconnectIndicatorPresenter = new CallReconnectIndicatorPresenter(
      dom.callReconnectIndicatorElement,
    );

    this.callStatePresenter = new DemoCallStatePresenter(
      this.localMediaStreamManager,
      this.statusesManager,
      this.presentationManager,
    );

    this.mainStreamRecoverySettingsApplier = new MainStreamRecoverySettingsApplier(
      this.sipConnectorFacade.sipConnector,
      {
        showWarning: (message) => {
          this.showWarning(message);
        },
        showSuccess: (message) => {
          this.showSuccess(message);
        },
        showError: (message) => {
          this.notificationManager.show({
            type: 'error',
            message,
            isAutoHide: true,
          });
        },
      },
    );

    const logsManager = new LogsManager();

    logsManager.subscribe();
    this.callStatsManager.subscribe();

    new MainStreamHealthNotificationsBinder(
      this.notificationManager,
      sipConnectorFacade,
    ).subscribe();
    this.bootstrap();
  }

  private bootstrap(): void {
    this.initialize();
    this.loaderManager.hide();
  }

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

    dom.connectAndCallButtonElement.addEventListener('click', () => {
      this.handleFormSubmit();
    });

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
      this.callStatePresenter.renderSystemState(state);
    });

    this.statusesManager.onChangeCallReconnect((state) => {
      this.callReconnectIndicatorPresenter.render(state);
    });

    this.statusesManager.onChangeParticipantRole((participantRoleState) => {
      this.callStatePresenter.renderParticipantRole(participantRoleState);
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
      this.callFlow
        .getSession()
        ?.sendMediaState(state)
        .catch((error: unknown) => {
          this.handleError(error);
        });
      this.callStatePresenter.syncMediaActionButtonsWithStreamState();
    });
  }

  private handleFormSubmit(): void {
    const state = this.formStateManager.getState();

    if (!this.formStateManager.validate()) {
      return;
    }

    this.runSafely(async () => {
      if (!this.callFlow.hasConnected()) {
        await this.callFlow.connect(state);
      }

      await this.callFlow.callToServer(state, (streams) => {
        this.handleRemoteStreams(streams);
      });
      this.presentationManager.activate();
    });
  }

  private handleConnectOnly(): void {
    const state = this.formStateManager.getState();

    if (!this.formStateManager.validate()) {
      return;
    }

    if (this.callFlow.hasConnected()) {
      return;
    }

    this.runSafely(async () => {
      await this.callFlow.connect(state);
    });
  }

  private handleCallOnly(): void {
    const state = this.formStateManager.getState();

    if (!this.formStateManager.validate()) {
      return;
    }

    if (!this.callFlow.hasConnected()) {
      this.showWarning('Сначала подключитесь к серверу');

      return;
    }

    this.runSafely(async () => {
      await this.callFlow.callToServer(state, (streams) => {
        this.handleRemoteStreams(streams);
      });
      this.presentationManager.activate();
    });
  }

  private handleDisconnectOnly(): void {
    if (this.callFlow.getSession() === undefined) {
      return;
    }

    this.loaderManager.show('Отключение от сервера...');

    this.runSafely(async () => {
      await this.callFlow.disconnectFromServer();
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

  private handleMainStreamSettingsSubmit(): void {
    this.mainStreamRecoverySettingsApplier.applyFromForm();
  }

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

  private handleEndCall(): void {
    this.loaderManager.show('Завершение звонка...');
    this.resetCallMediaState();

    this.runSafely(async () => {
      await this.callFlow.stopCall();
      this.loaderManager.hide();
    });
  }

  private handleHangupOnly(): void {
    this.loaderManager.show('Завершение звонка...');
    this.resetCallMediaState();

    this.runSafely(async () => {
      await this.callFlow.hangUpCall();
      this.loaderManager.hide();
    });
  }

  private resetCallMediaState(): void {
    this.presentationManager.deactivate();
    this.localMediaStreamManager.stop();
    this.remoteMediaStreamManager.clear();
  }

  private handleToggleCamera(): void {
    this.localMediaStreamManager.toggleCamera();
    this.callStatePresenter.syncMediaActionButtonsWithStreamState();
  }

  private handleToggleMic(): void {
    this.localMediaStreamManager.toggleMic();
    this.callStatePresenter.syncMediaActionButtonsWithStreamState();
  }

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
