import { repeatedCallsAsync } from 'repeated-calls';

type TConferenceNumber = string;

const SEND_OFFER_CALL_LIMIT = 10;
const SEND_OFFER_DELAY_BETWEEN_CALLS = 100;

type TSendOfferParams = {
  quality: 'low' | 'medium' | 'high';
  audioChannel: string;
};

type TConfig = Pick<TSendOfferParams, 'quality' | 'audioChannel'> & {
  pcConfig?: RTCConfiguration;
};

export type TTools = {
  sendOffer: (
    params: TSendOfferParams & { conferenceNumber: TConferenceNumber; token: string },
    offer: RTCSessionDescriptionInit,
  ) => Promise<RTCSessionDescription>;
};

class RecvSession {
  private cancelableSendOfferWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<RTCSessionDescription, Error, false>>
    | undefined;

  private readonly config: TConfig;

  private readonly tools: TTools;

  private readonly connection: RTCPeerConnection;

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
    this.cancelSendOfferWithRepeatedCalls();
    this.connection.close();
  }

  public async call({
    conferenceNumber,
    token,
  }: {
    conferenceNumber: TConferenceNumber;
    token: string;
  }): Promise<void> {
    const tracksPromise = this.waitForTracks();

    await this.renegotiate({ conferenceNumber, token });

    await tracksPromise;
  }

  public async renegotiate({
    conferenceNumber,
    token,
  }: {
    conferenceNumber: TConferenceNumber;
    token: string;
  }): Promise<boolean> {
    const offer = await this.createOffer();

    const targetFunction = async (): Promise<RTCSessionDescription> => {
      return this.tools.sendOffer(
        {
          conferenceNumber,
          token,
          quality: this.config.quality,
          audioChannel: this.config.audioChannel,
        },
        offer,
      );
    };

    const isComplete = (response: RTCSessionDescription | Error): boolean => {
      return !(response instanceof Error);
    };

    this.cancelableSendOfferWithRepeatedCalls = repeatedCallsAsync<
      RTCSessionDescription,
      Error,
      false
    >({
      targetFunction,
      isComplete,
      callLimit: SEND_OFFER_CALL_LIMIT,
      delay: SEND_OFFER_DELAY_BETWEEN_CALLS,
      isRejectAsValid: true,
      isCheckBeforeCall: false,
    });

    const result = await this.cancelableSendOfferWithRepeatedCalls
      .then((response) => {
        return response as RTCSessionDescription;
      })
      .finally(() => {
        this.cancelableSendOfferWithRepeatedCalls = undefined;
      });

    await this.setRemoteDescription(result);

    return true;
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

  private cancelSendOfferWithRepeatedCalls(): void {
    this.cancelableSendOfferWithRepeatedCalls?.cancel();
  }
}

export default RecvSession;
