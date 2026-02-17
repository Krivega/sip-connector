import { EContentTypeReceived, EKeyHeader } from './constants';

import type { EndEvent, IncomingRequest, IncomingResponse, RTCSession } from '@krivega/jssip';
import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { TOptionsExtraHeaders } from './types';

class PeerToPeerManager {
  private connectionManager?: ConnectionManager;

  private callManager?: CallManager;

  private get user(): string | undefined {
    return this.connectionManager?.user;
  }

  private get number(): string | undefined {
    return this.callManager?.number;
  }

  private get displayName(): string | undefined {
    return this.connectionManager?.displayName;
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

  private static createSyntheticLocalEndEvent(error: unknown): EndEvent {
    return {
      originator: 'local',
      cause: error instanceof Error ? error.message : String(error),
      message: {} as IncomingRequest | IncomingResponse,
    };
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
    if (this.peerToPeerRoom === undefined || this.displayName === undefined) {
      return;
    }

    this.sendEnterRoom(this.peerToPeerRoom, this.displayName).catch((error: unknown) => {
      this.callManager?.events.trigger(
        'failed',
        PeerToPeerManager.createSyntheticLocalEndEvent(error),
      );
    });
  }

  private async sendEnterRoom(room: string, participantName: string): Promise<void> {
    const rtcSession = this.getEstablishedRTCSessionProtected();
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [
      `${EKeyHeader.CONTENT_ENTER_ROOM}: ${room}`,
      `${EKeyHeader.PARTICIPANT_NAME}: ${participantName}`,
    ];

    return rtcSession.sendInfo(EContentTypeReceived.ENTER_ROOM, undefined, { extraHeaders });
  }

  private getEstablishedRTCSessionProtected(): RTCSession {
    const rtcSession = this.callManager?.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    return rtcSession;
  }
}

export default PeerToPeerManager;
