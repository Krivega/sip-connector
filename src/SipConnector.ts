import { isCanceledError } from '@krivega/cancelable-promise';
import type {
  IncomingInfoEvent,
  IncomingRTCSessionEvent,
  IncomingRequest,
  OutgoingInfoEvent,
  OutgoingRTCSessionEvent,
  RTCSession,
  RegisteredEvent,
  UA,
  UAConfigurationParams,
  URI,
  UnRegisteredEvent,
  WebSocketInterface,
} from '@krivega/jssip';
import Events from 'events-constructor';
import { hasCanceledError, repeatedCallsAsync } from 'repeated-calls';
import { generateUserId, hasVideoTracks, parseDisplayName, resolveSipUrl } from '../utils';
import { BYE, CANCELED, REJECTED, REQUEST_TIMEOUT } from './causes';
import {
  ACCOUNT_CHANGED,
  ACCOUNT_DELETED,
  ADMIN_FORCE_SYNC_MEDIA_STATE,
  ADMIN_START_MAIN_CAM,
  ADMIN_START_MIC,
  ADMIN_STOP_MAIN_CAM,
  ADMIN_STOP_MIC,
  AVAILABLE_SECOND_REMOTE_STREAM_EVENT,
  CHANNELS,
  CHANNELS_NOTIFY,
  CONFERENCE_PARTICIPANT_TOKEN_ISSUED,
  CONFIRMED,
  CONNECTED,
  CONNECTING,
  DECLINED_INCOMING_CALL,
  DISCONNECTED,
  ENDED,
  ENDED_FROM_SERVER,
  ENTER_ROOM,
  FAILED,
  FAILED_INCOMING_CALL,
  INCOMING_CALL,
  MAIN_CAM_CONTROL,
  MUST_STOP_PRESENTATION_EVENT,
  NEW_DTMF,
  NEW_INFO,
  NEW_RTC_SESSION,
  NOT_AVAILABLE_SECOND_REMOTE_STREAM_EVENT,
  ONE_MEGABIT_IN_BITS,
  Originator,
  PARTICIPANT,
  PARTICIPANT_ADDED_TO_LIST_MODERATORS,
  PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS,
  PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS,
  PARTICIPANT_MOVE_REQUEST_TO_STREAM,
  PARTICIPANT_REMOVED_FROM_LIST_MODERATORS,
  PARTICIPATION_ACCEPTING_WORD_REQUEST,
  PARTICIPATION_CANCELLING_WORD_REQUEST,
  PEER_CONNECTION,
  PEER_CONNECTION_CONFIRMED,
  PEER_CONNECTION_ONTRACK,
  PRESENTATION_ENDED,
  PRESENTATION_FAILED,
  REGISTERED,
  REGISTRATION_FAILED,
  SHARE_STATE,
  SIP_EVENT,
  SPECTATOR,
  TERMINATED_INCOMING_CALL,
  UNREGISTERED,
  USE_LICENSE,
  WEBCAST_STARTED,
  WEBCAST_STOPPED,
} from './constants';
import type { TEventSession, TEventUA } from './eventNames';
import {
  SESSION_EVENT_NAMES,
  SESSION_JSSIP_EVENT_NAMES,
  UA_EVENT_NAMES,
  UA_JSSIP_EVENT_NAMES,
} from './eventNames';
import getExtraHeadersRemoteAddress from './getExtraHeadersRemoteAddress';
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
  TJsSIP,
  TOnAddedTransceiver,
  TParametersCreateUaConfiguration,
} from './types';
import { EEventsMainCAM, EEventsMic, EEventsSyncMediaState } from './types';
import { hasDeclineResponseFromServer, hasHandshakeWebsocketOpeningError } from './utils/errors';
import scaleBitrate from './videoSendingBalancer/scaleBitrate';

const BUSY_HERE_STATUS_CODE = 486;
const REQUEST_TERMINATED_STATUS_CODE = 487;
const DELAYED_REPEATED_CALLS_CONNECT_LIMIT = 3;
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

type TParametersModeratorsList = {
  conference: string;
};

type TParametersWebcast = {
  conference: string;
  type: string;
};

type TParametersConferenceParticipantTokenIssued = {
  conference: string;
  participant: string;
  jwt: string;
};

type TOptionsInfoMediaState = {
  noTerminateWhenError?: boolean;
};

const CMD_CHANNELS = 'channels';
const CMD_WEBCAST_STARTED = 'WebcastStarted';
const CMD_WEBCAST_STOPPED = 'WebcastStopped';
const CMD_ACCOUNT_CHANGED = 'accountChanged';
const CMD_ACCOUNT_DELETED = 'accountDeleted';
const CMD_ADDED_TO_LIST_MODERATORS = 'addedToListModerators';
const CMD_REMOVED_FROM_LIST_MODERATORS = 'removedFromListModerators';
const CMD_ACCEPTING_WORD_REQUEST = 'ParticipationRequestAccepted';
const CMD_CANCELLING_WORD_REQUEST = 'ParticipationRequestRejected';
const CMD_MOVE_REQUEST_TO_STREAM = 'ParticipantMovedToWebcast';
const CMD_CONFERENCE_PARTICIPANT_TOKEN_ISSUED = 'ConferenceParticipantTokenIssued';

