import { EventEmitterProxy } from 'events-constructor';
import { hasCanceledError } from 'repeated-calls';

import { createEvents } from './events';
import {
  createCallManagerPort,
  PresentationConcurrency,
  PresentationLifecycle,
} from './orchestration';
import PresentationFrameSizeLimiter from './PresentationFrameSizeLimiter';
import { PresentationStateMachine } from './PresentationStateMachine';
import PresentationTrackService from './PresentationTrackService';

import type { CallManager } from '@/CallManager';
import type { TResolutionSize } from '@/types';
import type { TContentHint, TOnAddedTransceiver } from '@/utils/peerConnection';
import type { TEventMap } from './events';
import type { TPresentationSessionPort } from './orchestration';

type TPresentationOptions = {
  isNeedReinvite?: boolean;
  contentHint?: TContentHint;
  sendEncodings?: RTCRtpEncodingParameters[];
  maxResolution?: TResolutionSize;
  onAddedTransceiver?: TOnAddedTransceiver;
};

export const hasCanceledStartPresentationError = (error: unknown) => {
  return hasCanceledError(error);
};

class PresentationManager extends EventEmitterProxy<TEventMap> {
  public readonly stateMachine: PresentationStateMachine;

  private readonly trackService = new PresentationTrackService();

  private readonly frameSizeLimiter = new PresentationFrameSizeLimiter();

  private readonly concurrency = new PresentationConcurrency();

  private readonly lifecycle: PresentationLifecycle;

  private readonly sessionPort: TPresentationSessionPort;

  private presentation?: { startConfirmed: boolean };

  public constructor({
    callManager,
    maxBitrate,
  }: {
    callManager: CallManager;
    maxBitrate?: number;
  }) {
    super(createEvents());

    this.stateMachine = new PresentationStateMachine(this.events, callManager.events);
    this.sessionPort = createCallManagerPort(callManager);
    this.lifecycle = new PresentationLifecycle({
      events: this.events,
      trackService: this.trackService,
      frameSizeLimiter: this.frameSizeLimiter,
      sessionPort: this.sessionPort,
      stateMachine: this.stateMachine,
      maxBitrate,
    });
    this.sessionPort.onCallEnded(this.handleCallEnded);
  }

  public get isPendingPresentation(): boolean {
    return this.stateMachine.isPending || this.concurrency.isPending;
  }

  public get isPresentationInProcess(): boolean {
    return this.stateMachine.isActiveOrPending || this.concurrency.isPending;
  }

  // Только пока демонстрация идёт: трек из state machine покрывает старт до регистрации sender,
  // реестр — замену трека, когда на sender ещё прежний трек демонстрации
  public isPresentationSender(sender: RTCRtpSender): boolean {
    return (
      this.stateMachine.isActiveOrPending &&
      (sender.track === this.stateMachine.activeVideoTrack || this.trackService.has(sender))
    );
  }

  // eslint-disable-next-line @typescript-eslint/max-params
  public async startPresentation(
    beforeStartPresentation: (signal: AbortSignal) => Promise<void>,
    videoTrack: MediaStreamVideoTrack,
    {
      isNeedReinvite,
      contentHint,
      sendEncodings,
      maxResolution,
      onAddedTransceiver,
    }: TPresentationOptions = {},
    options?: { callLimit: number },
  ): Promise<MediaStreamVideoTrack> {
    this.lifecycle.guardEstablishedSession();

    if (this.stateMachine.isActiveOrPending || this.concurrency.isStartPending) {
      throw new Error('Presentation is already started');
    }

    const presentation = { startConfirmed: false };

    this.presentation = presentation;

    return this.concurrency.runWithRepeatedCalls(
      async (signal) => {
        return this.lifecycle.executeStartFlow(
          async (startSignal) => {
            await beforeStartPresentation(startSignal);
            presentation.startConfirmed = true;
          },
          videoTrack,
          {
            isNeedReinvite,
            contentHint,
            sendEncodings,
            maxResolution,
            onAddedTransceiver,
            signal,
          },
        );
      },
      () => {
        return this.stateMachine.isActive;
      },
      options,
    );
  }

  public async stopPresentation(
    beforeStopPresentation: () => Promise<void>,
  ): Promise<MediaStreamVideoTrack | undefined> {
    this.concurrency.cancel();

    const { presentation } = this;
    const videoTrack = this.getStopVideoTrack();

    return this.concurrency.runStop(async () => {
      if (
        presentation === undefined ||
        presentation !== this.presentation ||
        !presentation.startConfirmed
      ) {
        return undefined;
      }

      presentation.startConfirmed = false;

      try {
        const rtcSession = this.sessionPort.getEstablishedSession();

        if (!rtcSession) {
          if (videoTrack !== undefined) {
            this.lifecycle.emitEndedOnly(videoTrack);
          }

          return undefined;
        }

        if (videoTrack !== undefined) {
          await this.lifecycle.executeStop(videoTrack);
        }

        // Отзываем подтверждённый INFO и при отмене до добавления трека.
        if (this.sessionPort.getEstablishedSession() === rtcSession) {
          await beforeStopPresentation();
        }

        return videoTrack;
      } catch (error: unknown) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));

        if (this.presentation === presentation) {
          presentation.startConfirmed = true;
          this.events.trigger('failed', normalizedError);
        }

        throw error;
      }
    });
  }

  public async updatePresentation(
    beforeStartPresentation: () => Promise<void>,
    videoTrack: MediaStreamVideoTrack,
    { contentHint, sendEncodings, maxResolution, onAddedTransceiver }: TPresentationOptions = {},
  ): Promise<MediaStreamVideoTrack | undefined> {
    this.lifecycle.guardEstablishedSession();

    if (
      !this.stateMachine.isActive &&
      !this.stateMachine.isStarting &&
      !this.concurrency.isPending
    ) {
      throw new Error('Presentation has not started yet');
    }

    await this.concurrency.awaitPendingStart();

    return this.concurrency.runStart(async () => {
      return this.lifecycle.executeUpdateFlow(beforeStartPresentation, videoTrack, {
        contentHint,
        sendEncodings,
        maxResolution,
        onAddedTransceiver,
        isNeedReinvite: false,
      });
    });
  }

  public cancelSendPresentationWithRepeatedCalls(): void {
    this.concurrency.cancel();
  }

  private getStopVideoTrack(): MediaStreamVideoTrack | undefined {
    return this.stateMachine.activeVideoTrack ?? this.stateMachine.pendingVideoTrack;
  }

  private readonly handleCallEnded = (): void => {
    this.reset();
  };

  private reset(): void {
    this.cancelSendPresentationWithRepeatedCalls();
    this.presentation = undefined;
    this.concurrency.clearPending();
    this.lifecycle.resetTrackService();
    this.stateMachine.reset();
  }
}

export default PresentationManager;
