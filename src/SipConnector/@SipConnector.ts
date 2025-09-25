import { Events } from 'events-constructor';

import { ApiManager } from '@/ApiManager';
import { AutoConnectorManager } from '@/AutoConnectorManager';
import { CallManager } from '@/CallManager';
import { ConnectionManager } from '@/ConnectionManager';
import { ConnectionQueueManager } from '@/ConnectionQueueManager';
import { IncomingCallManager } from '@/IncomingCallManager';
import { PresentationManager } from '@/PresentationManager';
import { StatsManager } from '@/StatsManager';
import setCodecPreferences from '@/tools/setCodecPreferences';
import { TransceiverManager } from '@/TransceiverManager';
import { VideoSendingBalancerManager } from '@/VideoSendingBalancerManager';
import { ONE_MEGABIT_IN_BITS } from './constants';
import { EVENT_NAMES } from './eventNames';

import type { IAutoConnectorOptions } from '@/AutoConnectorManager';
import type { TGetServerUrl } from '@/CallManager';
import type { TContentHint, TOnAddedTransceiver } from '@/PresentationManager';
import type { TJsSIP } from '@/types';
import type { IBalancerOptions } from '@/VideoSendingBalancer';
import type { TEvent } from './eventNames';

class SipConnector {
  public readonly events: Events<typeof EVENT_NAMES>;

  public readonly connectionManager: ConnectionManager;

  public readonly connectionQueueManager: ConnectionQueueManager;

  public readonly callManager: CallManager;

  public readonly autoConnectorManager: AutoConnectorManager;

  public readonly apiManager: ApiManager;

  public readonly incomingCallManager: IncomingCallManager;

  public readonly presentationManager: PresentationManager;

  public readonly statsManager: StatsManager;

  public readonly videoSendingBalancerManager: VideoSendingBalancerManager;

  public readonly transceiverManager: TransceiverManager;

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

    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    this.connectionManager = new ConnectionManager({ JsSIP });
    this.connectionQueueManager = new ConnectionQueueManager({
      connectionManager: this.connectionManager,
    });
    this.callManager = new CallManager();
    this.apiManager = new ApiManager({
      connectionManager: this.connectionManager,
      callManager: this.callManager,
    });
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
    this.transceiverManager = new TransceiverManager({
      callManager: this.callManager,
      apiManager: this.apiManager,
    });
    this.videoSendingBalancerManager = new VideoSendingBalancerManager(
      this.callManager,
      this.apiManager,
      videoBalancerOptions,
    );
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

  public get establishedRTCSession() {
    return this.callManager.establishedRTCSession;
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public on<T>(eventName: TEvent, handler: (data: T) => void) {
    return this.events.on<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public once<T>(eventName: TEvent, handler: (data: T) => void) {
    return this.events.once<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceRace<T>(eventNames: TEvent[], handler: (data: T, eventName: string) => void) {
    return this.events.onceRace<T>(eventNames, handler);
  }

  public async wait<T>(eventName: TEvent): Promise<T> {
    return this.events.wait<T>(eventName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public off<T>(eventName: TEvent, handler: (data: T) => void) {
    this.events.off<T>(eventName, handler);
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

  public getSipServerUrl: TGetServerUrl = (id: string) => {
    return this.connectionManager.getSipServerUrl(id);
  };

  public startAutoConnect: AutoConnectorManager['start'] = (...args) => {
    this.autoConnectorManager.start(...args);
  };

  public stopAutoConnect: AutoConnectorManager['stop'] = () => {
    this.autoConnectorManager.stop();
  };

  public call = async (params: Parameters<CallManager['startCall']>[2]) => {
    const { onAddedTransceiver, ...rest } = params;

    return this.callManager.startCall(
      this.connectionManager.getUaProtected(),
      this.getSipServerUrl,
      {
        ...rest,
        onAddedTransceiver: this.resolveHandleAddTransceiver(onAddedTransceiver),
      },
    );
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

  public getCallConfiguration: CallManager['getCallConfiguration'] = () => {
    return this.callManager.getCallConfiguration();
  };

  public getRemoteStreams: CallManager['getRemoteStreams'] = () => {
    return this.callManager.getRemoteStreams();
  };

  public replaceMediaStream: CallManager['replaceMediaStream'] = async (...args) => {
    return this.callManager.replaceMediaStream(...args);
  };

  public async startPresentation(
    mediaStream: MediaStream,
    options: {
      isP2P?: boolean;
      isNeedReinvite?: boolean;
      contentHint?: TContentHint;
      degradationPreference?: RTCDegradationPreference;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
      callLimit?: number;
    } = {},
  ): Promise<MediaStream> {
    const { isP2P, callLimit, onAddedTransceiver, ...rest } = options;

    return this.presentationManager.startPresentation(
      async () => {
        if (isP2P === true) {
          await this.apiManager.sendMustStopPresentationP2P();
          await this.apiManager.askPermissionToStartPresentationP2P();
        } else {
          await this.apiManager.askPermissionToStartPresentation();
        }
      },
      mediaStream,
      {
        ...rest,
        onAddedTransceiver: this.resolveHandleAddTransceiver(onAddedTransceiver),
      },
      callLimit === undefined ? undefined : { callLimit },
    );
  }

  public async stopPresentation(
    options: { isP2P?: boolean } = {},
  ): Promise<MediaStream | undefined> {
    const { isP2P } = options;

    return this.presentationManager.stopPresentation(async () => {
      await (isP2P === true
        ? this.apiManager.sendMustStopPresentationP2P()
        : this.apiManager.sendStoppedPresentation());
    });
  }

  public async updatePresentation(
    mediaStream: MediaStream,
    options: {
      isP2P?: boolean;
      isNeedReinvite?: boolean;
      contentHint?: TContentHint;
      degradationPreference?: RTCDegradationPreference;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    } = {},
  ): Promise<MediaStream | undefined> {
    const { isP2P, onAddedTransceiver, ...rest } = options;

    return this.presentationManager.updatePresentation(
      async () => {
        if (isP2P === true) {
          await this.apiManager.sendMustStopPresentationP2P();
          await this.apiManager.askPermissionToStartPresentationP2P();
        } else {
          await this.apiManager.askPermissionToStartPresentation();
        }
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

  public async sendMustStopPresentationP2P(
    ...args: Parameters<ApiManager['sendMustStopPresentationP2P']>
  ) {
    return this.apiManager.sendMustStopPresentationP2P(...args);
  }

  public async sendStoppedPresentationP2P(
    ...args: Parameters<ApiManager['sendStoppedPresentationP2P']>
  ) {
    return this.apiManager.sendStoppedPresentationP2P(...args);
  }

  public async sendStoppedPresentation(...args: Parameters<ApiManager['sendStoppedPresentation']>) {
    return this.apiManager.sendStoppedPresentation(...args);
  }

  public async askPermissionToStartPresentationP2P(
    ...args: Parameters<ApiManager['askPermissionToStartPresentationP2P']>
  ) {
    return this.apiManager.askPermissionToStartPresentationP2P(...args);
  }

  public async askPermissionToStartPresentation(
    ...args: Parameters<ApiManager['askPermissionToStartPresentation']>
  ) {
    return this.apiManager.askPermissionToStartPresentation(...args);
  }

  public async askPermissionToEnableCam(
    ...args: Parameters<ApiManager['askPermissionToEnableCam']>
  ) {
    return this.apiManager.askPermissionToEnableCam(...args);
  }

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
        this.events.trigger(`${prefix}:${eventName}` as TEvent, event);
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
