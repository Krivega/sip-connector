import { hasVideoTracks } from '@/utils/utils';
import { AbstractCallStrategy } from './AbstractCallStrategy';
import { MCUSession } from './MCUSession';
import { RemoteStreamsManager } from './RemoteStreamsManager';

import type { RTCSession } from '@krivega/jssip';
import type { TEvents } from './eventNames';
import type { ICallStrategy } from './types';

export class MCUCallStrategy extends AbstractCallStrategy {
  private readonly remoteStreamsManager = new RemoteStreamsManager();

  private readonly mcuSession: MCUSession;

  public constructor(events: TEvents) {
    super(events);
    this.mcuSession = new MCUSession(events, { onReset: this.reset });
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

  public startCall: ICallStrategy['startCall'] = async (ua, getSipServerUrl, params) => {
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

  public answerToIncomingCall: ICallStrategy['answerToIncomingCall'] = async (
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
    mediaStream: Parameters<ICallStrategy['replaceMediaStream']>[0],
    options?: Parameters<ICallStrategy['replaceMediaStream']>[1],
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

  public async addTransceiver(
    kind: 'audio' | 'video',
    options?: RTCRtpTransceiverInit,
  ): Promise<RTCRtpTransceiver> {
    return this.mcuSession.addTransceiver(kind, options);
  }

  private readonly reset: () => void = () => {
    this.remoteStreamsManager.reset();
    this.callConfiguration.number = undefined;
    this.callConfiguration.answer = false;
  };
}
