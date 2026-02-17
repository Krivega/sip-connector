import { EKeyHeader } from '@/ApiManager';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

class PeerToPeerManager {
  private connectionManager?: ConnectionManager;

  private callManager?: CallManager;

  private get user(): string | undefined {
    try {
      const ua = this.connectionManager?.getUaProtected();

      return ua?.configuration.uri.user;
    } catch {
      return undefined;
    }
  }

  private get number(): string | undefined {
    return this.callManager?.number;
  }

  private get isCallInitiator(): boolean {
    return Boolean(this.callManager?.isCallInitiator);
  }

  private get isCallAnswerer(): boolean {
    return Boolean(this.callManager?.isCallAnswerer);
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

    callManager.on('accepted', this.handleAccepted);
    callManager.on('confirmed', this.handleConfirmed);
  }

  private readonly handleAccepted = (): void => {
    if (this.isCallInitiator) {
      this.maybeSendDirectPeerToPeerRoom();
    }
  };

  private readonly handleConfirmed = (): void => {
    if (this.isCallAnswerer) {
      this.maybeSendDirectPeerToPeerRoom();
    }
  };

  private maybeSendDirectPeerToPeerRoom(): void {
    if (this.peerToPeerRoom === undefined || this.user === undefined) {
      return;
    }

    const extraHeaders: string[] = [
      `${EKeyHeader.CONTENT_ENTER_ROOM}: ${this.peerToPeerRoom}`,
      `${EKeyHeader.PARTICIPANT_NAME}: ${this.user}`,
      `${EKeyHeader.IS_DIRECT_PEER_TO_PEER}: true`,
    ];

    this.callManager?.sendEnterRoom(extraHeaders);
  }
}

export default PeerToPeerManager;
