import { EventEmitterProxy } from 'events-constructor';
import { hasCanceledError, repeatedCallsAsync } from 'repeated-calls';

import { setEncodingsToSender } from '@/tools/setParametersToSender';
import { createEvents } from './events';
import PresentationSenders from './PresentationSenders';
import { addOrReplacePresentationVideoTrack } from './presentationSession';
import { PresentationStateMachine } from './PresentationStateMachine';
import resolveSendEncodings from './resolveSendEncodings';

import type { CallManager } from '@/CallManager';
import type { TEventMap } from './events';
import type { TContentHint, TMaxResolution, TOnAddedTransceiver } from './types';

const SEND_PRESENTATION_CALL_LIMIT = 1;

type TPresentationOptions = {
  isNeedReinvite?: boolean;
  contentHint?: TContentHint;
  sendEncodings?: RTCRtpEncodingParameters[];
  maxResolution?: TMaxResolution;
  onAddedTransceiver?: TOnAddedTransceiver;
};

type TSendPresentationOptions = TPresentationOptions & {
  degradationPreference?: RTCDegradationPreference;
};

type TSendPresentationWithDuplicatedCallsOptions = {
  videoTrack: MediaStreamVideoTrack;
  presentationOptions: TPresentationOptions;
  options?: { callLimit: number };
};

const normalizePresentationError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
};

const applyContentHint = (videoTrack: MediaStreamVideoTrack, contentHint: TContentHint): void => {
  if (contentHint === 'none') {
    return;
  }

  if ('contentHint' in videoTrack && videoTrack.contentHint !== contentHint) {
    // eslint-disable-next-line no-param-reassign
    videoTrack.contentHint = contentHint;
  }
};

export const hasCanceledStartPresentationError = (error: unknown) => {
  return hasCanceledError(error);
};

class PresentationManager extends EventEmitterProxy<TEventMap> {
  public readonly stateMachine: PresentationStateMachine;

  public promisePendingStartPresentation?: Promise<MediaStreamVideoTrack>;

  public promisePendingStopPresentation?: Promise<MediaStreamVideoTrack | undefined>;

  public videoTrackPresentationCurrent?: MediaStreamVideoTrack;

  private readonly maxBitrate?: number;

  private readonly presentationSenders = new PresentationSenders();

  private cancelableSendPresentationWithRepeatedCalls:
    ReturnType<typeof repeatedCallsAsync<MediaStreamVideoTrack>> | undefined;

  private readonly callManager: CallManager;

  public constructor({
    callManager,
    maxBitrate,
  }: {
    callManager: CallManager;
    maxBitrate?: number;
  }) {
    super(createEvents());

    this.callManager = callManager;
    this.maxBitrate = maxBitrate;
    this.stateMachine = new PresentationStateMachine(this.events, this.callManager.events);
    this.subscribe();
  }

  public get isPendingPresentation(): boolean {
    return !!this.promisePendingStartPresentation || !!this.promisePendingStopPresentation;
  }

  public get isPresentationInProcess(): boolean {
    return !!this.videoTrackPresentationCurrent || this.isPendingPresentation;
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
    this.getRtcSessionProtected();

    if (this.videoTrackPresentationCurrent) {
      throw new Error('Presentation is already started');
    }

    return this.sendPresentationWithDuplicatedCalls(beforeStartPresentation, {
      videoTrack,
      presentationOptions: {
        isNeedReinvite,
        contentHint,
        sendEncodings,
        maxResolution,
        onAddedTransceiver,
      },
      options,
    });
  }

  public async stopPresentation(
    beforeStopPresentation: () => Promise<void>,
  ): Promise<MediaStreamVideoTrack | undefined> {
    this.cancelSendPresentationWithRepeatedCalls();

    const videoTrackPresentationPrevious = this.videoTrackPresentationCurrent;
    let result: Promise<MediaStreamVideoTrack | undefined> =
      this.promisePendingStartPresentation ?? Promise.resolve(undefined);

    if (this.promisePendingStartPresentation) {
      await this.promisePendingStartPresentation.catch(() => {});
    }

    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (rtcSession && videoTrackPresentationPrevious) {
      result = beforeStopPresentation()
        .then(async () => {
          return this.executeStopPresentation(videoTrackPresentationPrevious);
        })
        .catch((error: unknown) => {
          this.notifyPresentationFailed(error);

          throw error;
        });
    } else if (videoTrackPresentationPrevious) {
      this.emitPresentationEvent('ended', videoTrackPresentationPrevious);
    }

    this.promisePendingStopPresentation = result;

    return result.finally(() => {
      this.resetPresentationState();
    });
  }

  public async updatePresentation(
    beforeStartPresentation: () => Promise<void>,
    videoTrack: MediaStreamVideoTrack,
    { contentHint, sendEncodings, maxResolution, onAddedTransceiver }: TPresentationOptions = {},
  ): Promise<MediaStreamVideoTrack | undefined> {
    this.getRtcSessionProtected();

    if (!this.videoTrackPresentationCurrent) {
      throw new Error('Presentation has not started yet');
    }

    if (this.promisePendingStartPresentation) {
      await this.promisePendingStartPresentation;
    }

    return this.sendPresentation(beforeStartPresentation, videoTrack, {
      contentHint,
      sendEncodings,
      maxResolution,
      onAddedTransceiver,
      isNeedReinvite: false,
    }).then(async (track) => {
      await this.setMaxBitrate();

      return track;
    });
  }

  public cancelSendPresentationWithRepeatedCalls() {
    this.cancelableSendPresentationWithRepeatedCalls?.stopRepeatedCalls();
  }

