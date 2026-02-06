import { DeferredCommandRunner } from '@/tools';
import { CallStateMachine, EState } from './CallStateMachine';
import { createEvents, EEvent } from './events';
import { MCUSession } from './MCUSession';
import RecvSession from './RecvSession';
import { RemoteStreamsManager } from './RemoteStreamsManager';
import { RoleManager } from './RoleManager';
import { StreamsChangeTracker } from './StreamsChangeTracker';
import { StreamsManagerProvider } from './StreamsManagerProvider';

import type { RTCSession } from '@krivega/jssip';
import type { ApiManager } from '@/ApiManager';
import type { ContentedStreamManager } from '@/ContentedStreamManager';
import type { TEventMap, TEvents } from './events';
import type { TRecvQuality } from './quality';
import type { TTools } from './RecvSession';
import type {
  TAnswerToIncomingCall,
  TCallRole,
  TCallRoleSpectator,
  TReplaceMediaStream,
  TStartCall,
  TStreamsManagerTools,
  TRemoteTracksChangeType,
  TRemoteStreams,
} from './types';

const getStreamHint = (event: RTCTrackEvent) => {
  return event.streams[0]?.id;
};

class CallManager {
  public readonly events: TEvents;

  public readonly stateMachine: CallStateMachine;

  protected isPendingCall = false;

  protected isPendingAnswer = false;

  protected rtcSession?: RTCSession;

  private readonly mainRemoteStreamsManager = new RemoteStreamsManager();

  private readonly recvRemoteStreamsManager = new RemoteStreamsManager();

  private readonly streamsManagerProvider: StreamsManagerProvider;

  private readonly contentedStreamManager: ContentedStreamManager;

  private readonly roleManager = new RoleManager((params) => {
    this.onRoleChanged(params);
  });

  private readonly mcuSession: MCUSession;

  private recvSession?: RecvSession;

  private disposeRecvSessionTrackListener?: () => void;

  private recvQuality: TRecvQuality = 'auto';

  private readonly deferredStartRecvSessionRunner: DeferredCommandRunner<
    TCallRoleSpectator['recvParams'],
    EState
  >;

  private readonly streamsChangeTracker = new StreamsChangeTracker();

