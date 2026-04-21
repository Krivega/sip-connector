import resolveDebug from '../logger';
import RecvQualityManager from './RecvQualityManager';
import resolveServerParametersRequester from './resolveServerParametersRequester';
import sipConnectorFacade from './sipConnectorFacade';

import type { TRemoteStreams } from '@/index';
import type {
  IParams as IServerParametersRequesterParams,
  IServerParametersRequester,
  IServerParameters,
} from './resolveServerParametersRequester';

const debug = resolveDebug('demo:session');

export class Session {
  private readonly serverParametersRequester: IServerParametersRequester;

  private readonly recvQualityManager: RecvQualityManager;

  private serverParameters: IServerParameters | undefined;

  private unsubscribeChangeRemoteStreams?: () => void;

  public constructor({
    serverParametersRequesterParams,
  }: {
    serverParametersRequesterParams: IServerParametersRequesterParams;
  }) {
    this.serverParametersRequester = resolveServerParametersRequester(
      serverParametersRequesterParams,
    );
    this.recvQualityManager = new RecvQualityManager();
  }

  public hasConnected(): boolean {
    return this.serverParameters !== undefined;
  }

  public async connect({
    serverUrl,
    isRegistered,
    displayName,
    user,
    password,
  }: {
    serverUrl: string;
    isRegistered: boolean;
    displayName: string;
    user: string;
    password: string;
  }): Promise<void> {
    debug('connect', { serverUrl, isRegistered, displayName, user, password });

    sipConnectorFacade.startAutoConnect({
      getParameters: async () => {
        const serverParameters = await this.serverParametersRequester.request({
          serverUrl,
          isRegistered,
        });

        debug('serverParameters', serverParameters);

        this.serverParameters = serverParameters;

        return {
          displayName,
          user,
          password,
          register: isRegistered,
          sipServerIp: serverParameters.serverIp,
          sipServerUrl: serverParameters.sipServerUrl,
          remoteAddress: serverParameters.remoteAddress,
          iceServers: serverParameters.iceServers,
          userAgent: serverParameters.userAgent,
        };
      },
    });
  }

  public async callToServer({
    conference,
    mediaStream,
    autoRedial,
    setRemoteStreams,
  }: {
    conference: string;
    mediaStream: MediaStream;
    autoRedial?: boolean;
    setRemoteStreams: (streams: TRemoteStreams) => void;
  }): Promise<void> {
    const { serverParameters } = this;

    debug('callToServer', { conference, mediaStream, serverParameters });

    if (serverParameters === undefined || !sipConnectorFacade.isConfigured()) {
      throw new Error('Server parameters are not initialized. Call connect() first.');
    }

    // Подписываемся на изменение качества приема
    this.recvQualityManager.subscribe();

    this.unsubscribeChangeRemoteStreams = sipConnectorFacade.on(
      'call:remote-streams-changed',
      (event) => {
        setRemoteStreams(event.streams);
      },
    );

    await sipConnectorFacade.callToServer({
      conference,
      mediaStream,
      autoRedial: autoRedial ?? true,
      extraHeaders: serverParameters.extraHeaders,
      iceServers: serverParameters.iceServers,
    });
  }

  public async disconnectFromServer(): Promise<void> {
    sipConnectorFacade.stopAutoConnect();
    await sipConnectorFacade.disconnectFromServer();
    this.serverParameters = undefined;
  }

  public async stopCall(): Promise<void> {
    this.unsubscribeChangeRemoteStreams?.();
    this.unsubscribeChangeRemoteStreams = undefined;
    this.recvQualityManager.unsubscribe();
    this.recvQualityManager.reset();
    await this.disconnectFromServer();
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public async sendMediaState({
    isEnabledCam,
    isEnabledMic,
  }: {
    isEnabledCam: boolean;
    isEnabledMic: boolean;
  }) {
    debug('sendMediaState', { isEnabledCam, isEnabledMic });

    return sipConnectorFacade.sendMediaState({ isEnabledCam, isEnabledMic });
  }
}
