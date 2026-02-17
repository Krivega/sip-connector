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
      this.maybeSendPeerToPeerRoom();
    }
  };

  private readonly handleConfirmed = (): void => {
    if (this.isCallAnswerer) {
      this.maybeSendPeerToPeerRoom();
    }
  };

  private maybeSendPeerToPeerRoom(): void {
    if (this.peerToPeerRoom === undefined || this.user === undefined) {
      return;
    }

    this.callManager?.sendEnterRoom(this.peerToPeerRoom, this.user);
  }
}

export default PeerToPeerManager;