  public constructor(contentedStreamManager: ContentedStreamManager) {
    this.contentedStreamManager = contentedStreamManager;
    this.events = createEvents();
    this.mcuSession = new MCUSession(this.events, { onReset: this.reset });
    this.stateMachine = new CallStateMachine(this.events);
    this.streamsManagerProvider = new StreamsManagerProvider(
      this.mainRemoteStreamsManager,
      this.recvRemoteStreamsManager,
    );
    this.deferredStartRecvSessionRunner = new DeferredCommandRunner<
      TCallRoleSpectator['recvParams'],
      EState
    >({
      subscribe: (listener) => {
        return this.stateMachine.onStateChange(listener);
      },
      isReady: (state) => {
        return state === EState.IN_ROOM;
      },
      isCancelled: (state) => {
        return state === EState.FAILED || state === EState.IDLE;
      },
      onExecute: (command) => {
        // isReady(state) === true означает IN_ROOM, контекст гарантированно содержит token
        const { token } = this.stateMachine.context as { token: string };

        this.startRecvSession(command.audioId, {
          sendOffer: command.sendOffer,
          token,
        });
      },
    });

    this.subscribeCallStatusChange();
    this.subscribeMcuRemoteTrackEvents();
    this.subscribeContentedStreamEvents();
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

  // For testing purposes
  public getStreamsManagerProvider(): StreamsManagerProvider {
    return this.streamsManagerProvider;
  }

  public getContentedStreamManager(): ContentedStreamManager {
    return this.contentedStreamManager;
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

  public subscribeToApiEvents(apiManager: ApiManager): void {
    this.stateMachine.subscribeToApiEvents(apiManager.events);
  }

  public startCall: TStartCall = async (ua, getUri, params) => {
    this.isPendingCall = true;

    this.events.emit('start-call', {
      number: params.number,
      answer: false,
    });

    return this.mcuSession.startCall(ua, getUri, params).finally(() => {
      this.isPendingCall = false;
    });
  };

  public async endCall(): Promise<void> {
    return this.mcuSession.endCall();
  }

  public async renegotiate(): Promise<boolean> {
    if (this.roleManager.hasSpectator()) {
      return this.renegotiateRecvSession();
    }

    return this.renegotiateMcuSession();
  }

  public answerToIncomingCall: TAnswerToIncomingCall = async (
    extractIncomingRTCSession: () => RTCSession,
    params,
  ): Promise<RTCPeerConnection> => {
    this.isPendingAnswer = true;

    const rtcSession = extractIncomingRTCSession();

    this.events.emit('start-call', {
      answer: true,
      number: rtcSession.remote_identity.uri.user,
    });

    return this.mcuSession.answerToIncomingCall(rtcSession, params).finally(() => {
      this.isPendingAnswer = false;
    });
  };

  public getMainRemoteStream(): MediaStream | undefined {
    const { mainStream } = this.getRemoteStreams();

    return mainStream;
  }

  public getRemoteStreams() {
    const { getRemoteStreams } = this.getActiveStreamsManagerTools();

    return getRemoteStreams();
  }

  public getToken() {
    return this.stateMachine.token;
  }

  public getRecvQuality(): TRecvQuality {
    return this.recvQuality;
  }

  public readonly getActivePeerConnection = () => {
    if (this.roleManager.hasSpectator()) {
      return this.recvSession?.peerConnection;
    }

    return this.mcuSession.connection;
  };

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

  public async setRecvQuality(quality: TRecvQuality): Promise<boolean> {
    const previous = this.recvQuality;

    this.recvQuality = quality;

    this.events.trigger(EEvent.RECV_QUALITY_REQUESTED, {
      quality,
      previous,
      source: 'api',
    });

    if (!this.roleManager.hasSpectator()) {
      this.events.trigger(EEvent.RECV_QUALITY_CHANGED, {
        previous,
        next: quality,
        applied: false,
        reason: 'not-spectator',
      });

      return false;
    }

    if (!this.recvSession) {
      this.events.trigger(EEvent.RECV_QUALITY_CHANGED, {
        previous,
        next: quality,
        applied: false,
        reason: 'no-session',
      });

      return false;
    }

    try {
      const applied = await this.recvSession.setQuality(quality);
      const effectiveQuality = this.recvSession.getEffectiveQuality();

      this.events.trigger(EEvent.RECV_QUALITY_CHANGED, {
        previous,
        next: quality,
        applied,
        effectiveQuality,
        reason: applied ? undefined : 'no-effective-change',
      });

      return applied;
    } catch (error) {
      const effectiveQuality = this.recvSession.getEffectiveQuality();

      this.events.trigger(EEvent.RECV_QUALITY_CHANGED, {
        previous,
        next: quality,
        applied: false,
        effectiveQuality,
        reason: 'renegotiate-failed',
      });

      throw error;
    }
  }

  private readonly reset: () => void = () => {
    this.mainRemoteStreamsManager.reset();
    this.roleManager.reset();
    this.recvRemoteStreamsManager.reset();
    this.stopRecvSession();
    this.deferredStartRecvSessionRunner.cancel();
    this.streamsChangeTracker.reset();
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
        this.handleChangedRemoteTracks(manager, 'removed', {
          isRemovedStream: event.isRemovedStream,
          isAddedStream: false,
          trackId: event.trackId,
          participantId: event.participantId,
        });
      },
    });

    if (!result.isAddedTrack) {
      return;
    }

