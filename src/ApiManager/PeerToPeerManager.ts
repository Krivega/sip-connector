import { EKeyHeader } from '@/ApiManager';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

class PeerToPeerManager {
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
    connectionManager,
    callManager,
  }: {
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }): void {
    this.connectionManager = connectionManager;
    this.callManager = callManager;

    callManager.on('confirmed', this.maybeSendDirectPeerToPeerRoom);
  }

  private readonly maybeSendDirectPeerToPeerRoom = () => {
    if (this.peerToPeerRoom === undefined || this.user === undefined) {
      return;
    }

    const extraHeaders: string[] = [
      `${EKeyHeader.CONTENT_ENTER_ROOM}: ${this.peerToPeerRoom}`,
      `${EKeyHeader.PARTICIPANT_NAME}: ${this.number}`,
      `${EKeyHeader.IS_DIRECT_PEER_TO_PEER}: true`,
    ];

    this.callManager?.sendEnterRoom(extraHeaders);
  };
}

export default PeerToPeerManager;
