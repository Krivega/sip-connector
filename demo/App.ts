/* eslint-disable no-alert */
import CallStateManager, { type TCallState } from './CallStateManager';
import { dom } from './dom';
import LoaderManager from './LoaderManager';
import LocalMediaStreamManager from './LocalMediaStreamManager';
import RemoteMediaStreamManager from './RemoteMediaStreamManager';
import Session from './Session/Session';
import FormStateManager from './state/FormStateManager';
import getAppInfo from './utils/getAppInfo';
import getBrowserInfo from './utils/getBrowserInfo';
import VideoPlayer from './VideoPlayer';

import type { IFormState } from './state/FormState';

/**
 * Главный класс приложения
 * Объединяет все компоненты для работы SIP-звонков
 */
class App {
  private readonly formStateManager: FormStateManager;

  private readonly localMediaStreamManager: LocalMediaStreamManager;

  private readonly remoteMediaStreamManager: RemoteMediaStreamManager;

  private readonly loaderManager: LoaderManager;

  private readonly callStateManager: CallStateManager;

  private session: Session | undefined = undefined;

  /**
   * Создает экземпляр App
   */
  public constructor() {
    this.formStateManager = new FormStateManager();
    this.localMediaStreamManager = new LocalMediaStreamManager();
    this.remoteMediaStreamManager = new RemoteMediaStreamManager();
    this.loaderManager = new LoaderManager();
    this.callStateManager = new CallStateManager();

    this.initialize();
  }

