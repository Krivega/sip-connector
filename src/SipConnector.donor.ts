import { isCanceledError } from '@krivega/cancelable-promise';
import type { RTCSession } from '@krivega/jssip';
import Events from 'events-constructor';
import { hasCanceledError, repeatedCallsAsync } from 'repeated-calls';
import { hasVideoTracks } from '../utils';
import { BYE, CANCELED, REJECTED, REQUEST_TIMEOUT } from './causes';
import {
  ADMIN_FORCE_SYNC_MEDIA_STATE,
  CHANNELS,
  CONFIRMED,
  ENDED,
  ENDED_FROM_SERVER,
  FAILED,
  NEW_DTMF,
  ONE_MEGABIT_IN_BITS,
  Originator,
  PEER_CONNECTION,
  PEER_CONNECTION_CONFIRMED,
  PEER_CONNECTION_ONTRACK,
  PRESENTATION_ENDED,
  PRESENTATION_FAILED,
} from './constants';
import type { TEventSession } from './eventNames';
import { SESSION_EVENT_NAMES, SESSION_JSSIP_EVENT_NAMES } from './eventNames';
import {
  CONTENT_TYPE_CHANNELS,
  CONTENT_TYPE_MAIN_CAM,
  CONTENT_TYPE_MEDIA_STATE,
  CONTENT_TYPE_REFUSAL,
  CONTENT_TYPE_SHARE_STATE,
  HEADER_ENABLE_MAIN_CAM,
  HEADER_INPUT_CHANNELS,
  HEADER_MAIN_CAM_STATE,
  HEADER_MEDIA_STATE,
  HEADER_MEDIA_TYPE,
  HEADER_MIC_STATE,
  HEADER_MUST_STOP_PRESENTATION_P2P,
  HEADER_OUTPUT_CHANNELS,
  HEADER_START_PRESENTATION,
  HEADER_START_PRESENTATION_P2P,
  HEADER_STOP_PRESENTATION,
  HEADER_STOP_PRESENTATION_P2P,
} from './headers';
import logger from './logger';
import prepareMediaStream from './tools/prepareMediaStream';
import type { TContentHint, TCustomError, TOnAddedTransceiver } from './types';
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

type TAnswerToIncomingCall = (
  getIncomingRTCSession: () => RTCSession,
  removeIncomingSession: () => void,
  parameters: TParametersAnswerToIncomingCall,
) => Promise<RTCPeerConnection>;

type TSendDTMF = (tone: number | string) => Promise<void>;

type THangUp = () => Promise<void>;

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

  private isPendingAnswer = false;

  public constructor() {
    this.sessionEvents = new Events<typeof SESSION_EVENT_NAMES>(SESSION_EVENT_NAMES);

    this.onSession(FAILED, this.handleEnded);
    this.onSession(ENDED, this.handleEnded);
  }

  public get connection(): RTCPeerConnection | undefined {
    const connection = this.rtcSession?.connection;

    return connection;
  }

  public get requested() {
    return this.isPendingAnswer;
  }

  public get establishedRTCSession(): RTCSession | undefined {
    return this.rtcSession?.isEstablished() === true ? this.rtcSession : undefined;
  }

  public get isPendingPresentation(): boolean {
    return !!this.promisePendingStartPresentation || !!this.promisePendingStopPresentation;
  }

  public hangUp: THangUp = async () => {
    const { rtcSession } = this;

    if (rtcSession) {
      if (this.streamPresentationCurrent) {
        try {
          await this.stopPresentation();
        } catch (error) {
          logger('error stop presentation: ', error);
        }
      }

      this.resetSession();

      if (!rtcSession.isEnded()) {
        return rtcSession.terminateAsync({
          cause: CANCELED,
        });
      }
    }

    return undefined;
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

  private readonly resetSession: () => void = () => {
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

  private readonly handleEnded = (error: TCustomError) => {
    const { originator } = error;

    if (originator === Originator.REMOTE) {
      this.sessionEvents.trigger(ENDED_FROM_SERVER, error);
    }

    this.resetSession();
  };
}
