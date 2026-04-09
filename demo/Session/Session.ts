import ParticipantRoleManager from './ParticipantRoleManager';
import RecvQualityManager from './RecvQualityManager';
import resolveServerParametersRequester from './resolveServerParametersRequester';
import sipConnectorFacade from './sipConnectorFacade';
import UseLicenseManager from './UseLicenseManager';

import type { TRemoteStreams } from '@/index';
import type { TParticipantRoleHandler } from './ParticipantRoleManager';
import type {
  IParams as IServerParametersRequesterParams,
  IServerParametersRequester,
  IServerParameters,
} from './resolveServerParametersRequester';

export class Session {
  private readonly serverParametersRequester: IServerParametersRequester;

  private readonly participantRoleManager: ParticipantRoleManager;

  private readonly useLicenseManager: UseLicenseManager;

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
    this.participantRoleManager = new ParticipantRoleManager();
    this.useLicenseManager = new UseLicenseManager();
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
    sipConnectorFacade.startAutoConnect({
      getParameters: async () => {
        const serverParameters = await this.serverParametersRequester.request({
          serverUrl,
          isRegistered,
        });

        this.serverParameters = serverParameters;

        return {
          displayName,
          user,
          password,
          register: isRegistered,
          sipServerIp: serverParameters.serverIp,
          sipServerUrl: serverParameters.sipServerUrl,
          remoteAddress: serverParameters.remoteAddress,
          userAgent: serverParameters.userAgent,
        };
      },
    });
  }

  public async callToServer({
    conference,
    mediaStream,
    setRemoteStreams,
  }: {
    conference: string;
    mediaStream: MediaStream;
    setRemoteStreams: (streams: TRemoteStreams) => void;
  }): Promise<void> {
    const { serverParameters } = this;

    if (serverParameters === undefined || !sipConnectorFacade.isConfigured()) {
      throw new Error('Server parameters are not initialized. Call connect() first.');
    }

    // Подписываемся на события изменения роли участника
    this.participantRoleManager.subscribe();

    // Подписываемся на события изменения лицензии
    this.useLicenseManager.subscribe();

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
    this.participantRoleManager.unsubscribe();
    this.participantRoleManager.reset();

    this.useLicenseManager.unsubscribe();
    this.useLicenseManager.reset();
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
    // eslint-disable-next-line no-console
    console.log('Session ~ sendMediaState:', {
      isEnabledCam,
      isEnabledMic,
    });

    return sipConnectorFacade.sendMediaState({ isEnabledCam, isEnabledMic });
  }

  public onChangeParticipantRole(callback: TParticipantRoleHandler) {
    this.participantRoleManager.onChange(callback);
  }
}
