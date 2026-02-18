import { C as JsSIP_C, IncomingResponse } from '@krivega/jssip';

import { ApiManager } from '@/ApiManager';
import { AutoConnectorManager } from '@/AutoConnectorManager';
import { CallManager } from '@/CallManager';
import { ConnectionManager } from '@/ConnectionManager';
import { ConnectionQueueManager } from '@/ConnectionQueueManager';
import { ContentedStreamManager } from '@/ContentedStreamManager';
import { IncomingCallManager } from '@/IncomingCallManager';
import logger from '@/logger';
import { PeerToPeerManager } from '@/PeerToPeerManager';
import { PresentationManager } from '@/PresentationManager';
import { SessionManager } from '@/SessionManager';
import { StatsManager } from '@/StatsManager';
import { sendOffer } from '@/tools';
import setCodecPreferences from '@/tools/setCodecPreferences';
import { VideoSendingBalancerManager } from '@/VideoSendingBalancerManager';
import { MainStreamHealthMonitor } from '../MainStreamHealthMonitor';
import { MainStreamRecovery } from '../MainStreamRecovery';
import { ONE_MEGABIT_IN_BITS } from './constants';
import { createEvents } from './events';

import type { IAutoConnectorOptions } from '@/AutoConnectorManager';
import type { TGetUri, TRecvQuality } from '@/CallManager';
import type { TContentHint, TOnAddedTransceiver } from '@/PresentationManager';
import type { TJsSIP } from '@/types';
import type { IBalancerOptions } from '@/VideoSendingBalancer';
import type { TEventName, TEventMap, TEvents } from './events';

class SipConnector {
  public readonly events: TEvents;

  public readonly connectionManager: ConnectionManager;

  public readonly connectionQueueManager: ConnectionQueueManager;

  public readonly contentedStreamManager: ContentedStreamManager;

  public readonly callManager: CallManager;

  public readonly autoConnectorManager: AutoConnectorManager;

  public readonly apiManager: ApiManager;

  public readonly incomingCallManager: IncomingCallManager;

  public readonly presentationManager: PresentationManager;

  public readonly statsManager: StatsManager;

  public readonly videoSendingBalancerManager: VideoSendingBalancerManager;

  public readonly sessionManager: SessionManager;

  public readonly mainStreamHealthMonitor: MainStreamHealthMonitor;

  private readonly peerToPeerManager: PeerToPeerManager;

  private readonly mainStreamRecovery: MainStreamRecovery;

  private readonly preferredMimeTypesVideoCodecs?: string[];

  private readonly excludeMimeTypesVideoCodecs?: string[];

  public constructor(
    { JsSIP }: { JsSIP: TJsSIP },
    {
      preferredMimeTypesVideoCodecs,
      excludeMimeTypesVideoCodecs,
      videoBalancerOptions,
      autoConnectorOptions,
    }: {
      preferredMimeTypesVideoCodecs?: string[];
      excludeMimeTypesVideoCodecs?: string[];
      videoBalancerOptions?: IBalancerOptions;
      autoConnectorOptions?: IAutoConnectorOptions;
    } = {},
  ) {
    this.preferredMimeTypesVideoCodecs = preferredMimeTypesVideoCodecs;
    this.excludeMimeTypesVideoCodecs = excludeMimeTypesVideoCodecs;

    this.events = createEvents();
    this.apiManager = new ApiManager();
    this.connectionManager = new ConnectionManager({ JsSIP });
    this.connectionQueueManager = new ConnectionQueueManager({
      connectionManager: this.connectionManager,
    });
    this.contentedStreamManager = new ContentedStreamManager();
    this.callManager = new CallManager(this.contentedStreamManager);
    this.incomingCallManager = new IncomingCallManager(this.connectionManager);
    this.presentationManager = new PresentationManager({
      callManager: this.callManager,
      maxBitrate: ONE_MEGABIT_IN_BITS,
    });
    this.statsManager = new StatsManager({
      callManager: this.callManager,
      apiManager: this.apiManager,
    });
    this.autoConnectorManager = new AutoConnectorManager(
      {
        connectionQueueManager: this.connectionQueueManager,
        connectionManager: this.connectionManager,
        callManager: this.callManager,
      },
      autoConnectorOptions,
    );
    this.videoSendingBalancerManager = new VideoSendingBalancerManager(
      this.callManager,
      this.apiManager,
      videoBalancerOptions,
    );
    this.mainStreamHealthMonitor = new MainStreamHealthMonitor(this.statsManager, this.callManager);
    this.mainStreamRecovery = new MainStreamRecovery(this.callManager);
    this.sessionManager = new SessionManager({
      connectionManager: this.connectionManager,
      callManager: this.callManager,
      incomingCallManager: this.incomingCallManager,
      presentationManager: this.presentationManager,
    });

    this.callManager.subscribeToApiEvents(this.apiManager);
    this.contentedStreamManager.subscribeToApiEvents(this.apiManager);
    this.apiManager.subscribe({
      connectionManager: this.connectionManager,
      callManager: this.callManager,
    });
    this.peerToPeerManager = new PeerToPeerManager();
    this.peerToPeerManager.subscribe({
      connectionManager: this.connectionManager,
      callManager: this.callManager,
      apiManager: this.apiManager,
    });
    this.subscribe();
  }

