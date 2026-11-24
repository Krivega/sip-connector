import {
  setPresentationMaxBitrate,
  applyContentHint,
  findSenderByTrack,
} from '@/utils/peerConnection';
import { PresentationReinviteError, PresentationTrackError } from '../errors';
import { resolvePresentationSendEncodings } from '../PresentationFrameSizeLimiter';

import type { TResolutionSize } from '@/types';
import type { TContentHint, TOnAddedTransceiver } from '@/utils/peerConnection';
import type { TTransceiverOptions } from '@/utils/peerConnection/types';
import type { TEvents } from '../events';
import type PresentationFrameSizeLimiter from '../PresentationFrameSizeLimiter';
import type { PresentationStateMachine } from '../PresentationStateMachine';
import type PresentationTrackService from '../PresentationTrackService';
import type { TPresentationSessionPort } from './createCallManagerPort';

type TPresentationLifecycleDeps = {
  events: TEvents;
  trackService: PresentationTrackService;
  frameSizeLimiter: PresentationFrameSizeLimiter;
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
  return error instanceof Error ? error : new Error(String(error));
};

export class PresentationLifecycle {
  private readonly events: TEvents;

  private readonly trackService: PresentationTrackService;

  private readonly frameSizeLimiter: PresentationFrameSizeLimiter;

  private readonly sessionPort: TPresentationSessionPort;

  private readonly stateMachine: PresentationStateMachine;

  private readonly maxBitrate?: number;

  public constructor({
    events,
    trackService,
    frameSizeLimiter,
    sessionPort,
    stateMachine,
    maxBitrate,
  }: TPresentationLifecycleDeps) {
    this.events = events;
    this.trackService = trackService;
    this.frameSizeLimiter = frameSizeLimiter;
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
    beforeStartPresentation: (signal: AbortSignal) => Promise<void>,
    videoTrack: MediaStreamVideoTrack,
    {
      isNeedReinvite = true,
      contentHint = 'detail',
      degradationPreference,
      sendEncodings,
      maxResolution,
      onAddedTransceiver,
      signal,
    }: TPresentationFlowOptions & { signal: AbortSignal },
  ): Promise<MediaStreamVideoTrack> {
    applyContentHint(videoTrack, contentHint);

    const presentationSendEncodings = resolvePresentationSendEncodings({
      videoTrack,
      sendEncodings,
      maxResolution,
    });

    await beforeStartPresentation(signal);

    // Остановка во время ожидания сервера ещё не видела трек, поэтому отменённый старт его не добавляет
    if (signal.aborted) {
      throw new Error('Presentation start is canceled');
    }

    try {
      await this.attachTrack(videoTrack, isNeedReinvite, {
        degradationPreference,
        onAddedTransceiver,
        sendEncodings: presentationSendEncodings,
      });
      await this.applyMaxBitrate();
      this.watchFrameSize(videoTrack, { sendEncodings, maxResolution });

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

    const presentationSendEncodings = resolvePresentationSendEncodings({
      videoTrack,
      sendEncodings,
      maxResolution,
    });

    await beforeStartPresentation();

    // Отказ сервера оставляет прежний трек, поэтому слежение за ним снимаем только перед заменой
    this.frameSizeLimiter.stop();

    try {
      await this.replaceActiveTrack(videoTrack, {
        degradationPreference,
        onAddedTransceiver,
        sendEncodings: presentationSendEncodings,
      });
      await this.applyMaxBitrate();
      this.watchFrameSize(videoTrack, { sendEncodings, maxResolution });

      return videoTrack;
    } catch (error: unknown) {
      this.notifyFailed(error);

      throw error;
    }
  }

  public async executeStop(videoTrack: MediaStreamVideoTrack): Promise<MediaStreamVideoTrack> {
    this.frameSizeLimiter.stop();
    this.events.trigger('end', videoTrack);

    const connection = this.sessionPort.getConnection();

    if (connection) {
      this.trackService.stop(connection);
    }

    this.events.trigger('ended', videoTrack);

    return videoTrack;
  }

  public emitEndedOnly(videoTrack: MediaStreamVideoTrack): void {
    this.frameSizeLimiter.stop();
    this.events.trigger('ended', videoTrack);
  }

  public resetTrackService(): void {
    this.frameSizeLimiter.stop();
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
          await this.sendRenegotiation();
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

  // JsSIP сам дожидается конца другого согласования в звонке (например, INVITE от сервера);
  // false — reINVITE не отправлен: звонок так и не освободился или завершился
  private async sendRenegotiation(): Promise<void> {
    const isRenegotiated = await this.sessionPort.renegotiate();

    if (!isRenegotiated) {
      throw new Error('Renegotiation was not sent');
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

  // Следим только за активной демонстрацией: остановка или конец звонка во время flow её уже сняли
  private watchFrameSize(
    videoTrack: MediaStreamVideoTrack,
    options: Pick<TPresentationFlowOptions, 'sendEncodings' | 'maxResolution'>,
  ): void {
    const connection = this.sessionPort.getConnection();

    if (!this.stateMachine.isActive || !connection) {
      return;
    }

    const sender = findSenderByTrack(connection, videoTrack);

    if (sender) {
      this.frameSizeLimiter.watch(sender, options);
    }
  }

  private notifyFailed(error: unknown): void {
    this.events.trigger('failed', normalizePresentationError(error));
  }
}
