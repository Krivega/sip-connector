import resolveDebug from '@/logger';
import { prepareMediaStream } from '@/tools';
import BitrateStateManager from './BitrateStateManager';
import { ECallCause } from './causes';
import { SESSION_JSSIP_EVENT_NAMES } from './events';

import type { EndEvent, RTCSession, RenegotiateOptions } from '@krivega/jssip';
import type { TEvents } from './events';
import type { IMCUSession } from './types';

export type TRestartIceOptions = RenegotiateOptions;

const debug = resolveDebug('MCUSession');

export class MCUSession implements IMCUSession {
  protected readonly events: TEvents;

  protected rtcSession?: RTCSession;

  private readonly disposers = new Set<() => void>();

  private pcConfig?: { iceServers?: RTCIceServer[] };

  // Менеджер состояния битрейта
  private readonly bitrateStateManager = new BitrateStateManager();

  public constructor(events: TEvents) {
    this.events = events;
    events.on('failed', this.handleEnded);
    events.on('ended', this.handleEnded);
  }

  public get connection(): RTCPeerConnection | undefined {
    const connection = this.rtcSession?.connection;

    return connection;
  }

  public get isCallActive(): boolean {
    return this.rtcSession?.isEstablished() === true;
  }

  public getEstablishedRTCSession = (): RTCSession | undefined => {
    return this.rtcSession?.isEstablished() === true ? this.rtcSession : undefined;
  };

  public getPcConfig(): { iceServers?: RTCIceServer[] } | undefined {
    return this.pcConfig;
  }

  public async renegotiate(): Promise<boolean> {
    if (this.rtcSession === undefined) {
      throw new Error('No rtcSession established');
    }

    return this.rtcSession.renegotiate();
  }

  public startCall: IMCUSession['startCall'] = async (
    ua,
    getUri,
    {
      number,
      mediaStream,
      extraHeaders = [],
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
    return new Promise<RTCPeerConnection>((resolve, reject) => {
      this.handleCall()
        .then(resolve)
        .catch((error: unknown) => {
          reject(error as Error);
        });

      this.pcConfig = { iceServers };
      this.rtcSession = ua.call(getUri(number), {
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
    });
  };

  public async endCall(): Promise<void> {
    const { rtcSession } = this;

    if (rtcSession && !rtcSession.isEnded()) {
      return rtcSession.terminateAsync({
        cause: ECallCause.CANCELED,
      });
    }

    return undefined;
  }

  public answerToIncomingCall: IMCUSession['answerToIncomingCall'] = async (
    rtcSession: RTCSession,
    {
      mediaStream,
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
    return new Promise<RTCPeerConnection>((resolve, reject) => {
      try {
        this.rtcSession = rtcSession;

        this.subscribeToSessionEvents(rtcSession);
        this.handleCall()
          .then(resolve)
          .catch((error: unknown) => {
            reject(error as Error);
          });

        this.pcConfig = { iceServers };
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
    });
  };

  public async replaceMediaStream(
    mediaStream: Parameters<IMCUSession['replaceMediaStream']>[0],
    options?: Parameters<IMCUSession['replaceMediaStream']>[1],
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

  public async restartIce(options?: TRestartIceOptions): Promise<boolean> {
    if (!this.rtcSession) {
      throw new Error('No rtcSession established');
    }

    return this.rtcSession.restartIce(options);
  }

  /**
   * Устанавливает минимальный битрейт для указанных типов потоков
   * @param kinds - типы потоков ('audio' | 'video' | 'all')
   */
  public setMinBitrateForSenders(kinds: 'audio' | 'video' | 'all' = 'all'): void {
    this.bitrateStateManager
      .setMinBitrateForSenders(this.connection, kinds)
      .catch((error: unknown) => {
        debug('setMinBitrateForSenders', error as Error);
      });
  }

  /**
   * Восстанавливает предыдущий битрейт для указанных типов потоков
   * @param kinds - типы потоков ('audio' | 'video' | 'all')
   */
  public restoreBitrateForSenders(kinds: 'audio' | 'video' | 'all' = 'all'): void {
    this.bitrateStateManager
      .restoreBitrateForSenders(this.connection, kinds)
      .catch((error: unknown) => {
        debug('restoreBitrateForSenders', error as Error);
      });
  }

  public readonly reset: () => void = () => {
    delete this.rtcSession;
    delete this.pcConfig;
    this.unsubscribeFromSessionEvents();
    this.bitrateStateManager.clearAll();
  };

  private readonly handleCall = async (): Promise<RTCPeerConnection> => {
    return new Promise((resolve, reject) => {
      const addStartedEventListeners = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.on('peerconnection', handlePeerConnection);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.on('confirmed', handleConfirmed);
      };
      const removeStartedEventListeners = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.off('peerconnection', handlePeerConnection);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.off('confirmed', handleConfirmed);
      };
      const addEndedEventListeners = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.on('failed', handleEnded);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.on('ended', handleEnded);
      };
      const removeEndedEventListeners = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.off('failed', handleEnded);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.events.off('ended', handleEnded);
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
          this.events.trigger('peerconnection:ontrack', event);
        };

        peerconnection.addEventListener('track', handleTrack);

        this.disposers.add(() => {
          peerconnection.removeEventListener('track', handleTrack);
        });
      };
      const handleConfirmed = () => {
        if (savedPeerconnection !== undefined) {
          this.events.trigger('peerconnection:confirmed', savedPeerconnection);
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
      this.events.trigger('ended:fromserver', event);
    }
  };
}
