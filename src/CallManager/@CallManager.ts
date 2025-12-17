import { TypedEvents } from 'events-constructor';

import { hasVideoTracks } from '@/utils/utils';
import { EEvent, EVENT_NAMES } from './eventNames';
import { MCUSession } from './MCUSession';
import { RemoteStreamsManager } from './RemoteStreamsManager';

import type { RTCSession } from '@krivega/jssip';
import type { TEvents, TEventMap } from './eventNames';
import type {
  TStartCall,
  TCallConfiguration,
  TReplaceMediaStream,
  TAnswerToIncomingCall,
} from './types';

class CallManager {
  public readonly events: TEvents;

  protected isPendingCall = false;

  protected isPendingAnswer = false;

  protected rtcSession?: RTCSession;

  protected remoteStreams: Record<string, MediaStream> = {};

  protected readonly callConfiguration: TCallConfiguration = {};

  private readonly remoteStreamsManager = new RemoteStreamsManager();

  private readonly mcuSession: MCUSession;

  public constructor() {
    this.events = new TypedEvents<TEventMap>(EVENT_NAMES);

    this.mcuSession = new MCUSession(this.events, { onReset: this.reset });
    this.subscribeCallStatusChange();
  }

  public get requested() {
    return this.isPendingCall || this.isPendingAnswer;
  }

  public get connection(): RTCPeerConnection | undefined {
    return this.mcuSession.connection;
  }

  public get isCallActive(): boolean {
    return this.mcuSession.isCallActive;
  }

  public getEstablishedRTCSession = (): RTCSession | undefined => {
    return this.mcuSession.getEstablishedRTCSession();
  };

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.on(eventName, handler);
  }

  public onRace<T extends keyof TEventMap>(
    eventNames: T[],
    handler: (data: TEventMap[T], eventName: string) => void,
  ) {
    return this.events.onRace(eventNames, handler);
  }

  public once<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.once(eventName, handler);
  }

  public onceRace<T extends keyof TEventMap>(
    eventNames: T[],
    handler: (data: TEventMap[T], eventName: string) => void,
  ) {
    return this.events.onceRace(eventNames, handler);
  }

  public async wait<T extends keyof TEventMap>(eventName: T): Promise<TEventMap[T]> {
    return this.events.wait(eventName);
  }

  public off<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    this.events.off(eventName, handler);
  }

  public startCall: TStartCall = async (ua, getSipServerUrl, params) => {
    this.isPendingCall = true;
    this.callConfiguration.number = params.number;
    this.callConfiguration.answer = false;

    return this.mcuSession.startCall(ua, getSipServerUrl, params).finally(() => {
      this.isPendingCall = false;
    });
  };

  public async endCall(): Promise<void> {
    return this.mcuSession.endCall();
  }

  public answerToIncomingCall: TAnswerToIncomingCall = async (
    extractIncomingRTCSession: () => RTCSession,
    params,
  ): Promise<RTCPeerConnection> => {
    this.isPendingAnswer = true;

    const rtcSession = extractIncomingRTCSession();

    this.callConfiguration.answer = true;
    this.callConfiguration.number = rtcSession.remote_identity.uri.user;

    return this.mcuSession.answerToIncomingCall(rtcSession, params).finally(() => {
      this.isPendingAnswer = false;
    });
  };

  public getCallConfiguration() {
    return { ...this.callConfiguration };
  }

  public getRemoteStreams(): MediaStream[] | undefined {
    const remoteTracks = this.mcuSession.getRemoteTracks();

    if (!remoteTracks) {
      return undefined;
    }

    if (hasVideoTracks(remoteTracks)) {
      return this.remoteStreamsManager.generateStreams(remoteTracks);
    }

    return this.remoteStreamsManager.generateAudioStreams(remoteTracks);
  }

  public async replaceMediaStream(
    mediaStream: Parameters<TReplaceMediaStream>[0],
    options?: Parameters<TReplaceMediaStream>[1],
  ): Promise<void> {
    return this.mcuSession.replaceMediaStream(mediaStream, options);
  }

  public async restartIce(options?: {
    useUpdate?: boolean;
    extraHeaders?: string[];
    rtcOfferConstraints?: RTCOfferOptions;
    sendEncodings?: RTCRtpEncodingParameters[];
    degradationPreference?: RTCDegradationPreference;
  }): Promise<boolean> {
    return this.mcuSession.restartIce(options);
  }

  private readonly reset: () => void = () => {
    this.remoteStreamsManager.reset();
    this.callConfiguration.number = undefined;
    this.callConfiguration.answer = false;
  };

  private subscribeCallStatusChange() {
    let { isCallActive } = this;

    const { ACCEPTED, CONFIRMED, ENDED, FAILED } = EEvent;

    this.onRace([ACCEPTED, CONFIRMED, ENDED, FAILED], () => {
      isCallActive = this.maybeTriggerCallStatus(isCallActive);
    });
  }

  private maybeTriggerCallStatus(isCallActive: boolean) {
    const newStatus = this.isCallActive;

    if (newStatus !== isCallActive) {
      this.events.trigger(EEvent.CALL_STATUS_CHANGED, { isCallActive: newStatus });
    }

    return newStatus;
  }
}

export default CallManager;
