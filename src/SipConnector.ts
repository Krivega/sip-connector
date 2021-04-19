import type { UA, WebSocketInterface } from '@krivega/jssip';
import type { IncomingRequest } from '@krivega/jssip/lib/SIPMessage';
import type { IncomingInfoEvent, OutgoingInfoEvent } from '@krivega/jssip/lib/RTCSession';
import type { RegisteredEvent, UnRegisteredEvent } from '@krivega/jssip/lib/UA';
import CancelableRequest, {
  isCanceledError,
} from '@krivega/cancelable-promise/dist/CancelableRequest';
import Events from 'events-constructor';
import {
  UA_EVENT_NAMES,
  UA_JSSIP_EVENT_NAMES,
  SESSION_EVENT_NAMES,
  SESSION_JSSIP_EVENT_NAMES,
} from './eventNames';
import type { TEventUA, TEventSession } from './eventNames';
import { REQUEST_TIMEOUT, REJECTED, BYE, CANCELED } from './causes';
import {
  AVAILABLE_SECOND_REMOTE_STREAM,
  NOT_AVAILABLE_SECOND_REMOTE_STREAM,
  MUST_STOP_PRESENTATION,
} from './eventNamesShareState';
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
} from './headers';

function resolveSipUrl(serverUrl: string): (string) => string {
  return (id: string): string => {
    return `sip:${id}@${serverUrl}`;
  };
}

const resolveRandomInt = (min, max) => {
  return () => {
    return Math.floor(Math.random() * (max - min)) + min;
  };
};
const parseDisplayName = (displayName) => {
  return displayName.trim().replace(/ /g, '_');
};
const generateUserId = resolveRandomInt(100000, 99999999);

const prepareMediaStream = (mediaStream: MediaStream) => {
  const audioTracks = mediaStream.getAudioTracks();
  const videoTracks = mediaStream.getVideoTracks();
  const tracks = [...audioTracks, ...videoTracks];
  const newStream = new MediaStream(tracks);

  newStream.getTracks = () => {
    return [...newStream.getAudioTracks(), ...newStream.getVideoTracks()]; // for garante audio first order
  };

  return newStream;
};

const BUSY_HERE_STATUS_CODE = 486;
const REQUEST_TERMINATED_STATUS_CODE = 487;
const ORIGINATOR_LOCAL = 'local';
const ORIGINATOR_REMOTE = 'remote';

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

type TOptionsExtraHeaders = {
  extraHeaders?: string[];
};

type TOntrack = (track: RTCTrackEvent) => void;

type TParametersConnection = {
  displayName?: string;
  user?: string;
  password?: string;
  register?: boolean;
  sipServerUrl?: string;
  sipWebSocketServerURL?: string;
};

type TConnect = (
  parameters: TParametersConnection,
  options?: TOptionsExtraHeaders
) => Promise<UA | undefined>;

type TCreateUa = (parameters: TParametersConnection) => Promise<UA | undefined>;

type TStart = (options: TOptionsExtraHeaders) => Promise<UA | undefined>;

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
}: {
  number: string;
  mediaStream: MediaStream;
  extraHeaders?: TOptionsExtraHeaders['extraHeaders'];
  ontrack?: TOntrack;
}) => Promise<RTCPeerConnection>;

type TDisconnect = () => Promise<void>;

