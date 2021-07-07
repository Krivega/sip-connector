import type { RTCPeerConnectionDeprecated } from '@krivega/jssip/lib/RTCSession';

/* eslint-disable @typescript-eslint/no-unused-vars */
class RTCPeerConnectionMock implements RTCPeerConnectionDeprecated {
  _senders: RTCRtpSender[] = [];

  _receivers: any[] = [];

  constructor(tracks) {
    this._receivers = tracks.map((track) => {
      return { track };
    });
  }
  getRemoteStreams(): MediaStream[] {
    throw new Error('Method not implemented.');
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
  onconnectionstatechange!: ((this: RTCPeerConnection, ev: Event) => any) | null;
  ondatachannel!: ((this: RTCPeerConnection, ev: RTCDataChannelEvent) => any) | null;
  onicecandidate!: ((this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) => any) | null;
  onicecandidateerror!:
    | ((this: RTCPeerConnection, ev: RTCPeerConnectionIceErrorEvent) => any)
    | null;
  oniceconnectionstatechange!: ((this: RTCPeerConnection, ev: Event) => any) | null;
  onicegatheringstatechange!: ((this: RTCPeerConnection, ev: Event) => any) | null;
  onnegotiationneeded!: ((this: RTCPeerConnection, ev: Event) => any) | null;
  onsignalingstatechange!: ((this: RTCPeerConnection, ev: Event) => any) | null;
  ontrack!: ((this: RTCPeerConnection, ev: RTCTrackEvent) => any) | null;
  peerIdentity!: Promise<RTCIdentityAssertion>;
  pendingLocalDescription!: RTCSessionDescription | null;
  pendingRemoteDescription!: RTCSessionDescription | null;
  remoteDescription!: RTCSessionDescription | null;
  sctp!: RTCSctpTransport | null;
  signalingState!: RTCSignalingState;
  addIceCandidate(candidate: RTCIceCandidateInit | RTCIceCandidate): Promise<void> {
    throw new Error('Method not implemented.');
  }
  addTransceiver(
    trackOrKind: string | MediaStreamTrack,
    init?: RTCRtpTransceiverInit
  ): RTCRtpTransceiver {
    throw new Error('Method not implemented.');
  }
  close(): void {
    throw new Error('Method not implemented.');
  }
  restartIce(): void {
    throw new Error('Method not implemented.');
  }
  createAnswer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    throw new Error('Method not implemented.');
  }
  createDataChannel(label: string, dataChannelDict?: RTCDataChannelInit): RTCDataChannel {
    throw new Error('Method not implemented.');
  }
  createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    throw new Error('Method not implemented.');
  }
  getConfiguration(): RTCConfiguration {
    throw new Error('Method not implemented.');
  }
  getIdentityAssertion(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  getStats(selector?: MediaStreamTrack | null): Promise<RTCStatsReport> {
    throw new Error('Method not implemented.');
  }
  getTransceivers(): RTCRtpTransceiver[] {
    throw new Error('Method not implemented.');
  }
  removeTrack(sender: RTCRtpSender): void {
    throw new Error('Method not implemented.');
  }
  setConfiguration(configuration: RTCConfiguration): void {
    throw new Error('Method not implemented.');
  }
  setIdentityProvider(provider: string, options?: RTCIdentityProviderOptions): void {
    throw new Error('Method not implemented.');
  }
  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    throw new Error('Method not implemented.');
  }
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    throw new Error('Method not implemented.');
  }
  addEventListener<K extends keyof RTCPeerConnectionEventMap>(
    type: K,
    listener: (this: RTCPeerConnection, ev: RTCPeerConnectionEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(type: any, listener: any, options?: any) {
    throw new Error('Method not implemented.');
  }
  removeEventListener<K extends keyof RTCPeerConnectionEventMap>(
    type: K,
    listener: (this: RTCPeerConnection, ev: RTCPeerConnectionEventMap[K]) => any,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(type: any, listener: any, options?: any) {
    throw new Error('Method not implemented.');
  }
  dispatchEvent(event: Event): boolean {
    throw new Error('Method not implemented.');
  }

  getReceivers = () => {
    return this._receivers;
  };

  getSenders = () => {
    return this._senders;
  };

  addTrack = (track: MediaStreamTrack) => {
    // @ts-ignore
    const sender: RTCRtpSender = { track };

    this._senders.push(sender);

    return sender;
  };
}

export default RTCPeerConnectionMock;
