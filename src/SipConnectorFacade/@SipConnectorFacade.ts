/* eslint-disable no-constructor-return */
import { isCanceledError } from '@krivega/cancelable-promise';
import { hasCanceledError } from 'repeated-calls';
import { debounce } from 'ts-debounce';

import { hasNotReadyForConnectionError } from '@/ConnectionManager';
import debug from '@/logger';
import hasPurgatory from '@/tools/hasPurgatory';

import type { EContentUseLicense } from '@/ApiManager';
import type { TOnAddedTransceiver, TRemoteStreams } from '@/CallManager';
import type { TParametersConnection, TConnectionConfiguration } from '@/ConnectionManager';
import type { TContentHint } from '@/PresentationManager';
import type { SipConnector } from '@/SipConnector';
import type { TStatsManagerEventMap } from '@/StatsManager';

const handleError = (error: Error): { configuration: undefined; isSuccessful: false } => {
  if (
    !isCanceledError(error) &&
    !hasCanceledError(error) &&
    !hasNotReadyForConnectionError(error)
  ) {
    throw error as Error;
  }

  return { configuration: undefined, isSuccessful: false };
};
const hasVideoTrackReady = ({ kind, readyState }: MediaStreamTrack) => {
  return kind === 'video' && readyState === 'live';
};

type TEnterRoomHandlers = {
  onEnterPurgatory?: () => void;
  onEnterConference?: (parameters_: { isSuccessProgressCall: boolean }) => void;
};

const handleEnterRoomEvent = (
  room: string,
  isSuccessProgressCall: boolean,
  { onEnterPurgatory, onEnterConference }: TEnterRoomHandlers,
): void => {
  if (hasPurgatory(room)) {
    if (onEnterPurgatory) {
      onEnterPurgatory();
    }
  } else if (onEnterConference) {
    onEnterConference({ isSuccessProgressCall });
  }
};

const handleOnceRaceEvent = (
  unsubscribeEnterConference: () => void,
  onEndedCall?: () => void,
): void => {
  unsubscribeEnterConference();

  if (onEndedCall) {
    onEndedCall();
  }
};

const handleFailProgressEvent = (
  onFailProgressCall: (() => void) | undefined,
  unsubscribeEnterConference: () => void,
  error: Error,
): never => {
  if (onFailProgressCall) {
    onFailProgressCall();
  }

  unsubscribeEnterConference();

  throw error;
};

// test hooks
export const TEST_HOOKS = {
  handleEnterRoomEvent,
  handleOnceRaceEvent,
  handleFailProgressEvent,
};

interface IProxyMethods {
  on: SipConnector['on'];
  once: SipConnector['once'];
  onceRace: SipConnector['onceRace'];
  wait: SipConnector['wait'];
  off: SipConnector['off'];
  sendDTMF: SipConnector['sendDTMF'];
  hangUp: SipConnector['hangUp'];
  declineToIncomingCall: SipConnector['declineToIncomingCall'];
  sendChannels: SipConnector['sendChannels'];
  checkTelephony: SipConnector['checkTelephony'];
  waitChannels: SipConnector['waitChannels'];
  ping: SipConnector['ping'];
  startAutoConnect: SipConnector['startAutoConnect'];
  stopAutoConnect: SipConnector['stopAutoConnect'];
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
  'sendDTMF',
  'hangUp',
  'declineToIncomingCall',
  'sendChannels',
  'checkTelephony',
  'waitChannels',
  'ping',
  'startAutoConnect',
  'stopAutoConnect',
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

  // @ts-expect-error: proxy method
  public startAutoConnect: IProxyMethods['startAutoConnect'];

  // @ts-expect-error: proxy method
  public stopAutoConnect: IProxyMethods['stopAutoConnect'];

  //  proxy method
  public connection: IProxyMethods['connection'];

  // @ts-expect-error: proxy method
  public isConfigured: IProxyMethods['isConfigured'];

  // @ts-expect-error: proxy method
  public isRegistered: IProxyMethods['isRegistered'];

  public readonly sipConnector: SipConnector;

