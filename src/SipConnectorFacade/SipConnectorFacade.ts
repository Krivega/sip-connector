/* eslint-disable no-constructor-return */
import { isCanceledError } from '@krivega/cancelable-promise';
import type { UA } from '@krivega/jssip';
import { hasCanceledError } from 'repeated-calls';
import { debounce } from 'ts-debounce';
import {
  PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS,
  PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS,
} from '../constants';
import log, { debug } from '../logger';
import type SipConnector from '../SipConnector';
import generateSimulcastEncodings from '../tools/generateSimulcastEncodings';
import hasPurgatory from '../tools/hasPurgatory';
import resolveUpdateTransceiver from '../tools/resolveUpdateTransceiver';
import type { EUseLicense, TContentHint, TSimulcastEncoding } from '../types';

const handleError = (error: Error): { isSuccessful: boolean } => {
  if (!isCanceledError(error) && !hasCanceledError(error)) {
    throw error;
  }

  return { isSuccessful: false };
};
const hasVideoTrackReady = ({ kind, readyState }: MediaStreamTrack) => {
  return kind === 'video' && readyState === 'live';
};

interface IProxyMethods {
  on: SipConnector['on'];
  once: SipConnector['once'];
  onceRace: SipConnector['onceRace'];
  wait: SipConnector['wait'];
  off: SipConnector['off'];
  onSession: SipConnector['onSession'];
  onceSession: SipConnector['onceSession'];
  onceRaceSession: SipConnector['onceRaceSession'];
  waitSession: SipConnector['waitSession'];
  offSession: SipConnector['offSession'];
  sendDTMF: SipConnector['sendDTMF'];
  hangUp: SipConnector['hangUp'];
  declineToIncomingCall: SipConnector['declineToIncomingCall'];
  sendChannels: SipConnector['sendChannels'];
  checkTelephony: SipConnector['checkTelephony'];
  waitChannels: SipConnector['waitChannels'];
  ping: SipConnector['ping'];
  connection: SipConnector['connection'];
  isConfigured: SipConnector['isConfigured'];
  isRegistered: SipConnector['isRegistered'];
}

const proxyMethods = new Set<keyof IProxyMethods>([
  'on',
  'once',
  'onceRace',
  'wait',
  'off',
  'onSession',
  'onceSession',
  'onceRaceSession',
  'waitSession',
  'offSession',
  'sendDTMF',
  'hangUp',
  'declineToIncomingCall',
  'sendChannels',
  'checkTelephony',
  'waitChannels',
  'ping',
  'connection',
  'isConfigured',
  'isRegistered',
]);

class SipConnectorFacade implements IProxyMethods {
  // @ts-expect-error: proxy method
  public on: IProxyMethods['on'];

  // @ts-expect-error: proxy method
  public once: IProxyMethods['once'];

  // @ts-expect-error: proxy method
  public onceRace: IProxyMethods['onceRace'];

  // @ts-expect-error: proxy method
  public wait: IProxyMethods['wait'];

  // @ts-expect-error: proxy method
  public off: IProxyMethods['off'];

  // @ts-expect-error: proxy method
  public onSession: IProxyMethods['onSession'];

  // @ts-expect-error: proxy method
  public onceSession: IProxyMethods['onceSession'];

  // @ts-expect-error: proxy method
  public onceRaceSession: IProxyMethods['onceRaceSession'];

  // @ts-expect-error: proxy method
  public waitSession: IProxyMethods['waitSession'];

  // @ts-expect-error: proxy method
  public offSession: IProxyMethods['offSession'];

  // @ts-expect-error: proxy method
  public sendDTMF: IProxyMethods['sendDTMF'];

  // @ts-expect-error: proxy method
  public hangUp: IProxyMethods['hangUp'];

  // @ts-expect-error: proxy method
  public declineToIncomingCall: IProxyMethods['declineToIncomingCall'];

  // @ts-expect-error: proxy method
  public sendChannels: IProxyMethods['sendChannels'];

  // @ts-expect-error: proxy method
  public checkTelephony: IProxyMethods['checkTelephony'];