  private subscribe() {
    this.callManager.on('failed', this.handleEnded);
    this.callManager.on('ended', this.handleEnded);
  }

  private async sendPresentationWithDuplicatedCalls(
    beforeStartPresentation: () => Promise<void>,
    {
      videoTrack,
      presentationOptions,
      options = {
        callLimit: SEND_PRESENTATION_CALL_LIMIT,
      },
    }: TSendPresentationWithDuplicatedCallsOptions,
  ) {
    const targetFunction = async () => {
      return this.sendPresentation(beforeStartPresentation, videoTrack, presentationOptions);
    };

    const isComplete = (): boolean => {
      return !!this.videoTrackPresentationCurrent;
    };

    this.cancelableSendPresentationWithRepeatedCalls = repeatedCallsAsync<MediaStreamVideoTrack>({
      targetFunction,
      isComplete,
      isRejectAsValid: true,
      ...options,
    });

    return this.cancelableSendPresentationWithRepeatedCalls.then((response?: unknown) => {
      return response as MediaStreamVideoTrack;
    });
  }

  private async sendPresentation(
    beforeStartPresentation: () => Promise<void>,
    videoTrack: MediaStreamVideoTrack,
    {
      isNeedReinvite = true,
      contentHint = 'detail',
      degradationPreference,
      sendEncodings,
      maxResolution,
      onAddedTransceiver,
    }: TSendPresentationOptions,
  ) {
    applyContentHint(videoTrack, contentHint);

    this.videoTrackPresentationCurrent = videoTrack;

    const presentationSendEncodings = resolveSendEncodings({
      videoTrack,
      sendEncodings,
      maxResolution,
    });

    const result = beforeStartPresentation()
      .then(async () => {
        return this.executeStartPresentation(videoTrack, isNeedReinvite, {
          degradationPreference,
          onAddedTransceiver,
          sendEncodings: presentationSendEncodings,
        });
      })
      .then(this.setMaxBitrate)
      .then(() => {
        return videoTrack;
      })
      .catch((error: unknown) => {
        this.removeVideoTrackPresentationCurrent();

        this.notifyPresentationFailed(error);

        throw error;
      });

    this.promisePendingStartPresentation = result;

    return result.finally(() => {
      this.promisePendingStartPresentation = undefined;
    });
  }

  private async executeStartPresentation(
    videoTrack: MediaStreamVideoTrack,
    isNeedReinvite: boolean,
    {
      degradationPreference,
      onAddedTransceiver,
      sendEncodings,
    }: {
      degradationPreference?: RTCDegradationPreference;
      onAddedTransceiver?: TOnAddedTransceiver;
      sendEncodings?: RTCRtpEncodingParameters[];
    },
  ): Promise<MediaStreamVideoTrack> {
    const connection = this.getConnectionProtected();

    this.emitPresentationEvent('start', videoTrack);

    try {
      await addOrReplacePresentationVideoTrack(connection, this.presentationSenders, videoTrack, {
        degradationPreference,
        onAddedTransceiver,
        sendEncodings,
      });
      this.presentationSenders.markTrack(connection, videoTrack);

      if (isNeedReinvite) {
        try {
          await this.callManager.renegotiate();
        } catch {
          this.presentationSenders.stopTracks(connection);

          throw new Error('Fail reInvite');
        }
      }

      this.emitPresentationEvent('started', videoTrack);

      return videoTrack;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Fail reInvite') {
        throw error;
      }

      throw new Error('Wrong videoTrack');
    }
  }

  private async executeStopPresentation(
    videoTrack: MediaStreamVideoTrack,
  ): Promise<MediaStreamVideoTrack> {
    this.emitPresentationEvent('end', videoTrack);

    const { connection } = this.callManager;

    if (connection) {
      this.presentationSenders.stopTracks(connection);
    }

    this.emitPresentationEvent('ended', videoTrack);

    return videoTrack;
  }

  private readonly setMaxBitrate = async () => {
    const { connection } = this.callManager;
    const { videoTrackPresentationCurrent } = this;
    const { maxBitrate } = this;

    if (!connection || !videoTrackPresentationCurrent || maxBitrate === undefined) {
      return;
    }

    const sender = connection.getSenders().find((itemSender) => {
      return itemSender.track === videoTrackPresentationCurrent;
    });

    if (sender) {
      await setEncodingsToSender(sender, { maxBitrate });
    }
  };

  private readonly getRtcSessionProtected = () => {
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    return rtcSession;
  };

  private readonly getConnectionProtected = () => {
    const { connection } = this.callManager;

    if (!connection) {
      throw new Error('No connection established');
    }

    return connection;
  };

  private readonly handleEnded = () => {
    this.reset();
  };

  private reset() {
    this.cancelSendPresentationWithRepeatedCalls();
    this.resetPresentation();
  }

  private resetPresentationState() {
    this.removeVideoTrackPresentationCurrent();

    this.promisePendingStartPresentation = undefined;
    this.promisePendingStopPresentation = undefined;
  }

  private resetPresentation() {
    this.resetPresentationState();
    this.presentationSenders.clear();
  }

  private removeVideoTrackPresentationCurrent() {
    delete this.videoTrackPresentationCurrent;
  }

  private emitPresentationEvent<T extends keyof TEventMap>(
    eventName: T,
    payload: TEventMap[T],
  ): void {
    this.events.trigger(eventName, payload);
  }

  private notifyPresentationFailed(error: unknown): void {
    const normalizedError = normalizePresentationError(error);

    this.emitPresentationEvent('failed', normalizedError);
  }
}

export default PresentationManager;
