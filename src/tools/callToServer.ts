import type SipConnector from '../SipConnector';
import log from '../logger';
import type { TContentHint, TSimulcastEncodings } from '../types';
import generateSimulcastEncodings from './generateSimulcastEncodings';
import hasPurgatory from './hasPurgatory';
import resolveGetRemoteStreams from './resolveGetRemoteStreams';
import resolveHandleChangeTracks from './resolveHandleChangeTracks';
import resolveUpdateRemoteStreams from './resolveUpdateRemoteStreams';
import resolveUpdateSenderInTransceiver from './resolveUpdateSenderInTransceiver';

const resolveCallToServer = (sipConnector: SipConnector) => {
  const callToServer = async (parameters: {
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
    const updateRemoteStreams = resolveUpdateRemoteStreams({
      setRemoteStreams,
      getRemoteStreams: resolveGetRemoteStreams(sipConnector),
    });
    const handleChangeTracks = resolveHandleChangeTracks(updateRemoteStreams);
    const updateSenderInTransceiver = resolveUpdateSenderInTransceiver({
      degradationPreference,
    });

    log('callToServer', parameters);

    const startCall = async (): Promise<RTCPeerConnection> => {
      log('startCall');

      return sipConnector.call({
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
        onAddedTransceiver: updateSenderInTransceiver,
        ontrack: handleChangeTracks,
      });
    };
    let isSuccessProgressCall = false;
    let room: string;

    const subscribeEnterConference = () => {
      log('subscribeEnterConference: onEnterConference', onEnterConference);

      if (onEnterPurgatory ?? onEnterConference) {
        return sipConnector.onSession('enterRoom', ({ room: _room }: { room: string }) => {
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
      updateRemoteStreams();

      if (onSuccessProgressCall) {
        onSuccessProgressCall({ isPurgatory: hasPurgatory(room) });
      }

      sipConnector.onceRaceSession(['ended', 'failed'], () => {
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

  return callToServer;
};

export default resolveCallToServer;