type TParametersAnswerToIncomingCall = {
  mediaStream: MediaStream;
  extraHeaders?: TOptionsExtraHeaders['extraHeaders'];
  ontrack?: TOntrack;
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

  private _sdpSemantics: string;

  private _sessionEvents: Events<typeof SESSION_EVENT_NAMES>;

  private _uaEvents: Events<typeof UA_EVENT_NAMES>;

  private _cancelableConnect: any;

  private _cancelableCreateUa: any;

  private _cancelableStart: any;

  private _cancelableDisconnect: any;

  private _cancelableSet: any;

  private _cancelableCall: CancelableRequest<Parameters<TCall>[0], ReturnType<TCall>>;

  private _cancelableAnswer: any;

  private _cancelableSendDTMF: any;

  private _cancelableRestoreSession: any;

  private getSipServerUrl: (id: string) => string = (id: string) => {
    return id;
  };

  isPendingPresentation = false;

  ua?: UA;

  session?: ReturnType<UA['call']>;

  incomingSession: any;

  _streamPresentationCurrent: any;

  socket: any;

  constructor({
    JsSIP,
    sdpSemantics = 'plan-b',
  }: {
    JsSIP: TJsSIP;
    sdpSemantics?: 'plan-b' | 'unified-plan';
  }) {
    this.JsSIP = JsSIP;
    this._sdpSemantics = sdpSemantics;

    this._sessionEvents = new Events<typeof SESSION_EVENT_NAMES>(SESSION_EVENT_NAMES);
    this._uaEvents = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);

    this._cancelableConnect = new CancelableRequest<Parameters<TConnect>[0], ReturnType<TConnect>>(
      this._connect,
      moduleName,
      () => {
        this._cancelableCreateUa.cancelRequest();
        this._cancelableStart.cancelRequest();
        this._cancelableDisconnect.cancelRequest();
      }
    );

    this._cancelableCreateUa = new CancelableRequest<
      Parameters<TCreateUa>[0],
      ReturnType<TCreateUa>
    >(this._createUa, moduleName);

    this._cancelableStart = new CancelableRequest<Parameters<TStart>[0], ReturnType<TStart>>(
      this._start,
      moduleName
    );

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
  }

  connect: TConnect = (data) => {
    this._cancelRequests();

    return this._cancelableConnect.request(data);
  };

  createUa: TCreateUa = (data) => {
    return this._cancelableCreateUa.request(data);
  };

  start: TStart = (data) => {
    return this._cancelableStart.request(data);
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

  replaceMediaStream(mediaStream: MediaStream): Promise<void> {
    return this.session!.replaceMediaStream(mediaStream);
  }

  declineToIncomingCall = ({ statusCode = REQUEST_TERMINATED_STATUS_CODE } = {}) => {
    return new Promise((resolve, reject) => {
      if (!this.isAvailableIncomingCall) {
        reject(new Error('no incomingSession'));

        return undefined;
      }

      const { incomingSession } = this;
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
    isNeedReinvite = true
  ): Promise<void> | Promise<MediaStream> {
    this.isPendingPresentation = true;

    this._streamPresentationCurrent = prepareMediaStream(stream);

    let result: Promise<void> | Promise<MediaStream> = Promise.resolve();

    if (this.isEstablishedSession && this._streamPresentationCurrent) {
      result = this.session!.startPresentation(
        this._streamPresentationCurrent,
        [HEADER_START_PRESENTATION],
        isNeedReinvite
      );
    }

    return result.finally(() => {
      this.isPendingPresentation = false;
    });
  }

  stopPresentation(): Promise<void> | Promise<MediaStream> {
    this.isPendingPresentation = true;

    const streamPresentationPrev = this._streamPresentationCurrent;
    let result: Promise<void> | Promise<MediaStream> = Promise.resolve();

    if (this.isEstablishedSession && streamPresentationPrev) {
      result = this.session!.stopPresentation(this._streamPresentationCurrent, [
        HEADER_STOP_PRESENTATION,
      ]);
    }

    if (!this.isEstablishedSession && streamPresentationPrev) {
      this._sessionEvents.trigger('presentation:ended', streamPresentationPrev);
    }

    return result.finally(() => {
      delete this._streamPresentationCurrent;

      this.isPendingPresentation = false;
    });
  }

  handleNewRTCSession = ({ originator, session, request }) => {
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

  getRemoteStreams() {
    if (!this.session) {
      return undefined;
    }

    const receivers = this.session.connection.getReceivers();
    const remoteTracks = receivers.map(({ track }) => {
      return track;
    });
    const mainRemoteStreams = this._generateStreams(remoteTracks);

    return [...mainRemoteStreams];
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
      this._cancelableStart.requested ||
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

  _connect: TConnect = (
    { displayName = '', register = false, user, password, sipServerUrl, sipWebSocketServerURL },
    optionsExtraHeaders = {}
  ) => {
    return this.createUa({
      displayName,
      user,
      password,
      register,
      sipServerUrl,
      sipWebSocketServerURL,
    }).then(() => {
      return this._start(optionsExtraHeaders);
    });
  };

  _createUa: TCreateUa = async ({
    displayName,
    user,
    password,
    register,
    sipServerUrl,
    sipWebSocketServerURL,
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

    if (this._sdpSemantics === 'unified-plan') {
      userAgent = 'ChromeNew';
    }

    const configuration = {
      password,
      register,
      display_name: parseDisplayName(displayName),
      user_agent: userAgent,
      sdp_semantics: this._sdpSemantics,
      sockets: [this.socket],
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

    return this.ua;
  };

  _init({ sipServerUrl, sipWebSocketServerURL }) {
    this.getSipServerUrl = resolveSipUrl(sipServerUrl);
    this.socket = new this.JsSIP.WebSocketInterface(sipWebSocketServerURL);
  }

  _start: TStart = ({ extraHeaders }) => {
    return new Promise((resolve, reject) => {
      const resolveUa = () => {
        removeEventListeners();
        resolve(this.ua);
      };
      const rejectError = (error) => {
        removeEventListeners();
        reject(error);
      };
      const handleDisconnected = (data) => {
        let error = data;

        if (data && data.error) {
          error = data.error;
        }

        rejectError(error);
      };
      const addEventListeners = () => {
        if (this.isRegisterConfig) {
          this.on('registered', resolveUa);
          this.on('registrationFailed', rejectError);
        } else {
          this.on('connected', resolveUa);
        }

        this.on('disconnected', handleDisconnected);
      };
      const removeEventListeners = () => {
        this.off('registered', resolveUa);
        this.off('registrationFailed', rejectError);
        this.off('connected', resolveUa);
        this.off('disconnected', handleDisconnected);
      };

      addEventListeners();
      this.on('newRTCSession', this.handleNewRTCSession);

      if (extraHeaders) {
        this.ua!.registrator().setExtraHeaders(extraHeaders);
      }

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

    const disconnectedPromise = new Promise<void>((resolve, reject) => {
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

  _call: TCall = ({ number, mediaStream, extraHeaders = [], ontrack }) => {
    return new Promise((resolve, reject) => {
      this._connectionConfiguration.number = number;
      this._connectionConfiguration.answer = false;
      this._handleCall({ ontrack }).then(resolve).catch(reject);

      this.session = this.ua!.call(this.getSipServerUrl(number), {
        extraHeaders,
        mediaStream: prepareMediaStream(mediaStream),
        eventHandlers: this._sessionEvents.triggers,
      });
    });
  };

  _answer: TAnswerToIncomingCall = ({
    mediaStream,
    ontrack,
    extraHeaders = [],
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

  _generateStream(videoTrack, audioTrack) {
    const { id } = videoTrack;
    const remoteStream = this._remoteStreams[id] || new MediaStream();

    if (audioTrack) {
      remoteStream.addTrack(audioTrack);
    }

    remoteStream.addTrack(videoTrack);
    this._remoteStreams[id] = remoteStream;

    return remoteStream;
  }

  _generateStreams(remoteTracks) {
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

  _hangUpWithoutCancelRequests: THangUp = async () => {
    if (this.ua && this.session) {
      await this.restoreSession();

      this.ua.terminateSessions();
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

  _triggerEnterRoom = (request: IncomingRequest) => {
    const room = request.getHeader(HEADER_CONTENT_ENTER_ROOM);

    this._uaEvents.trigger('enterRoom', room);
  };

  _triggerShareState = (request: IncomingRequest) => {
    const eventName = request.getHeader(HEADER_CONTENT_SHARE_STATE);

    this._uaEvents.trigger('shareState', eventName);
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
        case CONTENT_TYPE_SHARE_STATE:
          this._triggerShareState(request);
          break;

        default:
          break;
      }
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
