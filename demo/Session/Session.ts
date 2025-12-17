import ParticipantRoleManager, { type TParticipantRole } from './ParticipantRoleManager';
import resolveServerParametersRequester from './resolveServerParametersRequester';
import sipConnectorFacade from './sipConnectorFacade';

import type {
  IParams as IServerParametersRequesterParams,
  IServerParametersRequester,
} from './resolveServerParametersRequester';

class Session {
  private readonly serverParametersRequester: IServerParametersRequester;

  private readonly participantRoleManager: ParticipantRoleManager;

  public constructor({
    serverParametersRequesterParams,
  }: {
    serverParametersRequesterParams: IServerParametersRequesterParams;
  }) {
    this.serverParametersRequester = resolveServerParametersRequester(
      serverParametersRequesterParams,
    );
    this.participantRoleManager = new ParticipantRoleManager();
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
    }); // Подписываемся на события изменения роли участника

    this.participantRoleManager.subscribe();

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

    await sipConnectorFacade.disconnectFromServer();
  }

  public getParticipantRole(): TParticipantRole {
    return this.participantRoleManager.getRole();
  }

  public getParticipantRoleManager(): ParticipantRoleManager {
    return this.participantRoleManager;
  }
}

export default Session;
