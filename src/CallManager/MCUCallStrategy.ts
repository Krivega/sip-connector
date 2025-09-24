import prepareMediaStream from '@/tools/prepareMediaStream';
import { hasVideoTracks } from '@/utils/utils';
import { AbstractCallStrategy } from './AbstractCallStrategy';
import { ECallCause } from './causes';
import { EEvent, SESSION_JSSIP_EVENT_NAMES } from './eventNames';
import { RemoteStreamsManager } from './RemoteStreamsManager';

import type { RTCSession, EndEvent } from '@krivega/jssip';
import type { TEvents } from './eventNames';
import type { ICallStrategy, TOntrack } from './types';

export class MCUCallStrategy extends AbstractCallStrategy {
  private readonly remoteStreamsManager = new RemoteStreamsManager();

  private readonly disposers = new Set<() => void>();

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

  public get isCallActive(): boolean {
    return this.rtcSession?.isEstablished() === true;
  }

  public get establishedRTCSession(): RTCSession | undefined {
    return this.rtcSession?.isEstablished() === true ? this.rtcSession : undefined;
  }

  public startCall: ICallStrategy['startCall'] = async (
    ua,
    getSipServerUrl,
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
      degradationPreference,
      sendEncodings,
      onAddedTransceiver,
    },
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
        mediaStream: prepareMediaStream(mediaStream, {
          directionVideo,
          directionAudio,
          contentHint,
        }),
        pcConfig: {
          iceServers,
        },
        rtcOfferConstraints: {
          offerToReceiveAudio,
          offerToReceiveVideo,
        },
        // необходимо передавать в методе call, чтобы подписаться на события peerconnection,
        // так как в методе call создается RTCSession
        // и после создания нет возможности подписаться на события peerconnection через subscribeToSessionEvents
        eventHandlers: this.events.triggers,
        extraHeaders,
        directionVideo,
        directionAudio,
        degradationPreference,
        sendEncodings,
        onAddedTransceiver,
      });
    }).finally(() => {
      this.isPendingCall = false;
    });
  };

  public async endCall(): Promise<void> {
    const { rtcSession } = this;

    if (rtcSession && !rtcSession.isEnded()) {
      return rtcSession
        .terminateAsync({
          cause: ECallCause.CANCELED,
        })
        .finally(() => {
          this.reset();
        });
    }

    this.reset();

    return undefined;
  }

  public answerToIncomingCall: ICallStrategy['answerToIncomingCall'] = async (
    extractIncomingRTCSession: () => RTCSession,
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
      degradationPreference,
      sendEncodings,
      onAddedTransceiver,
    },
  ): Promise<RTCPeerConnection> => {
    this.isPendingAnswer = true;

    return new Promise<RTCPeerConnection>((resolve, reject) => {
      try {
        const rtcSession = extractIncomingRTCSession();

        this.rtcSession = rtcSession;

        this.subscribeToSessionEvents(rtcSession);

        this.callConfiguration.answer = true;
        this.callConfiguration.number = rtcSession.remote_identity.uri.user;
        this.handleCall({ ontrack })
          .then(resolve)
          .catch((error: unknown) => {
            reject(error as Error);
          });

        rtcSession.answer({
          pcConfig: {
            iceServers,
          },
          rtcOfferConstraints: {
            offerToReceiveAudio,
            offerToReceiveVideo,
          },
          mediaStream: prepareMediaStream(mediaStream, {
            directionVideo,
            directionAudio,
            contentHint,
          }),
          extraHeaders,
          directionVideo,
          directionAudio,
          degradationPreference,
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

  public async restartIce(options?: {
    useUpdate?: boolean;
    extraHeaders?: string[];
    rtcOfferConstraints?: RTCOfferOptions;
    sendEncodings?: RTCRtpEncodingParameters[];
    degradationPreference?: RTCDegradationPreference;
  }): Promise<boolean> {
    if (!this.rtcSession) {
      throw new Error('No rtcSession established');
    }

    return this.rtcSession.restartIce(options);
  }

  public async addTransceiver(
    kind: 'audio' | 'video',
    options?: RTCRtpTransceiverInit,
  ): Promise<RTCRtpTransceiver> {
    if (!this.rtcSession) {
      throw new Error('No rtcSession established');
    }

    return this.rtcSession.addTransceiver(kind, options);
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
      const handleEnded = (error: EndEvent) => {
        removeStartedEventListeners();
        removeEndedEventListeners();
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(error);
      };

      let savedPeerconnection: RTCPeerConnection | undefined;

      const handlePeerConnection = ({ peerconnection }: { peerconnection: RTCPeerConnection }) => {
        savedPeerconnection = peerconnection;

        const handleTrack = (event: RTCTrackEvent) => {
          this.events.trigger(EEvent.PEER_CONNECTION_ONTRACK, event);

          if (ontrack) {
            ontrack(event);
          }
        };

        peerconnection.addEventListener('track', handleTrack);

        this.disposers.add(() => {
          peerconnection.removeEventListener('track', handleTrack);
        });
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
        this.disposers.add(() => {
          rtcSession.off(sessionJsSipEvent, trigger);
        });
      }
    });
  }

  private unsubscribeFromSessionEvents() {
    this.disposers.forEach((disposer) => {
      disposer();
    });
    this.disposers.clear();
  }

  private readonly handleEnded = (event: EndEvent) => {
    const { originator } = event;

    if (originator === 'remote') {
      this.events.trigger(EEvent.ENDED_FROM_SERVER, event);
    }

    this.reset();
  };

  private readonly reset: () => void = () => {
    delete this.rtcSession;
    this.remoteStreamsManager.reset();
    this.unsubscribeFromSessionEvents();
    this.callConfiguration.number = undefined;
    this.callConfiguration.answer = false;
  };
}
