import type { TApiEvent } from './ApiManager';
import { ApiManager } from './ApiManager';
import type { TCallEvent } from './CallManager';
import { CallManager } from './CallManager';
import type { TConnectionManagerEvent } from './ConnectionManager';
import { ConnectionManager } from './ConnectionManager';
import type { TIncomingCallEvent } from './IncomingCallManager';
import { IncomingCallManager } from './IncomingCallManager';
import { PresentationManager } from './PresentationManager';
import type { TContentHint, TOnAddedTransceiver } from './PresentationManager/types';
import type { TGetServerUrl, TJsSIP } from './types';

class SipConnector {
  public readonly connectionManager: ConnectionManager;

  public readonly callManager: CallManager;

  public readonly apiManager: ApiManager;

  public readonly incomingCallManager: IncomingCallManager;

  public readonly presentationManager: PresentationManager;

  public constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.connectionManager = new ConnectionManager({ JsSIP });
    this.callManager = new CallManager();
    this.apiManager = new ApiManager({
      connectionManager: this.connectionManager,
      callManager: this.callManager,
    });
    this.incomingCallManager = new IncomingCallManager(this.connectionManager);
    this.presentationManager = new PresentationManager({
      callManager: this.callManager,
    });
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

  public get remoteCallerData(): IncomingCallManager['remoteCallerData'] {
    return this.incomingCallManager.remoteCallerData;
  }

  public connect: ConnectionManager['connect'] = async (...args) => {
    return this.connectionManager.connect(...args);
  };

  public set: ConnectionManager['set'] = async (...args) => {
    return this.connectionManager.set(...args);
  };

  public disconnect = async () => {
    return this.connectionManager.disconnect();
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onConnection<T>(eventName: TConnectionManagerEvent, handler: (data: T) => void) {
    return this.connectionManager.on<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceConnection<T>(eventName: TConnectionManagerEvent, handler: (data: T) => void) {
    return this.connectionManager.once<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceRaceConnection<T>(
    eventNames: TConnectionManagerEvent[],
    handler: (data: T, eventName: string) => void,
  ) {
    return this.connectionManager.onceRace<T>(eventNames, handler);
  }

  public async waitConnection<T>(eventName: TConnectionManagerEvent): Promise<T> {
    return this.connectionManager.wait<T>(eventName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public offConnection<T>(eventName: TConnectionManagerEvent, handler: (data: T) => void) {
    this.connectionManager.off<T>(eventName, handler);
  }

  public isConfigured = () => {
    return this.connectionManager.isConfigured();
  };

  public getConnectionConfiguration = () => {
    return this.connectionManager.getConnectionConfiguration();
  };

  public getSipServerUrl: TGetServerUrl = (id: string) => {
    return this.connectionManager.getSipServerUrl(id);
  };

  public call = async (params: Parameters<CallManager['startCall']>[2]) => {
    return this.callManager.startCall(
      this.connectionManager.getUaProtected(),
      this.getSipServerUrl,
      params,
    );
  };

  public hangUp: CallManager['endCall'] = async () => {
    return this.callManager.endCall();
  };

  public answerToIncomingCall = async (
    params: Parameters<CallManager['answerToIncomingCall']>[1],
  ) => {
    return this.callManager.answerToIncomingCall(
      this.incomingCallManager.extractIncomingRTCSession,
      params,
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onCall<T>(eventName: TCallEvent, handler: (data: T) => void) {
    return this.callManager.on<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceCall<T>(eventName: TCallEvent, handler: (data: T) => void) {
    return this.callManager.once<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceRaceCall<T>(eventNames: TCallEvent[], handler: (data: T, eventName: string) => void) {
    return this.callManager.onceRace<T>(eventNames, handler);
  }

  public async waitCall<T>(eventName: TCallEvent): Promise<T> {
    return this.callManager.wait<T>(eventName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public offIncomingCall<T>(eventName: TIncomingCallEvent, handler: (data: T) => void) {
    this.incomingCallManager.off<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onIncomingCall<T>(eventName: TIncomingCallEvent, handler: (data: T) => void) {
    return this.incomingCallManager.on<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceIncomingCall<T>(eventName: TIncomingCallEvent, handler: (data: T) => void) {
    return this.incomingCallManager.once<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceRaceIncomingCall<T>(
    eventNames: TIncomingCallEvent[],
    handler: (data: T, eventName: string) => void,
  ) {
    return this.incomingCallManager.onceRace<T>(eventNames, handler);
  }

  public async waitIncomingCall<T>(eventName: TIncomingCallEvent): Promise<T> {
    return this.incomingCallManager.wait<T>(eventName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public offCall<T>(eventName: TCallEvent, handler: (data: T) => void) {
    this.callManager.off<T>(eventName, handler);
  }

  public async startPresentation(
    stream: MediaStream,
    options: {
      isP2P: boolean;
      isNeedReinvite?: boolean;
      maxBitrate?: number;
      contentHint?: TContentHint;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
      callLimit?: number;
    },
  ): Promise<MediaStream> {
    const { isP2P, callLimit, ...rest } = options;

    if (isP2P) {
      await this.apiManager.sendMustStopPresentationP2P();
      await this.apiManager.askPermissionToStartPresentationP2P();
    } else {
      await this.apiManager.askPermissionToStartPresentation();
    }

    return this.presentationManager.startPresentation(
      stream,
      rest,
      callLimit === undefined ? undefined : { callLimit },
    );
  }

  public async stopPresentation(options: { isP2P: boolean }): Promise<MediaStream | undefined> {
    const { isP2P } = options;

    if (isP2P) {
      await this.apiManager.sendStoppedPresentationP2P();
    } else {
      await this.apiManager.sendStoppedPresentation();
    }

    return this.presentationManager.stopPresentation();
  }

  public async updatePresentation(
    stream: MediaStream,
    options: {
      isP2P: boolean;
      isNeedReinvite?: boolean;
      maxBitrate?: number;
      contentHint?: TContentHint;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    },
  ): Promise<MediaStream | undefined> {
    const { isP2P, ...rest } = options;

    if (isP2P) {
      await this.apiManager.sendMustStopPresentationP2P();
      await this.apiManager.askPermissionToStartPresentationP2P();
    } else {
      await this.apiManager.askPermissionToStartPresentation();
    }

    return this.presentationManager.updatePresentation(stream, rest);
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onApi<T>(eventName: TApiEvent, handler: (data: T) => void) {
    return this.apiManager.on<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceApi<T>(eventName: TApiEvent, handler: (data: T) => void) {
    return this.apiManager.once<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceRaceApi<T>(eventNames: TApiEvent[], handler: (data: T, eventName: string) => void) {
    return this.apiManager.onceRace<T>(eventNames, handler);
  }

  public async waitApi<T>(eventName: TApiEvent): Promise<T> {
    return this.apiManager.wait<T>(eventName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public offApi<T>(eventName: TApiEvent, handler: (data: T) => void) {
    this.apiManager.off<T>(eventName, handler);
  }
}

export default SipConnector;
