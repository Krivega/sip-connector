import { setPresentationMaxBitrate, applyContentHint } from '@/utils/peerConnection';
import { PresentationReinviteError, PresentationTrackError } from '../errors';
import resolveSendEncodings from '../resolveSendEncodings';

import type { TResolutionSize } from '@/types';
import type { TContentHint, TOnAddedTransceiver } from '@/utils/peerConnection';
import type { TTransceiverOptions } from '@/utils/peerConnection/types';
import type { TEvents } from '../events';
import type { TPresentationSessionPort } from './createCallManagerPort';
import type { PresentationStateMachine } from '../PresentationStateMachine';
import type PresentationTrackService from '../PresentationTrackService';

type TPresentationLifecycleDeps = {
  events: TEvents;
  trackService: PresentationTrackService;
  sessionPort: TPresentationSessionPort;
  stateMachine: PresentationStateMachine;
  maxBitrate?: number;
};

type TStartPresentationRtcOptions = {
  degradationPreference?: RTCDegradationPreference;
  onAddedTransceiver?: TOnAddedTransceiver;
  sendEncodings?: RTCRtpEncodingParameters[];
};

type TPresentationFlowOptions = {
  contentHint?: TContentHint;
  sendEncodings?: RTCRtpEncodingParameters[];
  maxResolution?: TResolutionSize;
  onAddedTransceiver?: TOnAddedTransceiver;
  degradationPreference?: RTCDegradationPreference;
  isNeedReinvite?: boolean;
};

const normalizePresentationError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
};

export class PresentationLifecycle {
  private readonly events: TEvents;

  private readonly trackService: PresentationTrackService;

  private readonly sessionPort: TPresentationSessionPort;

  private readonly stateMachine: PresentationStateMachine;

  private readonly maxBitrate?: number;

  public constructor({
    events,
    trackService,
    sessionPort,
    stateMachine,
    maxBitrate,
  }: TPresentationLifecycleDeps) {
    this.events = events;
    this.trackService = trackService;
    this.sessionPort = sessionPort;
    this.stateMachine = stateMachine;
    this.maxBitrate = maxBitrate;
  }

  public guardEstablishedSession(): void {
    if (!this.sessionPort.getEstablishedSession()) {
      throw new Error('No rtcSession established');
    }
  }

  public getConnectionProtected(): RTCPeerConnection {
    const connection = this.sessionPort.getConnection();

    if (!connection) {
      throw new Error('No connection established');
    }

    return connection;
  }

  public async executeStartFlow(
    beforeStartPresentation: () => Promise<void>,
    videoTrack: MediaStreamVideoTrack,
    {
      isNeedReinvite = true,
      contentHint = 'detail',
      degradationPreference,
      sendEncodings,
      maxResolution,
      onAddedTransceiver,
    }: TPresentationFlowOptions,
  ): Promise<MediaStreamVideoTrack> {
    applyContentHint(videoTrack, contentHint);

    const presentationSendEncodings = resolveSendEncodings({
      videoTrack,
      sendEncodings,
      maxResolution,
    });

    await beforeStartPresentation();

    try {
      await this.attachTrack(videoTrack, isNeedReinvite, {
        degradationPreference,
        onAddedTransceiver,
        sendEncodings: presentationSendEncodings,
      });
      await this.applyMaxBitrate();

      return videoTrack;
    } catch (error: unknown) {
      this.notifyFailed(error);

      throw error;
    }
  }

  public async executeUpdateFlow(
    beforeStartPresentation: () => Promise<void>,
    videoTrack: MediaStreamVideoTrack,
    {
      contentHint = 'detail',
      degradationPreference,
      sendEncodings,
      maxResolution,
      onAddedTransceiver,
    }: TPresentationFlowOptions,
  ): Promise<MediaStreamVideoTrack> {
    applyContentHint(videoTrack, contentHint);

    const presentationSendEncodings = resolveSendEncodings({
      videoTrack,
      sendEncodings,
      maxResolution,
    });

    await beforeStartPresentation();

    try {
      await this.replaceActiveTrack(videoTrack, {
        degradationPreference,
        onAddedTransceiver,
        sendEncodings: presentationSendEncodings,
      });
      await this.applyMaxBitrate();

      return videoTrack;
    } catch (error: unknown) {
      this.notifyFailed(error);

      throw error;
    }
  }

  public async executeStop(videoTrack: MediaStreamVideoTrack): Promise<MediaStreamVideoTrack> {
    this.events.trigger('end', videoTrack);

    const connection = this.sessionPort.getConnection();

    if (connection) {
      this.trackService.stop(connection);
    }

    this.events.trigger('ended', videoTrack);

    return videoTrack;
  }

  public emitEndedOnly(videoTrack: MediaStreamVideoTrack): void {
    this.events.trigger('ended', videoTrack);
  }

  public resetTrackService(): void {
    this.trackService.clear();
  }

  private async attachTrack(
    videoTrack: MediaStreamVideoTrack,
    isNeedReinvite: boolean,
    options: TStartPresentationRtcOptions,
  ): Promise<void> {
    const connection = this.getConnectionProtected();

    this.events.trigger('start', videoTrack);

    try {
      await this.trackService.addOrReplace(connection, videoTrack, options);

      if (isNeedReinvite) {
        try {
          await this.sessionPort.renegotiate();
        } catch (reinviteError: unknown) {
          this.trackService.stop(connection);

          throw new PresentationReinviteError(reinviteError);
        }
      }

      this.events.trigger('started', videoTrack);
    } catch (error: unknown) {
      if (error instanceof PresentationReinviteError) {
        throw error;
      }

      throw new PresentationTrackError(error);
    }
  }

  private async replaceActiveTrack(
    videoTrack: MediaStreamVideoTrack,
    options: TTransceiverOptions,
  ): Promise<void> {
    const connection = this.getConnectionProtected();

    this.events.trigger('updating', videoTrack);

    try {
      await this.trackService.addOrReplace(connection, videoTrack, options);
      this.events.trigger('updated', videoTrack);
    } catch (error: unknown) {
      throw new PresentationTrackError(error);
    }
  }

  private async applyMaxBitrate(): Promise<void> {
    await setPresentationMaxBitrate({
      connection: this.sessionPort.getConnection(),
      videoTrack: this.stateMachine.activeVideoTrack,
      maxBitrate: this.maxBitrate,
    });
  }

  private notifyFailed(error: unknown): void {
    this.events.trigger('failed', normalizePresentationError(error));
  }
}
