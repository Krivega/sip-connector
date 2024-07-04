/* eslint-disable unicorn/no-useless-undefined */
import { CancelableRequest, isCanceledError } from '@krivega/cancelable-promise';
import type {
  IncomingInfoEvent,
  IncomingRTCSessionEvent,
  IncomingRequest,
  OutgoingInfoEvent,
  RTCSession,
  RegisteredEvent,
  UA,
  UAConfigurationParams,
  URI,
  UnRegisteredEvent,
  WebSocketInterface,
} from '@krivega/jssip';
import Events from 'events-constructor';
import { repeatedCallsAsync } from 'repeated-calls';
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
  PARTICIPANT_ADDED_TO_LIST_MODERATORS,
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
import type {
  EUseLicense,
  TCustomError,
  TGetServerUrl,
  TJsSIP,
  TParametersCreateUa,
} from './types';
import { EEventsMainCAM, EEventsMic, EEventsSyncMediaState } from './types';
import {
  generateUserId,
  hasVideoTracks,
  parseDisplayName,
  prepareMediaStream,
  resolveSipUrl,
} from './utils';
import { hasDeclineResponseFromServer, hasHandshakeWebsocketOpeningError } from './utils/errors';
import scaleBitrate from './videoSendingBalancer/scaleBitrate';

const BUSY_HERE_STATUS_CODE = 486;
const REQUEST_TERMINATED_STATUS_CODE = 487;
const ORIGINATOR_LOCAL = 'local';
const ORIGINATOR_REMOTE = 'remote';
const DELAYED_REPEATED_CALLS_CONNECT_LIMIT = 3;
const DELAYED_REPEATED_CALLS_SEND_PRESENTATION_LIMIT = 1;

export const hasCanceledCallError = (error: TCustomError = new Error()): boolean => {
  const { originator, cause } = error;

  if (isCanceledError(error)) {
    return true;
  }

  if (typeof cause === 'string') {
    return (
      cause === REQUEST_TIMEOUT ||
      cause === REJECTED ||
      (originator === ORIGINATOR_LOCAL && (cause === CANCELED || cause === BYE))
    );
  }

  return false;
};

const moduleName = 'SipConnector';

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
};

type TConnect = (
  parameters: TParametersConnection,
  options?: { callLimit?: number },
) => Promise<UA>;
type TInitUa = (parameters: TParametersConnection) => Promise<UA>;
type TCreateUa = (parameters: UAConfigurationParams) => UA;
type TStart = () => Promise<UA>;
type TSet = ({
  displayName,
  password,
}: {
  displayName?: string;
  password?: string;
}) => Promise<boolean>;

type TDegradationPreference = 'balanced' | 'maintain-framerate' | 'maintain-resolution';
type TCall = ({
  number,
  mediaStream,
  extraHeaders,
  ontrack,
  iceServers,
  videoMode,
  audioMode,
  offerToReceiveAudio,
  offerToReceiveVideo,
  degradationPreference,
}: {
  number: string;
  mediaStream: MediaStream;
  extraHeaders?: TOptionsExtraHeaders['extraHeaders'];
  ontrack?: TOntrack;
  iceServers?: RTCIceServer[];
  videoMode?: 'recvonly' | 'sendonly' | 'sendrecv';
  audioMode?: 'recvonly' | 'sendonly' | 'sendrecv';
  offerToReceiveAudio?: boolean;
  offerToReceiveVideo?: boolean;
  degradationPreference?: TDegradationPreference;
}) => Promise<RTCPeerConnection>;

type TDisconnect = () => Promise<void>;

type TParametersAnswerToIncomingCall = {
  mediaStream: MediaStream;
  extraHeaders?: TOptionsExtraHeaders['extraHeaders'];
  ontrack?: TOntrack;
  iceServers?: RTCIceServer[];
  videoMode?: 'recvonly' | 'sendonly' | 'sendrecv';
  audioMode?: 'recvonly' | 'sendonly' | 'sendrecv';
  degradationPreference?: TDegradationPreference;
};

type TAnswerToIncomingCall = (
  parameters: TParametersAnswerToIncomingCall,
) => Promise<RTCPeerConnection>;

type TSendDTMF = (tone: number | string) => Promise<void>;

type THangUp = () => Promise<void>;

export default class SipConnector {
  private _isRegisterConfig = false;

  private _connectionConfiguration: {
    sipServerUrl?: string;
    displayName?: string;
    register?: boolean;
    user?: string;
    password?: string;
    number?: string;
    answer?: boolean;
  } = {};

  private _remoteStreams: Record<string, MediaStream> = {};

  private readonly JsSIP: TJsSIP;

  private readonly _sessionEvents: Events<typeof SESSION_EVENT_NAMES>;

  private readonly _uaEvents: Events<typeof UA_EVENT_NAMES>;

  private readonly _cancelableConnect: CancelableRequest<
    Parameters<TConnect>[0],
    ReturnType<TConnect>
  >;

  private _cancelableConnectWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<UA>>
    | undefined;

  private readonly _cancelableInitUa: CancelableRequest<
    Parameters<TInitUa>[0],
    ReturnType<TInitUa>
  >;

  private _sendPresentationWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<MediaStream>>
    | undefined;

  private readonly _cancelableDisconnect: CancelableRequest<void, ReturnType<TDisconnect>>;

  private readonly _cancelableSet: CancelableRequest<Parameters<TSet>[0], ReturnType<TSet>>;

  private readonly _cancelableCall: CancelableRequest<Parameters<TCall>[0], ReturnType<TCall>>;

  private readonly _cancelableAnswer: CancelableRequest<
    Parameters<TAnswerToIncomingCall>[0],
    ReturnType<TAnswerToIncomingCall>
  >;

