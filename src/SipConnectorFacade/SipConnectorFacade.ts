import { isCanceledError } from '@krivega/cancelable-promise';
import type { UA } from '@krivega/jssip';
import { hasCanceledError } from 'repeated-calls';
import { debounce } from 'ts-debounce';
import {
  PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS,
  PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS,
} from '../constants';
import log from '../logger';
import type SipConnector from '../SipConnector';
import generateSimulcastEncodings from '../tools/generateSimulcastEncodings';
import hasPurgatory from '../tools/hasPurgatory';
import resolveUpdateTransceiver from '../tools/resolveUpdateTransceiver';
import type { EUseLicense, TContentHint, TSimulcastEncodings } from '../types';

const handleError = (error: Error): { isSuccessful: boolean } => {
  if (!isCanceledError(error) && !hasCanceledError(error)) {
    throw error;
  }

  return { isSuccessful: false };
};
const hasVideoTrackReady = ({ kind, readyState }: MediaStreamTrack) => {
  return kind === 'video' && readyState === 'live';
};

class SipConnectorFacade {
  private readonly sipConnector: SipConnector;

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
    this.sipConnector = sipConnector;

    this.preferredMimeTypesVideoCodecs = preferredMimeTypesVideoCodecs;
    this.excludeMimeTypesVideoCodecs = excludeMimeTypesVideoCodecs;
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
    simulcastEncodings?: TSimulcastEncodings;
    degradationPreference?: RTCDegradationPreference;
    sendEncodings?: RTCRtpEncodingParameters[];
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
      onReadyRemoteStreams: handleReadyRemoteStreamsDebounced,
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
      handleReadyRemoteStreamsDebounced();

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
    simulcastEncodings?: TSimulcastEncodings;
    degradationPreference?: RTCDegradationPreference;
    sendEncodings?: RTCRtpEncodingParameters[];
    setRemoteStreams: (streams: MediaStream[]) => void;
    onBeforeProgressCall?: (conference?: string) => void;
    onSuccessProgressCall?: (parameters_: { isPurgatory: boolean }) => void;
    onFailProgressCall?: () => void;
    onFinishProgressCall?: () => void;
    onEnterPurgatory?: () => void;
    onEnterConference?: (parameters_: { isSuccessProgressCall: boolean }) => void;
    onEndedCall?: () => void;
  }): Promise<RTCPeerConnection | void> => {
    const {
      mediaStream,
      extraHeaders,
      iceServers,
      contentHint,
      simulcastEncodings,
      degradationPreference,
      sendEncodings,
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
      onReadyRemoteStreams: handleReadyRemoteStreamsDebounced,
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
      handleReadyRemoteStreamsDebounced();

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
    simulcastEncodings?: TSimulcastEncodings;
    degradationPreference?: RTCDegradationPreference;
    sendEncodings?: RTCRtpEncodingParameters[];
    preferredMimeTypesVideoCodecs?: string[];
    excludeMimeTypesVideoCodecs?: string[];
  }): Promise<MediaStream | void> => {
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
      simulcastEncodings?: TSimulcastEncodings;
      degradationPreference?: RTCDegradationPreference;
      sendEncodings?: RTCRtpEncodingParameters[];
      preferredMimeTypesVideoCodecs?: string[];
      excludeMimeTypesVideoCodecs?: string[];
    },
    options?: { callLimit: number },
  ): Promise<MediaStream | void> => {
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

    return this.sipConnector.sendRefusalToTurnOnMic().catch((error: unknown) => {
      log('sendRefusalToTurnOnMic: error', error);
    });
  };

  public sendRefusalToTurnOnCam = async (): Promise<void> => {
    if (!this.sipConnector.isCallActive) {
      return;
    }

    log('sendRefusalToTurnOnCam');

    return this.sipConnector.sendRefusalToTurnOnCam().catch((error: unknown) => {
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

    return this.sipConnector.sendMediaState({ cam: isEnabledCam, mic: isEnabledMic });
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
      simulcastEncodings?: TSimulcastEncodings;
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

    return this.sipConnector.askPermissionToEnableCam();
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