  // @ts-expect-error: proxy method
  public waitChannels: IProxyMethods['waitChannels'];

  // @ts-expect-error: proxy method
  public ping: IProxyMethods['ping'];

  //  proxy method
  public connection: IProxyMethods['connection'];

  // @ts-expect-error: proxy method
  public isConfigured: IProxyMethods['isConfigured'];

  // @ts-expect-error: proxy method
  public isRegistered: IProxyMethods['isRegistered'];

  public readonly sipConnector: SipConnector;

  private readonly preferredMimeTypesVideoCodecs?: string[];

  private readonly excludeMimeTypesVideoCodecs?: string[];

  public constructor(
    sipConnector: SipConnector,
    {
      preferredMimeTypesVideoCodecs,
      excludeMimeTypesVideoCodecs,
    }: {
      preferredMimeTypesVideoCodecs?: string[];
      excludeMimeTypesVideoCodecs?: string[];
    } = {},
  ) {
    this.preferredMimeTypesVideoCodecs = preferredMimeTypesVideoCodecs;
    this.excludeMimeTypesVideoCodecs = excludeMimeTypesVideoCodecs;

    this.sipConnector = sipConnector;

    return new Proxy(this, {
      get: (target, property, receiver) => {
        if (
          typeof property === 'string' &&
          proxyMethods.has(property as keyof IProxyMethods) &&
          property in this.sipConnector
        ) {
          const value = Reflect.get(this.sipConnector, property, this.sipConnector) as unknown;

          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return typeof value === 'function' ? value.bind(this.sipConnector) : value;
        }

        const value = Reflect.get(target, property, receiver) as unknown;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  public connectToServer = async (parameters: {
    userAgent: string;
    sipWebSocketServerURL: string;
    sipServerUrl: string;
    remoteAddress?: string;
    displayName?: string;
    name?: string;
    password?: string;
    isRegisteredUser?: boolean;
    isDisconnectOnFail?: boolean;
  }): Promise<{ ua?: UA; isSuccessful: boolean }> => {
    const {
      userAgent,
      sipWebSocketServerURL,
      sipServerUrl,
      remoteAddress,
      displayName,
      name,
      password,
      isRegisteredUser,
      isDisconnectOnFail,
    } = parameters;

    log('connectToServer', parameters);

    return this.sipConnector
      .connect({
        userAgent,
        sipWebSocketServerURL,
        sipServerUrl,
        remoteAddress,
        displayName,
        password,
        user: name,
        register: isRegisteredUser,
      })
      .then((ua) => {
        log('connectToServer then');

        return { ua, isSuccessful: true };
      })
      .catch(async (error: unknown) => {
        log('connectToServer catch: error', error);

        if (isDisconnectOnFail === true) {
          return this.sipConnector
            .disconnect()
            .then(() => {
              return handleError(error as Error);
            })
            .catch(() => {
              return handleError(error as Error);
            });
        }

        return handleError(error as Error);
      });
  };

  public callToServer = async (parameters: {
    conference: string;
    mediaStream: MediaStream;
    extraHeaders?: string[] | undefined;
    iceServers?: RTCIceServer[];
    contentHint?: TContentHint;
    simulcastEncodings?: TSimulcastEncoding[];
    degradationPreference?: RTCDegradationPreference;
    sendEncodings?: RTCRtpEncodingParameters[];
    offerToReceiveAudio?: boolean;
    offerToReceiveVideo?: boolean;
    directionVideo?: RTCRtpTransceiverDirection;
    directionAudio?: RTCRtpTransceiverDirection;
    setRemoteStreams: (streams: MediaStream[]) => void;
    onBeforeProgressCall?: (conference: string) => void;
    onSuccessProgressCall?: (parameters_: { isPurgatory: boolean }) => void;
    onEnterPurgatory?: () => void;
    onEnterConference?: (parameters_: { isSuccessProgressCall: boolean }) => void;
    onFailProgressCall?: () => void;
    onFinishProgressCall?: () => void;
    onEndedCall?: () => void;
  }): Promise<RTCPeerConnection> => {
    const {
      conference,
      mediaStream,
      extraHeaders,
      iceServers,
      contentHint,
      simulcastEncodings,
      degradationPreference,
      sendEncodings,
      offerToReceiveAudio,
      offerToReceiveVideo,
      directionVideo,
      directionAudio,
      setRemoteStreams,
      onBeforeProgressCall,
      onSuccessProgressCall,
      onEnterPurgatory,
      onEnterConference,
      onFailProgressCall,
      onFinishProgressCall,
      onEndedCall,
    } = parameters;
    const handleReadyRemoteStreamsDebounced = this.resolveHandleReadyRemoteStreamsDebounced({
      onReadyRemoteStreams: setRemoteStreams,
    });
    const handleReadyRemoteStreams = this.resolveHandleReadyRemoteStreams({
      onReadyRemoteStreams: () => {
        handleReadyRemoteStreamsDebounced().catch(debug);
      },
    });
    const updateTransceiver = resolveUpdateTransceiver(
      {
        degradationPreference,
      },
      {
        preferredMimeTypesVideoCodecs: this.preferredMimeTypesVideoCodecs,
        excludeMimeTypesVideoCodecs: this.excludeMimeTypesVideoCodecs,
      },
    );

    log('callToServer', parameters);

    const startCall = async (): Promise<RTCPeerConnection> => {
      log('startCall');

      return this.sipConnector.call({
        mediaStream,
        extraHeaders,
        iceServers,
        contentHint,
        offerToReceiveAudio,
        offerToReceiveVideo,
        directionVideo,
        directionAudio,
        sendEncodings: generateSimulcastEncodings({
          mediaStream,
          simulcastEncodings,
          sendEncodings,
        }),
        number: conference,
        onAddedTransceiver: updateTransceiver,
        ontrack: handleReadyRemoteStreams,
      });
    };
    let isSuccessProgressCall = false;
    let room: string;

    const subscribeEnterConference = () => {
      log('subscribeEnterConference: onEnterConference', onEnterConference);

      if (onEnterPurgatory ?? onEnterConference) {
        return this.sipConnector.onSession('enterRoom', ({ room: _room }: { room: string }) => {
          log('enterRoom', { _room, isSuccessProgressCall });

          room = _room;

          if (hasPurgatory(room)) {
            if (onEnterPurgatory) {
              onEnterPurgatory();
            }
          } else if (onEnterConference) {
            onEnterConference({ isSuccessProgressCall });
          }
        });
      }

      return () => {};
    };

    const unsubscribeEnterConference = subscribeEnterConference();

    const onSuccess = (peerConnection: RTCPeerConnection): RTCPeerConnection => {
      log('onSuccess');

      isSuccessProgressCall = true;
      handleReadyRemoteStreamsDebounced().catch(debug);

      if (onSuccessProgressCall) {
        onSuccessProgressCall({ isPurgatory: hasPurgatory(room) });
      }

      this.sipConnector.onceRaceSession(['ended', 'failed'], () => {
        unsubscribeEnterConference();

        if (onEndedCall) {
          onEndedCall();
        }
      });

      return peerConnection;
    };

    const onFail = (error: Error): never => {
      log('onFail');

      if (onFailProgressCall) {
        onFailProgressCall();
      }

      unsubscribeEnterConference();

      throw error;
    };

    const onFinish = () => {
      log('onFinish');

      if (onFinishProgressCall) {
        onFinishProgressCall();
      }
    };

    log('onBeforeProgressCall');

    if (onBeforeProgressCall) {
      onBeforeProgressCall(conference);
    }

    return startCall()
      .then(onSuccess)
      .catch((error: unknown) => {
        return onFail(error as Error);
      })
      .finally(onFinish);
  };

  public disconnectFromServer = async (): Promise<{ isSuccessful: boolean }> => {
    return this.sipConnector
      .disconnect()
      .then(() => {
        log('disconnectFromServer: then');

        return { isSuccessful: true };
      })
      .catch((error: unknown) => {
        log('disconnectFromServer: catch', error);

        return { isSuccessful: false };
      });
  };

  public answerIncomingCall = async (parameters: {
    mediaStream: MediaStream;
    extraHeaders?: string[] | undefined;
    iceServers?: RTCIceServer[];
    contentHint?: TContentHint;
    simulcastEncodings?: TSimulcastEncoding[];
    degradationPreference?: RTCDegradationPreference;
    sendEncodings?: RTCRtpEncodingParameters[];
    offerToReceiveAudio?: boolean;
    offerToReceiveVideo?: boolean;
    directionVideo?: RTCRtpTransceiverDirection;
    directionAudio?: RTCRtpTransceiverDirection;
    setRemoteStreams: (streams: MediaStream[]) => void;
    onBeforeProgressCall?: (conference?: string) => void;
    onSuccessProgressCall?: (parameters_: { isPurgatory: boolean }) => void;
    onFailProgressCall?: () => void;
    onFinishProgressCall?: () => void;
    onEnterPurgatory?: () => void;
    onEnterConference?: (parameters_: { isSuccessProgressCall: boolean }) => void;
    onEndedCall?: () => void;
  }): Promise<RTCPeerConnection | undefined> => {
    const {
      mediaStream,
      extraHeaders,
      iceServers,
      contentHint,
      simulcastEncodings,
      degradationPreference,
      sendEncodings,
      offerToReceiveAudio,
      offerToReceiveVideo,
      directionVideo,
      directionAudio,
      setRemoteStreams,
      onBeforeProgressCall,
      onSuccessProgressCall,
      onEnterPurgatory,
      onEnterConference,
      onFailProgressCall,
      onFinishProgressCall,
      onEndedCall,
    } = parameters;
    const handleReadyRemoteStreamsDebounced = this.resolveHandleReadyRemoteStreamsDebounced({
      onReadyRemoteStreams: setRemoteStreams,
    });
    const handleReadyRemoteStreams = this.resolveHandleReadyRemoteStreams({
      onReadyRemoteStreams: () => {
        handleReadyRemoteStreamsDebounced().catch(debug);
      },
    });
    const updateTransceiver = resolveUpdateTransceiver(
      {
        degradationPreference,
      },
      {
        preferredMimeTypesVideoCodecs: this.preferredMimeTypesVideoCodecs,
        excludeMimeTypesVideoCodecs: this.excludeMimeTypesVideoCodecs,
      },
    );

    log('answerIncomingCall', parameters);

    const answer = async (): Promise<RTCPeerConnection> => {
      return this.sipConnector.answerToIncomingCall({
        mediaStream,
        extraHeaders,
        iceServers,
        contentHint,
        offerToReceiveAudio,
        offerToReceiveVideo,
        directionVideo,
        directionAudio,
        sendEncodings: generateSimulcastEncodings({
          mediaStream,
          simulcastEncodings,
          sendEncodings,
        }),
        onAddedTransceiver: updateTransceiver,
        ontrack: handleReadyRemoteStreams,
      });
    };

    const getIncomingNumber = (): string | undefined => {
      const { remoteCallerData } = this.sipConnector;

      return remoteCallerData.incomingNumber;
    };
    let isSuccessProgressCall = false;
    let room: string;

    const subscribeEnterConference = () => {
      log('subscribeEnterConference: onEnterConference', onEnterConference);

      if (onEnterPurgatory ?? onEnterConference) {
        return this.sipConnector.onSession('enterRoom', (_room: string) => {
          log('enterRoom', { _room, isSuccessProgressCall });

          room = _room;

          if (hasPurgatory(room)) {
            if (onEnterPurgatory) {
              onEnterPurgatory();
            }
          } else if (onEnterConference) {
            onEnterConference({ isSuccessProgressCall });
          }
        });
      }

      return () => {};
    };

    const unsubscribeEnterConference = subscribeEnterConference();

    const onSuccess = (peerConnection: RTCPeerConnection) => {
      log('onSuccess');

      isSuccessProgressCall = true;
      handleReadyRemoteStreamsDebounced().catch(debug);

      if (onSuccessProgressCall) {
        onSuccessProgressCall({ isPurgatory: hasPurgatory(room) });
      }

      this.sipConnector.onceRaceSession(['ended', 'failed'], () => {
        unsubscribeEnterConference();

        if (onEndedCall) {
          onEndedCall();
        }
      });

      return peerConnection;
    };

    const onFail = (error: Error): never => {
      log('onFail');

      if (onFailProgressCall) {
        onFailProgressCall();
      }

      unsubscribeEnterConference();

      throw error;
    };

    const onFinish = () => {
      log('onFinish');

      if (onFinishProgressCall) {
        onFinishProgressCall();
      }
    };

    log('onBeforeProgressCall');

    if (onBeforeProgressCall) {
      const conference = getIncomingNumber();

      onBeforeProgressCall(conference);
    }

    return answer()
      .then(onSuccess)
      .catch((error: unknown) => {
        return onFail(error as Error);
      })
      .finally(onFinish);
  };

  public updatePresentation = async ({
    mediaStream,
    isP2P,
    maxBitrate,
    contentHint,
    simulcastEncodings,
    degradationPreference,
    sendEncodings,
    preferredMimeTypesVideoCodecs,
    excludeMimeTypesVideoCodecs,
  }: {
    mediaStream: MediaStream;
    isP2P: boolean;
    maxBitrate?: number;
    contentHint?: TContentHint;
    simulcastEncodings?: TSimulcastEncoding[];
    degradationPreference?: RTCDegradationPreference;
    sendEncodings?: RTCRtpEncodingParameters[];
    preferredMimeTypesVideoCodecs?: string[];
    excludeMimeTypesVideoCodecs?: string[];
  }): Promise<MediaStream | undefined> => {
    const updateTransceiver = resolveUpdateTransceiver(
      {
        degradationPreference,
      },
      {
        preferredMimeTypesVideoCodecs,
        excludeMimeTypesVideoCodecs,
      },
    );

    log('updatePresentation');

    return this.sipConnector.updatePresentation(mediaStream, {
      isP2P,
      maxBitrate,
      contentHint,
      sendEncodings: generateSimulcastEncodings({
        mediaStream,
        simulcastEncodings,
        sendEncodings,
      }),
      onAddedTransceiver: updateTransceiver,
    });
  };

  public startPresentation = async (
    {
      mediaStream,
      isP2P,
      maxBitrate,
      contentHint,
      simulcastEncodings,
      degradationPreference,
      sendEncodings,
      preferredMimeTypesVideoCodecs,
      excludeMimeTypesVideoCodecs,
    }: {
      mediaStream: MediaStream;
      isP2P: boolean;
      maxBitrate?: number;
      contentHint?: TContentHint;
      simulcastEncodings?: TSimulcastEncoding[];
      degradationPreference?: RTCDegradationPreference;
      sendEncodings?: RTCRtpEncodingParameters[];
      preferredMimeTypesVideoCodecs?: string[];
      excludeMimeTypesVideoCodecs?: string[];
    },
    options?: { callLimit: number },
  ): Promise<MediaStream | undefined> => {
    const updateTransceiver = resolveUpdateTransceiver(
      {
        degradationPreference,
      },
      {
        preferredMimeTypesVideoCodecs,
        excludeMimeTypesVideoCodecs,
      },
    );

    log('startPresentation');

    return this.sipConnector.startPresentation(
      mediaStream,
      {
        isP2P,
        maxBitrate,
        contentHint,
        sendEncodings: generateSimulcastEncodings({
          mediaStream,
          simulcastEncodings,
          sendEncodings,
        }),
        onAddedTransceiver: updateTransceiver,
      },
      options,
    );
  };

  public stopShareSipConnector = async ({ isP2P = false }: { isP2P?: boolean } = {}) => {
    log('stopShareSipConnector');

    return this.sipConnector
      .stopPresentation({
        isP2P,
      })
      .catch((error: unknown) => {
        log(error as Error);
      });
  };

  public sendRefusalToTurnOnMic = async (): Promise<void> => {
    if (!this.sipConnector.isCallActive) {
      return;
    }

    log('sendRefusalToTurnOnMic');

    await this.sipConnector.sendRefusalToTurnOnMic().catch((error: unknown) => {
      log('sendRefusalToTurnOnMic: error', error);
    });
  };

  public sendRefusalToTurnOnCam = async (): Promise<void> => {
    if (!this.sipConnector.isCallActive) {
      return;
    }

    log('sendRefusalToTurnOnCam');

    await this.sipConnector.sendRefusalToTurnOnCam().catch((error: unknown) => {
      log('sendRefusalToTurnOnCam: error', error);
    });
  };

  public sendMediaState = async ({
    isEnabledCam,
    isEnabledMic,
  }: {
    isEnabledCam: boolean;
    isEnabledMic: boolean;
  }): Promise<void> => {
    if (!this.sipConnector.isCallActive) {
      return;
    }

    log('sendMediaState');

    await this.sipConnector.sendMediaState({ cam: isEnabledCam, mic: isEnabledMic });
  };

  public replaceMediaStream = async (
    mediaStream: MediaStream,
    {
      deleteExisting,
      addMissing,
      forceRenegotiation,
      contentHint,
      simulcastEncodings,
      degradationPreference,
      sendEncodings,
    }: {
      deleteExisting?: boolean;
      addMissing?: boolean;
      forceRenegotiation?: boolean;
      contentHint?: TContentHint;
      simulcastEncodings?: TSimulcastEncoding[];
      degradationPreference?: RTCDegradationPreference;
      sendEncodings?: RTCRtpEncodingParameters[];
    } = {},
  ): Promise<void> => {
    const updateTransceiver = resolveUpdateTransceiver(
      {
        degradationPreference,
      },
      {
        preferredMimeTypesVideoCodecs: this.preferredMimeTypesVideoCodecs,
        excludeMimeTypesVideoCodecs: this.excludeMimeTypesVideoCodecs,
      },
    );

    log('replaceMediaStream');

    return this.sipConnector.replaceMediaStream(mediaStream, {
      deleteExisting,
      addMissing,
      forceRenegotiation,
      contentHint,
      sendEncodings: generateSimulcastEncodings({
        mediaStream,
        simulcastEncodings,
        sendEncodings,
      }),
      onAddedTransceiver: updateTransceiver,
    });
  };

  public askPermissionToEnableCam = async (): Promise<void> => {
    if (!this.sipConnector.isCallActive) {
      return;
    }

    log('askPermissionToEnableCam');

    await this.sipConnector.askPermissionToEnableCam();
  };

  public resolveHandleReadyRemoteStreamsDebounced = ({
    onReadyRemoteStreams,
  }: {
    onReadyRemoteStreams: (streams: MediaStream[]) => void;
  }) => {
    return debounce(() => {
      const remoteStreams = this.sipConnector.getRemoteStreams();

      log('remoteStreams', remoteStreams);

      if (remoteStreams) {
        onReadyRemoteStreams(remoteStreams);
      }
    }, 200);
  };

  // eslint-disable-next-line class-methods-use-this
  public resolveHandleReadyRemoteStreams = ({
    onReadyRemoteStreams,
  }: {
    onReadyRemoteStreams: () => void;
  }) => {
    return ({ track }: { track: MediaStreamTrack }) => {
      if (hasVideoTrackReady(track)) {
        onReadyRemoteStreams();
      }
    };
  };

  public getRemoteStreams = (): MediaStream[] | undefined => {
    log('getRemoteStreams');

    return this.sipConnector.getRemoteStreams();
  };

  public onUseLicense = (handler: (license: EUseLicense) => void): (() => void) => {
    log('onUseLicense');

    return this.sipConnector.onSession('useLicense', handler);
  };

  public onMustStopPresentation = (handler: () => void): (() => void) => {
    log('onMustStopPresentation');

    return this.sipConnector.onSession('mustStopPresentation', handler);
  };

  public onMoveToSpectators = (handler: () => void): (() => void) => {
    log('onMoveToSpectators');

    return this.sipConnector.onSession(PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS, handler);
  };

  public onMoveToParticipants = (handler: () => void): (() => void) => {
    log('onMoveToParticipants');

    return this.sipConnector.onSession(PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS, handler);
  };
}

export default SipConnectorFacade;