type TAddedToListModeratorsInfoNotify = {
  cmd: typeof CMD_ADDED_TO_LIST_MODERATORS;
  conference: string;
};
type TRemovedFromListModeratorsInfoNotify = {
  cmd: typeof CMD_REMOVED_FROM_LIST_MODERATORS;
  conference: string;
};
type TAcceptingWordRequestInfoNotify = {
  cmd: typeof CMD_ACCEPTING_WORD_REQUEST;
  body: { conference: string };
};
type TCancellingWordRequestInfoNotify = {
  cmd: typeof CMD_CANCELLING_WORD_REQUEST;
  body: { conference: string };
};
type TMoveRequestToStreamInfoNotify = {
  cmd: typeof CMD_MOVE_REQUEST_TO_STREAM;
  body: { conference: string };
};

type TConferenceParticipantTokenIssued = {
  cmd: typeof CMD_CONFERENCE_PARTICIPANT_TOKEN_ISSUED;
  body: { conference: string; participant: string; jwt: string };
};

type TWebcastInfoNotify = {
  cmd: typeof CMD_WEBCAST_STARTED;
  body: { conference: string; type: string };
};
type TChannelsInfoNotify = { cmd: typeof CMD_CHANNELS; input: string; output: string };
type TInfoNotify = Omit<
  TAddedToListModeratorsInfoNotify | TChannelsInfoNotify | TRemovedFromListModeratorsInfoNotify,
  'cmd'
> & { cmd: string };

type TOptionsExtraHeaders = {
  extraHeaders?: string[];
};

type TOntrack = (track: RTCTrackEvent) => void;

type TParametersConnection = TOptionsExtraHeaders & {
  displayName?: string;
  user?: string;
  password?: string;
  register?: boolean;
  sipServerUrl: string;
  sipWebSocketServerURL: string;
  remoteAddress?: string;
  sessionTimers?: boolean;
  registerExpires?: number;
  connectionRecoveryMinInterval?: number;
  connectionRecoveryMaxInterval?: number;
  userAgent?: string;
};

type TParametersCheckTelephony = {
  displayName: string;
  sipServerUrl: string;
  sipWebSocketServerURL: string;
  userAgent?: string;
  remoteAddress?: string;
  extraHeaders?: string[];
};
type TParametersCreateUa = UAConfigurationParams & {
  remoteAddress?: string;
  extraHeaders?: string[];
};

type TConnect = (
  parameters: TParametersConnection,
  options?: { callLimit?: number },
) => Promise<UA>;
type TInitUa = (parameters: TParametersConnection) => Promise<UA>;
type TCreateUa = (parameters: TParametersCreateUa) => UA;
type TStart = () => Promise<UA>;
type TSet = ({
  displayName,
  password,
}: {
  displayName?: string;
  password?: string;
}) => Promise<boolean>;

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
  parameters: TParametersAnswerToIncomingCall,
) => Promise<RTCPeerConnection>;

type TSendDTMF = (tone: number | string) => Promise<void>;

type THangUp = () => Promise<void>;

export default class SipConnector {
  private isRegisterConfigInner = false;

  private connectionConfiguration: {
    sipServerUrl?: string;
    displayName?: string;
    register?: boolean;
    user?: string;
    password?: string;
    number?: string;
    answer?: boolean;
  } = {};

  private remoteStreams: Record<string, MediaStream> = {};

  private readonly JsSIP: TJsSIP;

  private readonly sessionEvents: Events<typeof SESSION_EVENT_NAMES>;

  private readonly uaEvents: Events<typeof UA_EVENT_NAMES>;

  private getSipServerUrl: TGetServerUrl = (id: string) => {
    return id;
  };

  private cancelableConnectWithRepeatedCalls: ReturnType<typeof repeatedCallsAsync<UA>> | undefined;

  private cancelableSendPresentationWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<MediaStream>>
    | undefined;

  private isPendingConnect = false;

  private isPendingInitUa = false;

  private isPendingCall = false;

  private isPendingAnswer = false;

  promisePendingStartPresentation?: Promise<MediaStream>;

  promisePendingStopPresentation?: Promise<MediaStream | void>;

  ua?: UA;

  rtcSession?: RTCSession;

  incomingRTCSession?: RTCSession;

  streamPresentationCurrent?: MediaStream;

  socket?: WebSocketInterface;

  constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.JsSIP = JsSIP;

