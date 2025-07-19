import { isCanceledError } from '@krivega/cancelable-promise';
import type {
  IncomingInfoEvent,
  IncomingRequest,
  OutgoingInfoEvent,
  RTCSession,
  UA,
} from '@krivega/jssip';
import Events from 'events-constructor';
import { hasCanceledError, repeatedCallsAsync } from 'repeated-calls';
import { hasVideoTracks } from '../utils';
import { BYE, CANCELED, REJECTED, REQUEST_TIMEOUT } from './causes';
import {
  ADMIN_FORCE_SYNC_MEDIA_STATE,
  ADMIN_START_MAIN_CAM,
  ADMIN_START_MIC,
  ADMIN_STOP_MAIN_CAM,
  ADMIN_STOP_MIC,
  AVAILABLE_SECOND_REMOTE_STREAM_EVENT,
  CHANNELS,
  CONFIRMED,
  ENDED,
  ENDED_FROM_SERVER,
  ENTER_ROOM,
  FAILED,
  MAIN_CAM_CONTROL,
  MUST_STOP_PRESENTATION_EVENT,
  NEW_DTMF,
  NEW_INFO,
  NOT_AVAILABLE_SECOND_REMOTE_STREAM_EVENT,
  ONE_MEGABIT_IN_BITS,
  Originator,
  PARTICIPANT,
  PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS,
  PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS,
  PEER_CONNECTION,
  PEER_CONNECTION_CONFIRMED,
  PEER_CONNECTION_ONTRACK,
  PRESENTATION_ENDED,
  PRESENTATION_FAILED,
  SHARE_STATE,
  SPECTATOR,
  USE_LICENSE,
} from './constants';
import type { TEventSession } from './eventNames';
import { SESSION_EVENT_NAMES, SESSION_JSSIP_EVENT_NAMES } from './eventNames';
import {
  AVAILABLE_SECOND_REMOTE_STREAM,
  CONTENT_TYPE_CHANNELS,
  CONTENT_TYPE_ENTER_ROOM,
  CONTENT_TYPE_MAIN_CAM,
  CONTENT_TYPE_MEDIA_STATE,
  CONTENT_TYPE_MIC,
  CONTENT_TYPE_NOTIFY,
  CONTENT_TYPE_PARTICIPANT_STATE,
  CONTENT_TYPE_REFUSAL,
  CONTENT_TYPE_SHARE_STATE,
  CONTENT_TYPE_USE_LICENSE,
  HEADER_CONTENT_ENTER_ROOM,
  HEADER_CONTENT_PARTICIPANT_STATE,
  HEADER_CONTENT_SHARE_STATE,
  HEADER_CONTENT_TYPE_NAME,
  HEADER_CONTENT_USE_LICENSE,
  HEADER_ENABLE_MAIN_CAM,
  HEADER_INPUT_CHANNELS,
  HEADER_MAIN_CAM,
  HEADER_MAIN_CAM_RESOLUTION,
  HEADER_MAIN_CAM_STATE,
  HEADER_MEDIA_STATE,
  HEADER_MEDIA_SYNC,
  HEADER_MEDIA_TYPE,
  HEADER_MIC,
  HEADER_MIC_STATE,
  HEADER_MUST_STOP_PRESENTATION_P2P,
  HEADER_NOTIFY,
  HEADER_OUTPUT_CHANNELS,
  HEADER_PARTICIPANT_NAME,
  HEADER_START_PRESENTATION,
  HEADER_START_PRESENTATION_P2P,
  HEADER_STOP_PRESENTATION,
  HEADER_STOP_PRESENTATION_P2P,
  MUST_STOP_PRESENTATION,
  NOT_AVAILABLE_SECOND_REMOTE_STREAM,
} from './headers';
import logger from './logger';
import prepareMediaStream from './tools/prepareMediaStream';
import type {
  EUseLicense,
  TContentHint,
  TCustomError,
  TGetServerUrl,
  TOnAddedTransceiver,
} from './types';
import { EEventsMainCAM, EEventsMic, EEventsSyncMediaState } from './types';
import { hasDeclineResponseFromServer } from './utils/errors';
import scaleBitrate from './videoSendingBalancer/scaleBitrate';

const SEND_PRESENTATION_CALL_LIMIT = 1;

