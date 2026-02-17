import { EKeyHeader } from '@/ApiManager';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

class PeerToPeerManager {
  private apiManager?: ApiManager;

  private connectionManager?: ConnectionManager;

  private callManager?: CallManager;

  private get user(): string | undefined {
    return this.connectionManager?.getUser();
  }

  private get number(): string | undefined {
    return this.callManager?.number;
  }

  private get isCallInitiator(): boolean {
    return Boolean(this.callManager?.isCallInitiator);
  }

  private get peerToPeerRoom(): string | undefined {
    if (this.user === undefined || this.number === undefined) {
      return undefined;
    }

    if (this.isCallInitiator) {
      return `p2p${this.user}to${this.number}`;
    }

    return `p2p${this.number}to${this.user}`;
  }

  public subscribe({
    apiManager,
    connectionManager,
    callManager,
  }: {
    apiManager: ApiManager;
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }): void {
    this.apiManager = apiManager;
    this.connectionManager = connectionManager;
    this.callManager = callManager;

    callManager.on('confirmed', this.maybeSendDirectPeerToPeerRoom);
  }

  private readonly maybeSendDirectPeerToPeerRoom = () => {
    const { peerToPeerRoom, number, apiManager } = this;

    if (peerToPeerRoom === undefined || number === undefined || apiManager === undefined) {
      return;
    }

    const extraHeaders: string[] = [
      `${EKeyHeader.CONTENT_ENTER_ROOM}: ${this.peerToPeerRoom}`,
      `${EKeyHeader.PARTICIPANT_NAME}: ${this.number}`,
      `${EKeyHeader.IS_DIRECT_PEER_TO_PEER}: true`,
    ];

    apiManager.sendEnterRoom(extraHeaders);
  };
}

export default PeerToPeerManager;