    this.handleChangedRemoteTracks(manager, 'added', {
      isRemovedStream: false,
      isAddedStream: result.isAddedStream,
      trackId: track.id,
      participantId: result.participantId,
    });
  }

  private handleChangedRemoteTracks(
    manager: RemoteStreamsManager,
    changeType: TRemoteTracksChangeType,
    {
      trackId,
      participantId,
      isRemovedStream,
      isAddedStream,
    }: { trackId: string; participantId: string; isRemovedStream: boolean; isAddedStream: boolean },
  ) {
    const tools = this.getActiveStreamsManagerTools();

    if (manager !== tools.manager) {
      return;
    }

    const streams = tools.getRemoteStreams();

    this.emitEventChangedRemoteTracks(streams, changeType, { trackId, participantId });

    if (isAddedStream || isRemovedStream) {
      this.emitEventChangedRemoteStreams(streams);
    }
  }

  private emitEventChangedRemoteTracks(
    streams: TRemoteStreams,
    changeType: TRemoteTracksChangeType,
    { trackId, participantId }: { trackId: string; participantId: string },
  ) {
    this.events.trigger(EEvent.REMOTE_TRACKS_CHANGED, {
      streams,
      changeType,
      trackId,
      participantId,
    });
  }

  private emitEventChangedRemoteStreams(streams: TRemoteStreams) {
    // Проверяем, изменились ли streams с предыдущего вызова
    if (!this.streamsChangeTracker.hasChanged(streams)) {
      return; // Не эмитим событие, если streams не изменились
    }

    this.streamsChangeTracker.updateLastEmittedStreams(streams);
    this.events.trigger(EEvent.REMOTE_STREAMS_CHANGED, { streams });
  }

  private getActiveStreamsManagerTools(): TStreamsManagerTools {
    return this.streamsManagerProvider.getActiveStreamsManagerTools({
      isSpectator: this.roleManager.hasSpectator(),
      stateInfo: this.contentedStreamManager.getStateInfo(),
    });
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

  private startRecvSession(
    audioId: string,
    { sendOffer, token }: { sendOffer: TTools['sendOffer']; token: string },
  ): void {
    const conferenceNumber = this.stateMachine.number;

    if (conferenceNumber === undefined) {
      return;
    }

    this.stopRecvSession();

    const quality = this.recvQuality;
    const config = {
      quality,
      audioChannel: audioId,
    };

    const session = new RecvSession(config, { sendOffer });

    this.recvSession = session;
    this.recvRemoteStreamsManager.reset();
    this.attachRecvSessionTracks(session);

    const callPromise = session.call({ conferenceNumber, token });

    callPromise.catch(() => {
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
    const isPreviousSpectator = RoleManager.hasSpectator(previous);
    const isNextSpectator = RoleManager.hasSpectator(next);
    const isNextSpectatorSynthetic = RoleManager.hasSpectatorSynthetic(next);
    const isPreviousSpectatorSynthetic = RoleManager.hasSpectatorSynthetic(previous);
    const isNextAnySpectator = isNextSpectator || isNextSpectatorSynthetic;
    const isPreviousAnySpectator = isPreviousSpectator || isPreviousSpectatorSynthetic;

    if (isPreviousSpectator && !isNextSpectator) {
      this.stopRecvSession();
      this.deferredStartRecvSessionRunner.cancel();
      this.emitEventChangedRemoteStreams(this.getRemoteStreams());
    }

    if (isNextSpectator) {
      const params = next.recvParams;
      const { token } = this.stateMachine;

      if (token === undefined) {
        this.deferredStartRecvSessionRunner.set({
          audioId: params.audioId,
          sendOffer: params.sendOffer,
        });
      } else {
        this.startRecvSession(params.audioId, {
          token,
          sendOffer: params.sendOffer,
        });
      }
    }

    if (isPreviousAnySpectator && !isNextAnySpectator) {
      // Переход из роли зрителя в роль участника:
      // восстанавливаем исходные значения битрейта отправителей
      this.mcuSession.restoreBitrateForSenders();
    }

    if (isNextAnySpectator && !isPreviousAnySpectator) {
      // Переход из роли участника в роль зрителя:
      // ограничиваем битрейт отправителей до минимального значения
      this.mcuSession.setMinBitrateForSenders();
    }
  };

  private subscribeContentedStreamEvents() {
    this.contentedStreamManager.on('available', () => {
      this.emitEventChangedRemoteStreams(this.getRemoteStreams());
    });

    this.contentedStreamManager.on('not-available', () => {
      this.emitEventChangedRemoteStreams(this.getRemoteStreams());
    });
  }

  private async renegotiateRecvSession() {
    const conferenceNumber = this.stateMachine.number;
    const { token } = this.stateMachine;

    if (conferenceNumber === undefined || token === undefined || this.recvSession === undefined) {
      return false;
    }

    return this.recvSession.renegotiate({ conferenceNumber, token });
  }

  private async renegotiateMcuSession() {
    return this.mcuSession.renegotiate();
  }
}

export default CallManager;
