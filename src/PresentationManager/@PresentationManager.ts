import { EventEmitterProxy } from 'events-constructor';
import { hasCanceledError, repeatedCallsAsync } from 'repeated-calls';

import prepareMediaStream from '@/tools/prepareMediaStream';
import { setMaxBitrateToSender } from '@/tools/setParametersToSender';
import { createEvents } from './events';
import { PresentationStateMachine } from './PresentationStateMachine';

import type { RTCSession } from '@krivega/jssip';
import type { CallManager } from '@/CallManager';
import type { TEventMap } from './events';
import type { TContentHint, TOnAddedTransceiver } from './types';

const SEND_PRESENTATION_CALL_LIMIT = 1;
const PRESENTATION_EVENT_NAMES = [
  'presentation:start',
  'presentation:started',
  'presentation:end',
  'presentation:ended',
  'presentation:failed',
] as const;

type TPresentationOptions = {
  isNeedReinvite?: boolean;
  contentHint?: TContentHint;
  sendEncodings?: RTCRtpEncodingParameters[];
  onAddedTransceiver?: TOnAddedTransceiver;
};

type TSendPresentationOptions = TPresentationOptions & {
  degradationPreference?: RTCDegradationPreference;
};

type TSendPresentationWithDuplicatedCallsOptions = {
  rtcSession: RTCSession;
  stream: MediaStream;
  presentationOptions: TPresentationOptions;
  options?: { callLimit: number };
};

const normalizePresentationError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
};

export const hasCanceledStartPresentationError = (error: unknown) => {
  return hasCanceledError(error);
};

class PresentationManager extends EventEmitterProxy<TEventMap> {
  public readonly stateMachine: PresentationStateMachine;

  public promisePendingStartPresentation?: Promise<MediaStream>;

  public promisePendingStopPresentation?: Promise<MediaStream | undefined>;

  public streamPresentationCurrent?: MediaStream;

  private readonly maxBitrate?: number;

