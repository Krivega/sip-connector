import type { TRemoteStreams } from '@/index';
import type { TDemoCallFlowPorts, TDemoCallFlowSession } from './DemoCallFlowPorts';
import type { IFormState } from '../state/FormState';

/**
 * Сценарии подключения и звонка демо: состояние сессии и координация портов (loader / media / factory).
 */
export class DemoCallFlowService {
  private readonly loader: TDemoCallFlowPorts['loader'];

  private readonly sessionFactory: TDemoCallFlowPorts['sessionFactory'];

  private readonly media: TDemoCallFlowPorts['media'];

  private session: TDemoCallFlowSession | undefined = undefined;

  public constructor({ loader, sessionFactory, media }: TDemoCallFlowPorts) {
    this.loader = loader;
    this.sessionFactory = sessionFactory;
    this.media = media;
  }

  public hasConnected(): boolean {
    return this.session?.hasConnected() === true;
  }

  public getSession(): TDemoCallFlowSession | undefined {
    return this.session;
  }

  public async connect(state: IFormState): Promise<void> {
    try {
      this.loader.setMessage('Подключение к серверу...');

      this.session = this.sessionFactory.createSession();

      await this.session.connect({
        serverUrl: state.serverAddress,
        isRegistered: state.authEnabled,
        displayName: state.displayName,
        user: state.userNumber,
        password: state.password,
      });

      this.loader.hide();
    } catch (error) {
      this.loader.hide();
      throw error;
    }
  }

  public async callToServer(
    state: IFormState,
    setRemoteStreams: (streams: TRemoteStreams) => void,
  ): Promise<void> {
    const session = this.getConnectedSessionOrThrow();

    try {
      this.loader.show('Инициализация медиа...');
      await this.media.initialize();

      this.loader.setMessage('Установление звонка...');

      const mediaStream = this.media.getStream();

      if (!mediaStream) {
        throw new Error('MediaStream не инициализирован');
      }

      await session.callToServer({
        mediaStream,
        conference: state.conferenceNumber,
        autoRedial: state.autoRedialEnabled,
        setRemoteStreams,
      });

      this.loader.hide();
    } catch (error) {
      this.loader.hide();
      throw error;
    }
  }

  public async disconnectFromServer(): Promise<void> {
    const { session } = this;

    if (session === undefined) {
      return;
    }

    await session.disconnectFromServer();
    this.session = undefined;
  }

  public async hangUpCall(): Promise<void> {
    if (this.session === undefined) {
      return;
    }

    await this.session.hangUpCall();
  }

  public async stopCall(): Promise<void> {
    if (this.session === undefined) {
      return;
    }

    await this.session.stopCall();
    this.session = undefined;
  }

  private getConnectedSessionOrThrow(): TDemoCallFlowSession {
    const { session } = this;

    if (!session) {
      throw new Error('Session is not initialized. Call connect() first.');
    }

    return session;
  }
}
