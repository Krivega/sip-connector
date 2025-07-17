import type {
  IncomingRTCSessionEvent,
  IncomingRequest,
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
import { repeatedCallsAsync } from 'repeated-calls';
import { generateUserId, parseDisplayName, resolveSipUrl } from '../utils';
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
  Originator,
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
import type { TGetServerUrl, TJsSIP, TParametersCreateUaConfiguration } from './types';
import { hasHandshakeWebsocketOpeningError } from './utils/errors';

const BUSY_HERE_STATUS_CODE = 486;
const REQUEST_TERMINATED_STATUS_CODE = 487;
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

export default class ConnectionManager {
  public ua?: UA;

  public incomingRTCSession?: RTCSession;

  public socket?: WebSocketInterface;

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

  private readonly JsSIP: TJsSIP;

  private readonly uaEvents: Events<typeof UA_EVENT_NAMES>;

  private cancelableConnectWithRepeatedCalls: ReturnType<typeof repeatedCallsAsync<UA>> | undefined;

  private isPendingConnect = false;

  private isPendingInitUa = false;

  public constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.JsSIP = JsSIP;

    this.uaEvents = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);

    this.on(SIP_EVENT, this.handleSipEvent);
  }

  public get remoteCallerData() {
    return {
      displayName: this.incomingRTCSession?.remote_identity.display_name,

      host: this.incomingRTCSession?.remote_identity.uri.host,

      incomingNumber: this.incomingRTCSession?.remote_identity.uri.user,
      rtcSession: this.incomingRTCSession,
    };
  }

  public get requested() {
    return this.isPendingInitUa || this.isPendingConnect;
  }

  public get isRegistered() {
    return !!this.ua && this.ua.isRegistered();
  }

  public get isRegisterConfig() {
    return !!this.ua && this.isRegisterConfigInner;
  }

  public get isAvailableIncomingCall() {
    return !!this.incomingRTCSession;
  }

  public connect: TConnect = async (data, options) => {
    this.cancelRequests();

    return this.connectWithDuplicatedCalls(data, options);
  };

  public async register(): Promise<RegisteredEvent> {
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

  public async unregister(): Promise<UnRegisteredEvent> {
    return new Promise((resolve, reject) => {
      if (this.isRegistered && this.ua) {
        this.ua.on(UNREGISTERED, resolve);
        this.ua.unregister();
      } else {
        reject(new Error('ua is not registered'));
      }
    });
  }

  public readonly tryRegister = async () => {
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

  public async sendOptions(
    target: URI | string,
    body?: string,
    extraHeaders?: string[],
  ): Promise<void> {
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

  public async ping(body?: string, extraHeaders?: string[]): Promise<void> {
    if (!this.ua?.configuration.uri) {
      throw new Error('is not connected');
    }

    const target = this.ua.configuration.uri;

    return this.sendOptions(target, body, extraHeaders);
  }

  public async checkTelephony({
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

  public declineToIncomingCall = async ({
    statusCode = REQUEST_TERMINATED_STATUS_CODE,
  }: { statusCode?: number } = {}) => {
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

  public busyIncomingCall = async () => {
    return this.declineToIncomingCall({ statusCode: BUSY_HERE_STATUS_CODE });
  };

  public removeIncomingSession = () => {
    delete this.incomingRTCSession;
  };

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public on<T>(eventName: TEventUA, handler: (data: T) => void) {
    return this.uaEvents.on<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public once<T>(eventName: TEventUA, handler: (data: T) => void) {
    return this.uaEvents.once<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceRace<T>(eventNames: TEventUA[], handler: (data: T, eventName: string) => void) {
    return this.uaEvents.onceRace<T>(eventNames, handler);
  }

  public async wait<T>(eventName: TEventUA): Promise<T> {
    return this.uaEvents.wait<T>(eventName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public off<T>(eventName: TEventUA, handler: (data: T) => void) {
    this.uaEvents.off<T>(eventName, handler);
  }

  public isConfigured() {
    return !!this.ua;
  }

  public getConnectionConfiguration() {
    return { ...this.connectionConfiguration };
  }

  public getIncomingRTCSession() {
    const { incomingRTCSession } = this;

    if (!incomingRTCSession) {
      throw new Error('No incomingRTCSession');
    }

    return incomingRTCSession;
  }

  public set: TSet = async ({ displayName, password }) => {
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

  public disconnect = async () => {
    this.off(NEW_RTC_SESSION, this.handleNewRTCSession);

    const disconnectedPromise = new Promise<void>((resolve) => {
      this.once(DISCONNECTED, () => {
        resolve();
      });
    });

    const { ua } = this;

    if (ua) {
      ua.stop();
    } else {
      this.uaEvents.trigger(DISCONNECTED, undefined);
    }

    return disconnectedPromise.finally(() => {
      delete this.ua;
    });
  };

  // eslint-disable-next-line class-methods-use-this
  public getSipServerUrl: TGetServerUrl = (id: string) => {
    return id;
  };

  private readonly connectWithDuplicatedCalls: TConnect = async (
    data,
    { callLimit = DELAYED_REPEATED_CALLS_CONNECT_LIMIT } = {},
  ) => {
    const targetFunction = async () => {
      return this.connectInner(data);
    };

    const isComplete = (response?: unknown): boolean => {
      const isConnected = this.ua?.isConnected() === true;
      const isValidResponse = isConnected && this.hasEqualConnectionConfiguration(data);
      const isValidError =
        response !== undefined && response !== null && !hasHandshakeWebsocketOpeningError(response);

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
    if (register && (password === undefined || password === '')) {
      throw new Error('password is required for authorized connection');
    }

    const authorizationUser =
      register && user !== undefined && user.trim() !== '' ? user.trim() : `${generateUserId()}`;
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

  private readonly handleNewRTCSession = ({
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

  private readonly connectInner: TConnect = async (parameters) => {
    return this.initUa(parameters).then(async () => {
      return this.start();
    });
  };

  private readonly initUa: TInitUa = async ({
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

    if (register && (user === undefined || user === '')) {
      throw new Error('user is required for authorized connection');
    }

    if (register && (password === undefined || password === '')) {
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

  private readonly createUa: TCreateUa = ({
    remoteAddress,
    extraHeaders = [],
    ...parameters
  }: TParametersCreateUa): UA => {
    const ua = new this.JsSIP.UA(parameters);

    const extraHeadersRemoteAddress =
      remoteAddress !== undefined && remoteAddress !== ''
        ? getExtraHeadersRemoteAddress(remoteAddress)
        : [];
    const extraHeadersBase = [...extraHeadersRemoteAddress, ...extraHeaders];

    if (extraHeadersBase.length > 0) {
      ua.registrator().setExtraHeaders(extraHeadersBase);
    }

    return ua;
  };

  private readonly start: TStart = async () => {
    return new Promise((resolve, reject) => {
      const { ua } = this;

      if (!ua) {
        reject(new Error('this.ua is not initialized'));

        return;
      }

      const resolveUa = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        removeEventListeners();
        resolve(ua);
      };
      const rejectError = (error: Error) => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
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

  private cancelRequests() {
    this.cancelConnectWithRepeatedCalls();
  }

  private cancelConnectWithRepeatedCalls() {
    this.cancelableConnectWithRepeatedCalls?.cancel();
  }

  private readonly handleNotify = (header: TInfoNotify) => {
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

  private readonly triggerRemovedFromListModeratorsNotify = ({
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

  private readonly triggerAddedToListModeratorsNotify = ({
    conference,
  }: TAddedToListModeratorsInfoNotify) => {
    const headersParametersModeratorsList: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(PARTICIPANT_ADDED_TO_LIST_MODERATORS, headersParametersModeratorsList);
  };

  private readonly triggerWebcastStartedNotify = ({
    body: { conference, type },
  }: TWebcastInfoNotify) => {
    const headersParametersWebcast: TParametersWebcast = {
      conference,
      type,
    };

    this.uaEvents.trigger(WEBCAST_STARTED, headersParametersWebcast);
  };

  private readonly triggerWebcastStoppedNotify = ({
    body: { conference, type },
  }: TWebcastInfoNotify) => {
    const headersParametersWebcast: TParametersWebcast = {
      conference,
      type,
    };

    this.uaEvents.trigger(WEBCAST_STOPPED, headersParametersWebcast);
  };

  private readonly triggerAccountChangedNotify = () => {
    this.uaEvents.trigger(ACCOUNT_CHANGED, undefined);
  };

  private readonly triggerAccountDeletedNotify = () => {
    this.uaEvents.trigger(ACCOUNT_DELETED, undefined);
  };

  private readonly triggerConferenceParticipantTokenIssued = ({
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

  private readonly triggerChannelsNotify = (channelsInfo: TChannelsInfoNotify) => {
    const inputChannels = channelsInfo.input;
    const outputChannels = channelsInfo.output;

    const data: TChannels = {
      inputChannels,
      outputChannels,
    };

    this.uaEvents.trigger(CHANNELS_NOTIFY, data);
  };

  private readonly triggerParticipationAcceptingWordRequest = ({
    body: { conference },
  }: TAcceptingWordRequestInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(PARTICIPATION_ACCEPTING_WORD_REQUEST, data);
  };

  private readonly triggerParticipationCancellingWordRequest = ({
    body: { conference },
  }: TCancellingWordRequestInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(PARTICIPATION_CANCELLING_WORD_REQUEST, data);
  };

  private readonly triggerParticipantMoveRequestToStream = ({
    body: { conference },
  }: TMoveRequestToStreamInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(PARTICIPANT_MOVE_REQUEST_TO_STREAM, data);
  };

  private readonly handleSipEvent = ({ request }: { request: IncomingRequest }) => {
    this.maybeHandleNotify(request);
  };

  private readonly maybeHandleNotify = (request: IncomingRequest) => {
    const headerNotify = request.getHeader(HEADER_NOTIFY);

    if (headerNotify) {
      const headerNotifyParsed = JSON.parse(headerNotify) as TInfoNotify;

      this.handleNotify(headerNotifyParsed);
    }
  };
}