const hasCustomError = (error: unknown): error is TCustomError => {
  return error instanceof Object && ('originator' in error || 'cause' in error);
};

export const hasCanceledCallError = (error: unknown): boolean => {
  if (isCanceledError(error)) {
    return true;
  }

  if (!hasCustomError(error)) {
    return false;
  }

  const { originator, cause } = error;

  if (typeof cause === 'string') {
    return (
      cause === REQUEST_TIMEOUT ||
      cause === REJECTED ||
      (originator === Originator.LOCAL && (cause === CANCELED || cause === BYE))
    );
  }

  return false;
};

export const hasCanceledStartPresentationError = (error: unknown) => {
  return hasCanceledError(error);
};

type TChannels = {
  inputChannels: string;
  outputChannels: string;
};

type TMediaState = {
  cam: boolean;
  mic: boolean;
};

type TOptionsInfoMediaState = {
  noTerminateWhenError?: boolean;
};

type TOptionsExtraHeaders = {
  extraHeaders?: string[];
};

type TOntrack = (track: RTCTrackEvent) => void;

type TParametersAnswerToIncomingCall = {
  mediaStream: MediaStream;
  extraHeaders?: TOptionsExtraHeaders['extraHeaders'];
  ontrack?: TOntrack;
  iceServers?: RTCIceServer[];
  directionVideo?: RTCRtpTransceiverDirection;
  directionAudio?: RTCRtpTransceiverDirection;
  contentHint?: TContentHint;
  sendEncodings?: RTCRtpEncodingParameters[];
  offerToReceiveAudio?: boolean;
  offerToReceiveVideo?: boolean;
  onAddedTransceiver?: TOnAddedTransceiver;
};

type TParametersCall = TParametersAnswerToIncomingCall & {
  number: string;
};

type TCall = (parameters: TParametersCall) => Promise<RTCPeerConnection>;

type TAnswerToIncomingCall = (
  getIncomingRTCSession: () => RTCSession,
  removeIncomingSession: () => void,
  parameters: TParametersAnswerToIncomingCall,
) => Promise<RTCPeerConnection>;

type TSendDTMF = (tone: number | string) => Promise<void>;

type THangUp = () => Promise<void>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CMD_CHANNELS = 'channels' as const;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CMD_ADDED_TO_LIST_MODERATORS = 'addedToListModerators' as const;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CMD_REMOVED_FROM_LIST_MODERATORS = 'removedFromListModerators' as const;

type TAddedToListModeratorsInfoNotify = {
  cmd: typeof CMD_ADDED_TO_LIST_MODERATORS;
  conference: string;
};

type TRemovedFromListModeratorsInfoNotify = {
  cmd: typeof CMD_REMOVED_FROM_LIST_MODERATORS;
  conference: string;
};

type TChannelsInfoNotify = {
  cmd: typeof CMD_CHANNELS;
  input: string;
  output: string;
};

type TInfoNotify = Omit<
  TAddedToListModeratorsInfoNotify | TChannelsInfoNotify | TRemovedFromListModeratorsInfoNotify,
  'cmd'
> & { cmd: string };

export default class SipConnector {
  public promisePendingStartPresentation?: Promise<MediaStream>;

  public promisePendingStopPresentation?: Promise<MediaStream | undefined>;

  public rtcSession?: RTCSession;

  public streamPresentationCurrent?: MediaStream;

  private readonly callConfiguration: {
    answer?: boolean;
    number?: string;
  } = {};

  private remoteStreams: Record<string, MediaStream> = {};

  private readonly sessionEvents: Events<typeof SESSION_EVENT_NAMES>;

  private cancelableSendPresentationWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<MediaStream>>
    | undefined;

  private isPendingCall = false;

  private isPendingAnswer = false;

  public constructor() {
    this.sessionEvents = new Events<typeof SESSION_EVENT_NAMES>(SESSION_EVENT_NAMES);

    this.onSession(SHARE_STATE, this.handleShareState);
    this.onSession(NEW_INFO, this.handleNewInfo);
    this.onSession(FAILED, this.handleEnded);
    this.onSession(ENDED, this.handleEnded);
  }

  public get connection(): RTCPeerConnection | undefined {
    const connection = this.rtcSession?.connection;

    return connection;
  }

