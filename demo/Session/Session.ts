import ParticipantRoleManager from './ParticipantRoleManager';
import resolveServerParametersRequester from './resolveServerParametersRequester';
import sipConnectorFacade from './sipConnectorFacade';
import UseLicenseManager from './UseLicenseManager';

import type {
  IParams as IServerParametersRequesterParams,
  IServerParametersRequester,
} from './resolveServerParametersRequester';

class Session {
  private readonly serverParametersRequester: IServerParametersRequester;

  private readonly participantRoleManager: ParticipantRoleManager;

  private readonly useLicenseManager: UseLicenseManager;

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
    setRemoteStreams: (streams: MediaStream[]) => void;
  }): Promise<void> {
    const serverParameters = await this.serverParametersRequester.request({
      serverUrl,
      isRegistered,
    });

    // Подписываемся на события изменения роли участника
    this.participantRoleManager.subscribe();

    // Подписываемся на события изменения лицензии
    this.useLicenseManager.subscribe();

    await sipConnectorFacade.connectToServer({
      displayName,
      user,
      password,
      register: isRegistered,
      sipServerUrl: serverParameters.serverIp,
      sipWebSocketServerURL: serverParameters.sipWebSocketServerURL,
      remoteAddress: serverParameters.remoteAddress,
      userAgent: serverParameters.userAgent,
      extraHeaders: serverParameters.extraHeaders,
    });

    await sipConnectorFacade.callToServer({
      conference,
      mediaStream,
      setRemoteStreams,
      extraHeaders: serverParameters.extraHeaders,
      iceServers: serverParameters.iceServers,
    });
  }

  public async stopCall(): Promise<void> {
    this.participantRoleManager.unsubscribe();
    this.participantRoleManager.reset();

    this.useLicenseManager.unsubscribe();
    this.useLicenseManager.reset();

    await sipConnectorFacade.disconnectFromServer();
  }
}

export default Session;