    this.sessionEvents = new Events<typeof SESSION_EVENT_NAMES>(SESSION_EVENT_NAMES);
    this.uaEvents = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);

    this.onSession(SHARE_STATE, this.handleShareState);
    this.onSession(NEW_INFO, this.handleNewInfo);
    this.on(SIP_EVENT, this.handleSipEvent);

    this.onSession(FAILED, this.handleEnded);
    this.onSession(ENDED, this.handleEnded);
  }

  connect: TConnect = async (data, options) => {
    this.cancelRequests();

    return this.connectWithDuplicatedCalls(data, options);
  };

  hangUp: THangUp = async () => {
    this.cancelRequests();

    return this.hangUpWithoutCancelRequests();
  };

  async register(): Promise<RegisteredEvent> {
    return new Promise((resolve, reject) => {
      if (this.isRegisterConfig && this.ua) {
        this.ua.on(REGISTERED, resolve);
        this.ua.on(REGISTRATION_FAILED, reject);
        this.ua.register();
      } else {
        reject(new Error('Config is not registered'));
      }
    });
  }

  async unregister(): Promise<UnRegisteredEvent> {
    return new Promise((resolve, reject) => {
      if (this.isRegistered && this.ua) {
        this.ua.on(UNREGISTERED, resolve);
        this.ua.unregister();
      } else {
        reject(new Error('ua is not registered'));
      }
    });
  }

  tryRegister = async () => {
    if (!this.isRegisterConfig) {
      throw new Error('Config is not registered');
    }

    this.uaEvents.trigger(CONNECTING, undefined);

    try {
      await this.unregister();
    } catch (error) {
      logger('tryRegister', error);
    }

    return this.register();
  };

  async sendOptions(target: URI | string, body?: string, extraHeaders?: string[]): Promise<void> {
    if (!this.ua) {
      throw new Error('is not connected');
    }

    return new Promise((resolve, reject) => {
      try {
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        this.ua.sendOptions(target, body, {
          extraHeaders,
          eventHandlers: {
            succeeded: () => {
              resolve();
            },
            failed: reject,
          },
        });
      } catch (error) {
        reject(error as Error);
      }
    });
  }

  async ping(body?: string, extraHeaders?: string[]): Promise<void> {
    if (!this.ua?.configuration.uri) {
      throw new Error('is not connected');
    }

    const target = this.ua.configuration.uri;

    return this.sendOptions(target, body, extraHeaders);
  }

  async checkTelephony({
    userAgent,
    displayName,
    sipServerUrl,
    sipWebSocketServerURL,
    remoteAddress,
    extraHeaders,
  }: TParametersCheckTelephony): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (error: Error) => void) => {
      const { configuration } = this.createUaConfiguration({
        sipWebSocketServerURL,
        displayName,
        userAgent,
        sipServerUrl,
      });

      const ua = this.createUa({ ...configuration, remoteAddress, extraHeaders });

      const rejectWithError = () => {
        const error = new Error('Telephony is not available');

        reject(error);
      };

      ua.once(DISCONNECTED, rejectWithError);

      const stopAndResolveAfterDisconnect = () => {
        ua.removeAllListeners();
        ua.once(DISCONNECTED, resolve);

        ua.stop();
      };

      ua.once(CONNECTED, stopAndResolveAfterDisconnect);

      ua.start();
    });
  }

  async replaceMediaStream(
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

  declineToIncomingCall = async ({ statusCode = REQUEST_TERMINATED_STATUS_CODE } = {}) => {
    return new Promise<void>((resolve, reject) => {
      try {
        const incomingRTCSession = this.getIncomingRTCSession();

        const callerData = this.remoteCallerData;

        this.removeIncomingSession();
        this.uaEvents.trigger(DECLINED_INCOMING_CALL, callerData);
        incomingRTCSession.terminate({ status_code: statusCode });
        resolve();
      } catch (error) {
        reject(error as Error);
      }
    });
  };

  busyIncomingCall = async () => {
    return this.declineToIncomingCall({ statusCode: BUSY_HERE_STATUS_CODE });
  };

  removeIncomingSession = () => {
    delete this.incomingRTCSession;
  };

  async askPermissionToEnableCam(options: TOptionsInfoMediaState = {}): Promise<void> {
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

  get isPendingPresentation(): boolean {
    return !!this.promisePendingStartPresentation || !!this.promisePendingStopPresentation;
  }

  private readonly connectWithDuplicatedCalls: TConnect = async (
    data,
    { callLimit = DELAYED_REPEATED_CALLS_CONNECT_LIMIT } = {},
  ) => {
    const targetFunction = async () => {
      return this.connectInner(data);
    };

    const isComplete = (response?: unknown): boolean => {
      const isConnected = !!this.ua?.isConnected();
      const isValidResponse = isConnected && this.hasEqualConnectionConfiguration(data);
      const isValidError = !!response && !hasHandshakeWebsocketOpeningError(response);

      return isValidResponse || isValidError;
    };

    this.isPendingConnect = true;

    this.cancelableConnectWithRepeatedCalls = repeatedCallsAsync<UA>({
      targetFunction,
      isComplete,
      callLimit,
      isRejectAsValid: true,
      isCheckBeforeCall: false,
    });

    return this.cancelableConnectWithRepeatedCalls
      .then((response?: unknown) => {
        if (response instanceof this.JsSIP.UA) {
          return response;
        }

        throw response;
      })
      .finally(() => {
        this.isPendingConnect = false;
      });
  };

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

  private hasEqualConnectionConfiguration(parameters: TParametersConnection) {
    const { configuration: newConfiguration } = this.createUaConfiguration(parameters);

    const uaConfiguration = this.ua?.configuration;

    return (
      uaConfiguration?.password === newConfiguration.password &&
      uaConfiguration?.register === newConfiguration.register &&
      uaConfiguration.uri.toString() === newConfiguration.uri &&
      uaConfiguration.display_name === newConfiguration.display_name &&
      uaConfiguration.user_agent === newConfiguration.user_agent &&
      uaConfiguration.sockets === newConfiguration.sockets &&
      uaConfiguration.session_timers === newConfiguration.session_timers &&
      uaConfiguration.register_expires === newConfiguration.register_expires &&
      uaConfiguration.connection_recovery_min_interval ===
        newConfiguration.connection_recovery_min_interval &&
      uaConfiguration.connection_recovery_max_interval ===
        newConfiguration.connection_recovery_max_interval
    );
  }

  private createUaConfiguration({
    user,
    password,
    sipWebSocketServerURL,
    displayName = '',
    sipServerUrl,
    register = false,
    sessionTimers = false,
    registerExpires = 60 * 5, // 5 minutes in sec
    connectionRecoveryMinInterval = 2,
    connectionRecoveryMaxInterval = 6,
    userAgent,
  }: TParametersCreateUaConfiguration) {
    if (register && !password) {
      throw new Error('password is required for authorized connection');
    }

    const authorizationUser = register && user ? user.trim() : `${generateUserId()}`;
    const getSipServerUrl = resolveSipUrl(sipServerUrl);
    const uri = getSipServerUrl(authorizationUser);
    const socket = new this.JsSIP.WebSocketInterface(sipWebSocketServerURL);

    return {
      configuration: {
        password,
        register,
        uri,
        display_name: parseDisplayName(displayName),
        user_agent: userAgent,
        sdp_semantics: 'unified-plan',
        sockets: [socket],
        session_timers: sessionTimers,
        register_expires: registerExpires,

        connection_recovery_min_interval: connectionRecoveryMinInterval,
        connection_recovery_max_interval: connectionRecoveryMaxInterval,
      },
      helpers: {
        socket,
        getSipServerUrl,
      },
    };
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

  async startPresentation(
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

    if (isP2P) {
      await this.sendMustStopPresentation(rtcSession);
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

  private async sendMustStopPresentation(rtcSession: RTCSession): Promise<void> {
    await rtcSession.sendInfo(CONTENT_TYPE_SHARE_STATE, undefined, {
      extraHeaders: [HEADER_MUST_STOP_PRESENTATION_P2P],
    });
  }

  async stopPresentation({
    isP2P = false,
  }: {
    isP2P?: boolean;
  } = {}): Promise<MediaStream | void> {
    this.cancelSendPresentationWithRepeatedCalls();

    const streamPresentationPrevious = this.streamPresentationCurrent;
    let result: Promise<MediaStream | void> =
      this.promisePendingStartPresentation ?? Promise.resolve();

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

  async updatePresentation(
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
  ): Promise<MediaStream | void> {
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

  removeStreamPresentationCurrent() {
    delete this.streamPresentationCurrent;
  }

  resetPresentation() {
    this.removeStreamPresentationCurrent();

    this.promisePendingStartPresentation = undefined;
    this.promisePendingStopPresentation = undefined;
  }

  cancelRequestsAndResetPresentation() {
    this.cancelSendPresentationWithRepeatedCalls();
    this.resetPresentation();
  }

  handleNewRTCSession = ({
    originator,
    session: rtcSession,
  }: IncomingRTCSessionEvent | OutgoingRTCSessionEvent) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (originator === Originator.REMOTE) {
      this.incomingRTCSession = rtcSession;

      const callerData = this.remoteCallerData;

      rtcSession.on(FAILED, (event: { originator: Originator }) => {
        this.removeIncomingSession();

        if (event.originator === Originator.LOCAL) {
          this.uaEvents.trigger(TERMINATED_INCOMING_CALL, callerData);
        } else {
          this.uaEvents.trigger(FAILED_INCOMING_CALL, callerData);
        }
      });

      this.uaEvents.trigger(INCOMING_CALL, callerData);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  on<T>(eventName: TEventUA, handler: (data: T) => void) {
    return this.uaEvents.on<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  once<T>(eventName: TEventUA, handler: (data: T) => void) {
    return this.uaEvents.once<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  onceRace<T>(eventNames: TEventUA[], handler: (data: T, eventName: string) => void) {
    return this.uaEvents.onceRace<T>(eventNames, handler);
  }

  async wait<T>(eventName: TEventUA): Promise<T> {
    return this.uaEvents.wait<T>(eventName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  off<T>(eventName: TEventUA, handler: (data: T) => void) {
    this.uaEvents.off<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  onSession<T>(eventName: TEventSession, handler: (data: T) => void) {
    return this.sessionEvents.on<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  onceSession<T>(eventName: TEventSession, handler: (data: T) => void) {
    return this.sessionEvents.once<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  onceRaceSession<T>(eventNames: TEventSession[], handler: (data: T, eventName: string) => void) {
    return this.sessionEvents.onceRace<T>(eventNames, handler);
  }

  async waitSession<T>(eventName: TEventSession): Promise<T> {
    return this.sessionEvents.wait<T>(eventName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  offSession<T>(eventName: TEventSession, handler: (data: T) => void) {
    this.sessionEvents.off<T>(eventName, handler);
  }

  isConfigured() {
    return !!this.ua;
  }

  getConnectionConfiguration() {
    return { ...this.connectionConfiguration };
  }

  getRemoteStreams(): MediaStream[] | undefined {
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

  get connection(): RTCPeerConnection | undefined {
    const connection = this.rtcSession?.connection;

    return connection;
  }

  get remoteCallerData() {
    return {
      displayName: this.incomingRTCSession?.remote_identity.display_name,

      host: this.incomingRTCSession?.remote_identity.uri.host,

      incomingNumber: this.incomingRTCSession?.remote_identity.uri.user,
      rtcSession: this.incomingRTCSession,
    };
  }

  get requested() {
    return (
      this.isPendingInitUa || this.isPendingConnect || this.isPendingCall || this.isPendingAnswer
    );
  }

  get establishedRTCSession(): RTCSession | undefined {
    return this.rtcSession?.isEstablished() ? this.rtcSession : undefined;
  }

  get isRegistered() {
    return !!this.ua && this.ua.isRegistered();
  }

  get isRegisterConfig() {
    return !!this.ua && this.isRegisterConfigInner;
  }

  get isCallActive() {
    return !!(this.ua && this.rtcSession);
  }

  get isAvailableIncomingCall() {
    return !!this.incomingRTCSession;
  }

  getIncomingRTCSession() {
    const { incomingRTCSession } = this;

    if (!incomingRTCSession) {
      throw new Error('No incomingRTCSession');
    }

    return incomingRTCSession;
  }

  connectInner: TConnect = async (parameters) => {
    return this.initUa(parameters).then(async () => {
      return this.start();
    });
  };

  initUa: TInitUa = async ({
    user,
    password,
    sipServerUrl,
    sipWebSocketServerURL,
    remoteAddress,
    sessionTimers,
    registerExpires,
    connectionRecoveryMinInterval,
    connectionRecoveryMaxInterval,
    userAgent,
    displayName = '',
    register = false,
    extraHeaders = [],
  }) => {
    if (!sipServerUrl) {
      throw new Error('sipServerUrl is required');
    }

    if (!sipWebSocketServerURL) {
      throw new Error('sipWebSocketServerURL is required');
    }

    if (register && !user) {
      throw new Error('user is required for authorized connection');
    }

    if (register && !password) {
      throw new Error('password is required for authorized connection');
    }

    this.isPendingInitUa = true;

    try {
      this.connectionConfiguration = {
        sipServerUrl,
        displayName,
        register,
        user,
        password,
      };

      const { configuration, helpers } = this.createUaConfiguration({
        user,
        sipServerUrl,
        sipWebSocketServerURL,
        password,
        displayName,
        register,
        sessionTimers,
        registerExpires,
        connectionRecoveryMinInterval,
        connectionRecoveryMaxInterval,
        userAgent,
      });

      this.getSipServerUrl = helpers.getSipServerUrl;
      this.socket = helpers.socket;

      if (this.ua) {
        await this.disconnect();
      }

      this.isRegisterConfigInner = !!register;

      this.ua = this.createUa({ ...configuration, remoteAddress, extraHeaders });

      this.uaEvents.eachTriggers((trigger, eventName) => {
        const uaJsSipEvent = UA_JSSIP_EVENT_NAMES.find((jsSipEvent) => {
          return jsSipEvent === eventName;
        });

        if (uaJsSipEvent && this.ua) {
          this.ua.on(uaJsSipEvent, trigger);
        }
      });

      return this.ua;
    } finally {
      this.isPendingInitUa = false;
    }
  };

  createUa: TCreateUa = ({
    remoteAddress,
    extraHeaders = [],
    ...parameters
  }: TParametersCreateUa): UA => {
    const ua = new this.JsSIP.UA(parameters);

    const extraHeadersRemoteAddress = remoteAddress
      ? getExtraHeadersRemoteAddress(remoteAddress)
      : [];
    const extraHeadersBase = [...extraHeadersRemoteAddress, ...extraHeaders];

    if (extraHeadersBase.length > 0) {
      ua.registrator().setExtraHeaders(extraHeadersBase);
    }

    return ua;
  };

  start: TStart = async () => {
    return new Promise((resolve, reject) => {
      const { ua } = this;

      if (!ua) {
        reject(new Error('this.ua is not initialized'));

        return;
      }

      const resolveUa = () => {
        removeEventListeners();
        resolve(ua);
      };
      const rejectError = (error: Error) => {
        removeEventListeners();
        reject(error);
      };
      const addEventListeners = () => {
        if (this.isRegisterConfig) {
          this.on(REGISTERED, resolveUa);
          this.on(REGISTRATION_FAILED, rejectError);
        } else {
          this.on(CONNECTED, resolveUa);
        }

        this.on(DISCONNECTED, rejectError);
      };
      const removeEventListeners = () => {
        this.off(REGISTERED, resolveUa);
        this.off(REGISTRATION_FAILED, rejectError);
        this.off(CONNECTED, resolveUa);
        this.off(DISCONNECTED, rejectError);
      };

      addEventListeners();
      this.on(NEW_RTC_SESSION, this.handleNewRTCSession);

      ua.start();
    });
  };

  set: TSet = async ({ displayName, password }) => {
    return new Promise((resolve, reject) => {
      const { ua } = this;

      if (!ua) {
        reject(new Error('this.ua is not initialized'));

        return;
      }

      let changedDisplayName = false;
      let changedPassword = false;

      if (displayName !== undefined && displayName !== this.connectionConfiguration.displayName) {
        changedDisplayName = ua.set('display_name', parseDisplayName(displayName));
        this.connectionConfiguration.displayName = displayName;
      }

      if (password !== undefined && password !== this.connectionConfiguration.password) {
        changedPassword = ua.set('password', password);
        this.connectionConfiguration.password = password;
      }

      const changedSome = changedDisplayName || changedPassword;

      if (changedPassword && this.isRegisterConfig) {
        this.register()
          .then(() => {
            resolve(changedSome);
          })
          .catch((error: unknown) => {
            reject(error as Error);
          });
      } else if (changedSome) {
        resolve(changedSome);
      } else {
        reject(new Error('nothing changed'));
      }
    });
  };

  disconnect = async () => {
    this.off(NEW_RTC_SESSION, this.handleNewRTCSession);

    const disconnectedPromise = new Promise<void>((resolve) => {
      this.once(DISCONNECTED, () => {
        resolve();
      });
    });

    const { ua } = this;

    if (ua) {
      await this.hangUpWithoutCancelRequests();
      ua.stop();
    } else {
      this.uaEvents.trigger(DISCONNECTED, undefined);
    }

    return disconnectedPromise.finally(() => {
      delete this.ua;
    });
  };

  call: TCall = async ({
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
  }) => {
    this.isPendingCall = true;

    return new Promise<RTCPeerConnection>((resolve, reject) => {
      const { ua } = this;

      if (!ua) {
        reject(new Error('this.ua is not initialized'));

        return;
      }

      this.connectionConfiguration.number = number;
      this.connectionConfiguration.answer = false;
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

  answerToIncomingCall: TAnswerToIncomingCall = async ({
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
  }): Promise<RTCPeerConnection> => {
    this.isPendingAnswer = true;

    return new Promise<RTCPeerConnection>((resolve, reject) => {
      try {
        const rtcSession = this.getIncomingRTCSession();

        this.rtcSession = rtcSession;
        this.removeIncomingSession();

        this.sessionEvents.eachTriggers((trigger, eventName) => {
          const sessionJsSipEvent = SESSION_JSSIP_EVENT_NAMES.find((jsSipEvent) => {
            return jsSipEvent === eventName;
          });

          if (sessionJsSipEvent) {
            rtcSession.on(sessionJsSipEvent, trigger);
          }
        });

        this.connectionConfiguration.answer = true;
        this.connectionConfiguration.number = rtcSession.remote_identity.uri.user;
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

  handleCall = async ({ ontrack }: { ontrack?: TOntrack }): Promise<RTCPeerConnection> => {
    return new Promise((resolve, reject) => {
      const addStartedEventListeners = () => {
        this.onSession(PEER_CONNECTION, handlePeerConnection);
        this.onSession(CONFIRMED, handleConfirmed);
      };
      const removeStartedEventListeners = () => {
        this.offSession(PEER_CONNECTION, handlePeerConnection);
        this.offSession(CONFIRMED, handleConfirmed);
      };
      const addEndedEventListeners = () => {
        this.onSession(FAILED, handleEnded);
        this.onSession(ENDED, handleEnded);
      };
      const removeEndedEventListeners = () => {
        this.offSession(FAILED, handleEnded);
        this.offSession(ENDED, handleEnded);
      };
      const handleEnded = (error: TCustomError) => {
        removeStartedEventListeners();
        removeEndedEventListeners();
        reject(error);
      };

      let savedPeerconnection: RTCPeerConnection;

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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (savedPeerconnection) {
          this.sessionEvents.trigger(PEER_CONNECTION_CONFIRMED, savedPeerconnection);
        }

        removeStartedEventListeners();
        removeEndedEventListeners();
        resolve(savedPeerconnection);
      };

      addStartedEventListeners();
      addEndedEventListeners();
    });
  };

  restoreSession: () => void = () => {
    this.cancelRequestsAndResetPresentation();

    delete this.connectionConfiguration.number;
    delete this.rtcSession;
    this.remoteStreams = {};
  };

  sendDTMF: TSendDTMF = async (tone) => {
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

  generateStream(videoTrack: MediaStreamTrack, audioTrack?: MediaStreamTrack): MediaStream {
    const { id } = videoTrack;

    const remoteStream: MediaStream = this.remoteStreams[id] ?? new MediaStream();

    if (audioTrack) {
      remoteStream.addTrack(audioTrack);
    }

    remoteStream.addTrack(videoTrack);
    this.remoteStreams[id] = remoteStream;

    return remoteStream;
  }

  generateAudioStream(audioTrack: MediaStreamTrack): MediaStream {
    const { id } = audioTrack;

    const remoteStream = this.remoteStreams[id] ?? new MediaStream();

    remoteStream.addTrack(audioTrack);

    this.remoteStreams[id] = remoteStream;

    return remoteStream;
  }

  generateStreams(remoteTracks: MediaStreamTrack[]): MediaStream[] {
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

  generateAudioStreams(remoteTracks: MediaStreamTrack[]): MediaStream[] {
    const remoteStreams: MediaStream[] = remoteTracks.map((remoteTrack) => {
      return this.generateAudioStream(remoteTrack);
    });

    return remoteStreams;
  }

  hangUpWithoutCancelRequests: THangUp = async () => {
    if (this.ua && this.rtcSession) {
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

  cancelRequests() {
    this.cancelConnectWithRepeatedCalls();
  }

  cancelConnectWithRepeatedCalls() {
    this.cancelableConnectWithRepeatedCalls?.cancel();
  }

  cancelSendPresentationWithRepeatedCalls() {
    this.cancelableSendPresentationWithRepeatedCalls?.cancel();
  }

  handleShareState = (eventName: string) => {
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

  maybeTriggerChannels = (request: IncomingRequest) => {
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

  handleNotify = (header: TInfoNotify) => {
    switch (header.cmd) {
      case CMD_CHANNELS: {
        const channelsInfo = header as TChannelsInfoNotify;

        this.triggerChannelsNotify(channelsInfo);

        break;
      }
      case CMD_WEBCAST_STARTED: {
        const webcastInfo = header as TWebcastInfoNotify;

        this.triggerWebcastStartedNotify(webcastInfo);

        break;
      }
      case CMD_WEBCAST_STOPPED: {
        const webcastInfo = header as TWebcastInfoNotify;

        this.triggerWebcastStoppedNotify(webcastInfo);

        break;
      }
      case CMD_ADDED_TO_LIST_MODERATORS: {
        const data = header as TAddedToListModeratorsInfoNotify;

        this.triggerAddedToListModeratorsNotify(data);

        break;
      }
      case CMD_REMOVED_FROM_LIST_MODERATORS: {
        const data = header as TRemovedFromListModeratorsInfoNotify;

        this.triggerRemovedFromListModeratorsNotify(data);

        break;
      }
      case CMD_ACCEPTING_WORD_REQUEST: {
        const data = header as TAcceptingWordRequestInfoNotify;

        this.triggerParticipationAcceptingWordRequest(data);

        break;
      }
      case CMD_CANCELLING_WORD_REQUEST: {
        const data = header as TCancellingWordRequestInfoNotify;

        this.triggerParticipationCancellingWordRequest(data);

        break;
      }
      case CMD_MOVE_REQUEST_TO_STREAM: {
        const data = header as TMoveRequestToStreamInfoNotify;

        this.triggerParticipantMoveRequestToStream(data);

        break;
      }
      case CMD_ACCOUNT_CHANGED: {
        this.triggerAccountChangedNotify();

        break;
      }
      case CMD_ACCOUNT_DELETED: {
        this.triggerAccountDeletedNotify();

        break;
      }
      case CMD_CONFERENCE_PARTICIPANT_TOKEN_ISSUED: {
        const data = header as TConferenceParticipantTokenIssued;

        this.triggerConferenceParticipantTokenIssued(data);

        break;
      }
      default: {
        logger('unknown cmd', header.cmd);
      }
      // No default
    }
  };

  triggerRemovedFromListModeratorsNotify = ({
    conference,
  }: TRemovedFromListModeratorsInfoNotify) => {
    const headersParametersModeratorsList: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(
      PARTICIPANT_REMOVED_FROM_LIST_MODERATORS,
      headersParametersModeratorsList,
    );
  };

  triggerAddedToListModeratorsNotify = ({ conference }: TAddedToListModeratorsInfoNotify) => {
    const headersParametersModeratorsList: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(PARTICIPANT_ADDED_TO_LIST_MODERATORS, headersParametersModeratorsList);
  };

  triggerWebcastStartedNotify = ({ body: { conference, type } }: TWebcastInfoNotify) => {
    const headersParametersWebcast: TParametersWebcast = {
      conference,
      type,
    };

    this.uaEvents.trigger(WEBCAST_STARTED, headersParametersWebcast);
  };

  triggerWebcastStoppedNotify = ({ body: { conference, type } }: TWebcastInfoNotify) => {
    const headersParametersWebcast: TParametersWebcast = {
      conference,
      type,
    };

    this.uaEvents.trigger(WEBCAST_STOPPED, headersParametersWebcast);
  };

  triggerAccountChangedNotify = () => {
    this.uaEvents.trigger(ACCOUNT_CHANGED, undefined);
  };

  triggerAccountDeletedNotify = () => {
    this.uaEvents.trigger(ACCOUNT_DELETED, undefined);
  };

  triggerConferenceParticipantTokenIssued = ({
    body: { conference, participant, jwt },
  }: TConferenceParticipantTokenIssued) => {
    const headersConferenceParticipantTokenIssued: TParametersConferenceParticipantTokenIssued = {
      conference,
      participant,
      jwt,
    };

    this.uaEvents.trigger(
      CONFERENCE_PARTICIPANT_TOKEN_ISSUED,
      headersConferenceParticipantTokenIssued,
    );
  };

  triggerChannelsNotify = (channelsInfo: TChannelsInfoNotify) => {
    const inputChannels = channelsInfo.input;
    const outputChannels = channelsInfo.output;

    const data: TChannels = {
      inputChannels,
      outputChannels,
    };

    this.uaEvents.trigger(CHANNELS_NOTIFY, data);
  };

  triggerParticipationAcceptingWordRequest = ({
    body: { conference },
  }: TAcceptingWordRequestInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(PARTICIPATION_ACCEPTING_WORD_REQUEST, data);
  };

  triggerParticipationCancellingWordRequest = ({
    body: { conference },
  }: TCancellingWordRequestInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(PARTICIPATION_CANCELLING_WORD_REQUEST, data);
  };

  triggerParticipantMoveRequestToStream = ({
    body: { conference },
  }: TMoveRequestToStreamInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(PARTICIPANT_MOVE_REQUEST_TO_STREAM, data);
  };

  triggerEnterRoom = (request: IncomingRequest) => {
    const room = request.getHeader(HEADER_CONTENT_ENTER_ROOM);
    const participantName = request.getHeader(HEADER_PARTICIPANT_NAME);

    this.sessionEvents.trigger(ENTER_ROOM, { room, participantName });
  };

  triggerShareState = (request: IncomingRequest) => {
    const eventName = request.getHeader(HEADER_CONTENT_SHARE_STATE);

    this.sessionEvents.trigger(SHARE_STATE, eventName);
  };

  maybeTriggerParticipantMoveRequest = (request: IncomingRequest) => {
    const participantState = request.getHeader(HEADER_CONTENT_PARTICIPANT_STATE);

    if (participantState === SPECTATOR) {
      this.sessionEvents.trigger(PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS, undefined);
    }

    if (participantState === PARTICIPANT) {
      this.sessionEvents.trigger(PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS, undefined);
    }
  };

  triggerMainCamControl = (request: IncomingRequest) => {
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
      !!syncState
    ) {
      this.sessionEvents.trigger(ADMIN_FORCE_SYNC_MEDIA_STATE, { isSyncForced });
    }

    const resolutionMainCam = request.getHeader(HEADER_MAIN_CAM_RESOLUTION);

    this.sessionEvents.trigger(MAIN_CAM_CONTROL, {
      mainCam,
      resolutionMainCam,
    });
  };

  triggerMicControl = (request: IncomingRequest) => {
    const mic = request.getHeader(HEADER_MIC) as EEventsMic | undefined;
    const syncState = request.getHeader(HEADER_MEDIA_SYNC) as EEventsSyncMediaState | undefined;
    const isSyncForced = syncState === EEventsSyncMediaState.ADMIN_SYNC_FORCED;

    if (mic === EEventsMic.ADMIN_START_MIC) {
      this.sessionEvents.trigger(ADMIN_START_MIC, { isSyncForced });
    } else if (mic === EEventsMic.ADMIN_STOP_MIC) {
      this.sessionEvents.trigger(ADMIN_STOP_MIC, { isSyncForced });
    }
  };

  triggerUseLicense = (request: IncomingRequest) => {
    const license: EUseLicense = request.getHeader(HEADER_CONTENT_USE_LICENSE) as EUseLicense;

    this.sessionEvents.trigger(USE_LICENSE, license);
  };

  handleNewInfo = (info: IncomingInfoEvent | OutgoingInfoEvent) => {
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

  handleSipEvent = ({ request }: { request: IncomingRequest }) => {
    this.maybeHandleNotify(request);
  };

  maybeHandleNotify = (request: IncomingRequest) => {
    const headerNotify = request.getHeader(HEADER_NOTIFY);

    if (headerNotify) {
      const headerNotifyParsed = JSON.parse(headerNotify) as TInfoNotify;

      this.handleNotify(headerNotifyParsed);
    }
  };

  async waitChannels(): Promise<TChannels> {
    return this.waitSession(CHANNELS);
  }

  async waitSyncMediaState(): Promise<{ isSyncForced: boolean }> {
    return this.waitSession(ADMIN_FORCE_SYNC_MEDIA_STATE);
  }

  async sendChannels({ inputChannels, outputChannels }: TChannels): Promise<void> {
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

  async sendMediaState(
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

  async sendRefusalToTurnOn(
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

  async sendRefusalToTurnOnMic(options: TOptionsInfoMediaState = {}): Promise<void> {
    if (!this.rtcSession) {
      throw new Error('No rtcSession established');
    }

    return this.sendRefusalToTurnOn('mic', { noTerminateWhenError: true, ...options });
  }

  async sendRefusalToTurnOnCam(options: TOptionsInfoMediaState = {}): Promise<void> {
    if (!this.rtcSession) {
      throw new Error('No rtcSession established');
    }

    return this.sendRefusalToTurnOn('cam', { noTerminateWhenError: true, ...options });
  }

  handleEnded = (error: TCustomError) => {
    const { originator } = error;

    if (originator === Originator.REMOTE) {
      this.sessionEvents.trigger(ENDED_FROM_SERVER, error);
    }

    this.restoreSession();
  };
}