  public get requestedConnection() {
    return this.connectionManager.requested;
  }

  public get isPendingConnect() {
    return this.connectionManager.isPendingConnect;
  }

  public get isPendingInitUa() {
    return this.connectionManager.isPendingInitUa;
  }

  public get connectionState() {
    return this.connectionManager.connectionState;
  }

  public get isRegistered() {
    return this.connectionManager.isRegistered;
  }

  public get isRegisterConfig() {
    return this.connectionManager.isRegisterConfig;
  }

  public get socket() {
    return this.connectionManager.socket;
  }

  public get requestedCall() {
    return this.callManager.requested;
  }

  public get connection() {
    return this.callManager.connection;
  }

  public get isCallActive() {
    return this.callManager.isCallActive;
  }

  public get remoteCallerData(): IncomingCallManager['remoteCallerData'] {
    return this.incomingCallManager.remoteCallerData;
  }

  public get isAvailableIncomingCall(): IncomingCallManager['isAvailableIncomingCall'] {
    return this.incomingCallManager.isAvailableIncomingCall;
  }

  private get isDirectP2PRoom(): boolean {
    return this.callManager.isDirectP2PRoom;
  }

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.on(eventName, handler);
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

  public connect: ConnectionManager['connect'] = async (...args) => {
    return this.connectionQueueManager.connect(...args);
  };

  public disconnect = async () => {
    return this.connectionQueueManager.disconnect();
  };

  public register = async () => {
    return this.connectionManager.register();
  };

  public unregister = async () => {
    return this.connectionManager.unregister();
  };

  public tryRegister = async () => {
    return this.connectionManager.tryRegister();
  };

  public set: ConnectionManager['set'] = async (...args) => {
    return this.connectionManager.set(...args);
  };

  public sendOptions = async (
    target: Parameters<ConnectionManager['sendOptions']>[0],
    body?: Parameters<ConnectionManager['sendOptions']>[1],
    extraHeaders?: Parameters<ConnectionManager['sendOptions']>[2],
  ) => {
    return this.connectionManager.sendOptions(target, body, extraHeaders);
  };

  public ping = async (
    body?: Parameters<ConnectionManager['ping']>[0],
    extraHeaders?: Parameters<ConnectionManager['ping']>[1],
  ) => {
    return this.connectionManager.ping(body, extraHeaders);
  };

  public checkTelephony: ConnectionManager['checkTelephony'] = async (parameters) => {
    return this.connectionManager.checkTelephony(parameters);
  };

  public isConfigured = () => {
    return this.connectionManager.isConfigured();
  };

  public getConnectionConfiguration = () => {
    return this.connectionManager.getConnectionConfiguration();
  };

  public getUri: TGetUri = (id: string) => {
    return this.connectionManager.getUri(id);
  };

  public startAutoConnect: AutoConnectorManager['start'] = (...args) => {
    this.autoConnectorManager.start(...args);
  };

  public stopAutoConnect: AutoConnectorManager['stop'] = () => {
    this.autoConnectorManager.stop();
  };

  public call = async (params: Parameters<CallManager['startCall']>[2]) => {
    const { onAddedTransceiver, ...rest } = params;

    return this.callManager.startCall(this.connectionManager.getUaProtected(), this.getUri, {
      ...rest,
      onAddedTransceiver: this.resolveHandleAddTransceiver(onAddedTransceiver),
    });
  };

  public hangUp: CallManager['endCall'] = async () => {
    return this.callManager.endCall();
  };

  public answerToIncomingCall = async (
    params: Parameters<CallManager['answerToIncomingCall']>[1],
  ) => {
    const { onAddedTransceiver, ...rest } = params;

    return this.callManager.answerToIncomingCall(
      this.incomingCallManager.extractIncomingRTCSession,
      {
        ...rest,
        onAddedTransceiver: this.resolveHandleAddTransceiver(onAddedTransceiver),
      },
    );
  };

