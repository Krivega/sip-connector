/* eslint-disable @typescript-eslint/no-unused-vars */
import type { RTCPeerConnectionDeprecated } from '@krivega/jssip';
import type { MediaStreamTrackMock } from 'webrtc-mock';

class RTCPeerConnectionMock implements RTCPeerConnectionDeprecated {
  _senders: RTCRtpSender[] = [];

  _receivers: any[] = [];

  constructor(
    _configuration?: RTCConfiguration,
    // @ts-expect-error
    tracks: MediaStreamTrackMock[],
  ) {
    this._receivers = tracks.map((track) => {
      return { track };
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

  onconnectionstatechange!: ((this: RTCPeerConnection, event_: Event) => any) | null;

  ondatachannel!: ((this: RTCPeerConnection, event_: RTCDataChannelEvent) => any) | null;

  onicecandidate!: ((this: RTCPeerConnection, event_: RTCPeerConnectionIceEvent) => any) | null;

  onicecandidateerror: ((this: RTCPeerConnection, event_: Event) => any) | null = null;

  oniceconnectionstatechange!: ((this: RTCPeerConnection, event_: Event) => any) | null;

  onicegatheringstatechange!: ((this: RTCPeerConnection, event_: Event) => any) | null;

  onnegotiationneeded!: ((this: RTCPeerConnection, event_: Event) => any) | null;

  onsignalingstatechange!: ((this: RTCPeerConnection, event_: Event) => any) | null;

  ontrack!: ((this: RTCPeerConnection, event_: RTCTrackEvent) => any) | null;

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
    _successCallback?: any,
    _failureCallback?: any,
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
    _successCallback?: any,
    _failureCallback?: any,
    _options?: any,
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
    listener: (this: RTCPeerConnection, event_: RTCPeerConnectionEventMap[K]) => any,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(_type: any, _listener: any, _options?: any) {
    throw new Error('Method not implemented.');
  }

  removeEventListener<K extends keyof RTCPeerConnectionEventMap>(
    type: K,
    listener: (this: RTCPeerConnection, event_: RTCPeerConnectionEventMap[K]) => any,
    options?: EventListenerOptions | boolean,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: EventListenerOptions | boolean,
  ): void;
  removeEventListener(_type: any, _listener: any, _options?: any) {
    throw new Error('Method not implemented.');
  }

  dispatchEvent(_event: Event): boolean {
    throw new Error('Method not implemented.');
  }

  getReceivers = () => {
    return this._receivers;
  };

  getSenders = () => {
    return this._senders;
  };

  addTrack = (track: MediaStreamTrack) => {
    // @ts-expect-error
    const sender: RTCRtpSender = { track };

    this._senders.push(sender);

    return sender;
  };
}

export default RTCPeerConnectionMock;