  private readonly _cancelableSendDTMF: CancelableRequest<
    Parameters<TSendDTMF>[0],
    ReturnType<TSendDTMF>
  >;

  private getSipServerUrl: TGetServerUrl = (id: string) => {
    return id;
  };

  promisePendingStartPresentation?: Promise<MediaStream>;

  promisePendingStopPresentation?: Promise<MediaStream | void>;

  ua?: UA;

  session?: RTCSession;

  incomingSession?: RTCSession;

  _streamPresentationCurrent?: MediaStream;

  socket?: WebSocketInterface;

  private isStreamInProgress = false;

  constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.JsSIP = JsSIP;

    this._sessionEvents = new Events<typeof SESSION_EVENT_NAMES>(SESSION_EVENT_NAMES);
    this._uaEvents = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);

    this._cancelableConnect = new CancelableRequest<Parameters<TConnect>[0], ReturnType<TConnect>>(
      this._connect,
      {
        moduleName,
        afterCancelRequest: () => {
          this._cancelableInitUa.cancelRequest();
          this._cancelableDisconnect.cancelRequest();
        },
      },
    );

    this._cancelableInitUa = new CancelableRequest<Parameters<TInitUa>[0], ReturnType<TInitUa>>(
      this._initUa,
      { moduleName },
    );

    this._cancelableDisconnect = new CancelableRequest<void, ReturnType<TDisconnect>>(
      this._disconnect,
      { moduleName },
    );

    this._cancelableSet = new CancelableRequest<Parameters<TSet>[0], ReturnType<TSet>>(this._set, {
      moduleName,
    });

    this._cancelableCall = new CancelableRequest<Parameters<TCall>[0], ReturnType<TCall>>(
      this._call,
      { moduleName },
    );

    this._cancelableAnswer = new CancelableRequest<
      Parameters<TAnswerToIncomingCall>[0],
      ReturnType<TAnswerToIncomingCall>
    >(this._answer, { moduleName });

    this._cancelableSendDTMF = new CancelableRequest<
      Parameters<TSendDTMF>[0],
      ReturnType<TSendDTMF>
    >(this._sendDTMF, { moduleName });

    this.onSession(SHARE_STATE, this._handleShareState);
    this.onSession(NEW_INFO, this._handleNewInfo);
    this.on(SIP_EVENT, this._handleSipEvent);

    this.onSession(FAILED, this._handleEnded);
    this.onSession(ENDED, this._handleEnded);
  }

  connect: TConnect = async (data, options) => {
    this._cancelRequests();

    return this._connectWithDuplicatedCalls(data, options);
  };

  initUa: TInitUa = async (data) => {
    return this._cancelableInitUa.request(data);
  };

  set: TSet = async (data) => {
    return this._cancelableSet.request(data);
  };

  call: TCall = async (data) => {
    return this._cancelableCall.request(data);
  };

  disconnect: TDisconnect = async () => {
    this._cancelRequests();

    return this._disconnectWithoutCancelRequests();
  };

  answerToIncomingCall: TAnswerToIncomingCall = async (data) => {
    return this._cancelableAnswer.request(data);
  };

  sendDTMF: TSendDTMF = async (tone) => {
    return this._cancelableSendDTMF.request(tone);
  };

  hangUp: THangUp = async () => {
    this._cancelRequests();

    return this._hangUpWithoutCancelRequests();
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

    this._uaEvents.trigger(CONNECTING, undefined);

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
        // eslint-disable-next-line prefer-promise-reject-errors
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
  }: TParametersCheckTelephony): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (error: Error) => void) => {
      const { configuration } = this.createUaConfiguration({
        sipWebSocketServerURL,
        displayName,
        userAgent,
        sipServerUrl,
      });

      const ua = this._createUa(configuration);

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
      deleteExisting: boolean;
      addMissing: boolean;
      forceRenegotiation: boolean;
      degradationPreference?: TDegradationPreference;
    },
  ): Promise<void> {
    if (!this.session) {
      throw new Error('No session established');
    }

    return this.session.replaceMediaStream(mediaStream, options);
  }

  declineToIncomingCall = async ({ statusCode = REQUEST_TERMINATED_STATUS_CODE } = {}) => {
    return new Promise((resolve, reject) => {
      if (!this.isAvailableIncomingCall) {
        reject(new Error('no incomingSession'));

        return;
      }

      const incomingSession = this.incomingSession!;
      const callerData = this.remoteCallerData;

      this._cancelableCall.cancelRequest();
      this._cancelableAnswer.cancelRequest();

      this.removeIncomingSession();
      this._uaEvents.trigger(DECLINED_INCOMING_CALL, callerData);
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      resolve(incomingSession.terminate({ status_code: statusCode }));
    });
  };

  busyIncomingCall = async () => {
    return this.declineToIncomingCall({ statusCode: BUSY_HERE_STATUS_CODE });
  };

  removeIncomingSession = () => {
    delete this.incomingSession;
  };

  async askPermissionToEnableCam(options: TOptionsInfoMediaState = {}): Promise<void> {
    if (!this.session) {
      throw new Error('No session established');
    }

    const extraHeaders = [HEADER_ENABLE_MAIN_CAM];

    return this.session
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

  private readonly _connectWithDuplicatedCalls: TConnect = async (
    data,
    { callLimit = DELAYED_REPEATED_CALLS_CONNECT_LIMIT } = {},
  ) => {
    let isFirstRequest = true;

    const targetFunction = async () => {
      isFirstRequest = false;

      return this._cancelableConnect.request(data);
    };

    const isComplete = (response?: unknown): boolean => {
      const isConnected = !!this.ua?.isConnected();
      const isValidResponse =
        !isFirstRequest && isConnected && this.hasEqualConnectionConfiguration(data);
      const isValidError = !!response && !hasHandshakeWebsocketOpeningError(response);

      return isValidResponse || isValidError;
    };

    this._cancelableConnectWithRepeatedCalls = repeatedCallsAsync<UA>({
      targetFunction,
      isComplete,
      callLimit,
      isRejectAsValid: true,
      onAfterCancel: () => {
        this._cancelableConnect.cancelRequest();
      },
    });

    return this._cancelableConnectWithRepeatedCalls.then((response?: unknown) => {
      if (response instanceof this.JsSIP.UA) {
        return response;
      }

      throw response;
    });
  };

  private async __sendPresentationWithDuplicatedCalls({
    session,
    stream,
    data,
    options = {
      callLimit: DELAYED_REPEATED_CALLS_SEND_PRESENTATION_LIMIT,
    },
  }: {
    session: RTCSession;
    stream: MediaStream;
    data: {
      isNeedReinvite?: boolean;
      isP2P?: boolean;
      maxBitrate?: number;
      degradationPreference?: TDegradationPreference;
    };
    options?: { callLimit: number };
  }) {
    const targetFunction = async () => {
      return this._sendPresentation(session, stream, data);
    };

    const isComplete = (): boolean => {
      return this.isStreamInProgress;
    };

    this._sendPresentationWithRepeatedCalls = repeatedCallsAsync<MediaStream>({
      targetFunction,
      isComplete,
      isRejectAsValid: true,
      ...options,
    });

    return this._sendPresentationWithRepeatedCalls.then((response: unknown) => {
      if (response instanceof MediaStream) {
        return response;
      }

      throw response;
    });
  }

  private hasEqualConnectionConfiguration(parameters: TParametersConnection) {
    const { configuration: newConfiguration } = this.createUaConfiguration(parameters);

    const uaConfiguration = this.ua?.configuration;

    return (
      uaConfiguration?.password === newConfiguration.password &&
      uaConfiguration?.register === newConfiguration.register &&
      uaConfiguration?.uri.toString() === newConfiguration.uri &&
      uaConfiguration?.display_name === newConfiguration.display_name &&
      uaConfiguration?.user_agent === newConfiguration.user_agent &&
      uaConfiguration?.sockets === newConfiguration.sockets &&
      uaConfiguration?.session_timers === newConfiguration.session_timers &&
      uaConfiguration?.register_expires === newConfiguration.register_expires &&
      uaConfiguration?.connection_recovery_min_interval ===
        newConfiguration.connection_recovery_min_interval &&
      uaConfiguration?.connection_recovery_max_interval ===
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
  }: TParametersCreateUa) {
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

  private async _sendPresentation(
    session: RTCSession,
    stream: MediaStream,
    {
      maxBitrate,
      degradationPreference,
      isNeedReinvite = true,
      isP2P = false,
    }: {
      isNeedReinvite?: boolean;
      isP2P?: boolean;
      maxBitrate?: number;
      degradationPreference?: TDegradationPreference;
    },
  ) {
    const streamPresentationCurrent = prepareMediaStream(stream)!;

    this._streamPresentationCurrent = streamPresentationCurrent;

    const preparatoryHeaders = isP2P
      ? [HEADER_START_PRESENTATION_P2P]
      : [HEADER_START_PRESENTATION];

    const result = session
      .sendInfo(CONTENT_TYPE_SHARE_STATE, undefined, {
        extraHeaders: preparatoryHeaders,
      })
      .then(async () => {
        return session.startPresentation(
          streamPresentationCurrent,
          isNeedReinvite,
          degradationPreference,
        );
      })
      .then(async () => {
        const { connection } = this;

        if (!connection || maxBitrate === undefined) {
          return;
        }

        const senders = connection.getSenders();

        await scaleBitrate(senders, stream, maxBitrate);
      })
      .then(() => {
        this.isStreamInProgress = true;

        return stream;
      })
      .catch((error: unknown) => {
        this.isStreamInProgress = false;

        this._sessionEvents.trigger(PRESENTATION_FAILED, error);

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
      isNeedReinvite = true,
      isP2P = false,
      maxBitrate,
      degradationPreference,
    }: {
      isNeedReinvite?: boolean;
      isP2P?: boolean;
      maxBitrate?: number;
      degradationPreference?: TDegradationPreference;
    } = {},
    options?: { callLimit: number },
  ): Promise<MediaStream> {
    const session = this.establishedSession;

    if (!session) {
      throw new Error('No session established');
    }

    if (this._streamPresentationCurrent) {
      throw new Error('Presentation is already started');
    }

    if (isP2P) {
      await this.sendMustStopPresentation(session);
    }

    return this.__sendPresentationWithDuplicatedCalls({
      session,
      stream,
      data: {
        isNeedReinvite,
        isP2P,
        maxBitrate,
        degradationPreference,
      },
      options,
    });
  }

  private async sendMustStopPresentation(session: RTCSession): Promise<void> {
    await session.sendInfo(CONTENT_TYPE_SHARE_STATE, undefined, {
      extraHeaders: [HEADER_MUST_STOP_PRESENTATION_P2P],
    });
  }

  async stopPresentation({
    isP2P = false,
  }: {
    isP2P?: boolean;
  } = {}): Promise<MediaStream | void> {
    const streamPresentationPrevious = this._streamPresentationCurrent;
    let result: Promise<MediaStream | void> =
      this.promisePendingStartPresentation ?? Promise.resolve();

    const preparatoryHeaders = isP2P ? [HEADER_STOP_PRESENTATION_P2P] : [HEADER_STOP_PRESENTATION];

    const session = this.establishedSession;

    if (session && streamPresentationPrevious) {
      result = result
        .then(async () => {
          return session.sendInfo(CONTENT_TYPE_SHARE_STATE, undefined, {
            extraHeaders: preparatoryHeaders,
          });
        })
        .then(async () => {
          return session.stopPresentation(streamPresentationPrevious);
        })
        .catch((error: unknown) => {
          this._sessionEvents.trigger(PRESENTATION_FAILED, error);

          throw error;
        });
    }

    if (!session && streamPresentationPrevious) {
      this._sessionEvents.trigger(PRESENTATION_ENDED, streamPresentationPrevious);
    }

    this.promisePendingStopPresentation = result;

    return result.finally(() => {
      this._resetPresentation();
    });
  }

  async updatePresentation(
    stream: MediaStream,
    {
      isP2P = false,
      maxBitrate,
      degradationPreference,
    }: {
      isP2P?: boolean;
      maxBitrate?: number;
      degradationPreference?: TDegradationPreference;
    } = {},
  ): Promise<MediaStream | void> {
    const session = this.establishedSession;

    if (!session) {
      throw new Error('No session established');
    }

    if (!this._streamPresentationCurrent) {
      throw new Error('Presentation has not started yet');
    }

    if (this.promisePendingStartPresentation) {
      await this.promisePendingStartPresentation;
    }

    return this._sendPresentation(session, stream, {
      isP2P,
      maxBitrate,
      degradationPreference,
      isNeedReinvite: false,
    });
  }

  _resetPresentation(): void {
    delete this._streamPresentationCurrent;

    this.promisePendingStartPresentation = undefined;
    this.promisePendingStopPresentation = undefined;
    this.isStreamInProgress = false;
  }

  handleNewRTCSession = ({ originator, session }: IncomingRTCSessionEvent) => {
    if (originator === ORIGINATOR_REMOTE) {
      this.incomingSession = session;

      const callerData = this.remoteCallerData;

      session.on(FAILED, (event: { originator: string }) => {
        this.removeIncomingSession();

        if (event.originator === ORIGINATOR_LOCAL) {
          this._uaEvents.trigger(TERMINATED_INCOMING_CALL, callerData);
        } else {
          this._uaEvents.trigger(FAILED_INCOMING_CALL, callerData);
        }
      });

      this._uaEvents.trigger(INCOMING_CALL, callerData);
    }
  };

  on<T = void>(eventName: TEventUA, handler: (data: T) => void) {
    return this._uaEvents.on<T>(eventName, handler);
  }

  once<T>(eventName: TEventUA, handler: (data: T) => void) {
    return this._uaEvents.once<T>(eventName, handler);
  }

  onceRace<T>(eventNames: TEventUA[], handler: (data: T, eventName: string) => void) {
    return this._uaEvents.onceRace<T>(eventNames, handler);
  }

  async wait<T>(eventName: TEventUA): Promise<T> {
    return this._uaEvents.wait<T>(eventName);
  }

  off<T>(eventName: TEventUA, handler: (data: T) => void) {
    this._uaEvents.off<T>(eventName, handler);
  }

  onSession<T>(eventName: TEventSession, handler: (data: T) => void) {
    return this._sessionEvents.on<T>(eventName, handler);
  }

  onceSession<T>(eventName: TEventSession, handler: (data: T) => void) {
    return this._sessionEvents.once<T>(eventName, handler);
  }

  onceRaceSession<T>(eventNames: TEventSession[], handler: (data: T, eventName: string) => void) {
    return this._sessionEvents.onceRace<T>(eventNames, handler);
  }

  async waitSession<T>(eventName: TEventSession): Promise<T> {
    return this._sessionEvents.wait<T>(eventName);
  }

  offSession<T>(eventName: TEventSession, handler: (data: T) => void) {
    this._sessionEvents.off<T>(eventName, handler);
  }

  isConfigured() {
    return !!this.ua;
  }

  getConnectionConfiguration() {
    return { ...this._connectionConfiguration };
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
      return this._generateStreams(remoteTracks);
    }

    return this._generateAudioStreams(remoteTracks);
  }

  get connection(): RTCPeerConnection | undefined {
    const connection = this.session?.connection;

    return connection;
  }

  get remoteCallerData() {
    return {
      displayName: this.incomingSession?.remote_identity?.display_name,

      host: this.incomingSession?.remote_identity?.uri.host,

      incomingNumber: this.incomingSession?.remote_identity?.uri.user,
      session: this.incomingSession,
    };
  }

  get requested() {
    return (
      this._cancelableConnect.requested ||
      this._cancelableInitUa.requested ||
      this._cancelableCall.requested ||
      this._cancelableAnswer.requested
    );
  }

  get establishedSession(): RTCSession | undefined {
    return this.session?.isEstablished() ? this.session : undefined;
  }

  get isRegistered() {
    return !!this.ua && this.ua.isRegistered();
  }

  get isRegisterConfig() {
    return !!this.ua && this._isRegisterConfig;
  }

  get isCallActive() {
    return !!(this.ua && this.session);
  }

  get isAvailableIncomingCall() {
    return !!this.incomingSession;
  }

  _connect: TConnect = async (parameters) => {
    return this.initUa(parameters).then(async () => {
      return this._start();
    });
  };

  _initUa: TInitUa = async ({
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

    this._connectionConfiguration = {
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
      await this._disconnectWithoutCancelRequests();
    }

    this._isRegisterConfig = !!register;

    this.ua = this._createUa(configuration);

    this._uaEvents.eachTriggers((trigger, eventName) => {
      const uaJsSipEvent = UA_JSSIP_EVENT_NAMES.find((jsSipEvent) => {
        return jsSipEvent === eventName;
      });

      if (uaJsSipEvent && this.ua) {
        this.ua.on(uaJsSipEvent, trigger);
      }
    });

    const extraHeadersRemoteAddress = getExtraHeadersRemoteAddress(remoteAddress);
    const extraHeadersBase = [...extraHeadersRemoteAddress, ...extraHeaders];

    this.ua.registrator().setExtraHeaders(extraHeadersBase);

    return this.ua;
  };

  _createUa: TCreateUa = (parameters: UAConfigurationParams): UA => {
    return new this.JsSIP.UA(parameters);
  };

  _start: TStart = async () => {
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

  _set: TSet = async ({ displayName, password }) => {
    return new Promise((resolve, reject) => {
      const { ua } = this;

      if (!ua) {
        reject(new Error('this.ua is not initialized'));

        return;
      }

      let changedDisplayName = false;
      let changedPassword = false;

      if (displayName !== undefined && displayName !== this._connectionConfiguration.displayName) {
        changedDisplayName = ua.set('display_name', parseDisplayName(displayName));
        this._connectionConfiguration.displayName = displayName;
      }

      if (password !== undefined && password !== this._connectionConfiguration.password) {
        changedPassword = ua.set('password', password);
        this._connectionConfiguration.password = password;
      }

      const changedSome = changedDisplayName || changedPassword;

      if (changedPassword && this.isRegisterConfig) {
        this.register()
          .then(() => {
            resolve(changedSome);
          })
          .catch((error: unknown) => {
            // eslint-disable-next-line prefer-promise-reject-errors
            reject(error as Error);
          });
      } else if (changedSome) {
        resolve(changedSome);
      } else {
        reject(new Error('nothing changed'));
      }
    });
  };

  _disconnectWithoutCancelRequests: TDisconnect = async () => {
    return this._cancelableDisconnect.request();
  };

  _disconnect = async () => {
    this.off(NEW_RTC_SESSION, this.handleNewRTCSession);

    const disconnectedPromise = new Promise<void>((resolve) => {
      this.once(DISCONNECTED, () => {
        delete this.ua;
        resolve();
      });
    });

    if (this.ua) {
      await this._hangUpWithoutCancelRequests();

      if (this.ua) {
        this.ua.stop();
      } else {
        this._uaEvents.trigger(DISCONNECTED, undefined);
      }
    } else {
      this._uaEvents.trigger(DISCONNECTED, undefined);
    }

    return disconnectedPromise;
  };

  _call: TCall = async ({
    number,
    mediaStream,
    extraHeaders = [],
    ontrack,
    iceServers,
    videoMode,
    audioMode,
    degradationPreference,
    offerToReceiveAudio = true,
    offerToReceiveVideo = true,
  }) => {
    return new Promise((resolve, reject) => {
      const { ua } = this;

      if (!ua) {
        reject(new Error('this.ua is not initialized'));

        return;
      }

      this._connectionConfiguration.number = number;
      this._connectionConfiguration.answer = false;
      this._handleCall({ ontrack })
        .then(resolve)
        .catch((error: unknown) => {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(error as Error);
        });

      this.session = ua.call(this.getSipServerUrl(number), {
        extraHeaders,
        mediaStream: prepareMediaStream(mediaStream, {
          videoMode,
          audioMode,
        }),
        eventHandlers: this._sessionEvents.triggers,
        videoMode,
        audioMode,
        degradationPreference,
        pcConfig: {
          iceServers,
        },
        rtcOfferConstraints: {
          offerToReceiveAudio,
          offerToReceiveVideo,
        },
      });
    });
  };

  _answer: TAnswerToIncomingCall = async ({
    mediaStream,
    ontrack,
    extraHeaders = [],
    iceServers,
    videoMode,
    audioMode,
    degradationPreference,
  }): Promise<RTCPeerConnection> => {
    return new Promise((resolve, reject) => {
      if (!this.isAvailableIncomingCall) {
        reject(new Error('no incomingSession'));

        return;
      }

      this.session = this.incomingSession;
      this.removeIncomingSession();

      const { session } = this;

      if (!session) {
        reject(new Error('No session established'));

        return;
      }

      this._sessionEvents.eachTriggers((trigger, eventName) => {
        const sessionJsSipEvent = SESSION_JSSIP_EVENT_NAMES.find((jsSipEvent) => {
          return jsSipEvent === eventName;
        });

        if (sessionJsSipEvent) {
          session.on(sessionJsSipEvent, trigger);
        }
      });

      this._connectionConfiguration.answer = true;
      this._connectionConfiguration.number = session.remote_identity.uri.user;
      this._handleCall({ ontrack })
        .then(resolve)
        .catch((error: unknown) => {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(error as Error);
        });

      const preparedMediaStream = prepareMediaStream(mediaStream, {
        videoMode,
        audioMode,
      });

      session.answer({
        extraHeaders,
        videoMode,
        audioMode,
        degradationPreference,
        mediaStream: preparedMediaStream,
        pcConfig: {
          iceServers,
        },
      });
    });
  };

  _handleCall = async ({ ontrack }: { ontrack?: TOntrack }): Promise<RTCPeerConnection> => {
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
          this._sessionEvents.trigger(PEER_CONNECTION_ONTRACK, savedPeerconnection);

          if (ontrack) {
            ontrack(track);
          }
        };
      };
      const handleConfirmed = () => {
        if (savedPeerconnection) {
          this._sessionEvents.trigger(PEER_CONNECTION_CONFIRMED, savedPeerconnection);
        }

        removeStartedEventListeners();
        removeEndedEventListeners();
        resolve(savedPeerconnection);
      };

      addStartedEventListeners();
      addEndedEventListeners();
    });
  };

  _restoreSession: () => void = () => {
    this._resetPresentation();

    delete this._connectionConfiguration.number;
    delete this.session;
    this._remoteStreams = {};
  };

  _sendDTMF: TSendDTMF = async (tone) => {
    return new Promise<void>((resolve, reject) => {
      const { session } = this;

      if (!session) {
        reject(new Error('No session established'));

        return;
      }

      this.onceSession(NEW_DTMF, ({ originator }: { originator: string }) => {
        if (originator === ORIGINATOR_LOCAL) {
          resolve();
        }
      });

      session.sendDTMF(tone, {
        duration: 120,
        interToneGap: 600,
      });
    });
  };

  _generateStream(videoTrack: MediaStreamTrack, audioTrack?: MediaStreamTrack): MediaStream {
    const { id } = videoTrack;

    const remoteStream: MediaStream = this._remoteStreams[id] || new MediaStream();

    if (audioTrack) {
      remoteStream.addTrack(audioTrack);
    }

    remoteStream.addTrack(videoTrack);
    this._remoteStreams[id] = remoteStream;

    return remoteStream;
  }

  _generateAudioStream(audioTrack: MediaStreamTrack): MediaStream {
    const { id } = audioTrack;

    const remoteStream = this._remoteStreams[id] || new MediaStream();

    remoteStream.addTrack(audioTrack);

    this._remoteStreams[id] = remoteStream;

    return remoteStream;
  }

  _generateStreams(remoteTracks: MediaStreamTrack[]): MediaStream[] {
    const remoteStreams: MediaStream[] = [];

    remoteTracks.forEach((track, index) => {
      if (track.kind === 'audio') {
        return;
      }

      const videoTrack = track;
      const previousTrack = remoteTracks[index - 1];
      let audioTrack;

      if (previousTrack && previousTrack.kind === 'audio') {
        audioTrack = previousTrack;
      }

      const remoteStream = this._generateStream(videoTrack, audioTrack);

      remoteStreams.push(remoteStream);
    });

    return remoteStreams;
  }

  _generateAudioStreams(remoteTracks: MediaStreamTrack[]): MediaStream[] {
    const remoteStreams: MediaStream[] = remoteTracks.map((remoteTrack) => {
      return this._generateAudioStream(remoteTrack);
    });

    return remoteStreams;
  }

  _hangUpWithoutCancelRequests: THangUp = async () => {
    if (this.ua && this.session) {
      const { session } = this;

      if (this._streamPresentationCurrent) {
        await this.stopPresentation();
      }

      this._restoreSession();

      if (!session.isEnded()) {
        return session.terminateAsync();
      }
    }

    return undefined;
  };

  _cancelRequests() {
    this._cancelActionsRequests();
    this._cancelCallRequests();
    this._cancelConnectWithRepeatedCalls();
  }

  _cancelConnectWithRepeatedCalls() {
    this._cancelableConnectWithRepeatedCalls?.cancel();
  }

  _cancelCallRequests() {
    this._cancelableCall.cancelRequest();
    this._cancelableAnswer.cancelRequest();
  }

  _cancelActionsRequests() {
    this._cancelableAnswer.cancelRequest();
    this._cancelableSendDTMF.cancelRequest();
  }

  _handleShareState = (eventName: string) => {
    switch (eventName) {
      case AVAILABLE_SECOND_REMOTE_STREAM: {
        this._sessionEvents.trigger(AVAILABLE_SECOND_REMOTE_STREAM_EVENT, undefined);
        break;
      }
      case NOT_AVAILABLE_SECOND_REMOTE_STREAM: {
        this._sessionEvents.trigger(NOT_AVAILABLE_SECOND_REMOTE_STREAM_EVENT, undefined);
        break;
      }
      case MUST_STOP_PRESENTATION: {
        this._sessionEvents.trigger(MUST_STOP_PRESENTATION_EVENT, undefined);
        break;
      }

      default: {
        break;
      }
    }
  };

  _maybeTriggerChannels = (request: IncomingRequest) => {
    const inputChannels = request.getHeader(HEADER_INPUT_CHANNELS);
    const outputChannels = request.getHeader(HEADER_OUTPUT_CHANNELS);

    if (inputChannels && outputChannels) {
      const headersChannels: TChannels = {
        inputChannels,
        outputChannels,
      };

      this._sessionEvents.trigger(CHANNELS, headersChannels);
    }
  };

  _handleNotify = (header: TInfoNotify) => {
    switch (header.cmd) {
      case CMD_CHANNELS: {
        const channelsInfo = header as TChannelsInfoNotify;

        this._triggerChannelsNotify(channelsInfo);

        break;
      }
      case CMD_WEBCAST_STARTED: {
        const webcastInfo = header as TWebcastInfoNotify;

        this._triggerWebcastStartedNotify(webcastInfo);

        break;
      }
      case CMD_WEBCAST_STOPPED: {
        const webcastInfo = header as TWebcastInfoNotify;

        this._triggerWebcastStoppedNotify(webcastInfo);

        break;
      }
      case CMD_ADDED_TO_LIST_MODERATORS: {
        const data = header as TAddedToListModeratorsInfoNotify;

        this._triggerAddedToListModeratorsNotify(data);

        break;
      }
      case CMD_REMOVED_FROM_LIST_MODERATORS: {
        const data = header as TRemovedFromListModeratorsInfoNotify;

        this._triggerRemovedFromListModeratorsNotify(data);

        break;
      }
      case CMD_ACCEPTING_WORD_REQUEST: {
        const data = header as TAcceptingWordRequestInfoNotify;

        this._triggerParticipationAcceptingWordRequest(data);

        break;
      }
      case CMD_CANCELLING_WORD_REQUEST: {
        const data = header as TCancellingWordRequestInfoNotify;

        this._triggerParticipationCancellingWordRequest(data);

        break;
      }
      case CMD_MOVE_REQUEST_TO_STREAM: {
        const data = header as TMoveRequestToStreamInfoNotify;

        this._triggerParticipantMoveRequestToStream(data);

        break;
      }
      case CMD_ACCOUNT_CHANGED: {
        this._triggerAccountChangedNotify();

        break;
      }
      case CMD_ACCOUNT_DELETED: {
        this._triggerAccountDeletedNotify();

        break;
      }
      case CMD_CONFERENCE_PARTICIPANT_TOKEN_ISSUED: {
        const data = header as TConferenceParticipantTokenIssued;

        this._triggerConferenceParticipantTokenIssued(data);

        break;
      }
      default: {
        logger('unknown cmd', header.cmd);
      }
      // No default
    }
  };

  _triggerRemovedFromListModeratorsNotify = ({
    conference,
  }: TRemovedFromListModeratorsInfoNotify) => {
    const headersParametersModeratorsList: TParametersModeratorsList = {
      conference,
    };

    this._uaEvents.trigger(
      PARTICIPANT_REMOVED_FROM_LIST_MODERATORS,
      headersParametersModeratorsList,
    );
  };

  _triggerAddedToListModeratorsNotify = ({ conference }: TAddedToListModeratorsInfoNotify) => {
    const headersParametersModeratorsList: TParametersModeratorsList = {
      conference,
    };

    this._uaEvents.trigger(PARTICIPANT_ADDED_TO_LIST_MODERATORS, headersParametersModeratorsList);
  };

  _triggerWebcastStartedNotify = ({ body: { conference, type } }: TWebcastInfoNotify) => {
    const headersParametersWebcast: TParametersWebcast = {
      conference,
      type,
    };

    this._uaEvents.trigger(WEBCAST_STARTED, headersParametersWebcast);
  };

  _triggerWebcastStoppedNotify = ({ body: { conference, type } }: TWebcastInfoNotify) => {
    const headersParametersWebcast: TParametersWebcast = {
      conference,
      type,
    };

    this._uaEvents.trigger(WEBCAST_STOPPED, headersParametersWebcast);
  };

  _triggerAccountChangedNotify = () => {
    this._uaEvents.trigger(ACCOUNT_CHANGED, undefined);
  };

  _triggerAccountDeletedNotify = () => {
    this._uaEvents.trigger(ACCOUNT_DELETED, undefined);
  };

  _triggerConferenceParticipantTokenIssued = ({
    body: { conference, participant, jwt },
  }: TConferenceParticipantTokenIssued) => {
    const headersConferenceParticipantTokenIssued: TParametersConferenceParticipantTokenIssued = {
      conference,
      participant,
      jwt,
    };

    this._uaEvents.trigger(
      CONFERENCE_PARTICIPANT_TOKEN_ISSUED,
      headersConferenceParticipantTokenIssued,
    );
  };

  _triggerChannelsNotify = (channelsInfo: TChannelsInfoNotify) => {
    const inputChannels = channelsInfo.input;
    const outputChannels = channelsInfo.output;

    const data: TChannels = {
      inputChannels,
      outputChannels,
    };

    this._uaEvents.trigger(CHANNELS_NOTIFY, data);
  };

  _triggerParticipationAcceptingWordRequest = ({
    body: { conference },
  }: TAcceptingWordRequestInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this._uaEvents.trigger(PARTICIPATION_ACCEPTING_WORD_REQUEST, data);
  };

  _triggerParticipationCancellingWordRequest = ({
    body: { conference },
  }: TCancellingWordRequestInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this._uaEvents.trigger(PARTICIPATION_CANCELLING_WORD_REQUEST, data);
  };

  _triggerParticipantMoveRequestToStream = ({
    body: { conference },
  }: TMoveRequestToStreamInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this._uaEvents.trigger(PARTICIPANT_MOVE_REQUEST_TO_STREAM, data);
  };

  _triggerEnterRoom = (request: IncomingRequest) => {
    const room = request.getHeader(HEADER_CONTENT_ENTER_ROOM);
    const participantName = request.getHeader(HEADER_PARTICIPANT_NAME);

    this._sessionEvents.trigger(ENTER_ROOM, { room, participantName });
  };

  _triggerShareState = (request: IncomingRequest) => {
    const eventName = request.getHeader(HEADER_CONTENT_SHARE_STATE);

    this._sessionEvents.trigger(SHARE_STATE, eventName);
  };

  _maybeTriggerParticipantMoveRequestToSpectators = (request: IncomingRequest) => {
    const participantState = request.getHeader(HEADER_CONTENT_PARTICIPANT_STATE);

    if (participantState === SPECTATOR) {
      this._sessionEvents.trigger(PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS, undefined);
    }
  };

  _triggerMainCamControl = (request: IncomingRequest) => {
    const mainCam = request.getHeader(HEADER_MAIN_CAM) as EEventsMainCAM;

    const syncState = request.getHeader(HEADER_MEDIA_SYNC);
    const isSyncForced = syncState === EEventsSyncMediaState.ADMIN_SYNC_FORCED;

    if (mainCam === EEventsMainCAM.ADMIN_START_MAIN_CAM) {
      this._sessionEvents.trigger(ADMIN_START_MAIN_CAM, { isSyncForced });

      return;
    }

    if (mainCam === EEventsMainCAM.ADMIN_STOP_MAIN_CAM) {
      this._sessionEvents.trigger(ADMIN_STOP_MAIN_CAM, { isSyncForced });

      return;
    }

    if (
      (mainCam === EEventsMainCAM.RESUME_MAIN_CAM || mainCam === EEventsMainCAM.PAUSE_MAIN_CAM) &&
      !!syncState
    ) {
      this._sessionEvents.trigger(ADMIN_FORCE_SYNC_MEDIA_STATE, { isSyncForced });
    }

    const resolutionMainCam = request.getHeader(HEADER_MAIN_CAM_RESOLUTION);

    this._sessionEvents.trigger(MAIN_CAM_CONTROL, {
      mainCam,
      resolutionMainCam,
    });
  };

  _triggerMicControl = (request: IncomingRequest) => {
    const mic = request.getHeader(HEADER_MIC);
    const syncState = request.getHeader(HEADER_MEDIA_SYNC);
    const isSyncForced = syncState === EEventsSyncMediaState.ADMIN_SYNC_FORCED;

    if (mic === EEventsMic.ADMIN_START_MIC) {
      this._sessionEvents.trigger(ADMIN_START_MIC, { isSyncForced });
    } else if (mic === EEventsMic.ADMIN_STOP_MIC) {
      this._sessionEvents.trigger(ADMIN_STOP_MIC, { isSyncForced });
    }
  };

  _triggerUseLicense = (request: IncomingRequest) => {
    const license: EUseLicense = request.getHeader(HEADER_CONTENT_USE_LICENSE) as EUseLicense;

    this._sessionEvents.trigger(USE_LICENSE, license);
  };

  _handleNewInfo = (info: IncomingInfoEvent | OutgoingInfoEvent) => {
    const { originator } = info;

    if (originator !== 'remote') {
      return;
    }

    const { request } = info;
    const contentType = request.getHeader(HEADER_CONTENT_TYPE_NAME);

    if (contentType) {
      switch (contentType) {
        case CONTENT_TYPE_ENTER_ROOM: {
          this._triggerEnterRoom(request);
          this._maybeTriggerChannels(request);
          break;
        }
        case CONTENT_TYPE_NOTIFY: {
          this._maybeHandleNotify(request);
          break;
        }
        case CONTENT_TYPE_SHARE_STATE: {
          this._triggerShareState(request);
          break;
        }
        case CONTENT_TYPE_MAIN_CAM: {
          this._triggerMainCamControl(request);
          break;
        }
        case CONTENT_TYPE_MIC: {
          this._triggerMicControl(request);
          break;
        }
        case CONTENT_TYPE_USE_LICENSE: {
          this._triggerUseLicense(request);
          break;
        }
        case CONTENT_TYPE_PARTICIPANT_STATE: {
          this._maybeTriggerParticipantMoveRequestToSpectators(request);
          break;
        }

        default: {
          break;
        }
      }
    }
  };

  _handleSipEvent = ({ request }: { request: IncomingRequest }) => {
    this._maybeHandleNotify(request);
  };

  _maybeHandleNotify = (request: IncomingRequest) => {
    const headerNotify = request.getHeader(HEADER_NOTIFY);

    if (headerNotify) {
      const headerNotifyParsed: TInfoNotify = JSON.parse(headerNotify);

      this._handleNotify(headerNotifyParsed);
    }
  };

  async waitChannels(): Promise<TChannels> {
    return this.waitSession(CHANNELS);
  }

  async waitSyncMediaState(): Promise<{ isSyncForced: boolean }> {
    return this.waitSession(ADMIN_FORCE_SYNC_MEDIA_STATE);
  }

  async sendChannels({ inputChannels, outputChannels }: TChannels): Promise<void> {
    if (!this.session) {
      throw new Error('No session established');
    }

    const headerInputChannels = `${HEADER_INPUT_CHANNELS}: ${inputChannels}`;
    const headerOutputChannels = `${HEADER_OUTPUT_CHANNELS}: ${outputChannels}`;
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [
      headerInputChannels,
      headerOutputChannels,
    ];

    return this.session.sendInfo(CONTENT_TYPE_CHANNELS, undefined, { extraHeaders });
  }

  async sendMediaState(
    { cam, mic }: TMediaState,
    options: TOptionsInfoMediaState = {},
  ): Promise<void> {
    if (!this.session) {
      throw new Error('No session established');
    }

    const headerMediaState = `${HEADER_MEDIA_STATE}: currentstate`;
    const headerCam = `${HEADER_MAIN_CAM_STATE}: ${Number(cam)}`;
    const headerMic = `${HEADER_MIC_STATE}: ${Number(mic)}`;
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [
      headerMediaState,
      headerCam,
      headerMic,
    ];

    return this.session.sendInfo(CONTENT_TYPE_MEDIA_STATE, undefined, {
      noTerminateWhenError: true,
      ...options,
      extraHeaders,
    });
  }

  async _sendRefusalToTurnOn(
    type: 'cam' | 'mic',
    options: TOptionsInfoMediaState = {},
  ): Promise<void> {
    if (!this.session) {
      throw new Error('No session established');
    }

    const typeMicOnServer = 0;
    const typeCamOnServer = 1;
    const typeToSend = type === 'mic' ? typeMicOnServer : typeCamOnServer;

    const headerMediaType = `${HEADER_MEDIA_TYPE}: ${typeToSend}`;
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [headerMediaType];

    return this.session.sendInfo(CONTENT_TYPE_REFUSAL, undefined, {
      noTerminateWhenError: true,
      ...options,
      extraHeaders,
    });
  }

  async sendRefusalToTurnOnMic(options: TOptionsInfoMediaState = {}): Promise<void> {
    if (!this.session) {
      throw new Error('No session established');
    }

    return this._sendRefusalToTurnOn('mic', { noTerminateWhenError: true, ...options });
  }

  async sendRefusalToTurnOnCam(options: TOptionsInfoMediaState = {}): Promise<void> {
    if (!this.session) {
      throw new Error('No session established');
    }

    return this._sendRefusalToTurnOn('cam', { noTerminateWhenError: true, ...options });
  }

  _handleEnded = (error: TCustomError) => {
    const { originator } = error;

    if (originator === ORIGINATOR_REMOTE) {
      this._sessionEvents.trigger(ENDED_FROM_SERVER, error);
    }

    this._restoreSession();
  };
}
