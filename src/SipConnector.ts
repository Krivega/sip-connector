import type { UA, WebSocketInterface } from '@krivega/jssip';
import type { IncomingRequest } from '@krivega/jssip/lib/SIPMessage';
import type {
  IncomingInfoEvent,
  OutgoingInfoEvent,
  RTCSession,
} from '@krivega/jssip/lib/RTCSession';
import type {
  IncomingRTCSessionEvent,
  RegisteredEvent,
  UnRegisteredEvent,
} from '@krivega/jssip/lib/UA';
import CancelableRequest, {
  isCanceledError,
} from '@krivega/cancelable-promise/dist/CancelableRequest';
import Events from 'events-constructor';
import scaleBitrate from './videoSendingBalancer‎/scaleBitrate';
import {
  UA_EVENT_NAMES,
  UA_JSSIP_EVENT_NAMES,
  SESSION_EVENT_NAMES,
  SESSION_JSSIP_EVENT_NAMES,
} from './eventNames';
import type { TEventUA, TEventSession } from './eventNames';
import { REQUEST_TIMEOUT, REJECTED, BYE, CANCELED } from './causes';
import {
  HEADER_CONTENT_SHARE_STATE,
  HEADER_CONTENT_ENTER_ROOM,
  HEADER_CONTENT_TYPE_NAME,
  CONTENT_TYPE_SHARE_STATE,
  CONTENT_TYPE_ENTER_ROOM,
  CONTENT_TYPE_CHANNELS,
  HEADER_INPUT_CHANNELS,
  HEADER_OUTPUT_CHANNELS,
  HEADER_START_PRESENTATION,
  HEADER_STOP_PRESENTATION,
  HEADER_CONTENT_TYPE_MAIN_CAM,
  HEADER_MAIN_CAM,
  HEADER_MAIN_CAM_RESOLUTION,
  CONTENT_TYPE_NOTIFY,
  HEADER_NOTIFY,
  AVAILABLE_SECOND_REMOTE_STREAM,
  NOT_AVAILABLE_SECOND_REMOTE_STREAM,
  MUST_STOP_PRESENTATION,
  HEADER_START_PRESENTATION_P2P,
  HEADER_STOP_PRESENTATION_P2P,
} from './headers';
import getExtraHeadersRemoteAddress from './getExtraHeadersRemoteAddress';
import {
  generateUserId,
  hasVideoTracks,
  parseDisplayName,
  prepareMediaStream,
  resolveSipUrl,
} from './utils';

const BUSY_HERE_STATUS_CODE = 486;
const REQUEST_TERMINATED_STATUS_CODE = 487;
const ORIGINATOR_LOCAL = 'local';
const ORIGINATOR_REMOTE = 'remote';

export enum EEventsMainCAM {
  PAUSE_MAIN_CAM = 'PAUSEMAINCAM',
  RESUME_MAIN_CAM = 'RESUMEMAINCAM',
  MAX_MAIN_CAM_RESOLUTION = 'MAXMAINCAMRESOLUTION',
}

interface ICustomError extends Error {
  originator?: string;
  cause?: string;
  message: any;
  socket?: any;
  url?: string;
  code?: string;
}