  public declineToIncomingCall: IncomingCallManager['declineToIncomingCall'] = async (...args) => {
    return this.incomingCallManager.declineToIncomingCall(...args);
  };

  public getEstablishedRTCSession: CallManager['getEstablishedRTCSession'] = () => {
    return this.callManager.getEstablishedRTCSession();
  };

  public getRemoteStreams: CallManager['getRemoteStreams'] = () => {
    return this.callManager.getRemoteStreams();
  };

  public getRecvQuality: CallManager['getRecvQuality'] = () => {
    return this.callManager.getRecvQuality();
  };

  public setRecvQuality: CallManager['setRecvQuality'] = async (quality: TRecvQuality) => {
    return this.callManager.setRecvQuality(quality);
  };

  public replaceMediaStream: CallManager['replaceMediaStream'] = async (...args) => {
    return this.callManager.replaceMediaStream(...args);
  };

  public async startPresentation(
    mediaStream: MediaStream,
    options: {
      isNeedReinvite?: boolean;
      contentHint?: TContentHint;
      degradationPreference?: RTCDegradationPreference;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
      callLimit?: number;
    } = {},
  ): Promise<MediaStream> {
    const { callLimit, onAddedTransceiver, ...rest } = options;

    return this.presentationManager.startPresentation(
      async () => {
        await (this.isDirectP2PRoom
          ? this.apiManager.sendAvailableContentedStream()
          : this.apiManager.askPermissionToStartPresentation());
      },
      mediaStream,
      {
        ...rest,
        onAddedTransceiver: this.resolveHandleAddTransceiver(onAddedTransceiver),
      },
      callLimit === undefined ? undefined : { callLimit },
    );
  }

  public async stopPresentation(): Promise<MediaStream | undefined> {
    return this.presentationManager.stopPresentation(async () => {
      await (this.isDirectP2PRoom
        ? this.apiManager.sendNotAvailableContentedStream()
        : this.apiManager.sendStoppedPresentation());
    });
  }

  public async updatePresentation(
    mediaStream: MediaStream,
    options: {
      isNeedReinvite?: boolean;
      contentHint?: TContentHint;
      degradationPreference?: RTCDegradationPreference;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    } = {},
  ): Promise<MediaStream | undefined> {
    const { onAddedTransceiver, ...rest } = options;

    return this.presentationManager.updatePresentation(
      async () => {
        await (this.isDirectP2PRoom
          ? this.apiManager.sendAvailableContentedStream()
          : this.apiManager.askPermissionToStartPresentation());
      },
      mediaStream,
      {
        ...rest,
        onAddedTransceiver: this.resolveHandleAddTransceiver(onAddedTransceiver),
      },
    );
  }

  public async waitChannels(...args: Parameters<ApiManager['waitChannels']>) {
    return this.apiManager.waitChannels(...args);
  }

  public async waitSyncMediaState(...args: Parameters<ApiManager['waitSyncMediaState']>) {
    return this.apiManager.waitSyncMediaState(...args);
  }

  public async sendDTMF(...args: Parameters<ApiManager['sendDTMF']>) {
    return this.apiManager.sendDTMF(...args);
  }

  public async sendChannels(...args: Parameters<ApiManager['sendChannels']>) {
    return this.apiManager.sendChannels(...args);
  }

  public async sendMediaState(...args: Parameters<ApiManager['sendMediaState']>) {
    return this.apiManager.sendMediaState(...args);
  }

  public async sendRefusalToTurnOn(...args: Parameters<ApiManager['sendRefusalToTurnOn']>) {
    return this.apiManager.sendRefusalToTurnOn(...args);
  }

  public async sendRefusalToTurnOnMic(...args: Parameters<ApiManager['sendRefusalToTurnOnMic']>) {
    return this.apiManager.sendRefusalToTurnOnMic(...args);
  }

  public async sendRefusalToTurnOnCam(...args: Parameters<ApiManager['sendRefusalToTurnOnCam']>) {
    return this.apiManager.sendRefusalToTurnOnCam(...args);
  }

  public async askPermissionToEnableCam(
    ...args: Parameters<ApiManager['askPermissionToEnableCam']>
  ) {
    return this.apiManager.askPermissionToEnableCam(...args);
  }

  private subscribeDisconnectedFromOutOfCall() {
    this.connectionManager.on('disconnected', () => {
      if (!this.isCallActive) {
        this.events.trigger('disconnected-from-out-of-call', {});
      }
    });
  }

  private subscribeConnectedWithConfigurationFromOutOfCall() {
    this.connectionManager.on('connected-with-configuration', (configuration) => {
      if (!this.isCallActive) {
        this.events.trigger('connected-with-configuration-from-out-of-call', configuration);
      }
    });
  }

