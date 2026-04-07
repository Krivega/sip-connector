import { C as JsSIP_C, IncomingResponse } from '@krivega/jssip';
import { EventEmitterProxy } from 'events-constructor';

import { DeferredCommandRunner } from '@/tools';
import { CallStateMachine, EState } from './CallStateMachine';
import { createEvents } from './events';
import { MCUSession } from './MCUSession';
import { resolveRecvQuality } from './quality';
import RecvSession from './RecvSession';
import { RemoteStreamsManager } from './RemoteStreamsManager';
import { RoleManager } from './RoleManager';
import { StreamsChangeTracker } from './StreamsChangeTracker';
import { StreamsManagerProvider } from './StreamsManagerProvider';

import type { RTCSession } from '@krivega/jssip';
import type { ApiManager } from '@/ApiManager';
import type { ContentedStreamManager } from '@/ContentedStreamManager';
import type { TEventMap } from './events';
import type { TRestartIceOptions } from './MCUSession';
import type { TEffectiveQuality, TRecvQuality } from './quality';
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

const UDP_PROTOCOL = 'udp' as const;

const getLocalCandidatesFromReceiver = (receiver: RTCRtpReceiver): RTCIceCandidate[] => {
  if (receiver.transport?.iceTransport) {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return receiver.transport.iceTransport.getLocalCandidates();
  }

  return [];
};

const getLocalCandidatesFromPeerConnection = (
  peerConnection: RTCPeerConnection,
): RTCIceCandidate[] => {
  const receivers = peerConnection.getReceivers();

  return receivers.flatMap(getLocalCandidatesFromReceiver);
};

const getLocalPortsFromPeerConnection = (peerConnection: RTCPeerConnection): number[] => {
  const allLocalCandidates = getLocalCandidatesFromPeerConnection(peerConnection);

  const localCandidatesWithValidPort = allLocalCandidates.filter(({ protocol, port }) => {
    return port !== null && UDP_PROTOCOL === protocol;
  });

  const localPorts = localCandidatesWithValidPort.map(({ port }) => {
    return port;
  }) as number[];

  return [...new Set(localPorts)];
};

const getStreamHint = (event: RTCTrackEvent) => {
  return event.streams[0]?.id;
};

/** Для тестов и использования в deferred runner: возвращает token или выбрасывает при отсутствии inRoomContext. */
export function getInRoomTokenOrThrow(stateMachine: CallStateMachine): string {
  const { inRoomContext } = stateMachine;

  if (inRoomContext === undefined) {
    throw new Error(
      '[CallManager] Invariant: inRoomContext expected when deferred runner executes (state IN_ROOM)',
    );
  }

  return inRoomContext.token;
}

class CallManager extends EventEmitterProxy<TEventMap> {
  public readonly stateMachine: CallStateMachine;

  protected isPendingCall = false;

  protected isPendingAnswer = false;

  private readonly mainRemoteStreamsManager = new RemoteStreamsManager();

  private readonly recvRemoteStreamsManager = new RemoteStreamsManager();

  private readonly streamsManagerProvider: StreamsManagerProvider;

  private readonly contentedStreamManager: ContentedStreamManager;

  private readonly tools: TTools;

  private readonly roleManager = new RoleManager((params) => {
    this.onRoleChanged(params);
  });

  private readonly mcuSession: MCUSession;

  private recvSession?: RecvSession;

  private disposeRecvSessionTrackListener?: () => void;

  private readonly deferredStartRecvSessionRunner: DeferredCommandRunner<
    TCallRoleSpectator['recvParams'],
    EState
  >;

  private readonly streamsChangeTracker = new StreamsChangeTracker();

