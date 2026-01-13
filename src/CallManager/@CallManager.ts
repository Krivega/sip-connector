import { CallStateMachine } from './CallStateMachine';
import { createEvents, EEvent } from './events';
import { MCUSession } from './MCUSession';
import RecvSession from './RecvSession';
import { RemoteStreamsManager } from './RemoteStreamsManager';
import { RoleManager } from './RoleManager';

import type { RTCSession } from '@krivega/jssip';
import type { ConferenceStateManager } from '@/ConferenceStateManager';
import type { TCallActor } from './CallStateMachine';
import type { TEventMap, TEvents } from './events';
import type { TTools } from './RecvSession';
import type {
  TAnswerToIncomingCall,
  TCallRole,
  TCallRoleSpectator,
  TReplaceMediaStream,
  TStartCall,
} from './types';

type TRemoteStreamsChangeType = 'added' | 'removed';

const getStreamHint = (event: RTCTrackEvent) => {
  return event.streams[0]?.id;
};

class CallManager {
  public readonly events: TEvents;

  public readonly callStateMachine: CallStateMachine;

  protected isPendingCall = false;

  protected isPendingAnswer = false;

  protected rtcSession?: RTCSession;

  private readonly conferenceStateManager: ConferenceStateManager;

  private readonly mainRemoteStreamsManager = new RemoteStreamsManager();

  private readonly recvRemoteStreamsManager = new RemoteStreamsManager();

  private readonly roleManager = new RoleManager(
    { mainManager: this.mainRemoteStreamsManager, recvManager: this.recvRemoteStreamsManager },
    (params) => {
      this.onRoleChanged(params);
    },
  );

  private readonly mcuSession: MCUSession;

  private recvSession?: RecvSession;

  private disposeRecvSessionTrackListener?: () => void;

  public constructor(conferenceStateManager: ConferenceStateManager) {
    this.conferenceStateManager = conferenceStateManager;
    this.events = createEvents();
    this.mcuSession = new MCUSession(this.events, { onReset: this.reset });
    this.callStateMachine = new CallStateMachine(this.events);

    this.subscribeCallStatusChange();
    this.subscribeMcuRemoteTrackEvents();
  }

  public get callActor(): TCallActor {
    return this.callStateMachine.actorRef;
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

  public startCall: TStartCall = async (ua, getUri, params) => {
    this.isPendingCall = true;
    this.conferenceStateManager.updateState({ number: params.number, answer: false });

    return this.mcuSession.startCall(ua, getUri, params).finally(() => {
      this.isPendingCall = false;
    });
  };

  public async endCall(): Promise<void> {
    return this.mcuSession.endCall();
  }

  public async renegotiate(): Promise<boolean> {
    return this.mcuSession.renegotiate();
  }

  public answerToIncomingCall: TAnswerToIncomingCall = async (
    extractIncomingRTCSession: () => RTCSession,
    params,
  ): Promise<RTCPeerConnection> => {
    this.isPendingAnswer = true;

    const rtcSession = extractIncomingRTCSession();

    this.conferenceStateManager.updateState({
      answer: true,
      number: rtcSession.remote_identity.uri.user,
    });

    return this.mcuSession.answerToIncomingCall(rtcSession, params).finally(() => {
      this.isPendingAnswer = false;
    });
  };

  public getMainStream(): MediaStream | undefined {
    const manager = this.getActiveStreamsManager();

    return manager.mainStream;
  }

  public getRemoteStreams(): MediaStream[] {
    const manager = this.getActiveStreamsManager();

    return manager.getStreams();
  }

  public setCallRoleParticipant() {
    this.roleManager.setCallRoleParticipant();
  }

  public setCallRoleSpectatorSynthetic() {
    this.roleManager.setCallRoleSpectatorSynthetic();
  }

  public setCallRoleSpectator(recvParams: TCallRoleSpectator['recvParams']) {
    this.roleManager.setCallRoleSpectator(recvParams);
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
    this.mainRemoteStreamsManager.reset();
    this.conferenceStateManager.updateState({ number: undefined, answer: false });
    this.roleManager.reset();
    this.stopRecvSession();
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

  private subscribeMcuRemoteTrackEvents() {
    this.on(EEvent.PEER_CONNECTION_ONTRACK, (event: RTCTrackEvent) => {
      this.addRemoteTrack(this.mainRemoteStreamsManager, event.track, getStreamHint(event));
    });
  }

  private addRemoteTrack(
    manager: RemoteStreamsManager,
    track: MediaStreamTrack,
    streamHint?: string,
  ) {
    const result = manager.addTrack(track, {
      streamHint,
      onRemoved: (event) => {
        this.emitRemoteStreamsChanged(manager, 'removed', {
          trackId: event.trackId,
          participantId: event.participantId,
        });
      },
    });

    if (!result.isAdded) {
      return;
    }

    this.emitRemoteStreamsChanged(manager, 'added', {
      trackId: track.id,
      participantId: result.participantId,
    });
  }

  private emitRemoteStreamsChanged(
    manager: RemoteStreamsManager,
    changeType: TRemoteStreamsChangeType,
    { trackId, participantId }: { trackId: string; participantId: string },
  ) {
    const activeManager = this.getActiveStreamsManager();

    if (manager !== activeManager) {
      return;
    }

    const streams = [...activeManager.getStreams()];

    this.events.trigger(EEvent.REMOTE_STREAMS_CHANGED, {
      participantId,
      changeType,
      trackId,
      streams,
    });
  }

  private getActiveStreamsManager(): RemoteStreamsManager {
    return this.roleManager.getActiveManager();
  }

  private attachRecvSessionTracks(session: RecvSession) {
    const { peerConnection } = session;
    const handleTrack = (event: RTCTrackEvent) => {
      this.addRemoteTrack(this.recvRemoteStreamsManager, event.track, getStreamHint(event));
    };

    peerConnection.addEventListener('track', handleTrack);
    this.disposeRecvSessionTrackListener = () => {
      peerConnection.removeEventListener('track', handleTrack);
    };
  }

  private startRecvSession(audioId: string, sendOffer: TTools['sendOffer']): void {
    const conferenceNumber = this.conferenceStateManager.getNumber();

    if (conferenceNumber === undefined) {
      return;
    }

    this.stopRecvSession();

    const config = {
      quality: 'high' as const,
      audioChannel: audioId,
    };

    const session = new RecvSession(config, { sendOffer });

    this.recvSession = session;
    this.recvRemoteStreamsManager.reset();
    this.attachRecvSessionTracks(session);

    session.call(conferenceNumber).catch(() => {
      this.stopRecvSession();
    });
  }

  private stopRecvSession() {
    this.recvSession?.close();
    this.recvSession = undefined;
    this.disposeRecvSessionTrackListener?.();
    this.disposeRecvSessionTrackListener = undefined;
    this.recvRemoteStreamsManager.reset();
  }

  private readonly onRoleChanged = ({
    previous,
    next,
  }: {
    previous: TCallRole;
    next: TCallRole;
  }) => {
    if (RoleManager.hasSpectator(previous) && !RoleManager.hasSpectator(next)) {
      this.stopRecvSession();
    }

    if (RoleManager.hasSpectator(next)) {
      const params = next.recvParams;

      this.startRecvSession(params.audioId, params.sendOffer);
    }
  };
}

export default CallManager;
