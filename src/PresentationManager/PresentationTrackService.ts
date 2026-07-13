import {
  addVideoTrackInTransceiver,
  addVideoTrackInSender,
  hasRecvOnlyTransceiver,
  replaceTrack,
  findSenderByTrack,
} from '@/utils/peerConnection';

import type { TTransceiverOptions } from '@/utils/peerConnection';

class PresentationTrackService {
  private readonly senders = new Set<RTCRtpSender>();

  public async addOrReplace(
    connection: RTCPeerConnection,
    videoTrack: MediaStreamVideoTrack,
    options: TTransceiverOptions = {},
  ): Promise<void> {
    const presentationSenders = this.getFromConnection(connection);

    if (presentationSenders.length > 0) {
      const [sender] = presentationSenders;

      await replaceTrack(sender, videoTrack, options);

      return;
    }

    if (hasRecvOnlyTransceiver(connection)) {
      await addVideoTrackInSender(connection, videoTrack, options);
    } else {
      await addVideoTrackInTransceiver(connection, videoTrack, options);
    }

    this.markTrack(connection, videoTrack);
  }

  public stop(connection: RTCPeerConnection): void {
    connection.getSenders().forEach((sender) => {
      if (sender.track !== null && this.senders.has(sender)) {
        sender.track.stop();
      }
    });
  }

  public clear(): void {
    this.senders.clear();
  }

  private getFromConnection(connection: RTCPeerConnection): RTCRtpSender[] {
    return connection.getSenders().filter((sender) => {
      return this.senders.has(sender);
    });
  }

  private markTrack(connection: RTCPeerConnection, videoTrack: MediaStreamVideoTrack): void {
    const sender = findSenderByTrack(connection, videoTrack);

    if (sender !== undefined) {
      this.senders.add(sender);
    }
  }
}

export default PresentationTrackService;
