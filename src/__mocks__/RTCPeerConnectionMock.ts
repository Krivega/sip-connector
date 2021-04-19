class RTCPeerConnectionMock {
  _senders: any[] = [];

  _receivers: any[] = [];

  constructor(tracks) {
    this._receivers = tracks.map((track) => {
      return { track };
    });
  }

  getReceivers = () => {
    return this._receivers;
  };

  getSenders = () => {
    return this._senders;
  };

  addTrack = (track: MediaStreamTrack) => {
    const sender = { track };

    this._senders.push(sender);

    return sender;
  };
}

export default RTCPeerConnectionMock;
