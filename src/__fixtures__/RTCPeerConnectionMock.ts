/* eslint-disable @typescript-eslint/class-methods-use-this */

import { MediaStreamTrackMock } from 'webrtc-mock';

import RTCRtpSenderMock from './RTCRtpSenderMock';
import RTCRtpTransceiverMock from './RTCRtpTransceiverMock';

import type { RTCPeerConnectionDeprecated } from '@krivega/jssip';

export enum EEvent {
  TRACK = 'track',
}

class RTCPeerConnectionMock extends EventTarget implements RTCPeerConnectionDeprecated {
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

  public close = jest.fn();

  public setLocalDescription = jest.fn(
    async (_description: RTCSessionDescriptionInit): Promise<void> => {},
  );

  public setRemoteDescription = jest.fn(
    async (_description: RTCSessionDescriptionInit): Promise<void> => {},
  );

  public addTransceiver = jest.fn(
    (_trackOrKind: MediaStreamTrack | string, _init?: RTCRtpTransceiverInit): RTCRtpTransceiver => {
      return {} as RTCRtpTransceiver;
    },
  );

  public createOffer = jest.fn(
    async (
      _successCallback?: unknown,
      _failureCallback?: unknown,
      _options?: unknown,
    ): Promise<RTCSessionDescriptionInit> => {
      return { type: 'offer', sdp: 'offer-sdp' };
    },
  ) as unknown as {
    (options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit>;
    (
      successCallback: RTCSessionDescriptionCallback,
      failureCallback: RTCPeerConnectionErrorCallback,
      options?: RTCOfferOptions,
    ): Promise<void>;
  };

  public constructor(_configuration?: RTCConfiguration, tracks?: MediaStreamTrackMock[]) {
    super();
    this.receivers =
      tracks?.map((track) => {
        return { track } as unknown as RTCRtpReceiver;
      }) ?? [];
  }

  public getRemoteStreams(): MediaStream[] {
    throw new Error('Method not implemented.');
  }

  public async addIceCandidate(_candidate: RTCIceCandidate | RTCIceCandidateInit): Promise<void> {
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

  public getReceivers = (): RTCRtpReceiver[] => {
    return this.receivers;
  };

  public getSenders = (): RTCRtpSender[] => {
    return this.senders;
  };

  public addTrack = (track: MediaStreamTrack, ..._streams: MediaStream[]) => {
    const sender = new RTCRtpSenderMock({ track });
    const transceiver = new RTCRtpTransceiverMock(sender);

    // Автоматически присваиваем mid: '0' для аудио, '1' для видео
    transceiver.mid = track.kind === 'audio' ? '0' : '1';

    this.senders.push(sender);

    this.dispatchTrackInternal(track);

    return sender;
  };

  // Дополнительный метод для тестов с возможностью установки mid
  public addTrackWithMid = (track: MediaStreamTrack, mid?: string) => {
    const sender = new RTCRtpSenderMock({ track });
    const transceiver = new RTCRtpTransceiverMock(sender);

    // Устанавливаем mid если передан, иначе используем логику по умолчанию
    if (mid === undefined) {
      // Автоматически присваиваем mid: '0' для аудио, '1' для видео
      transceiver.mid = track.kind === 'audio' ? '0' : '1';
    } else {
      transceiver.mid = mid;
    }

    this.senders.push(sender);

    this.dispatchTrackInternal(track);

    return sender;
  };

  public dispatchTrack(kind: 'audio' | 'video'): void {
    this.dispatchTrackInternal(new MediaStreamTrackMock(kind));
  }

  private dispatchTrackInternal(track: MediaStreamTrack): void {
    const event = new Event(EEvent.TRACK) as RTCTrackEvent;

    Object.defineProperty(event, 'track', {
      value: track,
    });

    this.dispatchEvent(event);
  }
}

export default RTCPeerConnectionMock;