  public constructor(
    { contentedStreamManager }: { contentedStreamManager: ContentedStreamManager },
    tools: TTools,
  ) {
    super(createEvents());

    this.contentedStreamManager = contentedStreamManager;
    this.tools = tools;
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
        return state === EState.IDLE;
      },
      onExecute: (command) => {
        this.startRecvSessionForced({ audioChannel: command.audioId }).catch(() => {});
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

  public get number(): string | undefined {
    return this.stateMachine.number;
  }

  public get isCallInitiator(): boolean {
    return this.stateMachine.isCallInitiator;
  }

  public get isDirectP2PRoom(): boolean {
    return this.stateMachine.isDirectP2PRoom;
  }

  public get isDisconnecting(): boolean {
    return this.stateMachine.isDisconnecting;
  }

  public get localPorts(): number[] {
    const peerConnection = this.getActivePeerConnection();

    if (!peerConnection) {
      return [];
    }

    return getLocalPortsFromPeerConnection(peerConnection);
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
    this.events.emit('end-call');

    return this.mcuSession.endCall();
  }

  public async renegotiate(): Promise<boolean> {
    if (this.hasSpectator()) {
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

  public getRecvQuality():
    | { effectiveQuality: TEffectiveQuality; quality: TRecvQuality }
    | undefined {
    const { recvSession } = this;

    if (recvSession === undefined) {
      return undefined;
    }

    const effectiveQuality = recvSession.getEffectiveQuality();
    const quality = recvSession.getQuality();

    return {
      quality,
      effectiveQuality,
    };
  }

  public readonly getActivePeerConnection = () => {
    if (this.hasSpectator()) {
      return this.recvSession?.peerConnection;
    }

    return this.mcuSession.connection;
  };

  public hasSpectator(): boolean {
    return this.roleManager.hasSpectator();
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

  public async restartIce(options?: TRestartIceOptions): Promise<boolean> {
    return this.mcuSession.restartIce(options);
  }

  public async restartRecvSession(): Promise<boolean> {
    const { recvSession } = this;

    if (!this.hasSpectator() || !recvSession) {
      return false;
    }

    const audioChannel = recvSession.getAudioChannel();
    const quality = recvSession.getQuality();
    const { callResult } = await this.startRecvSessionForced(
      { audioChannel, quality },
      { silent: true },
    );

    return callResult;
  }

  public async setRecvQuality(quality: TRecvQuality): Promise<boolean> {
    const { recvSession } = this;

    if (!this.hasSpectator() || !recvSession) {
      return false;
    }

    const previousQuality = recvSession.getQuality();
    const previousEffectiveQuality = recvSession.getEffectiveQuality();
    const audioChannel = recvSession.getAudioChannel();

    const targetEffectiveQuality = resolveRecvQuality(quality);

    // Если качество не изменилось, ничего не делаем
    if (quality === previousQuality && targetEffectiveQuality === previousEffectiveQuality) {
      return false;
    }

    // Не пересоздаем RecvSession если не изменилось effectiveQuality
    // (например, 'auto' -> 'high' не требует пересоздания RecvSession, если effectiveQuality уже 'high')
    if (targetEffectiveQuality === previousEffectiveQuality) {
      await recvSession.setQuality(quality); // для обновления quality. renegotiate не будет вызван

      this.events.trigger('recv-quality-changed', {
        previousQuality,
        quality,
        effectiveQuality: previousEffectiveQuality,
      });

      return true;
    }

    const { session, callResult } = await this.startRecvSessionForced(
      { audioChannel, quality },
      { silent: true },
    );

    if (callResult) {
      const effectiveQuality = session.getEffectiveQuality();

      this.events.trigger('recv-quality-changed', {
        previousQuality,
        quality,
        effectiveQuality,
      });
    }

    return callResult;
  }

  public async applyQuality(quality: TRecvQuality): Promise<boolean> {
    const { recvSession } = this;

    if (!this.hasSpectator() || !recvSession) {
      return false;
    }

    const previousQuality = recvSession.getQuality();

    const result = await recvSession.applyQuality(quality);

    if (result.applied) {
      this.events.trigger('recv-quality-changed', {
        previousQuality,
        quality,
        effectiveQuality: result.effectiveQuality,
      });
    }

    return result.applied;
  }

  public async failed(message: IncomingResponse, cause: string): Promise<void> {
    this.emitFailedCall(message, cause);

    await this.endCall();
  }

  private emitFailedCall(message: IncomingResponse, cause: string) {
    this.events.trigger('failed', { message, cause, originator: 'local' });
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
    const onStatusChanged = this.createCallStatusChangeListener();

    this.onRace(['accepted', 'confirmed', 'ended', 'failed'], onStatusChanged);
  }

  /** Хранит prev/next и эмитит CALL_STATUS_CHANGED только при реальном изменении. */
  private createCallStatusChangeListener(): () => void {
    let prevIsCallActive = this.isCallActive;

    return () => {
      const nextIsCallActive = this.isCallActive;

      if (nextIsCallActive !== prevIsCallActive) {
        this.events.trigger('call-status-changed', { isCallActive: nextIsCallActive });
      }

      prevIsCallActive = nextIsCallActive;
    };
  }

  private subscribeMcuRemoteTrackEvents() {
    this.on('peerconnection:ontrack', (event: RTCTrackEvent) => {
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
    this.events.trigger('remote-tracks-changed', {
      streams,
      changeType,
      trackId,
      participantId,
    });
  }

  private readonly emitEventChangedRemoteStreamsConnected = (): void => {
    this.emitEventChangedRemoteStreams(this.getRemoteStreams());
  };

  private emitEventChangedRemoteStreams(streams: TRemoteStreams) {
    // Проверяем, изменились ли streams с предыдущего вызова
    if (!this.streamsChangeTracker.hasChanged(streams)) {
      return; // Не эмитим событие, если streams не изменились
    }

    this.streamsChangeTracker.updateLastEmittedStreams(streams);
    this.events.trigger('remote-streams-changed', { streams });
  }

  private getActiveStreamsManagerTools(): TStreamsManagerTools {
    return this.streamsManagerProvider.getActiveStreamsManagerTools({
      isSpectator: this.hasSpectator(),
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

  private async startRecvSessionForced(
    params: { audioChannel: string; quality?: TRecvQuality },
    { silent }: { silent?: boolean } = {},
  ) {
    const token = getInRoomTokenOrThrow(this.stateMachine);

    return this.startRecvSession(
      { audioChannel: params.audioChannel, quality: params.quality },
      {
        token,
        silent,
      },
    );
  }

  private async startRecvSession(
    { audioChannel, quality }: { audioChannel: string; quality?: TRecvQuality },
    { token, silent }: { token: string; silent?: boolean },
  ): Promise<
    { session: RecvSession; callResult: boolean } | { session: undefined; callResult: false }
  > {
    const conferenceNumber = this.stateMachine.number;

    if (conferenceNumber === undefined) {
      return { session: undefined, callResult: false };
    }

    this.stopRecvSession({ silent });

    const config = {
      audioChannel,
      quality,
      pcConfig: this.mcuSession.getPcConfig(),
    };

    const session = new RecvSession(config, { sendOffer: this.tools.sendOffer });

    this.recvSession = session;
    this.recvRemoteStreamsManager.reset();
    this.attachRecvSessionTracks(session);

    const callPromise = session.call({ conferenceNumber, token });

    return callPromise
      .then((result) => {
        if (silent !== true) {
          this.events.emit('recv-session-started');
        }

        return { session, callResult: result };
      })
      .catch(async (error: unknown) => {
        this.stopRecvSession();

        const message = new IncomingResponse();

        message.body = error instanceof Error ? error.message : String(error);

        const cause = JsSIP_C.causes.INTERNAL_ERROR;

        await this.failed(message, cause);
        throw error;
      });
  }

  private stopRecvSession({ silent }: { silent?: boolean } = {}) {
    const isActive = Boolean(this.recvSession);

    this.recvSession?.close();
    this.recvSession = undefined;
    this.disposeRecvSessionTrackListener?.();
    this.disposeRecvSessionTrackListener = undefined;
    this.recvRemoteStreamsManager.reset();

    if (isActive && silent !== true) {
      this.events.emit('recv-session-ended');
    }
  }

  private readonly onRoleChanged = ({
    previous,
    next,
  }: {
    previous: TCallRole;
    next: TCallRole;
  }) => {
    if (RoleManager.isExitingSpectatorRole(previous, next)) {
      this.stopRecvSession();
      this.deferredStartRecvSessionRunner.cancel();
      this.emitEventChangedRemoteStreamsConnected();
    }

    if (RoleManager.isEnteringSpectatorRole(previous, next)) {
      const params = next.recvParams;
      const { token } = this.stateMachine;

      if (token === undefined) {
        this.deferredStartRecvSessionRunner.set({
          audioId: params.audioId,
        });
      } else {
        this.startRecvSession(
          { audioChannel: params.audioId },
          {
            token,
          },
        ).catch(() => {});
      }
    }

    if (RoleManager.isExitingAnySpectatorRole(previous, next)) {
      // Выход из роли зрителя: восстанавливаем битрейт отправителей
      this.mcuSession.restoreBitrateForSenders();
    }

    if (RoleManager.isEnteringAnySpectatorRole(previous, next)) {
      // Вход в роль зрителя: ограничиваем битрейт отправителей
      this.mcuSession.setMinBitrateForSenders();
    }
  };

  private subscribeContentedStreamEvents() {
    this.contentedStreamManager.on('available', this.emitEventChangedRemoteStreamsConnected);
    this.contentedStreamManager.on('not-available', this.emitEventChangedRemoteStreamsConnected);
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
