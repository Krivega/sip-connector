import { CancelableRequest, isCanceledError } from '@krivega/cancelable-promise';
import type { UA, URI, WebSocketInterface } from '@krivega/jssip';
import type RTCSession from '@krivega/jssip/lib/RTCSession';
import type { IncomingInfoEvent, OutgoingInfoEvent } from '@krivega/jssip/lib/RTCSession';
import type { IncomingRequest } from '@krivega/jssip/lib/SIPMessage';
import type {
  IncomingRTCSessionEvent,
  RegisteredEvent,
  UnRegisteredEvent,
} from '@krivega/jssip/lib/UA';
import Events from 'events-constructor';
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
  PARTICIPANT_CANCELLING_WORD_REQUEST,
  PARTICIPANT_MOVE_REQUEST_TO_CONFERENCE,
  PARTICIPANT_MOVE_REQUEST_TO_STREAM,
  PARTICIPANT_REMOVED_FROM_LIST_MODERATORS,
  PEER_CONNECTION,
  PEER_CONNECTION_CONFIRMED,
  PEER_CONNECTION_ONTRACK,
  PRESENTATION_ENDED,
  PRESENTATION_FAILED,
  REGISTERED,
  REGISTRATION_FAILED,
  SHARE_STATE,
  SIP_EVENT,
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
  CONTENT_TYPE_REFUSAL,
  CONTENT_TYPE_SHARE_STATE,
  CONTENT_TYPE_USE_LICENSE,
  HEADER_CONTENT_ENTER_ROOM,
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
  HEADER_NOTIFY,
  HEADER_OUTPUT_CHANNELS,
  HEADER_START_PRESENTATION,
  HEADER_START_PRESENTATION_P2P,
  HEADER_STOP_PRESENTATION,
  HEADER_STOP_PRESENTATION_P2P,
  MUST_STOP_PRESENTATION,
  NOT_AVAILABLE_SECOND_REMOTE_STREAM,
} from './headers';
import {
  generateUserId,
  hasVideoTracks,
  parseDisplayName,
  prepareMediaStream,
  resolveSipUrl,
} from './utils';
import { hasDeclineResponseFromServer } from './utils/errors';
import scaleBitrate from './videoSendingBalancer/scaleBitrate';

const BUSY_HERE_STATUS_CODE = 486;
const REQUEST_TERMINATED_STATUS_CODE = 487;
const ORIGINATOR_LOCAL = 'local';
const ORIGINATOR_REMOTE = 'remote';

export enum EEventsMainCAM {
  PAUSE_MAIN_CAM = 'PAUSEMAINCAM',
  RESUME_MAIN_CAM = 'RESUMEMAINCAM',
  MAX_MAIN_CAM_RESOLUTION = 'MAXMAINCAMRESOLUTION',
  ADMIN_STOP_MAIN_CAM = 'ADMINSTOPMAINCAM',
  ADMIN_START_MAIN_CAM = 'ADMINSTARTMAINCAM',
}

export enum EEventsMic {
  ADMIN_STOP_MIC = 'ADMINSTOPMIC',
  ADMIN_START_MIC = 'ADMINSTARTMIC',
}

export enum EEventsSyncMediaState {
  ADMIN_SYNC_FORCED = '1',
  ADMIN_SYNC_NOT_FORCED = '0',
}

export enum EUseLicense {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  AUDIOPLUSPRESENTATION = 'AUDIOPLUSPRESENTATION',
}

export interface ICustomError extends Error {
  originator?: string;
  cause?: unknown;
  message: any;
  socket?: any;
  url?: string;
  code?: string;
}

