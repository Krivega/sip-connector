/* eslint-disable unicorn/filename-case */
import type { RTCSession } from '@krivega/jssip';
import { hasVideoTracks } from '../../utils';
import prepareMediaStream from '../tools/prepareMediaStream';
import { AbstractCallStrategy } from './AbstractCallStrategy';
import { ECallCause } from './causes';
import { EEvent, Originator, SESSION_JSSIP_EVENT_NAMES } from './eventNames';
import { RemoteStreamsManager } from './RemoteStreamsManager';
import type { ICallStrategy, TCustomError, TEvents, TOntrack } from './types';

export class MCUCallStrategy extends AbstractCallStrategy {
  private readonly remoteStreamsManager = new RemoteStreamsManager();

  public constructor(events: TEvents) {
    super(events);

    events.on(EEvent.FAILED, this.handleEnded);
    events.on(EEvent.ENDED, this.handleEnded);
  }

  public get requested() {
    return this.isPendingCall || this.isPendingAnswer;
  }

  public get connection(): RTCPeerConnection | undefined {
    const connection = this.rtcSession?.connection;

    return connection;
  }

  public get establishedRTCSession(): RTCSession | undefined {
    return this.rtcSession?.isEstablished() === true ? this.rtcSession : undefined;
  }

  public startCall: ICallStrategy['startCall'] = async (
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
    ua,
    getSipServerUrl,
  ) => {
    this.isPendingCall = true;

    return new Promise<RTCPeerConnection>((resolve, reject) => {
      this.callConfiguration.number = number;
      this.callConfiguration.answer = false;
      this.handleCall({ ontrack })
        .then(resolve)
        .catch((error: unknown) => {
          reject(error as Error);
        });

      this.rtcSession = ua.call(getSipServerUrl(number), {
        extraHeaders,
        mediaStream: prepareMediaStream(mediaStream, {
          directionVideo,
          directionAudio,
          contentHint,
        }),
        eventHandlers: this.events.triggers,
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

      this.subscribeToSessionEvents(this.rtcSession);
    }).finally(() => {
      this.isPendingCall = false;
    });
  };

  public async endCall(): Promise<void> {
    const { rtcSession } = this;

    if (rtcSession) {
      this.reset();

      if (!rtcSession.isEnded()) {
        return rtcSession.terminateAsync({
          cause: ECallCause.CANCELED,
        });
      }
    }

    return undefined;
  }

  public answerIncomingCall: ICallStrategy['answerIncomingCall'] = async (
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

        this.subscribeToSessionEvents(rtcSession);

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

  public getEstablishedRTCSession(): RTCSession | undefined {
    return this.rtcSession?.isEstablished() === true ? this.rtcSession : undefined;
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
      return this.remoteStreamsManager.generateStreams(remoteTracks);
    }

    return this.remoteStreamsManager.generateAudioStreams(remoteTracks);
  }

  public async replaceMediaStream(
    mediaStream: Parameters<ICallStrategy['replaceMediaStream']>[0],
    options?: Parameters<ICallStrategy['replaceMediaStream']>[1],
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

  protected readonly handleCall = async ({
    ontrack,
  }: {
    ontrack?: TOntrack;
  }): Promise<RTCPeerConnection> => {
    return new Promise((resolve, reject) => {
      const addStartedEventListeners = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.on(EEvent.PEER_CONNECTION, handlePeerConnection);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.on(EEvent.CONFIRMED, handleConfirmed);
      };
      const removeStartedEventListeners = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.off(EEvent.PEER_CONNECTION, handlePeerConnection);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.off(EEvent.CONFIRMED, handleConfirmed);
      };
      const addEndedEventListeners = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.on(EEvent.FAILED, handleEnded);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.on(EEvent.ENDED, handleEnded);
      };
      const removeEndedEventListeners = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.off(EEvent.FAILED, handleEnded);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.off(EEvent.ENDED, handleEnded);
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
          this.events.trigger(EEvent.PEER_CONNECTION_ONTRACK, savedPeerconnection);

          if (ontrack) {
            ontrack(track);
          }
        };
      };
      const handleConfirmed = () => {
        if (savedPeerconnection !== undefined) {
          this.events.trigger(EEvent.PEER_CONNECTION_CONFIRMED, savedPeerconnection);
        }

        removeStartedEventListeners();
        removeEndedEventListeners();
        resolve(savedPeerconnection as unknown as RTCPeerConnection);
      };

      addStartedEventListeners();
      addEndedEventListeners();
    });
  };

  private subscribeToSessionEvents(rtcSession: RTCSession) {
    this.events.eachTriggers((trigger, eventName) => {
      const sessionJsSipEvent = SESSION_JSSIP_EVENT_NAMES.find((jsSipEvent) => {
        return jsSipEvent === eventName;
      });

      if (sessionJsSipEvent) {
        rtcSession.on(sessionJsSipEvent, trigger);
      }
    });
  }

  private readonly handleEnded = (error: TCustomError) => {
    const { originator } = error;

    if (originator === Originator.REMOTE) {
      this.events.trigger(EEvent.ENDED_FROM_SERVER, error);
    }

    this.reset();
  };

  private readonly reset: () => void = () => {
    delete this.rtcSession;
    this.remoteStreamsManager.reset();
  };
}
