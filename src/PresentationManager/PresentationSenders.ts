class PresentationSenders {
  private readonly senders = new Set<RTCRtpSender>();

  public has(sender: RTCRtpSender): boolean {
    return this.senders.has(sender);
  }

  public clear(): void {
    this.senders.clear();
  }

  public getFromConnection(connection: RTCPeerConnection): RTCRtpSender[] {
    return connection.getSenders().filter((sender) => {
      return this.has(sender);
    });
  }

  public markTrack(connection: RTCPeerConnection, videoTrack: MediaStreamVideoTrack): void {
    const sender = connection.getSenders().find((itemSender) => {
      return itemSender.track === videoTrack;
    });

    if (sender !== undefined) {
      this.senders.add(sender);
    }
  }

  public stopTracks(connection: RTCPeerConnection): void {
    connection.getSenders().forEach((sender) => {
      if (sender.track !== null && this.has(sender)) {
        sender.track.stop();
      }
    });
  }
}

export default PresentationSenders;
