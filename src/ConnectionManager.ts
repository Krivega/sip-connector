/* eslint-disable unicorn/no-useless-undefined */

import type {
  IncomingRTCSessionEvent,
  IncomingRequest,
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
import {
  ACCOUNT_CHANGED,
  ACCOUNT_DELETED,
  CHANNELS_NOTIFY,
  CONFERENCE_PARTICIPANT_TOKEN_ISSUED,
  CONNECTED,
  CONNECTING,
  DECLINED_INCOMING_CALL,
  DISCONNECTED,
  FAILED,
  FAILED_INCOMING_CALL,
  INCOMING_CALL,
  NEW_RTC_SESSION,
  PARTICIPANT_ADDED_TO_LIST_MODERATORS,
  PARTICIPANT_MOVE_REQUEST_TO_STREAM,
  PARTICIPANT_REMOVED_FROM_LIST_MODERATORS,
  PARTICIPATION_ACCEPTING_WORD_REQUEST,
  PARTICIPATION_CANCELLING_WORD_REQUEST,
  REGISTERED,
  REGISTRATION_FAILED,
  SIP_EVENT,
  TERMINATED_INCOMING_CALL,
  UNREGISTERED,
  WEBCAST_STARTED,
  WEBCAST_STOPPED,
} from './constants';
import type { TEventUA } from './eventNames';
import { UA_EVENT_NAMES, UA_JSSIP_EVENT_NAMES } from './eventNames';
import getExtraHeadersRemoteAddress from './getExtraHeadersRemoteAddress';
import { HEADER_NOTIFY } from './headers';
import logger from './logger';
import prepareMediaStream from './tools/prepareMediaStream';
import type {
  TContentHint,
  TGetServerUrl,
  TJsSIP,
  TOnAddedTransceiver,
  TParametersCreateUaConfiguration,
} from './types';
import { generateUserId, parseDisplayName, resolveSipUrl } from './utils';
import { hasHandshakeWebsocketOpeningError } from './utils/errors';

const BUSY_HERE_STATUS_CODE = 486;
const REQUEST_TERMINATED_STATUS_CODE = 487;
const ORIGINATOR_LOCAL = 'local';
const ORIGINATOR_REMOTE = 'remote';
const DELAYED_REPEATED_CALLS_CONNECT_LIMIT = 3;

type TChannels = {
  inputChannels: string;
  outputChannels: string;
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

type TCreateRtcSession = (parameters: TParametersCall) => RTCSession;

export default class ConnectionManager {
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

  private readonly _uaEvents: Events<typeof UA_EVENT_NAMES>;

  private _cancelableConnectWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<UA>>
    | undefined;

  private readonly _cancelableSendPresentationWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<MediaStream>>
    | undefined;

  private getSipServerUrl: TGetServerUrl = (id: string) => {
    return id;
  };

  promisePendingStartPresentation?: Promise<MediaStream>;

  promisePendingStopPresentation?: Promise<MediaStream | void>;

  ua?: UA;

  incomingRTCSession?: RTCSession;

  socket?: WebSocketInterface;

  constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.JsSIP = JsSIP;

    this._uaEvents = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);

    this.on(SIP_EVENT, this._handleSipEvent);
  }

  connect: TConnect = async (data, options) => {
    this._cancelRequests();

    return this._connectWithDuplicatedCalls(data, options);
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

  declineToIncomingCall = async ({ statusCode = REQUEST_TERMINATED_STATUS_CODE } = {}) => {
    return new Promise((resolve, reject) => {
      if (!this.isAvailableIncomingCall) {
        reject(new Error('no incomingRTCSession'));

        return;
      }

      const incomingRTCSession = this.incomingRTCSession!;
      const callerData = this.remoteCallerData;

      this.removeIncomingSession();
      this._uaEvents.trigger(DECLINED_INCOMING_CALL, callerData);
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      resolve(incomingRTCSession.terminate({ status_code: statusCode }));
    });
  };

  busyIncomingCall = async () => {
    return this.declineToIncomingCall({ statusCode: BUSY_HERE_STATUS_CODE });
  };

  removeIncomingSession = () => {
    delete this.incomingRTCSession;
  };

  get isPendingPresentation(): boolean {
    return !!this.promisePendingStartPresentation || !!this.promisePendingStopPresentation;
  }

  private readonly _connectWithDuplicatedCalls: TConnect = async (
    data,
    { callLimit = DELAYED_REPEATED_CALLS_CONNECT_LIMIT } = {},
  ) => {
    const targetFunction = async () => {
      return this._connect(data);
    };

    const isComplete = (response?: unknown): boolean => {
      const isConnected = !!this.ua?.isConnected();
      const isValidResponse = isConnected && this.hasEqualConnectionConfiguration(data);
      const isValidError = !!response && !hasHandshakeWebsocketOpeningError(response);

      return isValidResponse || isValidError;
    };

    this._cancelableConnectWithRepeatedCalls = repeatedCallsAsync<UA>({
      targetFunction,
      isComplete,
      callLimit,
      isRejectAsValid: true,
      isCheckBeforeCall: false,
    });

    return this._cancelableConnectWithRepeatedCalls.then((response?: unknown) => {
      if (response instanceof this.JsSIP.UA) {
        return response;
      }

      throw response;
    });
  };

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

  _cancelRequestsAndResetPresentation() {
    this._cancelSendPresentationWithRepeatedCalls();
  }

  handleNewRTCSession = ({ originator, session: rtcSession }: IncomingRTCSessionEvent) => {
    if (originator === ORIGINATOR_REMOTE) {
      this.incomingRTCSession = rtcSession;

      const callerData = this.remoteCallerData;

      rtcSession.on(FAILED, (event: { originator: string }) => {
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

  isConfigured() {
    return !!this.ua;
  }

  getConnectionConfiguration() {
    return { ...this._connectionConfiguration };
  }

  get remoteCallerData() {
    return {
      displayName: this.incomingRTCSession?.remote_identity?.display_name,

      host: this.incomingRTCSession?.remote_identity?.uri.host,

      incomingNumber: this.incomingRTCSession?.remote_identity?.uri.user,
      rtcSession: this.incomingRTCSession,
    };
  }

  get isRegistered() {
    return !!this.ua && this.ua.isRegistered();
  }

  get isRegisterConfig() {
    return !!this.ua && this._isRegisterConfig;
  }

  get isAvailableIncomingCall() {
    return !!this.incomingRTCSession;
  }

  _connect: TConnect = async (parameters) => {
    return this.initUa(parameters).then(async () => {
      return this._start();
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
      await this.disconnect();
    }

    this._isRegisterConfig = !!register;

    this.ua = this.createUa({ ...configuration, remoteAddress, extraHeaders });

    this._uaEvents.eachTriggers((trigger, eventName) => {
      const uaJsSipEvent = UA_JSSIP_EVENT_NAMES.find((jsSipEvent) => {
        return jsSipEvent === eventName;
      });

      if (uaJsSipEvent && this.ua) {
        this.ua.on(uaJsSipEvent, trigger);
      }
    });

    return this.ua;
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

  set: TSet = async ({ displayName, password }) => {
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

  disconnect = async () => {
    this.off(NEW_RTC_SESSION, this.handleNewRTCSession);

    const disconnectedPromise = new Promise<void>((resolve) => {
      this.once(DISCONNECTED, () => {
        delete this.ua;
        resolve();
      });
    });

    if (this.ua) {
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

  createRtcSession: TCreateRtcSession = ({
    number,
    mediaStream,
    extraHeaders = [],
    iceServers,
    directionVideo,
    directionAudio,
    contentHint,
    offerToReceiveAudio = true,
    offerToReceiveVideo = true,
    sendEncodings,
    onAddedTransceiver,
  }) => {
    const { ua } = this;

    if (!ua) {
      throw new Error('this.ua is not initialized');
    }

    this._connectionConfiguration.number = number;
    this._connectionConfiguration.answer = false;

    return ua.call(this.getSipServerUrl(number), {
      extraHeaders,
      mediaStream: prepareMediaStream(mediaStream, {
        directionVideo,
        directionAudio,
        contentHint,
      }),
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
  };

  _restoreSession: () => void = () => {
    this._cancelRequestsAndResetPresentation();

    delete this._connectionConfiguration.number;
    this._remoteStreams = {};
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

  _cancelRequests() {
    this._cancelConnectWithRepeatedCalls();
  }

  _cancelConnectWithRepeatedCalls() {
    this._cancelableConnectWithRepeatedCalls?.cancel();
  }

  _cancelSendPresentationWithRepeatedCalls() {
    this._cancelableSendPresentationWithRepeatedCalls?.cancel();
  }

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
}
