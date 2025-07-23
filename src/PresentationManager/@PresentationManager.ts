import type { RTCSession } from '@krivega/jssip';
import Events from 'events-constructor';
import { hasCanceledError, repeatedCallsAsync } from 'repeated-calls';
import prepareMediaStream from '../tools/prepareMediaStream';
// import scaleBitrate from '../../videoSendingBalancer/scaleBitrate';
// import { ONE_MEGABIT_IN_BITS } from './constants';
import type { CallManager } from '../CallManager';
import type { TEvent, TEvents } from './eventNames';
import { EEvent, EVENT_NAMES } from './eventNames';
import type { TContentHint, TOnAddedTransceiver } from './types';

const SEND_PRESENTATION_CALL_LIMIT = 1;

export const hasCanceledStartPresentationError = (error: unknown) => {
  return hasCanceledError(error);
};

// TODO: Добавить перед вызовом startPresentation if isP2P == true => apiManager.sendMustStopPresentationP2P
// TODO: Добавить перед вызовом startPresentation if isP2P == true => apiManager.askPermissionToStartPresentationP2P
// TODO: Добавить перед вызовом startPresentation if isP2P == false => apiManager.askPermissionToStartPresentation
// TODO: Добавить перед вызовом stopPresentation if isP2P == true => apiManager.sendStoppedPresentationP2P
// TODO: Добавить перед вызовом stopPresentation if isP2P == false => apiManager.sendStoppedPresentation

class PresentationManager {
  public promisePendingStartPresentation?: Promise<MediaStream>;

  public promisePendingStopPresentation?: Promise<MediaStream | undefined>;

  public streamPresentationCurrent?: MediaStream;

  private readonly events: TEvents;

  private cancelableSendPresentationWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<MediaStream>>
    | undefined;

  private readonly callManager: CallManager;

  public constructor({ callManager }: { callManager: CallManager }) {
    this.callManager = callManager;
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);

    this.subscribe();
  }

  public get isPendingPresentation(): boolean {
    return !!this.promisePendingStartPresentation || !!this.promisePendingStopPresentation;
  }

  public async startPresentation(
    stream: MediaStream,
    {
      isNeedReinvite,
      maxBitrate,
      contentHint,
      sendEncodings,
      onAddedTransceiver,
    }: {
      isNeedReinvite?: boolean;
      maxBitrate?: number;
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

    return this.sendPresentationWithDuplicatedCalls({
      rtcSession,
      stream,
      presentationOptions: {
        isNeedReinvite,
        maxBitrate,
        contentHint,
        sendEncodings,
        onAddedTransceiver,
      },
      options,
    });
  }

  public async stopPresentation(): Promise<MediaStream | undefined> {
    this.cancelSendPresentationWithRepeatedCalls();

    const streamPresentationPrevious = this.streamPresentationCurrent;
    let result: Promise<MediaStream | undefined> =
      this.promisePendingStartPresentation ?? Promise.resolve<undefined>(undefined);
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (rtcSession && streamPresentationPrevious) {
      result = rtcSession.stopPresentation(streamPresentationPrevious).catch((error: unknown) => {
        this.events.trigger(EEvent.FAILED_PRESENTATION, error);

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
    stream: MediaStream,
    {
      // maxBitrate,
      contentHint,
      sendEncodings,
      onAddedTransceiver,
    }: {
      isP2P?: boolean;
      // maxBitrate?: number;
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

    return this.sendPresentation(rtcSession, stream, {
      // maxBitrate,
      contentHint,
      isNeedReinvite: false,
      sendEncodings,
      onAddedTransceiver,
    });
  }

  public cancelSendPresentationWithRepeatedCalls() {
    this.cancelableSendPresentationWithRepeatedCalls?.cancel();
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
    this.callManager.on('presentation:failed', (error: unknown) => {
      this.events.trigger(EEvent.FAILED_PRESENTATION, error);
    });

    this.callManager.on('failed', this.handleEnded);
    this.callManager.on('ended', this.handleEnded);
  }

  private async sendPresentationWithDuplicatedCalls({
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
      maxBitrate?: number;
      contentHint?: TContentHint;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    };
    options?: { callLimit: number };
  }) {
    const targetFunction = async () => {
      return this.sendPresentation(rtcSession, stream, presentationOptions);
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

  private async sendPresentation(
    rtcSession: RTCSession,
    stream: MediaStream,
    {
      // maxBitrate = ONE_MEGABIT_IN_BITS,
      isNeedReinvite = true,
      contentHint = 'detail',
      sendEncodings,
      onAddedTransceiver,
    }: {
      isNeedReinvite?: boolean;
      // maxBitrate?: number;
      contentHint?: TContentHint;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    },
  ) {
    const streamPresentationTarget = prepareMediaStream(stream, { contentHint });

    if (streamPresentationTarget === undefined) {
      throw new Error('No streamPresentationTarget');
    }

    this.streamPresentationCurrent = streamPresentationTarget;

    const result = rtcSession
      .startPresentation(streamPresentationTarget, isNeedReinvite, {
        sendEncodings,
        onAddedTransceiver,
      })
      // .then(async () => {
      //   const { connection } = this;

      //   if (!connection) {
      //     return;
      //   }

      //   const senders = connection.getSenders();

      //   await scaleBitrate(senders, stream, maxBitrate);
      // })
      .then(() => {
        return stream;
      })
      .catch((error: unknown) => {
        this.removeStreamPresentationCurrent();

        this.events.trigger(EEvent.FAILED_PRESENTATION, error);

        throw error;
      });

    this.promisePendingStartPresentation = result;

    return result.finally(() => {
      this.promisePendingStartPresentation = undefined;
    });
  }

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
