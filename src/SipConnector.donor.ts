import { isCanceledError } from '@krivega/cancelable-promise';
import type { RTCSession } from '@krivega/jssip';
import Events from 'events-constructor';
import { hasVideoTracks } from '../utils';
import { BYE, CANCELED, REJECTED, REQUEST_TIMEOUT } from './causes';
import {
  CONFIRMED,
  ENDED,
  ENDED_FROM_SERVER,
  FAILED,
  Originator,
  PEER_CONNECTION,
  PEER_CONNECTION_CONFIRMED,
  PEER_CONNECTION_ONTRACK,
} from './constants';
import type { TEventSession } from './eventNames';
import { SESSION_EVENT_NAMES, SESSION_JSSIP_EVENT_NAMES } from './eventNames';
import logger from './logger';
import prepareMediaStream from './tools/prepareMediaStream';
import type { TContentHint, TCustomError, TOnAddedTransceiver } from './types';

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

type THangUp = () => Promise<void>;

export default class SipConnector {
  public rtcSession?: RTCSession;

  private readonly callConfiguration: {
    answer?: boolean;
    number?: string;
  } = {};

  private remoteStreams: Record<string, MediaStream> = {};

  private readonly sessionEvents: Events<typeof SESSION_EVENT_NAMES>;

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
