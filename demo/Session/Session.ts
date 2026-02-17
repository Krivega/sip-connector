import ParticipantRoleManager from './ParticipantRoleManager';
import RecvQualityManager from './RecvQualityManager';
import resolveServerParametersRequester from './resolveServerParametersRequester';
import sipConnectorFacade from './sipConnectorFacade';
import UseLicenseManager from './UseLicenseManager';

import type { TRemoteStreams } from '@/index';
import type {
  IParams as IServerParametersRequesterParams,
  IServerParametersRequester,
} from './resolveServerParametersRequester';

class Session {
  private readonly serverParametersRequester: IServerParametersRequester;

  private readonly participantRoleManager: ParticipantRoleManager;

  private readonly useLicenseManager: UseLicenseManager;

  private readonly recvQualityManager: RecvQualityManager;

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

  public async startCall({
    serverUrl,
    isRegistered,
    displayName,
    user,
    password,
    conference,
    mediaStream,
    setRemoteStreams,
  }: {
    serverUrl: string;
    isRegistered: boolean;
    displayName: string;
    user: string;
    password: string;
    conference: string;
    mediaStream: MediaStream;
    setRemoteStreams: (streams: TRemoteStreams) => void;
  }): Promise<void> {
    const serverParameters = await this.serverParametersRequester.request({
      serverUrl,
      isRegistered,
    });

    // Подписываемся на события изменения роли участника
    this.participantRoleManager.subscribe();

    // Подписываемся на события изменения лицензии
    this.useLicenseManager.subscribe();

    // Подписываемся на изменение качества приема
    this.recvQualityManager.subscribe();

    await sipConnectorFacade.connectToServer({
      displayName,
      user,
      password,
      register: isRegistered,
      sipServerIp: serverParameters.serverIp,
      sipServerUrl: serverParameters.sipServerUrl,
      remoteAddress: serverParameters.remoteAddress,
      userAgent: serverParameters.userAgent,
    });

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

  public async stopCall(): Promise<void> {
    this.unsubscribeChangeRemoteStreams?.();
    this.unsubscribeChangeRemoteStreams = undefined;
    this.participantRoleManager.unsubscribe();
    this.participantRoleManager.reset();

    this.useLicenseManager.unsubscribe();
    this.useLicenseManager.reset();
    this.recvQualityManager.unsubscribe();
    this.recvQualityManager.reset();
    await sipConnectorFacade.disconnectFromServer();
  }
}

export default Session;
