/* eslint-disable unicorn/filename-case */
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { RTCPeerConnectionDeprecated } from '@krivega/jssip';
import type { MediaStreamTrackMock } from 'webrtc-mock';
import RTCRtpSenderMock from './RTCRtpSenderMock';

class RTCPeerConnectionMock implements RTCPeerConnectionDeprecated {
  public senders: RTCRtpSender[] = [];

  public receivers: RTCRtpReceiver[] = [];

  public canTrickleIceCandidates!: boolean | null;

  public connectionState!: RTCPeerConnectionState;

  public currentLocalDescription!: RTCSessionDescription | null;

  public currentRemoteDescription!: RTCSessionDescription | null;

  public iceConnectionState!: RTCIceConnectionState;

  public iceGatheringState!: RTCIceGatheringState;

  public idpErrorInfo!: string | null;

  public idpLoginUrl!: string | null;

  public localDescription!: RTCSessionDescription | null;

  public onconnectionstatechange!: ((this: RTCPeerConnection, event_: Event) => unknown) | null;

  public ondatachannel!: ((this: RTCPeerConnection, event_: RTCDataChannelEvent) => unknown) | null;

  public onicecandidate!:
    | ((this: RTCPeerConnection, event_: RTCPeerConnectionIceEvent) => unknown)
    | null;

  // eslint-disable-next-line unicorn/no-null
  public onicecandidateerror: ((this: RTCPeerConnection, event_: Event) => unknown) | null = null;

  public oniceconnectionstatechange!: ((this: RTCPeerConnection, event_: Event) => unknown) | null;

  public onicegatheringstatechange!: ((this: RTCPeerConnection, event_: Event) => unknown) | null;

  public onnegotiationneeded!: ((this: RTCPeerConnection, event_: Event) => unknown) | null;

  public onsignalingstatechange!: ((this: RTCPeerConnection, event_: Event) => unknown) | null;

  public ontrack!: ((this: RTCPeerConnection, event_: RTCTrackEvent) => unknown) | null;

  public peerIdentity = undefined;

  public pendingLocalDescription!: RTCSessionDescription | null;

  public pendingRemoteDescription!: RTCSessionDescription | null;

  public remoteDescription!: RTCSessionDescription | null;

  // eslint-disable-next-line unicorn/no-null
  public sctp = null;

  public signalingState!: RTCSignalingState;

  public constructor(
    // eslint-disable-next-line @typescript-eslint/default-param-last
    _configuration?: RTCConfiguration,
    // @ts-expect-error
    tracks: MediaStreamTrackMock[],
  ) {
    this.receivers = tracks.map((track) => {
      return { track } as unknown as RTCRtpReceiver;
    });
  }

  public getRemoteStreams(): MediaStream[] {
    throw new Error('Method not implemented.');
  }

  public async addIceCandidate(_candidate: RTCIceCandidate | RTCIceCandidateInit): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public addTransceiver(
    _trackOrKind: MediaStreamTrack | string,
    _init?: RTCRtpTransceiverInit,
  ): RTCRtpTransceiver {
    throw new Error('Method not implemented.');
  }

  public close(): void {
    throw new Error('Method not implemented.');
  }

  public restartIce(): void {
    throw new Error('Method not implemented.');
  }

  public createAnswer(options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit>;
  public createAnswer(
    successCallback: RTCSessionDescriptionCallback,
    failureCallback: RTCPeerConnectionErrorCallback,
  ): Promise<void>;
  public async createAnswer(
    _successCallback?: unknown,
    _failureCallback?: unknown,
  ): Promise<RTCSessionDescriptionInit | void> {
    throw new Error('Method not implemented.');
  }

  public createDataChannel(_label: string, _dataChannelDict?: RTCDataChannelInit): RTCDataChannel {
    throw new Error('Method not implemented.');
  }

  public createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit>;
  public createOffer(
    successCallback: RTCSessionDescriptionCallback,
    failureCallback: RTCPeerConnectionErrorCallback,
    options?: RTCOfferOptions,
  ): Promise<void>;
  public async createOffer(
    _successCallback?: unknown,
    _failureCallback?: unknown,
    _options?: unknown,
  ): Promise<RTCSessionDescriptionInit | void> {
    throw new Error('Method not implemented.');
  }

  public getConfiguration(): RTCConfiguration {
    throw new Error('Method not implemented.');
  }

  public async getIdentityAssertion(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  public async getStats(_selector?: MediaStreamTrack | null): Promise<RTCStatsReport> {
    throw new Error('Method not implemented.');
  }

  public getTransceivers(): RTCRtpTransceiver[] {
    throw new Error('Method not implemented.');
  }

  public removeTrack(_sender: RTCRtpSender): void {
    throw new Error('Method not implemented.');
  }

  public setConfiguration(_configuration: RTCConfiguration): void {
    throw new Error('Method not implemented.');
  }

  public async setLocalDescription(_description: RTCSessionDescriptionInit): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async setRemoteDescription(_description: RTCSessionDescriptionInit): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public addEventListener<K extends keyof RTCPeerConnectionEventMap>(
    type: K,
    listener: (this: RTCPeerConnection, event_: RTCPeerConnectionEventMap[K]) => unknown,
    options?: AddEventListenerOptions | boolean,
  ): void;
  public addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void;
  public addEventListener(_type: unknown, _listener: unknown, _options?: unknown) {
    // eslint-disable-next-line no-console
    console.warn('Method not implemented. Type:', _type);
  }

  public removeEventListener<K extends keyof RTCPeerConnectionEventMap>(
    type: K,
    listener: (this: RTCPeerConnection, event_: RTCPeerConnectionEventMap[K]) => unknown,
    options?: EventListenerOptions | boolean,
  ): void;
  public removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: EventListenerOptions | boolean,
  ): void;
  public removeEventListener(_type: unknown, _listener: unknown, _options?: unknown) {
    // eslint-disable-next-line no-console
    console.warn('Method not implemented. Type:', _type);
  }

  public dispatchEvent(_event: Event): boolean {
    throw new Error('Method not implemented.');
  }

  public getReceivers = (): RTCRtpReceiver[] => {
    return this.receivers;
  };

  public getSenders = (): RTCRtpSender[] => {
    return this.senders;
  };

  public addTrack = (track: MediaStreamTrack) => {
    const sender = new RTCRtpSenderMock({ track });

    this.senders.push(sender);

    return sender;
  };
}

export default RTCPeerConnectionMock;
