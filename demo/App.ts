/* eslint-disable no-alert */
import CallStateManager, { type TCallState } from './CallStateManager';
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

  private readonly callButton: HTMLButtonElement;

  private readonly endCallButton: HTMLButtonElement;

  private readonly localVideoSection: HTMLElement;

  private readonly remoteStreamsSection: HTMLElement;

  private session: Session | undefined = undefined;

  /**
   * Создает экземпляр App
   */
  public constructor() {
    this.formStateManager = new FormStateManager('callForm');
    this.localMediaStreamManager = new LocalMediaStreamManager();
    this.remoteMediaStreamManager = new RemoteMediaStreamManager('remoteStreamsContainer');
    this.loaderManager = new LoaderManager('loaderOverlay');
    this.callStateManager = new CallStateManager();

    const callButtonElement = document.querySelector('#callButton');

    if (!callButtonElement || !(callButtonElement instanceof HTMLButtonElement)) {
      throw new Error('Call button not found');
    }

    this.callButton = callButtonElement;

    const endCallButtonElement = document.querySelector('#endCallButton');

    if (!endCallButtonElement || !(endCallButtonElement instanceof HTMLButtonElement)) {
      throw new Error('End call button not found');
    }

    this.endCallButton = endCallButtonElement;

    const localVideoSectionElement = document.querySelector('#localVideoSection');

    if (!localVideoSectionElement || !(localVideoSectionElement instanceof HTMLElement)) {
      throw new Error('Local video section not found');
    }

    this.localVideoSection = localVideoSectionElement;

    const remoteStreamsSectionElement = document.querySelector('#remoteStreamsSection');

    if (!remoteStreamsSectionElement || !(remoteStreamsSectionElement instanceof HTMLElement)) {
      throw new Error('Remote streams section not found');
    }

    this.remoteStreamsSection = remoteStreamsSectionElement;

    this.initialize();
  }

  /**
   * Инициализирует приложение
   */
  private initialize(): void {
    const localVideoElement = document.querySelector<HTMLVideoElement>('#localVideo');

    if (!localVideoElement) {
      throw new Error('Local video element not found');
    }

    // Подключаем видео-плеер к локальному медиа-менеджеру
    const localVideoPlayer = new VideoPlayer(localVideoElement);

    this.localMediaStreamManager.setVideoPlayer(localVideoPlayer);

    // Подписываемся на отправку формы по Enter
    this.formStateManager.onSubmit((_state, event) => {
      event.preventDefault();
      this.handleFormSubmit();
    });

    // Подписываемся на кнопку "Позвонить"
    this.callButton.addEventListener('click', () => {
      this.handleFormSubmit();
    });

    // Подписываемся на изменения состояния звонка
    this.callStateManager.onChange((state) => {
      this.handleCallStateChange(state);
    });

    // Подписываемся на кнопку завершения звонка
    this.endCallButton.addEventListener('click', () => {
      this.handleEndCall();
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
      });

      this.callStateManager.setState('active');
      this.loaderManager.hide();
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
    this.callButton.disabled = state !== 'idle';
    this.endCallButton.disabled = state !== 'active';

    if (state === 'active') {
      this.callButton.style.display = 'none';
      this.endCallButton.style.display = '';
    } else {
      this.callButton.style.display = '';
      this.endCallButton.style.display = 'none';
    }

    // Показываем/скрываем секции в зависимости от состояния
    // Локальное видео показываем когда идет процесс
    const shouldShowLocalVideo =
      state === 'initializing' ||
      state === 'connecting' ||
      state === 'calling' ||
      state === 'active';

    this.localVideoSection.style.display = shouldShowLocalVideo ? '' : 'none';

    // Удаленные потоки показываем только когда звонок активен
    this.remoteStreamsSection.style.display = state === 'active' ? '' : 'none';
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
