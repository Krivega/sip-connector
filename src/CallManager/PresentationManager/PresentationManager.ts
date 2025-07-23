import type { RTCSession } from '@krivega/jssip';
import Events from 'events-constructor';
import { hasCanceledError, repeatedCallsAsync } from 'repeated-calls';
import type { TConnectionManagerEvents } from '../../ConnectionManager';
import prepareMediaStream from '../../tools/prepareMediaStream';
import type { TEvents as TCallEvents } from '../types';
import type { TEvent, TEvents } from './eventNames';
import { EVENT_NAMES } from './eventNames';
import type { TContentHint, TOnAddedTransceiver } from './types';

const SEND_PRESENTATION_CALL_LIMIT = 1;

export const hasCanceledStartPresentationError = (error: unknown) => {
  return hasCanceledError(error);
};

export class PresentationManager {
  private readonly events: TEvents;

  public promisePendingStartPresentation?: Promise<MediaStream>;

  public promisePendingStopPresentation?: Promise<MediaStream | undefined>;

  public streamPresentationCurrent?: MediaStream;

  private cancelableSendPresentationWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<MediaStream>>
    | undefined;

  private readonly connectionEvents: TConnectionManagerEvents;

  private readonly callEvents: TCallEvents;

  private readonly getRtcSession: () => RTCSession | undefined;

  public constructor({
    connectionEvents,
    callEvents,
    getRtcSession,
  }: {
    connectionEvents: TConnectionManagerEvents;
    callEvents: TCallEvents;
    getRtcSession: () => RTCSession | undefined;
  }) {
    this.connectionEvents = connectionEvents;
    this.callEvents = callEvents;
    this.getRtcSession = getRtcSession;
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
  }

  public get isPendingPresentation(): boolean {
    return !!this.promisePendingStartPresentation || !!this.promisePendingStopPresentation;
  }

  public async startPresentation(
    stream: MediaStream,
    {
      isNeedReinvite,
      isP2P,
      maxBitrate,
      contentHint,
      sendEncodings,
      onAddedTransceiver,
    }: {
      isNeedReinvite?: boolean;
      isP2P?: boolean;
      maxBitrate?: number;
      contentHint?: TContentHint;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    } = {},
    options?: { callLimit: number },
  ): Promise<MediaStream> {
    const rtcSession = this.getRtcSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    if (this.streamPresentationCurrent) {
      throw new Error('Presentation is already started');
    }

    if (isP2P === true) {
      await this.sendMustStopPresentation();
    }

    return this.sendPresentationWithDuplicatedCalls({
      rtcSession,
      stream,
      presentationOptions: {
        isNeedReinvite,
        isP2P,
        maxBitrate,
        contentHint,
        sendEncodings,
        onAddedTransceiver,
      },
      options,
    });
  }

  public async stopPresentation({
    isP2P = false,
  }: {
    isP2P?: boolean;
  } = {}): Promise<MediaStream | undefined> {
    this.cancelSendPresentationWithRepeatedCalls();

    const streamPresentationPrevious = this.streamPresentationCurrent;
    let result: Promise<MediaStream | undefined> =
      this.promisePendingStartPresentation ?? Promise.resolve<undefined>(undefined);

    // определяем заголовки для остановки презентации в зависимости от типа сессии
    const preparatoryHeaders = isP2P
      ? [HEADER_STOP_PRESENTATION_P2P] // `x-webrtc-share-state: CONTENTEND`
      : [HEADER_STOP_PRESENTATION]; // `x-webrtc-share-state: STOPPRESENTATION`

    const rtcSession = this.getRtcSession();

    if (rtcSession && streamPresentationPrevious) {
      result = result
        .then(async () => {
          // информируем сервер о остановке презентации с заголовком 'application/vinteo.webrtc.sharedesktop'
          return rtcSession.sendInfo(CONTENT_TYPE_SHARE_STATE, undefined, {
            extraHeaders: preparatoryHeaders,
          });
        })
        .then(async () => {
          return rtcSession.stopPresentation(streamPresentationPrevious);
        })
        .catch((error: unknown) => {
          this.sessionEvents.trigger(PRESENTATION_FAILED, error);

          throw error;
        });
    }

    if (!rtcSession && streamPresentationPrevious) {
      this.sessionEvents.trigger(PRESENTATION_ENDED, streamPresentationPrevious);
    }

    this.promisePendingStopPresentation = result;

    return result.finally(() => {
      this.resetPresentation();
    });
  }

  public async updatePresentation(
    stream: MediaStream,
    {
      isP2P,
      maxBitrate,
      contentHint,
      sendEncodings,
      onAddedTransceiver,
    }: {
      isP2P?: boolean;
      maxBitrate?: number;
      contentHint?: TContentHint;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    } = {},
  ): Promise<MediaStream | undefined> {
    const rtcSession = this.getRtcSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    if (!this.streamPresentationCurrent) {
      throw new Error('Presentation has not started yet');
    }

    if (this.promisePendingStartPresentation) {
      await this.promisePendingStartPresentation;
    }

    return this.sendPresentation(rtcSession, stream, {
      isP2P,
      maxBitrate,
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
      isP2P?: boolean;
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
      maxBitrate = ONE_MEGABIT_IN_BITS,
      isNeedReinvite = true,
      isP2P = false,
      contentHint = 'detail',
      sendEncodings,
      onAddedTransceiver,
    }: {
      isNeedReinvite?: boolean;
      isP2P?: boolean;
      maxBitrate?: number;
      contentHint?: TContentHint;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    },
  ) {
    const streamPresentationCurrent = prepareMediaStream(stream, { contentHint });

    if (streamPresentationCurrent === undefined) {
      throw new Error('No streamPresentationCurrent');
    }

    this.streamPresentationCurrent = streamPresentationCurrent;

    // определяем заголовки для начала презентации в зависимости от типа сессии
    const preparatoryHeaders = isP2P
      ? [HEADER_START_PRESENTATION_P2P] // `x-webrtc-share-state: YOUCANRECEIVECONTENT
      : [HEADER_START_PRESENTATION]; // `x-webrtc-share-state: LETMESTARTPRESENTATION`

    const result = rtcSession
      // отправляем запрос на презентацию с заголовком 'application/vinteo.webrtc.sharedesktop'
      .sendInfo(CONTENT_TYPE_SHARE_STATE, undefined, {
        extraHeaders: preparatoryHeaders,
      })
      .then(async () => {
        return rtcSession.startPresentation(streamPresentationCurrent, isNeedReinvite, {
          sendEncodings,
          onAddedTransceiver,
        });
      })
      .then(async () => {
        const { connection } = this;

        if (!connection) {
          return;
        }

        const senders = connection.getSenders();

        await scaleBitrate(senders, stream, maxBitrate);
      })
      .then(() => {
        return stream;
      })
      .catch((error: unknown) => {
        this.removeStreamPresentationCurrent();

        this.sessionEvents.trigger(PRESENTATION_FAILED, error);

        throw error;
      });

    this.promisePendingStartPresentation = result;

    return result.finally(() => {
      this.promisePendingStartPresentation = undefined;
    });
  }

  private removeStreamPresentationCurrent() {
    delete this.streamPresentationCurrent;
  }

  private resetPresentation() {
    this.removeStreamPresentationCurrent();

    this.promisePendingStartPresentation = undefined;
    this.promisePendingStopPresentation = undefined;
  }

  private cancelRequestsAndResetPresentation() {
    this.cancelSendPresentationWithRepeatedCalls();
    this.resetPresentation();
  }
}