export const hasCanceledCallError = (error: ICustomError = new Error()): boolean => {
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

export type TJsSIP = {
  UA: typeof UA;
  WebSocketInterface: typeof WebSocketInterface;
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
  noTerminateWhenError: boolean;
};

const CMD_CHANNELS = 'channels' as const;
const CMD_WEBCAST_STARTED = 'WebcastStarted' as const;
const CMD_WEBCAST_STOPPED = 'WebcastStopped' as const;
const CMD_ACCOUNT_CHANGED = 'accountChanged' as const;
const CMD_ACCOUNT_DELETED = 'accountDeleted' as const;
const CMD_ADDED_TO_LIST_MODERATORS = 'addedToListModerators' as const;
const CMD_REMOVED_FROM_LIST_MODERATORS = 'removedFromListModerators' as const;
const CMD_MOVE_REQUEST_TO_CONFERENCE = 'WebcastParticipationAccepted' as const;
const CMD_CANCELLING_WORD_REQUEST = 'WebcastParticipationRejected' as const;
const CMD_MOVE_REQUEST_TO_STREAM = 'ParticipantMovedToWebcast' as const;
const CMD_CONFERENCE_PARTICIPANT_TOKEN_ISSUED = 'ConferenceParticipantTokenIssued' as const;

type TAddedToListModeratorsInfoNotify = {
  cmd: typeof CMD_ADDED_TO_LIST_MODERATORS;
  conference: string;
};
type TRemovedFromListModeratorsInfoNotify = {
  cmd: typeof CMD_REMOVED_FROM_LIST_MODERATORS;
  conference: string;
};
type TMoveRequestToConferenceInfoNotify = {
  cmd: typeof CMD_MOVE_REQUEST_TO_CONFERENCE;
  body: { conference: string };
};
type TCancelingWordRequestInfoNotify = {
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
  TChannelsInfoNotify | TAddedToListModeratorsInfoNotify | TRemovedFromListModeratorsInfoNotify,
  'cmd'
> & { cmd: string };

type TOptionsExtraHeaders = {
  extraHeaders?: string[];
};

type TOntrack = (track: RTCTrackEvent) => void;

type TParametersConnection = {
  displayName?: string;
  user?: string;
  password?: string;
  register?: boolean;
  sipServerUrl: string;
  sipWebSocketServerURL: string;
  remoteAddress?: string;
  sdpSemantics?: 'plan-b' | 'unified-plan';
  sessionTimers?: boolean;
  registerExpires?: number;
  connectionRecoveryMinInterval?: number;
  connectionRecoveryMaxInterval?: number;
  userAgent?: string;
} & TOptionsExtraHeaders;

type TConnect = (parameters: TParametersConnection) => Promise<UA>;
type TCreateUa = (parameters: TParametersConnection) => Promise<UA>;
type TStart = () => Promise<UA>;
type TSet = ({
  displayName,
  password,
}: {
  displayName?: string;
  password?: string;
}) => Promise<boolean>;

type TDegradationPreference = 'maintain-framerate' | 'maintain-resolution' | 'balanced';
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
  mediaStream?: MediaStream;
  extraHeaders?: TOptionsExtraHeaders['extraHeaders'];
  ontrack?: TOntrack;
  iceServers?: RTCIceServer[];
  videoMode?: 'sendrecv' | 'sendonly' | 'recvonly';
  audioMode?: 'sendrecv' | 'sendonly' | 'recvonly';
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
  videoMode?: 'sendrecv' | 'sendonly' | 'recvonly';
  audioMode?: 'sendrecv' | 'sendonly' | 'recvonly';
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

  private _remoteStreams: { [key: string]: MediaStream } = {};

  private JsSIP: TJsSIP;

  private _sessionEvents: Events<typeof SESSION_EVENT_NAMES>;

  private _uaEvents: Events<typeof UA_EVENT_NAMES>;

  private _cancelableConnect: CancelableRequest<Parameters<TConnect>[0], ReturnType<TConnect>>;

  private _cancelableCreateUa: CancelableRequest<Parameters<TCreateUa>[0], ReturnType<TCreateUa>>;

  private _cancelableDisconnect: CancelableRequest<void, ReturnType<TDisconnect>>;

  private _cancelableSet: CancelableRequest<Parameters<TSet>[0], ReturnType<TSet>>;

  private _cancelableCall: CancelableRequest<Parameters<TCall>[0], ReturnType<TCall>>;

  private _cancelableAnswer: CancelableRequest<
    Parameters<TAnswerToIncomingCall>[0],
    ReturnType<TAnswerToIncomingCall>
  >;

  private _cancelableSendDTMF: CancelableRequest<Parameters<TSendDTMF>[0], ReturnType<TSendDTMF>>;

  private getSipServerUrl: (id: string) => string = (id: string) => {
    return id;
  };

  promisePendingStartPresentation?: Promise<MediaStream>;
  promisePendingStopPresentation?: Promise<void | MediaStream>;

  ua?: UA;

  session?: RTCSession;

  incomingSession?: RTCSession;

  _streamPresentationCurrent?: MediaStream;

  socket?: WebSocketInterface;

  constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.JsSIP = JsSIP;

    this._sessionEvents = new Events<typeof SESSION_EVENT_NAMES>(SESSION_EVENT_NAMES);
    this._uaEvents = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);

    this._cancelableConnect = new CancelableRequest<Parameters<TConnect>[0], ReturnType<TConnect>>(
      this._connect,
      {
        moduleName,
        afterCancelRequest: () => {
          this._cancelableCreateUa.cancelRequest();
          this._cancelableDisconnect.cancelRequest();
        },
      },
    );

    this._cancelableCreateUa = new CancelableRequest<
      Parameters<TCreateUa>[0],
      ReturnType<TCreateUa>
    >(this._createUa, { moduleName });

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

  connect: TConnect = (data) => {
    this._cancelRequests();

    return this._cancelableConnect.request(data);
  };

  createUa: TCreateUa = (data) => {
    return this._cancelableCreateUa.request(data);
  };

  set: TSet = (data) => {
    return this._cancelableSet.request(data);
  };

  call: TCall = (data) => {
    return this._cancelableCall.request(data);
  };

  disconnect: TDisconnect = () => {
    this._cancelRequests();

    return this._disconnectWithoutCancelRequests();
  };

  answerToIncomingCall: TAnswerToIncomingCall = (data) => {
    return this._cancelableAnswer.request(data);
  };

  sendDTMF: TSendDTMF = (tone) => {
    return this._cancelableSendDTMF.request(tone);
  };

  hangUp: THangUp = () => {
    this._cancelRequests();

    return this._hangUpWithoutCancelRequests();
  };

  register(): Promise<RegisteredEvent> {
    return new Promise((resolve, reject) => {
      if (this.isRegisterConfig) {
        this.ua!.on(REGISTERED, resolve);
        this.ua!.on(REGISTRATION_FAILED, reject);
        this.ua!.register();
      } else {
        reject(new Error('Config is not registered'));
      }
    });
  }

  unregister(): Promise<UnRegisteredEvent> {
    return new Promise((resolve, reject) => {
      if (this.isRegistered) {
        this.ua!.on(UNREGISTERED, resolve);
        this.ua!.unregister();
      } else {
        reject(new Error('ua is not registered'));
      }
    });
  }

  tryRegister = () => {
    if (!this.isRegisterConfig) {
      return Promise.reject(new Error('Config is not registered'));
    }

    this._uaEvents.trigger(CONNECTING, undefined);

    return this.unregister()
      .finally(() => {
        return this.register();
      })
      .finally(() => {
        return undefined;
      });
  };

  sendOptions(target: string | URI, body?: string, extraHeaders?: string[]): Promise<void> {
    if (!this.ua) {
      return Promise.reject(new Error('is not connected'));
    }

    return new Promise((resolve, reject) => {
      try {
        this.ua.sendOptions(target, body, {
          extraHeaders,
          eventHandlers: {
            succeeded: () => {
              resolve();
            },
            failed: (error) => {
              reject(error);
            },
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  ping(body?: string, extraHeaders?: string[]): Promise<void> {
    if (!this.ua || !this.ua.configuration || !this.ua.configuration.uri) {
      return Promise.reject(new Error('is not connected'));
    }

    const target = this.ua.configuration.uri;

    return this.sendOptions(target, body, extraHeaders);
  }

  replaceMediaStream(
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

  declineToIncomingCall = ({ statusCode = REQUEST_TERMINATED_STATUS_CODE } = {}) => {
    return new Promise((resolve, reject) => {
      if (!this.isAvailableIncomingCall) {
        reject(new Error('no incomingSession'));

        return undefined;
      }

      const incomingSession = this!.incomingSession as RTCSession;
      const callerData = this.remoteCallerData;

      this._cancelableCall.cancelRequest();
      this._cancelableAnswer.cancelRequest();

      this.removeIncomingSession();
      this._uaEvents.trigger(DECLINED_INCOMING_CALL, callerData);
      resolve(incomingSession.terminate({ status_code: statusCode }));

      return undefined;
    });
  };

  busyIncomingCall = () => {
    return this.declineToIncomingCall({ statusCode: BUSY_HERE_STATUS_CODE });
  };

  removeIncomingSession = () => {
    delete this.incomingSession;
  };

  askPermissionToEnableCam(
    options: TOptionsInfoMediaState = { noTerminateWhenError: true },
  ): Promise<void> {
    if (!this.session) {
      throw new Error('No session established');
    }

    const extraHeaders = [HEADER_ENABLE_MAIN_CAM];

    return this.session
      .sendInfo(CONTENT_TYPE_MAIN_CAM, undefined, {
        ...options,
        extraHeaders,
      })
      .catch((error) => {
        if (hasDeclineResponseFromServer(error)) {
          throw error;
        }

        return;
      });
  }

  get isPendingPresentation(): boolean {
    return !!this.promisePendingStartPresentation || !!this.promisePendingStopPresentation;
  }

  private _sendPresentation(
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
    const streamPresentationCurrent = prepareMediaStream(stream) as MediaStream;

    this._streamPresentationCurrent = streamPresentationCurrent;

    const preparatoryHeaders = isP2P
      ? [HEADER_START_PRESENTATION_P2P]
      : [HEADER_START_PRESENTATION];

    const result = session
      .sendInfo(CONTENT_TYPE_SHARE_STATE, undefined, {
        extraHeaders: preparatoryHeaders,
      })
      .then(() => {
        return session.startPresentation(
          streamPresentationCurrent,
          isNeedReinvite,
          degradationPreference,
        );
      })
      // @ts-ignore
      .then(() => {
        const { connection } = this;

        if (!connection || maxBitrate === undefined) {
          return undefined;
        }

        const senders = connection.getSenders();

        return scaleBitrate(senders, stream, maxBitrate);
      })
      .then(() => {
        return stream;
      })
      .catch((error) => {
        this._sessionEvents.trigger(PRESENTATION_FAILED, error);

        throw error;
      });

    this.promisePendingStartPresentation = result;

    return result.finally(() => {
      this.promisePendingStartPresentation = undefined;
    });
  }

  startPresentation(
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
  ): Promise<void | MediaStream> {
    const session = this.establishedSession;

    if (!session) {
      return Promise.reject(new Error('No session established'));
    }

    if (this._streamPresentationCurrent) {
      return Promise.reject(new Error('Presentation is already started'));
    }

    return this._sendPresentation(session, stream, {
      isNeedReinvite,
      isP2P,
      maxBitrate,
      degradationPreference,
    });
  }

  stopPresentation({
    isP2P = false,
  }: {
    isP2P?: boolean;
  } = {}): Promise<MediaStream | void> {
    const streamPresentationPrev = this._streamPresentationCurrent;
    let result: Promise<MediaStream | void> =
      this.promisePendingStartPresentation || Promise.resolve();

    const preparatoryHeaders = isP2P ? [HEADER_STOP_PRESENTATION_P2P] : [HEADER_STOP_PRESENTATION];

    const session = this.establishedSession;

    if (session && streamPresentationPrev) {
      result = result
        .then(() => {
          return session.sendInfo(CONTENT_TYPE_SHARE_STATE, undefined, {
            extraHeaders: preparatoryHeaders,
          });
        })
        .then(() => {
          return session.stopPresentation(streamPresentationPrev);
        })
        .catch((error) => {
          this._sessionEvents.trigger(PRESENTATION_FAILED, error);

          throw error;
        });
    }

    if (!session && streamPresentationPrev) {
      this._sessionEvents.trigger(PRESENTATION_ENDED, streamPresentationPrev);
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
  ): Promise<void | MediaStream> {
    const session = this.establishedSession;

    if (!session) {
      return Promise.reject(new Error('No session established'));
    }

    if (!this._streamPresentationCurrent) {
      return Promise.reject(new Error('Presentation has not started yet'));
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
  }

  handleNewRTCSession = ({ originator, session }: IncomingRTCSessionEvent) => {
    if (originator === ORIGINATOR_REMOTE) {
      this.incomingSession = session;

      const callerData = this.remoteCallerData;

      session.on(FAILED, ({ originator }) => {
        this.removeIncomingSession();

        if (originator !== ORIGINATOR_LOCAL) {
          this._uaEvents.trigger(FAILED_INCOMING_CALL, callerData);
        } else {
          this._uaEvents.trigger(TERMINATED_INCOMING_CALL, callerData);
        }
      });

      this._uaEvents.trigger(INCOMING_CALL, callerData);
    }
  };

  on(eventName: TEventUA, handler) {
    return this._uaEvents.on(eventName, handler);
  }

  once(eventName: TEventUA, handler) {
    return this._uaEvents.once(eventName, handler);
  }

  onceRace(eventNames: TEventUA[], handler) {
    return this._uaEvents.onceRace(eventNames, handler);
  }

  wait(eventName: TEventUA): Promise<any> {
    return this._uaEvents.wait(eventName);
  }

  off(eventName: TEventUA, handler) {
    this._uaEvents.off(eventName, handler);
  }

  onSession(eventName: TEventSession, handler) {
    return this._sessionEvents.on(eventName, handler);
  }

  onceSession(eventName: TEventSession, handler) {
    return this._sessionEvents.once(eventName, handler);
  }

  onceRaceSession(eventNames: TEventSession[], handler) {
    return this._sessionEvents.onceRace(eventNames, handler);
  }

  waitSession(eventName: TEventSession): Promise<any> {
    return this._sessionEvents.wait(eventName);
  }

  offSession(eventName: TEventSession, handler) {
    this._sessionEvents.off(eventName, handler);
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
    const connection = this?.session?.connection;

    return connection;
  }

  get remoteCallerData() {
    return {
      // eslint-disable-next-line camelcase
      displayName: this?.incomingSession?.remote_identity?.display_name,
      // eslint-disable-next-line camelcase
      host: this?.incomingSession?.remote_identity?.uri.host,
      // eslint-disable-next-line camelcase
      incomingNumber: this?.incomingSession?.remote_identity?.uri.user,
      session: this?.incomingSession,
    };
  }

  get requested() {
    return (
      this._cancelableConnect.requested ||
      this._cancelableCreateUa.requested ||
      this._cancelableCall.requested ||
      this._cancelableAnswer.requested
    );
  }

  get establishedSession(): RTCSession | undefined {
    return this.session && this.session.isEstablished() ? this.session : undefined;
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

  _connect: TConnect = (params) => {
    return this.createUa(params).then(() => {
      return this._start();
    });
  };

  _createUa: TCreateUa = async ({
    displayName = '',
    user,
    password,
    register = false,
    sipServerUrl,
    sipWebSocketServerURL,
    remoteAddress,
    extraHeaders = [],
    sdpSemantics = 'plan-b',
    sessionTimers = false,
    registerExpires = 60 * 5, // 5 minutes in sec
    connectionRecoveryMinInterval = 2,
    connectionRecoveryMaxInterval = 6,
    userAgent,
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

    this._init({ sipServerUrl, sipWebSocketServerURL });

    let authorizationUser;

    if (register && user) {
      authorizationUser = user.trim();
    } else {
      authorizationUser = generateUserId();
    }

    const configuration = {
      password,
      register,
      display_name: parseDisplayName(displayName),
      user_agent: userAgent,
      sdp_semantics: sdpSemantics,
      sockets: [this.socket as WebSocketInterface],
      uri: this.getSipServerUrl(authorizationUser),
      session_timers: sessionTimers,
      register_expires: registerExpires,

      connection_recovery_min_interval: connectionRecoveryMinInterval,
      connection_recovery_max_interval: connectionRecoveryMaxInterval,
    };

    if (this.ua) {
      await this._disconnectWithoutCancelRequests();
    }

    this._isRegisterConfig = !!configuration.register;
    this.ua = new this.JsSIP.UA(configuration);

    this._uaEvents.eachTriggers((trigger, eventName) => {
      const uaJsSipEvent = UA_JSSIP_EVENT_NAMES.find((jsSipEvent) => {
        return jsSipEvent === eventName;
      });

      if (uaJsSipEvent) {
        this.ua!.on(uaJsSipEvent, trigger);
      }
    });

    const extraHeadersRemoteAddress = getExtraHeadersRemoteAddress(remoteAddress);
    const extraHeadersBase = [...extraHeadersRemoteAddress, ...extraHeaders];

    this.ua!.registrator().setExtraHeaders(extraHeadersBase);

    return this.ua;
  };

  _init({ sipServerUrl, sipWebSocketServerURL }) {
    this.getSipServerUrl = resolveSipUrl(sipServerUrl);
    this.socket = new this.JsSIP.WebSocketInterface(sipWebSocketServerURL);
  }

  _start: TStart = () => {
    return new Promise((resolve, reject) => {
      const resolveUa = () => {
        removeEventListeners();
        resolve(this.ua as UA);
      };
      const rejectError = (error) => {
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

      this.ua!.start();
    });
  };

  _set: TSet = ({ displayName, password }) => {
    return new Promise((resolve, reject) => {
      let changedDisplayName = false;
      let changedPassword = false;

      if (displayName !== undefined && displayName !== this._connectionConfiguration.displayName) {
        changedDisplayName = this.ua!.set('display_name', parseDisplayName(displayName));
        this._connectionConfiguration.displayName = displayName;
      }

      if (password !== undefined && password !== this._connectionConfiguration.password) {
        changedPassword = this.ua!.set('password', password);
        this._connectionConfiguration.password = password;
      }

      const changedSome = changedDisplayName || changedPassword;

      if (changedPassword && this.isRegisterConfig) {
        this.register()
          .then(() => {
            return resolve(changedSome);
          })
          .catch(reject);
      } else if (changedSome) {
        resolve(changedSome);
      } else {
        reject(changedSome);
      }
    });
  };

  _disconnectWithoutCancelRequests: TDisconnect = () => {
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

  _call: TCall = ({
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
      this._connectionConfiguration.number = number;
      this._connectionConfiguration.answer = false;
      this._handleCall({ ontrack }).then(resolve).catch(reject);

      this.session = this.ua!.call(this.getSipServerUrl(number), {
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

  _answer: TAnswerToIncomingCall = ({
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

        return undefined;
      }

      this.session = this.incomingSession;
      this.removeIncomingSession();

      const session = this.session;

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
      this._handleCall({ ontrack }).then(resolve).catch(reject);

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

      return undefined;
    });
  };

  _handleCall = ({ ontrack }: { ontrack?: TOntrack }): Promise<RTCPeerConnection> => {
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
      const handleEnded = (error: ICustomError) => {
        removeStartedEventListeners();
        removeEndedEventListeners();
        reject(error);
      };

      let savedPeerconnection: RTCPeerConnection;

      const handlePeerConnection = ({ peerconnection }) => {
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

  _sendDTMF: TSendDTMF = (tone) => {
    return new Promise<void>((resolve, reject) => {
      const session = this.session;

      if (!session) {
        reject(new Error('No session established'));

        return;
      }

      this.onceSession(NEW_DTMF, ({ originator }) => {
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
    const id = videoTrack.id;

    const remoteStream: MediaStream = this._remoteStreams[id] || new MediaStream();

    if (audioTrack) {
      remoteStream.addTrack(audioTrack);
    }

    remoteStream.addTrack(videoTrack);
    this._remoteStreams[id] = remoteStream;

    return remoteStream;
  }

  _generateAudioStream(audioTrack: MediaStreamTrack): MediaStream {
    const id = audioTrack.id;

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
      const prevTrack = remoteTracks[index - 1];
      let audioTrack;

      if (prevTrack && prevTrack.kind === 'audio') {
        audioTrack = prevTrack;
      }

      const remoteStream = this._generateStream(videoTrack, audioTrack);

      remoteStreams.push(remoteStream);
    }, []);

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
        session.terminate();
      }
    }
  };

  _cancelRequests() {
    this._cancelActionsRequests();
    this._cancelCallRequests();
    this._cancelConnectRequests();
  }

  _cancelConnectRequests() {
    this._cancelableConnect.cancelRequest();
  }

  _cancelCallRequests() {
    this._cancelableCall.cancelRequest();
    this._cancelableAnswer.cancelRequest();
  }

  _cancelActionsRequests() {
    this._cancelableAnswer.cancelRequest();
    this._cancelableSendDTMF.cancelRequest();
  }

  _handleShareState = (eventName) => {
    switch (eventName) {
      case AVAILABLE_SECOND_REMOTE_STREAM:
        this._sessionEvents.trigger(AVAILABLE_SECOND_REMOTE_STREAM_EVENT, undefined);
        break;
      case NOT_AVAILABLE_SECOND_REMOTE_STREAM:
        this._sessionEvents.trigger(NOT_AVAILABLE_SECOND_REMOTE_STREAM_EVENT, undefined);
        break;
      case MUST_STOP_PRESENTATION:
        this._sessionEvents.trigger(MUST_STOP_PRESENTATION_EVENT, undefined);
        break;

      default:
        break;
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
    if (header.cmd === CMD_CHANNELS) {
      const channelsInfo = header as TChannelsInfoNotify;

      this._triggerChannelsNotify(channelsInfo);
    } else if (header.cmd === CMD_WEBCAST_STARTED) {
      const webcastInfo = header as TWebcastInfoNotify;

      this._triggerWebcastStartedNotify(webcastInfo);
    } else if (header.cmd === CMD_WEBCAST_STOPPED) {
      const webcastInfo = header as TWebcastInfoNotify;

      this._triggerWebcastStoppedNotify(webcastInfo);
    } else if (header.cmd === CMD_ADDED_TO_LIST_MODERATORS) {
      const data = header as TAddedToListModeratorsInfoNotify;

      this._triggerAddedToListModeratorsNotify(data);
    } else if (header.cmd === CMD_REMOVED_FROM_LIST_MODERATORS) {
      const data = header as TRemovedFromListModeratorsInfoNotify;

      this._triggerRemovedFromListModeratorsNotify(data);
    } else if (header.cmd === CMD_MOVE_REQUEST_TO_CONFERENCE) {
      const data = header as TMoveRequestToConferenceInfoNotify;

      this._triggerParticipantMoveRequestToConference(data);
    } else if (header.cmd === CMD_CANCELLING_WORD_REQUEST) {
      const data = header as TCancelingWordRequestInfoNotify;

      this._triggerParticipantCancelingWordRequest(data);
    } else if (header.cmd === CMD_MOVE_REQUEST_TO_STREAM) {
      const data = header as TMoveRequestToStreamInfoNotify;

      this._triggerParticipantMoveRequestToStream(data);
    } else if (header.cmd === CMD_ACCOUNT_CHANGED) {
      this._triggerAccountChangedNotify();
    } else if (header.cmd === CMD_ACCOUNT_DELETED) {
      this._triggerAccountDeletedNotify();
    } else if (header.cmd === CMD_CONFERENCE_PARTICIPANT_TOKEN_ISSUED) {
      const data = header as TConferenceParticipantTokenIssued;

      this._triggerConferenceParticipantTokenIssued(data);
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

  _triggerParticipantMoveRequestToConference = ({
    body: { conference },
  }: TMoveRequestToConferenceInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this._uaEvents.trigger(PARTICIPANT_MOVE_REQUEST_TO_CONFERENCE, data);
  };

  _triggerParticipantCancelingWordRequest = ({
    body: { conference },
  }: TCancelingWordRequestInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this._uaEvents.trigger(PARTICIPANT_CANCELLING_WORD_REQUEST, data);
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

    this._sessionEvents.trigger(ENTER_ROOM, room);
  };

  _triggerShareState = (request: IncomingRequest) => {
    const eventName = request.getHeader(HEADER_CONTENT_SHARE_STATE);

    this._sessionEvents.trigger(SHARE_STATE, eventName);
  };

  _triggerMainCamControl = (request: IncomingRequest) => {
    const mainCam = request.getHeader(HEADER_MAIN_CAM) as EEventsMainCAM;

    const syncState = request.getHeader(HEADER_MEDIA_SYNC);
    const isSyncForced = syncState === EEventsSyncMediaState.ADMIN_SYNC_FORCED ? true : false;

    if (mainCam === EEventsMainCAM.ADMIN_START_MAIN_CAM) {
      this._sessionEvents.trigger(ADMIN_START_MAIN_CAM, { isSyncForced });
    } else if (mainCam === EEventsMainCAM.ADMIN_STOP_MAIN_CAM) {
      this._sessionEvents.trigger(ADMIN_STOP_MAIN_CAM, { isSyncForced });
    } else if (
      (mainCam === EEventsMainCAM.RESUME_MAIN_CAM || mainCam === EEventsMainCAM.PAUSE_MAIN_CAM) &&
      !!syncState
    ) {
      this._sessionEvents.trigger(ADMIN_FORCE_SYNC_MEDIA_STATE, { isSyncForced });
    } else {
      const resolutionMainCam = request.getHeader(HEADER_MAIN_CAM_RESOLUTION);

      this._sessionEvents.trigger(MAIN_CAM_CONTROL, {
        mainCam,
        resolutionMainCam,
      });
    }
  };

  _triggerMicControl = (request: IncomingRequest) => {
    const mic = request.getHeader(HEADER_MIC);
    const syncState = request.getHeader(HEADER_MEDIA_SYNC);
    const isSyncForced = syncState === EEventsSyncMediaState.ADMIN_SYNC_FORCED ? true : false;

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

    const request = info.request as IncomingRequest;
    const contentType = request.getHeader(HEADER_CONTENT_TYPE_NAME);

    if (contentType) {
      switch (contentType) {
        case CONTENT_TYPE_ENTER_ROOM:
          this._triggerEnterRoom(request);
          this._maybeTriggerChannels(request);
          break;
        case CONTENT_TYPE_NOTIFY:
          this._maybeHandleNotify(request);
          break;
        case CONTENT_TYPE_SHARE_STATE:
          this._triggerShareState(request);
          break;
        case CONTENT_TYPE_MAIN_CAM:
          this._triggerMainCamControl(request);
          break;
        case CONTENT_TYPE_MIC:
          this._triggerMicControl(request);
          break;
        case CONTENT_TYPE_USE_LICENSE:
          this._triggerUseLicense(request);
          break;

        default:
          break;
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

  waitChannels(): Promise<TChannels> {
    return this.waitSession(CHANNELS);
  }

  waitSyncMediaState(): Promise<{ isSyncForced: boolean }> {
    return this.waitSession(ADMIN_FORCE_SYNC_MEDIA_STATE);
  }

  sendChannels({ inputChannels, outputChannels }: TChannels): Promise<void> {
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

  sendMediaState(
    { cam, mic }: TMediaState,
    options: TOptionsInfoMediaState = { noTerminateWhenError: true },
  ): Promise<void> {
    if (!this.session) {
      throw new Error('No session established');
    }

    const headerMediaState = `${HEADER_MEDIA_STATE}: currentstate`;
    const headerCam = `${HEADER_MAIN_CAM_STATE}: ${+cam}`;
    const headerMic = `${HEADER_MIC_STATE}: ${+mic}`;
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [
      headerMediaState,
      headerCam,
      headerMic,
    ];

    return this.session.sendInfo(CONTENT_TYPE_MEDIA_STATE, undefined, { ...options, extraHeaders });
  }

  _sendRefusalToTurnOn(
    type: 'cam' | 'mic',
    options: TOptionsInfoMediaState = { noTerminateWhenError: true },
  ): Promise<void> {
    if (!this.session) {
      throw new Error('No session established');
    }

    const typeMicOnServer = 0;
    const typeCamOnServer = 1;
    const typeToSend = type == 'mic' ? typeMicOnServer : typeCamOnServer;

    const headerMediaType = `${HEADER_MEDIA_TYPE}: ${typeToSend}`;
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [headerMediaType];

    return this.session.sendInfo(CONTENT_TYPE_REFUSAL, undefined, { ...options, extraHeaders });
  }

  sendRefusalToTurnOnMic(
    options: TOptionsInfoMediaState = { noTerminateWhenError: true },
  ): Promise<void> {
    if (!this.session) {
      throw new Error('No session established');
    }

    return this._sendRefusalToTurnOn('mic', options);
  }

  sendRefusalToTurnOnCam(
    options: TOptionsInfoMediaState = { noTerminateWhenError: true },
  ): Promise<void> {
    if (!this.session) {
      throw new Error('No session established');
    }

    return this._sendRefusalToTurnOn('cam', options);
  }

  _handleEnded = (error: ICustomError) => {
    const { originator } = error;

    if (originator === ORIGINATOR_REMOTE) {
      this._sessionEvents.trigger(ENDED_FROM_SERVER, error);
    }

    this._restoreSession();
  };
}