  public get requested() {
    return this.isPendingCall || this.isPendingAnswer;
  }

  public get establishedRTCSession(): RTCSession | undefined {
    return this.rtcSession?.isEstablished() === true ? this.rtcSession : undefined;
  }

  public get isPendingPresentation(): boolean {
    return !!this.promisePendingStartPresentation || !!this.promisePendingStopPresentation;
  }

  public hangUp: THangUp = async () => {
    // this.cancelRequests();

    return this.hangUpWithoutCancelRequests();
  };

  public async replaceMediaStream(
    mediaStream: MediaStream,
    options?: {
      deleteExisting?: boolean;
      addMissing?: boolean;
      forceRenegotiation?: boolean;
      contentHint?: TContentHint;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    },
  ): Promise<void> {
    if (!this.rtcSession) {
      throw new Error('No rtcSession established');
    }

    const { contentHint } = options ?? {};
    const preparedMediaStream = prepareMediaStream(mediaStream, { contentHint });

    if (preparedMediaStream === undefined) {
      throw new Error('No preparedMediaStream');
    }

    return this.rtcSession.replaceMediaStream(preparedMediaStream, options);
  }

  public async askPermissionToEnableCam(options: TOptionsInfoMediaState = {}): Promise<void> {
    if (!this.rtcSession) {
      throw new Error('No rtcSession established');
    }

    const extraHeaders = [HEADER_ENABLE_MAIN_CAM];

    return this.rtcSession
      .sendInfo(CONTENT_TYPE_MAIN_CAM, undefined, {
        noTerminateWhenError: true,
        ...options,
        extraHeaders,
      })
      .catch((error: unknown) => {
        if (hasDeclineResponseFromServer(error as Error)) {
          throw error;
        }
      });
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
    const rtcSession = this.establishedRTCSession;

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

    const rtcSession = this.establishedRTCSession;

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
    const rtcSession = this.establishedRTCSession;

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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onSession<T>(eventName: TEventSession, handler: (data: T) => void) {
    return this.sessionEvents.on<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceSession<T>(eventName: TEventSession, handler: (data: T) => void) {
    return this.sessionEvents.once<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceRaceSession<T>(
    eventNames: TEventSession[],
    handler: (data: T, eventName: string) => void,
  ) {
    return this.sessionEvents.onceRace<T>(eventNames, handler);
  }

  public async waitSession<T>(eventName: TEventSession): Promise<T> {
    return this.sessionEvents.wait<T>(eventName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public offSession<T>(eventName: TEventSession, handler: (data: T) => void) {
    this.sessionEvents.off<T>(eventName, handler);
  }

  public getCallConfiguration() {
    return { ...this.callConfiguration };
  }

  public getRemoteStreams(): MediaStream[] | undefined {
    if (!this.connection) {
      return undefined;
    }

    const receivers = this.connection.getReceivers();
    const remoteTracks = receivers.map(({ track }) => {
      return track;
    });

    if (hasVideoTracks(remoteTracks)) {
      return this.generateStreams(remoteTracks);
    }

    return this.generateAudioStreams(remoteTracks);
  }

  public call: TCall = async (
    {
      number,
      mediaStream,
      extraHeaders = [],
      ontrack,
      iceServers,
      directionVideo,
      directionAudio,
      contentHint,
      offerToReceiveAudio = true,
      offerToReceiveVideo = true,
      sendEncodings,
      onAddedTransceiver,
    },
    ua?: UA,
  ) => {
    this.isPendingCall = true;

    return new Promise<RTCPeerConnection>((resolve, reject) => {
      if (!ua) {
        reject(new Error('this.ua is not initialized'));

        return;
      }

      this.callConfiguration.number = number;
      this.callConfiguration.answer = false;
      this.handleCall({ ontrack })
        .then(resolve)
        .catch((error: unknown) => {
          reject(error as Error);
        });

      this.rtcSession = ua.call(this.getSipServerUrl(number), {
        extraHeaders,
        mediaStream: prepareMediaStream(mediaStream, {
          directionVideo,
          directionAudio,
          contentHint,
        }),
        eventHandlers: this.sessionEvents.triggers,
        directionVideo,
        directionAudio,
        pcConfig: {
          iceServers,
        },
        rtcOfferConstraints: {
          offerToReceiveAudio,
          offerToReceiveVideo,
        },
        sendEncodings,
        onAddedTransceiver,
      });
    }).finally(() => {
      this.isPendingCall = false;
    });
  };

  public answerToIncomingCall: TAnswerToIncomingCall = async (
    getIncomingRTCSession: () => RTCSession,
    removeIncomingSession: () => void,
    {
      mediaStream,
      ontrack,
      extraHeaders = [],
      iceServers,
      directionVideo,
      directionAudio,
      offerToReceiveAudio,
      offerToReceiveVideo,
      contentHint,
      sendEncodings,
      onAddedTransceiver,
    },
  ): Promise<RTCPeerConnection> => {
    this.isPendingAnswer = true;

    return new Promise<RTCPeerConnection>((resolve, reject) => {
      try {
        const rtcSession = getIncomingRTCSession();

        this.rtcSession = rtcSession;
        removeIncomingSession();

        this.sessionEvents.eachTriggers((trigger, eventName) => {
          const sessionJsSipEvent = SESSION_JSSIP_EVENT_NAMES.find((jsSipEvent) => {
            return jsSipEvent === eventName;
          });

          if (sessionJsSipEvent) {
            rtcSession.on(sessionJsSipEvent, trigger);
          }
        });

        this.callConfiguration.answer = true;
        this.callConfiguration.number = rtcSession.remote_identity.uri.user;
        this.handleCall({ ontrack })
          .then(resolve)
          .catch((error: unknown) => {
            reject(error as Error);
          });

        const preparedMediaStream = prepareMediaStream(mediaStream, {
          directionVideo,
          directionAudio,
          contentHint,
        });

        rtcSession.answer({
          extraHeaders,
          directionVideo,
          directionAudio,
          mediaStream: preparedMediaStream,
          pcConfig: {
            iceServers,
          },
          rtcOfferConstraints: {
            offerToReceiveAudio,
            offerToReceiveVideo,
          },
          sendEncodings,
          onAddedTransceiver,
        });
      } catch (error) {
        reject(error as Error);
      }
    }).finally(() => {
      this.isPendingAnswer = false;
    });
  };

  public sendDTMF: TSendDTMF = async (tone) => {
    return new Promise<void>((resolve, reject) => {
      const { rtcSession } = this;

      if (!rtcSession) {
        reject(new Error('No rtcSession established'));

        return;
      }

      this.onceSession(NEW_DTMF, ({ originator }: { originator: Originator }) => {
        if (originator === Originator.LOCAL) {
          resolve();
        }
      });

      rtcSession.sendDTMF(tone, {
        duration: 120,
        interToneGap: 600,
      });
    });
  };

  public cancelSendPresentationWithRepeatedCalls() {
    this.cancelableSendPresentationWithRepeatedCalls?.cancel();
  }

  public async waitChannels(): Promise<TChannels> {
    return this.waitSession(CHANNELS);
  }

  public async waitSyncMediaState(): Promise<{ isSyncForced: boolean }> {
    return this.waitSession(ADMIN_FORCE_SYNC_MEDIA_STATE);
  }

  public async sendChannels({ inputChannels, outputChannels }: TChannels): Promise<void> {
    if (!this.rtcSession) {
      throw new Error('No rtcSession established');
    }

    const headerInputChannels = `${HEADER_INPUT_CHANNELS}: ${inputChannels}`;
    const headerOutputChannels = `${HEADER_OUTPUT_CHANNELS}: ${outputChannels}`;
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [
      headerInputChannels,
      headerOutputChannels,
    ];

    return this.rtcSession.sendInfo(CONTENT_TYPE_CHANNELS, undefined, { extraHeaders });
  }

  public async sendMediaState(
    { cam, mic }: TMediaState,
    options: TOptionsInfoMediaState = {},
  ): Promise<void> {
    if (!this.rtcSession) {
      throw new Error('No rtcSession established');
    }

    const headerMediaState = `${HEADER_MEDIA_STATE}: currentstate`;
    const headerCam = `${HEADER_MAIN_CAM_STATE}: ${Number(cam)}`;
    const headerMic = `${HEADER_MIC_STATE}: ${Number(mic)}`;
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [
      headerMediaState,
      headerCam,
      headerMic,
    ];

    return this.rtcSession.sendInfo(CONTENT_TYPE_MEDIA_STATE, undefined, {
      noTerminateWhenError: true,
      ...options,
      extraHeaders,
    });
  }

  public async sendRefusalToTurnOn(
    type: 'cam' | 'mic',
    options: TOptionsInfoMediaState = {},
  ): Promise<void> {
    if (!this.rtcSession) {
      throw new Error('No rtcSession established');
    }

    const typeMicOnServer = 0;
    const typeCamOnServer = 1;
    const typeToSend = type === 'mic' ? typeMicOnServer : typeCamOnServer;

    const headerMediaType = `${HEADER_MEDIA_TYPE}: ${typeToSend}`;
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [headerMediaType];

    return this.rtcSession.sendInfo(CONTENT_TYPE_REFUSAL, undefined, {
      noTerminateWhenError: true,
      ...options,
      extraHeaders,
    });
  }

  public async sendRefusalToTurnOnMic(options: TOptionsInfoMediaState = {}): Promise<void> {
    if (!this.rtcSession) {
      throw new Error('No rtcSession established');
    }

    return this.sendRefusalToTurnOn('mic', { noTerminateWhenError: true, ...options });
  }

  public async sendRefusalToTurnOnCam(options: TOptionsInfoMediaState = {}): Promise<void> {
    if (!this.rtcSession) {
      throw new Error('No rtcSession established');
    }

    return this.sendRefusalToTurnOn('cam', { noTerminateWhenError: true, ...options });
  }

  // eslint-disable-next-line class-methods-use-this
  private readonly getSipServerUrl: TGetServerUrl = (id: string) => {
    return id;
  };

  private async sendMustStopPresentation(): Promise<void> {
    const rtcSession = this.establishedRTCSession;

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    await rtcSession.sendInfo(CONTENT_TYPE_SHARE_STATE, undefined, {
      extraHeaders: [HEADER_MUST_STOP_PRESENTATION_P2P],
    });
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

  private readonly handleCall = async ({
    ontrack,
  }: {
    ontrack?: TOntrack;
  }): Promise<RTCPeerConnection> => {
    return new Promise((resolve, reject) => {
      const addStartedEventListeners = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.onSession(PEER_CONNECTION, handlePeerConnection);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.onSession(CONFIRMED, handleConfirmed);
      };
      const removeStartedEventListeners = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.offSession(PEER_CONNECTION, handlePeerConnection);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.offSession(CONFIRMED, handleConfirmed);
      };
      const addEndedEventListeners = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.onSession(FAILED, handleEnded);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.onSession(ENDED, handleEnded);
      };
      const removeEndedEventListeners = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.offSession(FAILED, handleEnded);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.offSession(ENDED, handleEnded);
      };
      const handleEnded = (error: TCustomError) => {
        removeStartedEventListeners();
        removeEndedEventListeners();
        reject(error);
      };

      let savedPeerconnection: RTCPeerConnection | undefined;

      const handlePeerConnection = ({ peerconnection }: { peerconnection: RTCPeerConnection }) => {
        savedPeerconnection = peerconnection;

        savedPeerconnection.ontrack = (track) => {
          this.sessionEvents.trigger(PEER_CONNECTION_ONTRACK, savedPeerconnection);

          if (ontrack) {
            ontrack(track);
          }
        };
      };
      const handleConfirmed = () => {
        if (savedPeerconnection !== undefined) {
          this.sessionEvents.trigger(PEER_CONNECTION_CONFIRMED, savedPeerconnection);
        }

        removeStartedEventListeners();
        removeEndedEventListeners();
        resolve(savedPeerconnection as unknown as RTCPeerConnection);
      };

      addStartedEventListeners();
      addEndedEventListeners();
    });
  };

  private readonly restoreSession: () => void = () => {
    this.cancelRequestsAndResetPresentation();

    delete this.rtcSession;
    this.remoteStreams = {};
  };

  private generateStream(videoTrack: MediaStreamTrack, audioTrack?: MediaStreamTrack): MediaStream {
    const { id } = videoTrack;

    const remoteStream: MediaStream = this.remoteStreams[id] ?? new MediaStream();

    if (audioTrack) {
      remoteStream.addTrack(audioTrack);
    }

    remoteStream.addTrack(videoTrack);
    this.remoteStreams[id] = remoteStream;

    return remoteStream;
  }

  private generateAudioStream(audioTrack: MediaStreamTrack): MediaStream {
    const { id } = audioTrack;

    const remoteStream = this.remoteStreams[id] ?? new MediaStream();

    remoteStream.addTrack(audioTrack);

    this.remoteStreams[id] = remoteStream;

    return remoteStream;
  }

  private generateStreams(remoteTracks: MediaStreamTrack[]): MediaStream[] {
    const remoteStreams: MediaStream[] = [];

    remoteTracks.forEach((track, index) => {
      if (track.kind === 'audio') {
        return;
      }

      const videoTrack = track;
      const previousTrack = remoteTracks[index - 1] as MediaStreamTrack | undefined;
      let audioTrack;

      if (previousTrack?.kind === 'audio') {
        audioTrack = previousTrack;
      }

      const remoteStream = this.generateStream(videoTrack, audioTrack);

      remoteStreams.push(remoteStream);
    });

    return remoteStreams;
  }

  private generateAudioStreams(remoteTracks: MediaStreamTrack[]): MediaStream[] {
    const remoteStreams: MediaStream[] = remoteTracks.map((remoteTrack) => {
      return this.generateAudioStream(remoteTrack);
    });

    return remoteStreams;
  }

  private readonly hangUpWithoutCancelRequests: THangUp = async (ua?: UA) => {
    if (ua && this.rtcSession) {
      const { rtcSession } = this;

      if (this.streamPresentationCurrent) {
        try {
          await this.stopPresentation();
        } catch (error) {
          logger('error stop presentation: ', error);
        }
      }

      this.restoreSession();

      if (!rtcSession.isEnded()) {
        return rtcSession.terminateAsync({
          cause: CANCELED,
        });
      }
    }

    return undefined;
  };

  private readonly handleShareState = (eventName: string) => {
    switch (eventName) {
      case AVAILABLE_SECOND_REMOTE_STREAM: {
        this.sessionEvents.trigger(AVAILABLE_SECOND_REMOTE_STREAM_EVENT, undefined);
        break;
      }
      case NOT_AVAILABLE_SECOND_REMOTE_STREAM: {
        this.sessionEvents.trigger(NOT_AVAILABLE_SECOND_REMOTE_STREAM_EVENT, undefined);
        break;
      }
      case MUST_STOP_PRESENTATION: {
        this.sessionEvents.trigger(MUST_STOP_PRESENTATION_EVENT, undefined);
        break;
      }

      default: {
        break;
      }
    }
  };

  private readonly maybeTriggerChannels = (request: IncomingRequest) => {
    const inputChannels = request.getHeader(HEADER_INPUT_CHANNELS);
    const outputChannels = request.getHeader(HEADER_OUTPUT_CHANNELS);

    if (inputChannels && outputChannels) {
      const headersChannels: TChannels = {
        inputChannels,
        outputChannels,
      };

      this.sessionEvents.trigger(CHANNELS, headersChannels);
    }
  };

  private readonly triggerEnterRoom = (request: IncomingRequest) => {
    const room = request.getHeader(HEADER_CONTENT_ENTER_ROOM);
    const participantName = request.getHeader(HEADER_PARTICIPANT_NAME);

    this.sessionEvents.trigger(ENTER_ROOM, { room, participantName });
  };

  private readonly triggerShareState = (request: IncomingRequest) => {
    const eventName = request.getHeader(HEADER_CONTENT_SHARE_STATE);

    this.sessionEvents.trigger(SHARE_STATE, eventName);
  };

  private readonly maybeTriggerParticipantMoveRequest = (request: IncomingRequest) => {
    const participantState = request.getHeader(HEADER_CONTENT_PARTICIPANT_STATE);

    if (participantState === SPECTATOR) {
      this.sessionEvents.trigger(PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS, undefined);
    }

    if (participantState === PARTICIPANT) {
      this.sessionEvents.trigger(PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS, undefined);
    }
  };

  private readonly triggerMainCamControl = (request: IncomingRequest) => {
    const mainCam = request.getHeader(HEADER_MAIN_CAM) as EEventsMainCAM | undefined;
    const syncState = request.getHeader(HEADER_MEDIA_SYNC) as EEventsSyncMediaState | undefined;
    const isSyncForced = syncState === EEventsSyncMediaState.ADMIN_SYNC_FORCED;

    if (mainCam === EEventsMainCAM.ADMIN_START_MAIN_CAM) {
      this.sessionEvents.trigger(ADMIN_START_MAIN_CAM, { isSyncForced });

      return;
    }

    if (mainCam === EEventsMainCAM.ADMIN_STOP_MAIN_CAM) {
      this.sessionEvents.trigger(ADMIN_STOP_MAIN_CAM, { isSyncForced });

      return;
    }

    if (
      (mainCam === EEventsMainCAM.RESUME_MAIN_CAM || mainCam === EEventsMainCAM.PAUSE_MAIN_CAM) &&
      syncState !== undefined
    ) {
      this.sessionEvents.trigger(ADMIN_FORCE_SYNC_MEDIA_STATE, { isSyncForced });
    }

    const resolutionMainCam = request.getHeader(HEADER_MAIN_CAM_RESOLUTION);

    this.sessionEvents.trigger(MAIN_CAM_CONTROL, {
      mainCam,
      resolutionMainCam,
    });
  };

  private readonly triggerMicControl = (request: IncomingRequest) => {
    const mic = request.getHeader(HEADER_MIC) as EEventsMic | undefined;
    const syncState = request.getHeader(HEADER_MEDIA_SYNC) as EEventsSyncMediaState | undefined;
    const isSyncForced = syncState === EEventsSyncMediaState.ADMIN_SYNC_FORCED;

    if (mic === EEventsMic.ADMIN_START_MIC) {
      this.sessionEvents.trigger(ADMIN_START_MIC, { isSyncForced });
    } else if (mic === EEventsMic.ADMIN_STOP_MIC) {
      this.sessionEvents.trigger(ADMIN_STOP_MIC, { isSyncForced });
    }
  };

  private readonly triggerUseLicense = (request: IncomingRequest) => {
    const license: EUseLicense = request.getHeader(HEADER_CONTENT_USE_LICENSE) as EUseLicense;

    this.sessionEvents.trigger(USE_LICENSE, license);
  };

  private readonly handleNewInfo = (info: IncomingInfoEvent | OutgoingInfoEvent) => {
    const { originator } = info;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (originator !== Originator.REMOTE) {
      return;
    }

    const { request } = info;
    const contentType = request.getHeader(HEADER_CONTENT_TYPE_NAME);

    if (contentType) {
      switch (contentType) {
        case CONTENT_TYPE_ENTER_ROOM: {
          this.triggerEnterRoom(request);
          this.maybeTriggerChannels(request);
          break;
        }
        case CONTENT_TYPE_NOTIFY: {
          this.maybeHandleNotify(request);
          break;
        }
        case CONTENT_TYPE_SHARE_STATE: {
          this.triggerShareState(request);
          break;
        }
        case CONTENT_TYPE_MAIN_CAM: {
          this.triggerMainCamControl(request);
          break;
        }
        case CONTENT_TYPE_MIC: {
          this.triggerMicControl(request);
          break;
        }
        case CONTENT_TYPE_USE_LICENSE: {
          this.triggerUseLicense(request);
          break;
        }
        case CONTENT_TYPE_PARTICIPANT_STATE: {
          this.maybeTriggerParticipantMoveRequest(request);
          break;
        }

        default: {
          break;
        }
      }
    }
  };

  // eslint-disable-next-line class-methods-use-this
  private readonly maybeHandleNotify = (request: IncomingRequest) => {
    try {
      const headerNotify = request.getHeader(HEADER_NOTIFY);

      if (headerNotify) {
        const headerNotifyParsed = JSON.parse(headerNotify) as TInfoNotify;

        logger('headerNotify', headerNotifyParsed);
      }
    } catch (error) {
      logger('error parse notify', error);
    }
  };

  private readonly handleEnded = (error: TCustomError) => {
    const { originator } = error;

    if (originator === Originator.REMOTE) {
      this.sessionEvents.trigger(ENDED_FROM_SERVER, error);
    }

    this.restoreSession();
  };
}
