import ParticipantRoleManager from './ParticipantRoleManager';
import resolveServerParametersRequester from './resolveServerParametersRequester';
import sipConnectorFacade from './sipConnectorFacade';
import UseLicenseManager from './UseLicenseManager';
import { sessionSelectors } from '../../src';

import type {
  IParams as IServerParametersRequesterParams,
  IServerParametersRequester,
} from './resolveServerParametersRequester';
import type { TSessionSnapshot } from '../../src';

class Session {
  private readonly serverParametersRequester: IServerParametersRequester;

  private readonly participantRoleManager: ParticipantRoleManager;

  private readonly useLicenseManager: UseLicenseManager;

  private unsubscribeChangeRemoteStreams?: () => void;

  private unsubscribeSessionStatuses?: () => void;

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
    onStatusesChange,
  }: {
    serverUrl: string;
    isRegistered: boolean;
    displayName: string;
    user: string;
    password: string;
    conference: string;
    mediaStream: MediaStream;
    setRemoteStreams: (streams: MediaStream[]) => void;
    onStatusesChange: (params: {
      connection: string;
      call: string;
      incoming: string;
      screenShare: string;
    }) => void;
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
      sipServerIp: serverParameters.serverIp,
      sipServerUrl: serverParameters.sipServerUrl,
      remoteAddress: serverParameters.remoteAddress,
      userAgent: serverParameters.userAgent,
      extraHeaders: serverParameters.extraHeaders,
    });

    this.unsubscribeChangeRemoteStreams = sipConnectorFacade.on(
      'call:remote-streams-changed',
      (event) => {
        setRemoteStreams(event.streams);
      },
    );

    this.subscribeSessionStatuses((snapshot) => {
      onStatusesChange({
        connection: sessionSelectors.selectConnectionStatus(snapshot),
        call: sessionSelectors.selectCallStatus(snapshot),
        incoming: sessionSelectors.selectIncomingStatus(snapshot),
        screenShare: sessionSelectors.selectScreenShareStatus(snapshot),
      });
    });

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
    this.unsubscribeSessionStatuses?.();
    this.unsubscribeSessionStatuses = undefined;
    this.participantRoleManager.unsubscribe();
    this.participantRoleManager.reset();

    this.useLicenseManager.unsubscribe();
    this.useLicenseManager.reset();

    await sipConnectorFacade.disconnectFromServer();
  }

  private subscribeSessionStatuses(onSnapshot: (snapshot: TSessionSnapshot) => void) {
    this.unsubscribeSessionStatuses?.();

    const { session } = sipConnectorFacade.sipConnector;

    onSnapshot(session.actor.getSnapshot());
    this.unsubscribeSessionStatuses = session.subscribe(onSnapshot);
  }
}

export default Session;