export const hasCanceledCallError = (error: ICustomError = new Error()) => {
  const { originator, cause } = error;

  return (
    isCanceledError(error) ||
    cause === REQUEST_TIMEOUT ||
    cause === REJECTED ||
    (originator === ORIGINATOR_LOCAL && (cause === CANCELED || cause === BYE))
  );
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

type TParametersModeratorsList = {
  conference: string;
};

const CMD_CHANNELS = 'channels' as const;
const CMD_ADDED_TO_LIST_MODERATORS = 'addedToListModerators' as const;
const CMD_REMOVED_FROM_LIST_MODERATORS = 'removedFromListModerators' as const;
const CMD_MOVE_REQUEST_TO_CONFERENCE = 'WebcastParticipationAccepted' as const;
const CMD_CANCELLING_WORD_REQUEST = 'WebcastParticipationRejected' as const;
const CMD_MOVE_REQUEST_TO_STREAM = 'ParticipantMovedToWebcast' as const;

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

type TCall = ({
  number,
  mediaStream,
  extraHeaders,
  ontrack,
  iceServers,
}: {
  number: string;
  mediaStream: MediaStream;
  extraHeaders?: TOptionsExtraHeaders['extraHeaders'];
  ontrack?: TOntrack;
  iceServers?: RTCIceServer[];
}) => Promise<RTCPeerConnection>;

type TDisconnect = () => Promise<void>;

type TParametersAnswerToIncomingCall = {
  mediaStream: MediaStream;
  extraHeaders?: TOptionsExtraHeaders['extraHeaders'];
  ontrack?: TOntrack;
  iceServers?: RTCIceServer[];
};

type TAnswerToIncomingCall = (
  parameters: TParametersAnswerToIncomingCall
) => Promise<RTCPeerConnection>;

type TSendDTMF = (tone: number | string) => Promise<void>;

type THangUp = () => Promise<void>;

type TRestoreSession = () => Promise<void>;

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

  private _cancelableRestoreSession: CancelableRequest<void, ReturnType<TRestoreSession>>;

  private getSipServerUrl: (id: string) => string = (id: string) => {
    return id;
  };

  isPendingPresentation = false;

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
      moduleName,
      () => {
        this._cancelableCreateUa.cancelRequest();
        this._cancelableDisconnect.cancelRequest();
      }
    );

    this._cancelableCreateUa = new CancelableRequest<
      Parameters<TCreateUa>[0],
      ReturnType<TCreateUa>
    >(this._createUa, moduleName);

    this._cancelableDisconnect = new CancelableRequest<void, ReturnType<TDisconnect>>(
      this._disconnect,
      moduleName
    );

    this._cancelableSet = new CancelableRequest<Parameters<TSet>[0], ReturnType<TSet>>(
      this._set,
      moduleName
    );

    this._cancelableCall = new CancelableRequest<Parameters<TCall>[0], ReturnType<TCall>>(
      this._call,
      moduleName
    );

    this._cancelableAnswer = new CancelableRequest<
      Parameters<TAnswerToIncomingCall>[0],
      ReturnType<TAnswerToIncomingCall>
    >(this._answer, moduleName);

    this._cancelableSendDTMF = new CancelableRequest<
      Parameters<TSendDTMF>[0],
      ReturnType<TSendDTMF>
    >(this._sendDTMF, moduleName);

    this._cancelableRestoreSession = new CancelableRequest<void, ReturnType<TRestoreSession>>(
      this._restoreSession,
      moduleName
    );

    this.on('shareState', this._handleShareState);

    this.onSession('newInfo', this._handleNewInfo);
    this.on('sipEvent', this._handleSipEvent);
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

  restoreSession: TRestoreSession = () => {
    return this._cancelableRestoreSession.request();
  };

  register(): Promise<RegisteredEvent> {
    return new Promise((resolve, reject) => {
      if (this.isRegisterConfig) {
        this.ua!.on('registered', resolve);
        this.ua!.on('registrationFailed', reject);
        this.ua!.register();
      } else {
        reject(new Error('Config is not registered'));
      }
    });
  }

  unregister(): Promise<UnRegisteredEvent> {
    return new Promise((resolve, reject) => {
      if (this.isRegistered) {
        this.ua!.on('unregistered', resolve);
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

    this._uaEvents.trigger('connecting', undefined);

    return this.unregister()
      .finally(() => {
        return this.register();
      })
      .finally(() => {
        return undefined;
      });
  };

  replaceMediaStream(
    mediaStream: MediaStream,
    options?: {
      deleteExisting: boolean;
      addMissing: boolean;
    }
  ): Promise<void> {
    return this.session!.replaceMediaStream(mediaStream, options);
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
      this._uaEvents.trigger('declinedIncomingCall', callerData);
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

  startPresentation(
    stream: MediaStream,
    {
      isNeedReinvite = true,
      isP2P = false,
      maxBitrate,
    }: {
      isNeedReinvite?: boolean;
      isP2P?: boolean;
      maxBitrate?: number;
    } = {}
  ): Promise<void | MediaStream> {
    this.isPendingPresentation = true;

    const streamPresentationCurrent = prepareMediaStream(stream);

    this._streamPresentationCurrent = streamPresentationCurrent;

    let result: Promise<void | MediaStream> = Promise.resolve();

    const preparatoryHeaders = isP2P
      ? [HEADER_START_PRESENTATION_P2P]
      : [HEADER_START_PRESENTATION];

    if (this.isEstablishedSession) {
      result = this.session!.sendInfo(CONTENT_TYPE_SHARE_STATE, undefined, {
        extraHeaders: preparatoryHeaders,
      })
        .then(() => {
          return this.session!.startPresentation(streamPresentationCurrent, isNeedReinvite);
        })
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
          this._sessionEvents.trigger('presentation:failed', error);

          throw error;
        });
    }

    return result.finally(() => {
      this.isPendingPresentation = false;
    });
  }

  stopPresentation({
    isP2P = false,
  }: {
    isP2P?: boolean;
  } = {}): Promise<MediaStream | void> {
    this.isPendingPresentation = true;

    const streamPresentationPrev = this._streamPresentationCurrent;
    let result: Promise<MediaStream | void> = Promise.resolve();

    const preparatoryHeaders = isP2P ? [HEADER_STOP_PRESENTATION_P2P] : [HEADER_STOP_PRESENTATION];

    if (this.isEstablishedSession && streamPresentationPrev) {
      result = this.session!.sendInfo(CONTENT_TYPE_SHARE_STATE, undefined, {
        extraHeaders: preparatoryHeaders,
      })
        .then(() => {
          return this.session!.stopPresentation(streamPresentationPrev);
        })
        .catch((error) => {
          this._sessionEvents.trigger('presentation:failed', error);

          throw error;
        });
    }

    if (!this.isEstablishedSession && streamPresentationPrev) {
      this._sessionEvents.trigger('presentation:ended', streamPresentationPrev);
    }

    return result.finally(() => {
      delete this._streamPresentationCurrent;

      this.isPendingPresentation = false;
    });
  }

  handleNewRTCSession = ({ originator, session }: IncomingRTCSessionEvent) => {
    if (originator === ORIGINATOR_REMOTE) {
      this.incomingSession = session;

      const callerData = this.remoteCallerData;

      this.incomingSession.on('failed', () => {
        this.removeIncomingSession();
        this._uaEvents.trigger('failedIncomingCall', callerData);
      });

      this._uaEvents.trigger('incomingCall', callerData);
    }
  };

  on(eventName: TEventUA, handler) {
    this._uaEvents.on(eventName, handler);
  }

  once(eventName: TEventUA, handler) {
    this._uaEvents.once(eventName, handler);
  }

  wait(eventName: TEventUA): Promise<any> {
    return this._uaEvents.wait(eventName);
  }

  off(eventName: TEventUA, handler) {
    this._uaEvents.off(eventName, handler);
  }

  onSession(eventName: TEventSession, handler) {
    this._sessionEvents.on(eventName, handler);
  }

  onceSession(eventName: TEventSession, handler) {
    this._sessionEvents.once(eventName, handler);
  }

  waitSession(eventName: TEventSession): Promise<any> {
    return this._sessionEvents.wait(eventName);
  }

  offSession(eventName: TEventSession, handler) {
    this._sessionEvents.off(eventName, handler);
  }

  isMutedVideo() {
    if (!this.session) {
      return undefined;
    }

    return this.session.isMuted().video;
  }

  isMutedAudio() {
    if (!this.session) {
      return undefined;
    }

    return this.session.isMuted().audio;
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

  get isEstablishedSession() {
    return this.session && this.session.isEstablished();
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

  _connect: TConnect = ({
    displayName = '',
    register = false,
    user,
    password,
    sipServerUrl,
    sipWebSocketServerURL,
    remoteAddress,
    extraHeaders,
    sdpSemantics,
  }) => {
    return this.createUa({
      displayName,
      user,
      password,
      register,
      sipServerUrl,
      sipWebSocketServerURL,
      remoteAddress,
      extraHeaders,
      sdpSemantics,
    }).then(() => {
      return this._start();
    });
  };

  _createUa: TCreateUa = async ({
    displayName = '',
    user,
    password,
    register,
    sipServerUrl,
    sipWebSocketServerURL,
    remoteAddress,
    extraHeaders = [],
    sdpSemantics = 'plan-b',
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

    let userAgent = 'Chrome';

    if (sdpSemantics === 'unified-plan') {
      userAgent = 'ChromeNew';
    }

    const configuration = {
      password,
      register,
      display_name: parseDisplayName(displayName),
      user_agent: userAgent,
      sdp_semantics: sdpSemantics,
      sockets: [this.socket as WebSocketInterface],
      uri: this.getSipServerUrl(authorizationUser),
      session_timers: false,
      register_expires: 60 * 5, // 5 minutes in sec
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
          this.on('registered', resolveUa);
          this.on('registrationFailed', rejectError);
        } else {
          this.on('connected', resolveUa);
        }

        this.on('disconnected', rejectError);
      };
      const removeEventListeners = () => {
        this.off('registered', resolveUa);
        this.off('registrationFailed', rejectError);
        this.off('connected', resolveUa);
        this.off('disconnected', rejectError);
      };

      addEventListeners();
      this.on('newRTCSession', this.handleNewRTCSession);

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
    this.off('newRTCSession', this.handleNewRTCSession);

    const disconnectedPromise = new Promise<void>((resolve) => {
      this.once('disconnected', () => {
        delete this.ua;
        resolve();
      });
    });

    if (this.ua) {
      await this._hangUpWithoutCancelRequests();

      if (this.ua) {
        this.ua.stop();
      } else {
        this._uaEvents.trigger('disconnected', undefined);
      }
    } else {
      this._uaEvents.trigger('disconnected', undefined);
    }

    return disconnectedPromise;
  };

  _call: TCall = ({ number, mediaStream, extraHeaders = [], ontrack, iceServers }) => {
    return new Promise((resolve, reject) => {
      this._connectionConfiguration.number = number;
      this._connectionConfiguration.answer = false;
      this._handleCall({ ontrack }).then(resolve).catch(reject);

      this.session = this.ua!.call(this.getSipServerUrl(number), {
        extraHeaders,
        mediaStream: prepareMediaStream(mediaStream),
        eventHandlers: this._sessionEvents.triggers,
        pcConfig: {
          iceServers,
        },
      });
    });
  };

  _answer: TAnswerToIncomingCall = ({
    mediaStream,
    ontrack,
    extraHeaders = [],
    iceServers,
  }): Promise<RTCPeerConnection> => {
    return new Promise((resolve, reject) => {
      if (!this.isAvailableIncomingCall) {
        reject(new Error('no incomingSession'));

        return undefined;
      }

      this.session = this.incomingSession;
      this.removeIncomingSession();

      this._sessionEvents.eachTriggers((trigger, eventName) => {
        const sessionJsSipEvent = SESSION_JSSIP_EVENT_NAMES.find((jsSipEvent) => {
          return jsSipEvent === eventName;
        });

        if (sessionJsSipEvent) {
          this.session!.on(sessionJsSipEvent, trigger);
        }
      });

      this._connectionConfiguration.answer = true;
      this._connectionConfiguration.number = this.session!.remote_identity.uri.user;
      this._handleCall({ ontrack }).then(resolve).catch(reject);

      const preparedMediaStream = mediaStream ? prepareMediaStream(mediaStream) : undefined;

      this.session!.answer({
        extraHeaders,
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
        this.onSession('peerconnection', handlePeerConnection);
        this.onSession('confirmed', handleConfirmed);
      };
      const removeStartedEventListeners = () => {
        this.offSession('peerconnection', handlePeerConnection);
        this.offSession('confirmed', handleConfirmed);
      };
      const addEndedEventListeners = () => {
        this.onSession('failed', handleEnded);
        this.onSession('ended', handleEnded);
      };
      const removeEndedEventListeners = () => {
        this.offSession('failed', handleEnded);
        this.offSession('ended', handleEnded);
      };
      const handleEnded = (data) => {
        const { originator } = data;

        if (originator === ORIGINATOR_REMOTE) {
          this._sessionEvents.trigger('ended:fromserver', data);
        }

        if (this.session && !this._cancelableRestoreSession.requested) {
          this.restoreSession();
        }

        removeStartedEventListeners();
        removeEndedEventListeners();
        reject(data);
      };

      let savedPeerconnection: RTCPeerConnection;

      const handlePeerConnection = ({ peerconnection }) => {
        savedPeerconnection = peerconnection;

        savedPeerconnection.ontrack = (track) => {
          this._sessionEvents.trigger('peerconnection:ontrack', savedPeerconnection);

          if (ontrack) {
            ontrack(track);
          }
        };
      };
      const handleConfirmed = () => {
        if (savedPeerconnection) {
          this._sessionEvents.trigger('peerconnection:confirmed', savedPeerconnection);
        }

        removeStartedEventListeners();
        resolve(savedPeerconnection);
      };

      addStartedEventListeners();
      addEndedEventListeners();
    });
  };

  _restoreSession: TRestoreSession = async () => {
    if (this._streamPresentationCurrent) {
      await this.stopPresentation();
    }

    delete this._connectionConfiguration.number;
    delete this.session;
    this._remoteStreams = {};
  };

  _sendDTMF: TSendDTMF = (tone) => {
    return new Promise<void>((resolve, reject) => {
      if (this.session) {
        this.onceSession('newDTMF', ({ originator }) => {
          if (originator === ORIGINATOR_LOCAL) {
            resolve();
          }
        });
        this.session.sendDTMF(tone, {
          duration: 120,
          interToneGap: 600,
        });
      } else {
        reject();
      }
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

      await this.restoreSession();

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
    this._cancelableRestoreSession.cancelRequest();
  }

  _cancelActionsRequests() {
    this._cancelableAnswer.cancelRequest();
    this._cancelableSendDTMF.cancelRequest();
  }

  _handleShareState = (eventName) => {
    switch (eventName) {
      case AVAILABLE_SECOND_REMOTE_STREAM:
        this._uaEvents.trigger('availableSecondRemoteStream', undefined);
        break;
      case NOT_AVAILABLE_SECOND_REMOTE_STREAM:
        this._uaEvents.trigger('notAvailableSecondRemoteStream', undefined);
        break;
      case MUST_STOP_PRESENTATION:
        this._uaEvents.trigger('mustStopPresentation', undefined);
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

      this._sessionEvents.trigger('channels', headersChannels);
    }
  };

  _handleNotify = (header: TInfoNotify) => {
    if (header.cmd === CMD_CHANNELS) {
      const channelsInfo = header as TChannelsInfoNotify;

      this._maybeTriggerChannelsNotify(channelsInfo);
    } else if (header.cmd === CMD_ADDED_TO_LIST_MODERATORS) {
      const data = header as TAddedToListModeratorsInfoNotify;

      this._maybeTriggerAddedToListModeratorsNotify(data);
    } else if (header.cmd === CMD_REMOVED_FROM_LIST_MODERATORS) {
      const data = header as TRemovedFromListModeratorsInfoNotify;

      this._maybeTriggerRemovedFromListModeratorsNotify(data);
    } else if (header.cmd === CMD_MOVE_REQUEST_TO_CONFERENCE) {
      const data = header as TMoveRequestToConferenceInfoNotify;

      this._maybeTriggerParticipantMoveRequestToConference(data);
    } else if (header.cmd === CMD_CANCELLING_WORD_REQUEST) {
      const data = header as TCancelingWordRequestInfoNotify;

      this._maybeTriggerParticipantCancelingWordRequest(data);
    } else if (header.cmd === CMD_MOVE_REQUEST_TO_STREAM) {
      const data = header as TMoveRequestToStreamInfoNotify;

      this._maybeTriggerParticipantMoveRequestToStream(data);
    }
  };

  _maybeTriggerRemovedFromListModeratorsNotify = ({
    conference,
  }: TRemovedFromListModeratorsInfoNotify) => {
    const headersParametersModeratorsList: TParametersModeratorsList = {
      conference,
    };

    this._sessionEvents.trigger(
      'participant:removed-from-list-moderators',
      headersParametersModeratorsList
    );
  };

  _maybeTriggerAddedToListModeratorsNotify = ({ conference }: TAddedToListModeratorsInfoNotify) => {
    const headersParametersModeratorsList: TParametersModeratorsList = {
      conference,
    };

    this._sessionEvents.trigger(
      'participant:added-to-list-moderators',
      headersParametersModeratorsList
    );
  };

  _maybeTriggerChannelsNotify = (channelsInfo: TChannelsInfoNotify) => {
    const inputChannels = channelsInfo.input;
    const outputChannels = channelsInfo.output;

    const data: TChannels = {
      inputChannels,
      outputChannels,
    };

    if (this.session) {
      this._sessionEvents.trigger('channels:notify', data);
    }
  };

  _maybeTriggerParticipantMoveRequestToConference = ({
    body: { conference },
  }: TMoveRequestToConferenceInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this._sessionEvents.trigger('participant:move-request-to-conference', data);
  };

  _maybeTriggerParticipantCancelingWordRequest = ({
    body: { conference },
  }: TCancelingWordRequestInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this._sessionEvents.trigger('participant:canceling-word-request', data);
  };

  _maybeTriggerParticipantMoveRequestToStream = ({
    body: { conference },
  }: TMoveRequestToStreamInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this._sessionEvents.trigger('participant:move-request-to-stream', data);
  };

  _triggerEnterRoom = (request: IncomingRequest) => {
    const room = request.getHeader(HEADER_CONTENT_ENTER_ROOM);

    this._uaEvents.trigger('enterRoom', room);
  };

  _triggerShareState = (request: IncomingRequest) => {
    const eventName = request.getHeader(HEADER_CONTENT_SHARE_STATE);

    this._uaEvents.trigger('shareState', eventName);
  };

  _triggerMainCamControl = (request: IncomingRequest) => {
    const mainCam = request.getHeader(HEADER_MAIN_CAM) as EEventsMainCAM;
    const resolutionMainCam = request.getHeader(HEADER_MAIN_CAM_RESOLUTION);

    this._sessionEvents.trigger('main-cam-control', {
      mainCam,
      resolutionMainCam,
    });
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
        case HEADER_CONTENT_TYPE_MAIN_CAM:
          this._triggerMainCamControl(request);
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
    return this.waitSession('channels');
  }

  sendChannels({ inputChannels, outputChannels }: TChannels) {
    const headerInputChannels = `${HEADER_INPUT_CHANNELS}: ${inputChannels}`;
    const headerOutputChannels = `${HEADER_OUTPUT_CHANNELS}: ${outputChannels}`;
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [
      headerInputChannels,
      headerOutputChannels,
    ];

    this.session!.sendInfo(CONTENT_TYPE_CHANNELS, undefined, { extraHeaders });
  }
}
