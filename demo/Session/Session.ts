import resolveServerParametersRequester from './resolveServerParametersRequester';
import sipConnectorFacade from './sipConnectorFacade';

import type {
  IParams as IServerParametersRequesterParams,
  IServerParametersRequester,
} from './resolveServerParametersRequester';

class Session {
  private readonly serverParametersRequester: IServerParametersRequester;

  public constructor({
    serverParametersRequesterParams,
  }: {
    serverParametersRequesterParams: IServerParametersRequesterParams;
  }) {
    this.serverParametersRequester = resolveServerParametersRequester(
      serverParametersRequesterParams,
    );
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

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public async stopCall(): Promise<void> {
    await sipConnectorFacade.disconnectFromServer();
  }
}

export default Session;
