type TConferenceNumber = string;

type TSendOfferParams = {
  quality: 'low' | 'medium' | 'high';
  audioChannel: string;
};

type TConfig = Pick<TSendOfferParams, 'quality' | 'audioChannel'> & {
  pcConfig?: RTCConfiguration;
};

export type TTools = {
  sendOffer: (
    params: TSendOfferParams & { conferenceNumber: TConferenceNumber },
    offer: RTCSessionDescriptionInit,
  ) => Promise<RTCSessionDescription>;
};

class RecvSession {
  private readonly config: TConfig;

  private readonly tools: TTools;

  private readonly connection: RTCPeerConnection;

  private conferenceNumber: TConferenceNumber | undefined = undefined;

  public constructor(config: TConfig, tools: TTools) {
    this.config = config;
    this.tools = tools;
    this.connection = new RTCPeerConnection(config.pcConfig);
    this.addTransceivers();
  }

  public get settings(): TConfig {
    return this.config;
  }

  public get peerConnection(): RTCPeerConnection {
    return this.connection;
  }

  public close(): void {
    this.resetConferenceNumber();
    this.connection.close();
  }

  public async renegotiate() {
    if (this.conferenceNumber === undefined) {
      throw new Error('Conference number is not defined');
    }

    return this.negotiate(this.conferenceNumber);
  }

  public async call(conferenceNumber: TConferenceNumber): Promise<void> {
    const tracksPromise = this.waitForTracks();

    await this.negotiate(conferenceNumber);

    this.setConferenceNumber(conferenceNumber);

    await tracksPromise;
  }

  private async negotiate(conferenceNumber: TConferenceNumber): Promise<boolean> {
    const offer = await this.createOffer();
    const answer = await this.tools.sendOffer(
      { conferenceNumber, quality: this.config.quality, audioChannel: this.config.audioChannel },
      offer,
    );

    await this.setRemoteDescription(answer);

    return true;
  }

  private setConferenceNumber(conferenceNumber: TConferenceNumber) {
    this.conferenceNumber = conferenceNumber;
  }

  private resetConferenceNumber() {
    this.conferenceNumber = undefined;
  }

  private async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.connection.createOffer();

    await this.connection.setLocalDescription(offer);

    return offer;
  }

  private async setRemoteDescription(description: RTCSessionDescription): Promise<void> {
    return this.connection.setRemoteDescription(description);
  }

  private async waitForTracks(): Promise<void> {
    return new Promise<void>((resolve) => {
      const receivedTracks = new Set<'audio' | 'video'>();
      const handler = (event: RTCTrackEvent): void => {
        const { track } = event;

        receivedTracks.add(track.kind as 'audio');

        if (receivedTracks.has('audio') && receivedTracks.has('video')) {
          this.connection.removeEventListener('track', handler);
          resolve();
        }
      };

      this.connection.addEventListener('track', handler);
    });
  }

  private addTransceivers(): void {
    this.addRecvOnlyTransceiver('audio'); // main
    this.addRecvOnlyTransceiver('video'); // main
    this.addRecvOnlyTransceiver('video'); // contented
    this.addRecvOnlyTransceiver('video'); // contented
    this.addRecvOnlyTransceiver('video'); // contented
  }

  private addRecvOnlyTransceiver(kind: 'audio' | 'video'): RTCRtpTransceiver {
    const init: RTCRtpTransceiverInit = {
      direction: 'recvonly',
    };

    return this.connection.addTransceiver(kind, init);
  }
}

export default RecvSession;