  public constructor(sipConnector: SipConnector) {
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

  public connectToServer = async (
    parameters: (() => Promise<TParametersConnection>) | TParametersConnection,
    options?: {
      hasReadyForConnection?: () => boolean;
    },
  ): Promise<
    | { configuration: TConnectionConfiguration; isSuccessful: true }
    | { configuration: undefined; isSuccessful: false }
  > => {
    return this.sipConnector
      .connect(parameters, options)
      .then((connectionConfigurationWithUa) => {
        debug('connectToServer then');

        return { configuration: connectionConfigurationWithUa, isSuccessful: true } as {
          configuration: TConnectionConfiguration;
          isSuccessful: true;
        };
      })
      .catch(async (error: unknown) => {
        debug('connectToServer catch: error', error);

        return handleError(error as Error);
      });
  };

  public callToServer = async (parameters: {
    conference: string;
    mediaStream: MediaStream;
    extraHeaders?: string[] | undefined;
    iceServers?: RTCIceServer[];
    contentHint?: TContentHint;
    degradationPreference?: RTCDegradationPreference;
    sendEncodings?: RTCRtpEncodingParameters[];
    offerToReceiveAudio?: boolean;
    offerToReceiveVideo?: boolean;
    directionVideo?: RTCRtpTransceiverDirection;
    directionAudio?: RTCRtpTransceiverDirection;
    onBeforeProgressCall?: (conference: string) => void;
    onSuccessProgressCall?: (parameters_: { isPurgatory: boolean }) => void;
    onEnterPurgatory?: () => void;
    onEnterConference?: (parameters_: { isSuccessProgressCall: boolean }) => void;
    onFailProgressCall?: () => void;
    onFinishProgressCall?: () => void;
    onEndedCall?: () => void;
    onAddedTransceiver?: TOnAddedTransceiver;
  }): Promise<RTCPeerConnection> => {
    const {
      conference,
      mediaStream,
      extraHeaders,
      iceServers,
      contentHint,
      degradationPreference,
      sendEncodings,
      offerToReceiveAudio,
      offerToReceiveVideo,
      directionVideo,
      directionAudio,
      onBeforeProgressCall,
      onSuccessProgressCall,
      onEnterPurgatory,
      onEnterConference,
      onFailProgressCall,
      onFinishProgressCall,
      onEndedCall,
      onAddedTransceiver,
    } = parameters;

    debug('callToServer', parameters);

    const startCall = async (): Promise<RTCPeerConnection> => {
      debug('startCall');

      return this.sipConnector.call({
        mediaStream,
        extraHeaders,
        iceServers,
        contentHint,
        offerToReceiveAudio,
        offerToReceiveVideo,
        directionVideo,
        directionAudio,
        degradationPreference,
        onAddedTransceiver,
        sendEncodings,
        number: conference,
      });
    };
    let isSuccessProgressCall = false;
    let room: string;

    const subscribeEnterConference = () => {
      debug('subscribeEnterConference: onEnterConference', onEnterConference);

      return this.sipConnector.on('api:enter-room', ({ room: _room }: { room: string }) => {
        debug('enterRoom', { _room, isSuccessProgressCall });

        room = _room;

        if (onEnterPurgatory ?? onEnterConference) {
          handleEnterRoomEvent(room, isSuccessProgressCall, {
            onEnterPurgatory,
            onEnterConference,
          });
        }
      });
    };

    const unsubscribeEnterConference = subscribeEnterConference();

    const onSuccess = (peerConnection: RTCPeerConnection): RTCPeerConnection => {
      debug('onSuccess');

      isSuccessProgressCall = true;

      if (onSuccessProgressCall) {
        onSuccessProgressCall({ isPurgatory: hasPurgatory(room) });
      }

      this.sipConnector.onceRace(['call:ended', 'call:failed'], () => {
        handleOnceRaceEvent(unsubscribeEnterConference, onEndedCall);
      });

      return peerConnection;
    };

    const onFail = (error: Error): never => {
      debug('onFail');

      return handleFailProgressEvent(onFailProgressCall, unsubscribeEnterConference, error);
    };

    const onFinish = () => {
      debug('onFinish');

      if (onFinishProgressCall) {
        onFinishProgressCall();
      }
    };

    debug('onBeforeProgressCall');

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
        debug('disconnectFromServer: then');

        return { isSuccessful: true };
      })
      .catch((error: unknown) => {
        debug('disconnectFromServer: catch', error);

        return { isSuccessful: false };
      });
  };

  public answerToIncomingCall = async (parameters: {
    mediaStream: MediaStream;
    extraHeaders?: string[] | undefined;
    iceServers?: RTCIceServer[];
    contentHint?: TContentHint;
    degradationPreference?: RTCDegradationPreference;
    sendEncodings?: RTCRtpEncodingParameters[];
    offerToReceiveAudio?: boolean;
    offerToReceiveVideo?: boolean;
    directionVideo?: RTCRtpTransceiverDirection;
    directionAudio?: RTCRtpTransceiverDirection;
    onBeforeProgressCall?: (conference: string) => void;
    onSuccessProgressCall?: (parameters_: { isPurgatory: boolean }) => void;
    onFailProgressCall?: () => void;
    onFinishProgressCall?: () => void;
    onEnterPurgatory?: () => void;
    onEnterConference?: (parameters_: { isSuccessProgressCall: boolean }) => void;
    onEndedCall?: () => void;
    onAddedTransceiver?: TOnAddedTransceiver;
  }): Promise<RTCPeerConnection | undefined> => {
    const {
      mediaStream,
      extraHeaders,
      iceServers,
      contentHint,
      degradationPreference,
      sendEncodings,
      offerToReceiveAudio,
      offerToReceiveVideo,
      directionVideo,
      directionAudio,
      onBeforeProgressCall,
      onSuccessProgressCall,
      onEnterPurgatory,
      onEnterConference,
      onFailProgressCall,
      onFinishProgressCall,
      onEndedCall,
      onAddedTransceiver,
    } = parameters;

    debug('answerToIncomingCall', parameters);

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
        degradationPreference,
        onAddedTransceiver,
        sendEncodings,
      });
    };

    const getIncomingNumber = (): string | undefined => {
      const { remoteCallerData } = this.sipConnector;

      return remoteCallerData?.incomingNumber;
    };
    let isSuccessProgressCall = false;
    let room: string;

    const subscribeEnterConference = () => {
      debug('subscribeEnterConference: onEnterConference', onEnterConference);

      return this.sipConnector.on('api:enter-room', (event) => {
        debug('enterRoom', { room: event.room, isSuccessProgressCall });

        room = event.room;

        if (onEnterPurgatory ?? onEnterConference) {
          handleEnterRoomEvent(room, isSuccessProgressCall, {
            onEnterPurgatory,
            onEnterConference,
          });
        }
      });
    };

    const unsubscribeEnterConference = subscribeEnterConference();

    const onSuccess = (peerConnection: RTCPeerConnection) => {
      debug('onSuccess');

      isSuccessProgressCall = true;

      if (onSuccessProgressCall) {
        onSuccessProgressCall({ isPurgatory: hasPurgatory(room) });
      }

      this.sipConnector.onceRace(['call:ended', 'call:failed'], () => {
        handleOnceRaceEvent(unsubscribeEnterConference, onEndedCall);
      });

      return peerConnection;
    };

    const onFail = (error: Error): never => {
      debug('onFail');

      return handleFailProgressEvent(onFailProgressCall, unsubscribeEnterConference, error);
    };

    const onFinish = () => {
      debug('onFinish');

      if (onFinishProgressCall) {
        onFinishProgressCall();
      }
    };

    debug('onBeforeProgressCall');

    if (onBeforeProgressCall) {
      const conference = getIncomingNumber();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      onBeforeProgressCall(conference!);
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
    contentHint,
    degradationPreference,
    sendEncodings,
    onAddedTransceiver,
  }: {
    mediaStream: MediaStream;
    contentHint?: TContentHint;
    degradationPreference?: RTCDegradationPreference;
    sendEncodings?: RTCRtpEncodingParameters[];
    onAddedTransceiver?: TOnAddedTransceiver;
  }): Promise<MediaStream | undefined> => {
    debug('updatePresentation');

    return this.sipConnector.updatePresentation(mediaStream, {
      contentHint,
      degradationPreference,
      onAddedTransceiver,
      sendEncodings,
    });
  };

  public startPresentation = async ({
    mediaStream,
    contentHint,
    degradationPreference,
    sendEncodings,
    callLimit,
    onAddedTransceiver,
  }: {
    mediaStream: MediaStream;
    contentHint?: TContentHint;
    degradationPreference?: RTCDegradationPreference;
    sendEncodings?: RTCRtpEncodingParameters[];
    onAddedTransceiver?: TOnAddedTransceiver;
    callLimit?: number;
  }): Promise<MediaStream | undefined> => {
    debug('startPresentation');

    return this.sipConnector.startPresentation(mediaStream, {
      contentHint,
      callLimit,
      degradationPreference,
      onAddedTransceiver,
      sendEncodings,
    });
  };

  public stopPresentation = async () => {
    debug('stopPresentation');

    return this.sipConnector.stopPresentation().catch((error: unknown) => {
      debug(error as Error);
    });
  };

  public sendRefusalToTurnOnMic = async (): Promise<void> => {
    debug('sendRefusalToTurnOnMic');

    await this.sipConnector.sendRefusalToTurnOnMic().catch((error: unknown) => {
      debug('sendRefusalToTurnOnMic: error', error);
    });
  };

  public sendRefusalToTurnOnCam = async (): Promise<void> => {
    debug('sendRefusalToTurnOnCam');

    await this.sipConnector.sendRefusalToTurnOnCam().catch((error: unknown) => {
      debug('sendRefusalToTurnOnCam: error', error);
    });
  };

  public sendMediaState = async ({
    isEnabledCam,
    isEnabledMic,
  }: {
    isEnabledCam: boolean;
    isEnabledMic: boolean;
  }): Promise<void> => {
    debug('sendMediaState');

    await this.sipConnector.sendMediaState({ cam: isEnabledCam, mic: isEnabledMic });
  };

  public replaceMediaStream = async (
    mediaStream: MediaStream,
    {
      deleteExisting,
      addMissing,
      forceRenegotiation,
      contentHint,
      degradationPreference,
      sendEncodings,
      onAddedTransceiver,
    }: {
      deleteExisting?: boolean;
      addMissing?: boolean;
      forceRenegotiation?: boolean;
      contentHint?: TContentHint;
      degradationPreference?: RTCDegradationPreference;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    },
  ): Promise<void> => {
    debug('replaceMediaStream');

    return this.sipConnector.replaceMediaStream(mediaStream, {
      deleteExisting,
      addMissing,
      forceRenegotiation,
      contentHint,
      degradationPreference,
      onAddedTransceiver,
      sendEncodings,
    });
  };

  public askPermissionToEnableCam = async (): Promise<void> => {
    debug('askPermissionToEnableCam');

    await this.sipConnector.askPermissionToEnableCam();
  };

  public resolveHandleReadyRemoteStreamsDebounced = ({
    onReadyRemoteStreams,
  }: {
    onReadyRemoteStreams: (streams: TRemoteStreams) => void;
  }) => {
    return debounce(() => {
      const remoteStreams = this.sipConnector.getRemoteStreams();

      debug('remoteStreams', remoteStreams);
      onReadyRemoteStreams(remoteStreams);
    }, 200);
  };

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
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

  public getRemoteStreams = (): TRemoteStreams => {
    debug('getRemoteStreams');

    return this.sipConnector.getRemoteStreams();
  };

  public onUseLicense = (handler: (license: EContentUseLicense) => void): (() => void) => {
    debug('onUseLicense');

    return this.sipConnector.on('api:use-license', handler);
  };

  public onMustStopPresentation = (handler: () => void): (() => void) => {
    debug('onMustStopPresentation');

    return this.sipConnector.on('api:presentation:must-stop', handler);
  };

  public onMoveToSpectators = (handler: () => void): (() => void) => {
    debug('onMoveToSpectators');

    return this.sipConnector.on('api:participant:move-request-to-spectators', handler);
  };

  public onMoveToParticipants = (handler: () => void): (() => void) => {
    debug('onMoveToParticipants');

    return this.sipConnector.on('api:participant:move-request-to-participants', handler);
  };

  public onStats = (handler: (data: TStatsManagerEventMap['collected']) => void): (() => void) => {
    debug('onStats');

    return this.sipConnector.on('stats:collected', handler);
  };

  public offStats = (handler: (data: TStatsManagerEventMap['collected']) => void): void => {
    debug('offStats');

    this.sipConnector.off('stats:collected', handler);
  };
}

export default SipConnectorFacade;
