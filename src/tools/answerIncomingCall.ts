import type SipConnector from '../SipConnector';
import log from '../logger';
import type { TContentHint, TSimulcastEncodings } from '../types';
import generateSimulcastEncodings from './generateSimulcastEncodings';
import hasPurgatory from './hasPurgatory';
import resolveGetRemoteStreams from './resolveGetRemoteStreams';
import resolveHandleChangeTracks from './resolveHandleChangeTracks';
import resolveUpdateRemoteStreams from './resolveUpdateRemoteStreams';

const resolveAnswerIncomingCall = (sipConnector: SipConnector) => {
  const answerIncomingCall = async (parameters: {
    mediaStream: MediaStream;
    extraHeaders?: string[] | undefined;
    iceServers?: RTCIceServer[];
    contentHint?: TContentHint;
    simulcastEncodings?: TSimulcastEncodings;
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

    log('answerIncomingCall', parameters);

    const answer = async (): Promise<RTCPeerConnection> => {
      return sipConnector.answerToIncomingCall({
        mediaStream,
        extraHeaders,
        iceServers,
        contentHint,
        sendEncodings: generateSimulcastEncodings({
          mediaStream,
          simulcastEncodings,
          sendEncodings,
        }),
        ontrack: handleChangeTracks,
      });
    };

    const getIncomingNumber = (): string | undefined => {
      const { remoteCallerData } = sipConnector;

      return remoteCallerData.incomingNumber;
    };
    let isSuccessProgressCall = false;
    let room: string;

    const subscribeEnterConference = () => {
      log('subscribeEnterConference: onEnterConference', onEnterConference);

      if (onEnterPurgatory ?? onEnterConference) {
        return sipConnector.onSession('enterRoom', (_room: string) => {
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

  return answerIncomingCall;
};

export default resolveAnswerIncomingCall;
