/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { RTCPeerConnectionDeprecated } from '@krivega/jssip';
import type { MediaStreamTrackMock } from 'webrtc-mock';
import RTCRtpSenderMock from './RTCRtpSenderMock';

class RTCPeerConnectionMock implements RTCPeerConnectionDeprecated {
  senders: RTCRtpSender[] = [];

  receivers: RTCRtpReceiver[] = [];

  constructor(
    // eslint-disable-next-line @typescript-eslint/default-param-last
    _configuration?: RTCConfiguration,
    // @ts-expect-error
    tracks: MediaStreamTrackMock[],
  ) {
    this.receivers = tracks.map((track) => {
      return { track } as unknown as RTCRtpReceiver;
    });
  }

  canTrickleIceCandidates!: boolean | null;

  connectionState!: RTCPeerConnectionState;

  currentLocalDescription!: RTCSessionDescription | null;

  currentRemoteDescription!: RTCSessionDescription | null;

  iceConnectionState!: RTCIceConnectionState;

  iceGatheringState!: RTCIceGatheringState;

  idpErrorInfo!: string | null;

  idpLoginUrl!: string | null;

  localDescription!: RTCSessionDescription | null;

  onconnectionstatechange!: ((this: RTCPeerConnection, event_: Event) => unknown) | null;

  ondatachannel!: ((this: RTCPeerConnection, event_: RTCDataChannelEvent) => unknown) | null;

  onicecandidate!: ((this: RTCPeerConnection, event_: RTCPeerConnectionIceEvent) => unknown) | null;

  onicecandidateerror: ((this: RTCPeerConnection, event_: Event) => unknown) | null = null;

  oniceconnectionstatechange!: ((this: RTCPeerConnection, event_: Event) => unknown) | null;

  onicegatheringstatechange!: ((this: RTCPeerConnection, event_: Event) => unknown) | null;

  onnegotiationneeded!: ((this: RTCPeerConnection, event_: Event) => unknown) | null;

  onsignalingstatechange!: ((this: RTCPeerConnection, event_: Event) => unknown) | null;

  ontrack!: ((this: RTCPeerConnection, event_: RTCTrackEvent) => unknown) | null;

  peerIdentity = undefined;

  pendingLocalDescription!: RTCSessionDescription | null;

  pendingRemoteDescription!: RTCSessionDescription | null;

  remoteDescription!: RTCSessionDescription | null;

  sctp = null;

  signalingState!: RTCSignalingState;

  getRemoteStreams(): MediaStream[] {
    throw new Error('Method not implemented.');
  }

  async addIceCandidate(_candidate: RTCIceCandidate | RTCIceCandidateInit): Promise<void> {
    throw new Error('Method not implemented.');
  }

  addTransceiver(
    _trackOrKind: MediaStreamTrack | string,
    _init?: RTCRtpTransceiverInit,
  ): RTCRtpTransceiver {
    throw new Error('Method not implemented.');
  }

  close(): void {
    throw new Error('Method not implemented.');
  }

  restartIce(): void {
    throw new Error('Method not implemented.');
  }

  createAnswer(options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit>;
  createAnswer(
    successCallback: RTCSessionDescriptionCallback,
    failureCallback: RTCPeerConnectionErrorCallback,
  ): Promise<void>;
  async createAnswer(
    _successCallback?: unknown,
    _failureCallback?: unknown,
  ): Promise<RTCSessionDescriptionInit | void> {
    throw new Error('Method not implemented.');
  }

  createDataChannel(_label: string, _dataChannelDict?: RTCDataChannelInit): RTCDataChannel {
    throw new Error('Method not implemented.');
  }

  createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit>;
  createOffer(
    successCallback: RTCSessionDescriptionCallback,
    failureCallback: RTCPeerConnectionErrorCallback,
    options?: RTCOfferOptions,
  ): Promise<void>;
  async createOffer(
    _successCallback?: unknown,
    _failureCallback?: unknown,
    _options?: unknown,
  ): Promise<RTCSessionDescriptionInit | void> {
    throw new Error('Method not implemented.');
  }

  getConfiguration(): RTCConfiguration {
    throw new Error('Method not implemented.');
  }

  async getIdentityAssertion(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  async getStats(_selector?: MediaStreamTrack | null): Promise<RTCStatsReport> {
    throw new Error('Method not implemented.');
  }

  getTransceivers(): RTCRtpTransceiver[] {
    throw new Error('Method not implemented.');
  }

  removeTrack(_sender: RTCRtpSender): void {
    throw new Error('Method not implemented.');
  }

  setConfiguration(_configuration: RTCConfiguration): void {
    throw new Error('Method not implemented.');
  }

  async setLocalDescription(_description: RTCSessionDescriptionInit): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async setRemoteDescription(_description: RTCSessionDescriptionInit): Promise<void> {
    throw new Error('Method not implemented.');
  }

  addEventListener<K extends keyof RTCPeerConnectionEventMap>(
    type: K,
    listener: (this: RTCPeerConnection, event_: RTCPeerConnectionEventMap[K]) => unknown,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(_type: unknown, _listener: unknown, _options?: unknown) {
    throw new Error('Method not implemented.');
  }

  removeEventListener<K extends keyof RTCPeerConnectionEventMap>(
    type: K,
    listener: (this: RTCPeerConnection, event_: RTCPeerConnectionEventMap[K]) => unknown,
    options?: EventListenerOptions | boolean,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: EventListenerOptions | boolean,
  ): void;
  removeEventListener(_type: unknown, _listener: unknown, _options?: unknown) {
    throw new Error('Method not implemented.');
  }

  dispatchEvent(_event: Event): boolean {
    throw new Error('Method not implemented.');
  }

  getReceivers = (): RTCRtpReceiver[] => {
    return this.receivers;
  };

  getSenders = (): RTCRtpSender[] => {
    return this.senders;
  };

  addTrack = (track: MediaStreamTrack) => {
    const sender = new RTCRtpSenderMock({ track });

    this.senders.push(sender);

    return sender;
  };
}

export default RTCPeerConnectionMock;
