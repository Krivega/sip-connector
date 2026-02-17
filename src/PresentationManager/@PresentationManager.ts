import { hasCanceledError, repeatedCallsAsync } from 'repeated-calls';

import prepareMediaStream from '@/tools/prepareMediaStream';
import { setMaxBitrateToSender } from '@/tools/setParametersToSender';
import { createEvents, EEvent } from './events';
import { PresentationStateMachine } from './PresentationStateMachine';

import type { RTCSession } from '@krivega/jssip';
import type { CallManager } from '@/CallManager';
import type { TEventMap, TEvents } from './events';
import type { TContentHint, TOnAddedTransceiver } from './types';

const SEND_PRESENTATION_CALL_LIMIT = 1;

export const hasCanceledStartPresentationError = (error: unknown) => {
  return hasCanceledError(error);
};

class PresentationManager {
  public readonly events: TEvents;

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
    this.callManager = callManager;
    this.maxBitrate = maxBitrate;
    this.events = createEvents();
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
    {
      isNeedReinvite,
      contentHint,
      sendEncodings,
      onAddedTransceiver,
    }: {
      isNeedReinvite?: boolean;
      contentHint?: TContentHint;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    } = {},
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
      this.promisePendingStartPresentation ?? Promise.resolve<undefined>(undefined);

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
          const presentationError = error instanceof Error ? error : new Error(String(error));

          this.events.trigger(EEvent.FAILED_PRESENTATION, presentationError);

          throw error;
        });
    } else if (streamPresentationPrevious) {
      this.events.trigger(EEvent.ENDED_PRESENTATION, streamPresentationPrevious);
    }

    this.promisePendingStopPresentation = result;

    return result.finally(() => {
      this.resetPresentation();
    });
  }

  public async updatePresentation(
    beforeStartPresentation: () => Promise<void>,
    stream: MediaStream,
    {
      contentHint,
      sendEncodings,
      onAddedTransceiver,
    }: {
      contentHint?: TContentHint;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    } = {},
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

  private subscribe() {
    this.callManager.on('presentation:start', (stream: MediaStream) => {
      this.events.trigger(EEvent.START_PRESENTATION, stream);
    });
    this.callManager.on('presentation:started', (stream: MediaStream) => {
      this.events.trigger(EEvent.STARTED_PRESENTATION, stream);
    });
    this.callManager.on('presentation:end', (stream: MediaStream) => {
      this.events.trigger(EEvent.END_PRESENTATION, stream);
    });
    this.callManager.on('presentation:ended', (stream: MediaStream) => {
      this.events.trigger(EEvent.ENDED_PRESENTATION, stream);
    });
    this.callManager.on('presentation:failed', (error: Error) => {
      this.events.trigger(EEvent.FAILED_PRESENTATION, error);
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
    }: {
      rtcSession: RTCSession;
      stream: MediaStream;
      presentationOptions: {
        isNeedReinvite?: boolean;
        contentHint?: TContentHint;
        sendEncodings?: RTCRtpEncodingParameters[];
        onAddedTransceiver?: TOnAddedTransceiver;
      };
      options?: { callLimit: number };
    },
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
    }: {
      isNeedReinvite?: boolean;
      contentHint?: TContentHint;
      degradationPreference?: RTCDegradationPreference;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    },
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

        const presentationError = error instanceof Error ? error : new Error(String(error));

        this.events.trigger(EEvent.FAILED_PRESENTATION, presentationError);

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
}

export default PresentationManager;
