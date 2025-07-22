/* eslint-disable unicorn/filename-case */
import type { RTCSession } from '@krivega/jssip';
import prepareMediaStream from '../tools/prepareMediaStream';
import { AbstractCallStrategy } from './AbstractCallStrategy';
import { ECallCause } from './causes';
import { EEvent, Originator } from './eventNames';
import type { ICallStrategy, TCustomError, TEvents, TOntrack } from './types';

export class MCUCallStrategy extends AbstractCallStrategy {
  public constructor(events: TEvents) {
    super(events);

    events.on(EEvent.SHARE_STATE, this.handleShareState);
    events.on(EEvent.NEW_INFO, this.handleNewInfo);
    events.on(EEvent.FAILED, this.handleEnded);
    events.on(EEvent.ENDED, this.handleEnded);
  }

  public get requested() {
    return this.isPendingCall;
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
    }).finally(() => {
      this.isPendingCall = false;
    });
  };

  public async endCall(): Promise<void> {
    const { rtcSession } = this;

    if (rtcSession) {
      // if (this.streamPresentationCurrent) {
      //   try {
      //     await this.stopPresentation();
      //   } catch (error) {
      //     logger('error stop presentation: ', error);
      //   }
      // }

      this.resetSession();

      if (!rtcSession.isEnded()) {
        return rtcSession.terminateAsync({
          cause: ECallCause.CANCELED,
        });
      }
    }

    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  public async answerIncomingCall(localStream: MediaStream): Promise<void> {
    console.log('MCUCallStrategy.answerIncomingCall', localStream);
    // TODO: Реализация ответа на входящий звонок MCU
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

  private readonly resetSession: () => void = () => {
    // this.cancelRequestsAndResetPresentation();

    delete this.rtcSession;
    this.remoteStreams = {};
  };

  private readonly handleEnded = (error: TCustomError) => {
    const { originator } = error;

    if (originator === Originator.REMOTE) {
      this.events.trigger(EEvent.ENDED_FROM_SERVER, error);
    }

    this.resetSession();
  };
}