  /**
   * Инициализирует приложение
   */
  private initialize(): void {
    // Подключаем видео-плеер к локальному медиа-менеджеру
    const localVideoPlayer = new VideoPlayer(dom.localVideoElement);

    this.localMediaStreamManager.setVideoPlayer(localVideoPlayer);

    // Подписываемся на отправку формы по Enter
    this.formStateManager.onSubmit((_state, event) => {
      event.preventDefault();
      this.handleFormSubmit();
    });

    // Подписываемся на кнопку "Позвонить"
    dom.callButtonElement.addEventListener('click', () => {
      this.handleFormSubmit();
    });

    // Подписываемся на изменения состояния звонка
    this.callStateManager.onChange((state) => {
      this.handleCallStateChange(state);
    });

    // Подписываемся на кнопку завершения звонка
    dom.endCallButtonElement.addEventListener('click', () => {
      this.handleEndCall();
    });

    // Подписываемся на кнопку переключения камеры
    dom.toggleCameraButtonElement.addEventListener('click', () => {
      this.handleToggleCamera();
    });

    // Подписываемся на кнопку переключения микрофона
    dom.toggleMicButtonElement.addEventListener('click', () => {
      this.handleToggleMic();
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

    this.startCall(state).catch((error: unknown) => {
      this.handleError(error);
    });
  }

  /**
   * Запускает процесс звонка
   */
  private async startCall(state: IFormState): Promise<void> {
    this.callStateManager.setState('initializing');
    this.loaderManager.show('Инициализация медиа...');

    try {
      // Инициализируем локальный медиа-поток
      await this.localMediaStreamManager.initialize();

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

      this.callStateManager.setState('calling');
      this.loaderManager.setMessage('Установление звонка...');

      // Запускаем звонок
      const mediaStream = this.localMediaStreamManager.getStream();

      if (!mediaStream) {
        throw new Error('MediaStream не инициализирован');
      }

      await this.session.startCall({
        mediaStream,
        serverUrl: state.serverAddress,
        isRegistered: state.authEnabled,
        displayName: state.displayName,
        user: state.userNumber,
        password: state.password,
        conference: state.conferenceNumber,
        setRemoteStreams: (streams: MediaStream[]) => {
          this.handleRemoteStreams(streams);
        },
        onStatusesChange: (statuses) => {
          this.updateSessionStatuses(statuses);
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

  /**
   * Обрабатывает получение удаленных потоков
   */
  private handleRemoteStreams(streams: MediaStream[]): void {
    streams.forEach((stream) => {
      this.remoteMediaStreamManager.addStream(stream.id, stream);
    });
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private updateSessionStatuses(statuses: {
    connection: string;
    call: string;
    incoming: string;
    screenShare: string;
  }): void {
    dom.connectionStatusElement.textContent = statuses.connection;
    dom.callStatusElement.textContent = statuses.call;
    dom.incomingStatusElement.textContent = statuses.incoming;
    dom.screenShareStatusElement.textContent = statuses.screenShare;
  }

  /**
   * Обрабатывает завершение звонка
   */
  private handleEndCall() {
    this.loaderManager.show('Завершение звонка...');
    this.callStateManager.setState('idle');
    (this.session ? this.session.stopCall() : Promise.resolve())
      .then(() => {
        this.session = undefined;

        // Останавливаем локальный медиа-поток
        this.localMediaStreamManager.stop();

        // Очищаем удаленные потоки
        this.remoteMediaStreamManager.clear();

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
    // Включаем/выключаем кнопку в зависимости от состояния
    dom.callButtonElement.disabled = state !== 'idle';
    dom.endCallButtonElement.disabled = state !== 'active';

    if (state === 'active') {
      dom.callButtonElement.style.display = 'none';
      dom.endCallButtonElement.style.display = '';
      dom.toggleCameraButtonElement.style.display = '';
      dom.toggleMicButtonElement.style.display = '';
    } else {
      dom.callButtonElement.style.display = '';
      dom.endCallButtonElement.style.display = 'none';
      dom.toggleCameraButtonElement.style.display = 'none';
      dom.toggleMicButtonElement.style.display = 'none';
    }

    // Показываем/скрываем секции в зависимости от состояния
    // Локальное видео показываем когда идет процесс
    const shouldShowLocalVideo =
      state === 'initializing' ||
      state === 'connecting' ||
      state === 'calling' ||
      state === 'active';

    dom.localVideoSectionElement.style.display = shouldShowLocalVideo ? '' : 'none';

    // Общий контейнер для секций активного звонка показываем только когда звонок активен
    const shouldShowActiveCallSection = state === 'active';

    dom.activeCallSectionElement.style.display = shouldShowActiveCallSection ? '' : 'none';

    // Обновляем состояние кнопок камеры и микрофона
    this.updateMediaButtonsState();
  }

  /**
   * Обновляет состояние кнопок камеры и микрофона
   */
  private updateMediaButtonsState(): void {
    const isCameraEnabled = this.localMediaStreamManager.isCameraEnabled();
    const isMicEnabled = this.localMediaStreamManager.isMicEnabled();

    dom.toggleCameraButtonTextElement.textContent = isCameraEnabled
      ? 'Выключить камеру'
      : 'Включить камеру';

    dom.toggleMicButtonTextElement.textContent = isMicEnabled
      ? 'Выключить микрофон'
      : 'Включить микрофон';

    // Обновляем классы для стилизации
    if (isCameraEnabled) {
      dom.toggleCameraButtonElement.classList.add('enabled');
      dom.toggleCameraButtonElement.classList.remove('disabled');
    } else {
      dom.toggleCameraButtonElement.classList.add('disabled');
      dom.toggleCameraButtonElement.classList.remove('enabled');
    }

    if (isMicEnabled) {
      dom.toggleMicButtonElement.classList.add('enabled');
      dom.toggleMicButtonElement.classList.remove('disabled');
    } else {
      dom.toggleMicButtonElement.classList.add('disabled');
      dom.toggleMicButtonElement.classList.remove('enabled');
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
    const errorMessage = error instanceof Error ? error.message : String(error);

    // eslint-disable-next-line no-console
    console.error('Ошибка:', errorMessage);

    // Можно добавить отображение ошибки пользователю
    alert(`Ошибка: ${errorMessage}`);

    this.callStateManager.reset();
    this.loaderManager.hide();
  }
}

export default App;
