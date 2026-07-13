import { EventEmitterProxy } from 'events-constructor';
import { hasCanceledError } from 'repeated-calls';

import { createEvents } from './events';
import {
  createCallManagerPort,
  PresentationConcurrency,
  PresentationLifecycle,
} from './orchestration';
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

  private readonly concurrency = new PresentationConcurrency();

  private readonly lifecycle: PresentationLifecycle;

  private readonly sessionPort: TPresentationSessionPort;

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

  // eslint-disable-next-line @typescript-eslint/max-params
  public async startPresentation(
    beforeStartPresentation: () => Promise<void>,
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

    if (this.stateMachine.isActiveOrPending) {
      throw new Error('Presentation is already started');
    }

    return this.concurrency.runWithRepeatedCalls(
      async () => {
        return this.concurrency.runStart(async () => {
          return this.lifecycle.executeStartFlow(beforeStartPresentation, videoTrack, {
            isNeedReinvite,
            contentHint,
            sendEncodings,
            maxResolution,
            onAddedTransceiver,
          });
        });
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

    const videoTrack = this.getStopVideoTrack();

    return this.concurrency.runStop(async () => {
      if (videoTrack === undefined) {
        return undefined;
      }

      const rtcSession = this.sessionPort.getEstablishedSession();

      try {
        if (rtcSession !== undefined) {
          await beforeStopPresentation();

          return await this.lifecycle.executeStop(videoTrack);
        }

        this.lifecycle.emitEndedOnly(videoTrack);

        return undefined;
      } catch (error: unknown) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));

        this.events.trigger('failed', normalizedError);

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
    this.concurrency.clearPending();
    this.lifecycle.resetTrackService();
    this.stateMachine.reset();
  }
}

export default PresentationManager;