  private mayBeStopPresentationAndNotify() {
    if (this.presentationManager.isPresentationInProcess) {
      this.stopPresentation().catch(() => {
        // Игнорируем ошибки при остановке презентации
      });

      this.events.trigger('stopped-presentation-by-server-command', {});
    }
  }

  private subscribeToApiEvents() {
    this.apiManager.on('participant:move-request-to-participants', () => {
      this.callManager.setCallRoleParticipant();
    });
    this.apiManager.on('participant:move-request-to-spectators-synthetic', () => {
      this.callManager.setCallRoleSpectatorSynthetic();
      this.mayBeStopPresentationAndNotify();
    });
    this.apiManager.on('participant:move-request-to-spectators-with-audio-id', ({ audioId }) => {
      this.callManager.setCallRoleSpectator({ audioId, sendOffer: this.sendOffer });
      this.mayBeStopPresentationAndNotify();
    });
    this.apiManager.on('presentation:must-stop', () => {
      this.mayBeStopPresentationAndNotify();
    });

    this.apiManager.on('failed-send-room-direct-p2p', ({ error }: { error: unknown }) => {
      const message = new IncomingResponse();

      message.body = error instanceof Error ? error.message : String(error);

      const cause = JsSIP_C.causes.INTERNAL_ERROR;

      this.callManager.failed(message, cause).catch((endCallError: unknown) => {
        logger('Failed to end call after failed:', endCallError);
      });
    });
  }

  private readonly sendOffer = async (
    params: {
      conferenceNumber: string;
      token: string;
      quality: 'low' | 'medium' | 'high';
      audioChannel: string;
    },
    offer: RTCSessionDescriptionInit,
  ): Promise<RTCSessionDescription> => {
    const connectionConfiguration = this.connectionManager.getConnectionConfiguration();
    const serverUrl = connectionConfiguration?.sipServerUrl;

    if (serverUrl === undefined) {
      throw new Error('No sipServerUrl for sendOffer');
    }

    return sendOffer({
      serverUrl,
      offer,
      token: params.token,
      conferenceNumber: params.conferenceNumber,
      quality: params.quality,
      audio: params.audioChannel,
    });
  };

  private setCodecPreferences(transceiver: RTCRtpTransceiver) {
    setCodecPreferences(transceiver, {
      preferredMimeTypesVideoCodecs: this.preferredMimeTypesVideoCodecs,
      excludeMimeTypesVideoCodecs: this.excludeMimeTypesVideoCodecs,
    });
  }

  private subscribe() {
    this.bridgeEvents('auto-connect', this.autoConnectorManager);
    this.bridgeEvents('connection', this.connectionManager);
    this.bridgeEvents('call', this.callManager);
    this.bridgeEvents('api', this.apiManager);
    this.bridgeEvents('incoming-call', this.incomingCallManager);
    this.bridgeEvents('presentation', this.presentationManager);
    this.bridgeEvents('stats', this.statsManager);
    this.bridgeEvents('video-balancer', this.videoSendingBalancerManager);
    this.bridgeEvents('main-stream-health', this.mainStreamHealthMonitor);
    this.bridgeEvents('session', this.sessionManager);

    this.subscribeToApiEvents();
    this.subscribeDisconnectedFromOutOfCall();
    this.subscribeConnectedWithConfigurationFromOutOfCall();
    this.subscribeToMainStreamHealthMonitorEvents();
  }

  private subscribeToMainStreamHealthMonitorEvents() {
    this.mainStreamHealthMonitor.on('no-inbound-frames', () => {
      this.mainStreamRecovery.recover();
    });
  }

  private readonly bridgeEvents = <T extends string>(
    prefix: string,
    source: {
      events: {
        eachTriggers: (handler: (trigger: unknown, eventName: T) => void) => void;
      };
      on: (eventName: T, handler: (data: unknown) => void) => unknown;
    },
  ): void => {
    source.events.eachTriggers((_trigger, eventName) => {
      source.on(eventName, (event: unknown) => {
        this.events.trigger(`${prefix}:${eventName}` as TEventName, event);
      });
    });
  };

  private readonly resolveHandleAddTransceiver = (onAddedTransceiver?: TOnAddedTransceiver) => {
    return async (
      transceiver: RTCRtpTransceiver,
      track: MediaStreamTrack,
      streams: MediaStream[],
    ) => {
      this.setCodecPreferences(transceiver);
      await onAddedTransceiver?.(transceiver, track, streams);
    };
  };
}

export default SipConnector;