  private cancelableSendPresentationWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<MediaStream>>
    | undefined;

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
    this.stateMachine = new PresentationStateMachine(this.callManager.events);
    this.subscribe();
  }

  public get isPendingPresentation(): boolean {
    return !!this.promisePendingStartPresentation || !!this.promisePendingStopPresentation;
  }

  public get isPresentationInProcess(): boolean {
    return !!this.streamPresentationCurrent || this.isPendingPresentation;
  }

  // eslint-disable-next-line @typescript-eslint/max-params
  public async startPresentation(
    beforeStartPresentation: () => Promise<void>,
    stream: MediaStream,
    { isNeedReinvite, contentHint, sendEncodings, onAddedTransceiver }: TPresentationOptions = {},
    options?: { callLimit: number },
  ): Promise<MediaStream> {
    const rtcSession = this.getRtcSessionProtected();

    if (this.streamPresentationCurrent) {
      throw new Error('Presentation is already started');
    }

    return this.sendPresentationWithDuplicatedCalls(beforeStartPresentation, {
      rtcSession,
      stream,
      presentationOptions: {
        isNeedReinvite,
        contentHint,
        sendEncodings,
        onAddedTransceiver,
      },
      options,
    });
  }

  public async stopPresentation(
    beforeStopPresentation: () => Promise<void>,
  ): Promise<MediaStream | undefined> {
    this.cancelSendPresentationWithRepeatedCalls();

    const streamPresentationPrevious = this.streamPresentationCurrent;
    let result: Promise<MediaStream | undefined> =
      this.promisePendingStartPresentation ?? Promise.resolve(undefined);

    if (this.promisePendingStartPresentation) {
      await this.promisePendingStartPresentation.catch(() => {});
    }

    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (rtcSession && streamPresentationPrevious) {
      result = beforeStopPresentation()
        .then(async () => {
          return rtcSession.stopPresentation(streamPresentationPrevious);
        })
        .catch((error: unknown) => {
          this.notifyPresentationFailed(error);

          throw error;
        });
    } else if (streamPresentationPrevious) {
      this.events.trigger('presentation:ended', streamPresentationPrevious);
    }

    this.promisePendingStopPresentation = result;

    return result.finally(() => {
      this.resetPresentation();
    });
  }

  public async updatePresentation(
    beforeStartPresentation: () => Promise<void>,
    stream: MediaStream,
    { contentHint, sendEncodings, onAddedTransceiver }: TPresentationOptions = {},
  ): Promise<MediaStream | undefined> {
    const rtcSession = this.getRtcSessionProtected();

    if (!this.streamPresentationCurrent) {
      throw new Error('Presentation has not started yet');
    }

    if (this.promisePendingStartPresentation) {
      await this.promisePendingStartPresentation;
    }

    return this.sendPresentation(beforeStartPresentation, rtcSession, stream, {
      contentHint,
      isNeedReinvite: false,
      sendEncodings,
      onAddedTransceiver,
    }).then(async (mediaStream) => {
      await this.setMaxBitrate();

      return mediaStream;
    });
  }

  public cancelSendPresentationWithRepeatedCalls() {
    this.cancelableSendPresentationWithRepeatedCalls?.stopRepeatedCalls();
  }

  private subscribe() {
    PRESENTATION_EVENT_NAMES.forEach((eventName) => {
      this.callManager.on(eventName, (payload: TEventMap[typeof eventName]) => {
        this.events.trigger(eventName, payload);
      });
    });

    this.callManager.on('failed', this.handleEnded);
    this.callManager.on('ended', this.handleEnded);
  }

  private async sendPresentationWithDuplicatedCalls(
    beforeStartPresentation: () => Promise<void>,
    {
      rtcSession,
      stream,
      presentationOptions,
      options = {
        callLimit: SEND_PRESENTATION_CALL_LIMIT,
      },
    }: TSendPresentationWithDuplicatedCallsOptions,
  ) {
    const targetFunction = async () => {
      return this.sendPresentation(
        beforeStartPresentation,
        rtcSession,
        stream,
        presentationOptions,
      );
    };

    const isComplete = (): boolean => {
      return !!this.streamPresentationCurrent;
    };

    this.cancelableSendPresentationWithRepeatedCalls = repeatedCallsAsync<MediaStream>({
      targetFunction,
      isComplete,
      isRejectAsValid: true,
      ...options,
    });

    return this.cancelableSendPresentationWithRepeatedCalls.then((response?: unknown) => {
      return response as MediaStream;
    });
  }

  // eslint-disable-next-line @typescript-eslint/max-params
  private async sendPresentation(
    beforeStartPresentation: () => Promise<void>,
    rtcSession: RTCSession,
    stream: MediaStream,
    {
      isNeedReinvite = true,
      contentHint = 'detail',
      degradationPreference,
      sendEncodings,
      onAddedTransceiver,
    }: TSendPresentationOptions,
  ) {
    const streamPresentationTarget = prepareMediaStream(stream, { contentHint });

    if (streamPresentationTarget === undefined) {
      throw new Error('No streamPresentationTarget');
    }

    this.streamPresentationCurrent = streamPresentationTarget;

    const result = beforeStartPresentation()
      .then(async () => {
        return rtcSession.startPresentation(streamPresentationTarget, isNeedReinvite, {
          degradationPreference,
          sendEncodings,
          onAddedTransceiver,
        });
      })
      .then(this.setMaxBitrate)
      .then(() => {
        return stream;
      })
      .catch((error: unknown) => {
        this.removeStreamPresentationCurrent();

        this.notifyPresentationFailed(error);

        throw error;
      });

    this.promisePendingStartPresentation = result;

    return result.finally(() => {
      this.promisePendingStartPresentation = undefined;
    });
  }

  private readonly setMaxBitrate = async () => {
    const { connection } = this.callManager;
    const { streamPresentationCurrent } = this;
    const { maxBitrate } = this;

    if (!connection || !streamPresentationCurrent || maxBitrate === undefined) {
      return;
    }

    const senders = connection.getSenders();

    await setMaxBitrateToSender(senders, streamPresentationCurrent, maxBitrate);
  };

  private readonly getRtcSessionProtected = () => {
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    return rtcSession;
  };

  private readonly handleEnded = () => {
    this.reset();
  };

  private reset() {
    this.cancelSendPresentationWithRepeatedCalls();
    this.resetPresentation();
  }

  private resetPresentation() {
    this.removeStreamPresentationCurrent();

    this.promisePendingStartPresentation = undefined;
    this.promisePendingStopPresentation = undefined;
  }

  private removeStreamPresentationCurrent() {
    delete this.streamPresentationCurrent;
  }

  private notifyPresentationFailed(error: unknown): void {
    this.events.trigger('presentation:failed', normalizePresentationError(error));
  }
}

export default PresentationManager;
