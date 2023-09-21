import type SipConnector from '../SipConnector';
import log from '../logger';
import hasPurgatory from './hasPurgatory';
import resolveGetRemoteStreams from './resolveGetRemoteStreams';
import resolveHandleChangeTracks from './resolveHandleChangeTracks';
import resolveUpdateRemoteStreams from './resolveUpdateRemoteStreams';

type TDegradationPreference = 'maintain-framerate' | 'maintain-resolution' | 'balanced';

const resolveAnswerIncomingCall = (sipConnector: SipConnector) => {
  const answerIncomingCall = (params: {
    mediaStream: MediaStream;
    extraHeaders?: string[] | undefined;
    iceServers?: RTCIceServer[];
    degradationPreference?: TDegradationPreference;
    setRemoteStreams: (streams: MediaStream[]) => void;
    onBeforeProgressCall?: (conference: string) => void;
    onSuccessProgressCall?: (params: { isPurgatory: boolean }) => void;
    onFailProgressCall?: () => void;
    onFinishProgressCall?: () => void;
    onEnterPurgatory?: () => void;
    onEnterConference?: (params: { isSuccessProgressCall: boolean }) => void;
    onEndedCall?: () => void;
  }): Promise<RTCPeerConnection | void> => {
    const {
      mediaStream,
      extraHeaders,
      iceServers,
      degradationPreference,
      setRemoteStreams,
      onBeforeProgressCall,
      onSuccessProgressCall,
      onEnterPurgatory,
      onEnterConference,
      onFailProgressCall,
      onFinishProgressCall,
      onEndedCall,
    } = params;
    const updateRemoteStreams = resolveUpdateRemoteStreams({
      setRemoteStreams,
      getRemoteStreams: resolveGetRemoteStreams(sipConnector),
    });
    const handleChangeTracks = resolveHandleChangeTracks(updateRemoteStreams);

    log('answerIncomingCall', params);

    const answer = (): Promise<RTCPeerConnection> => {
      return sipConnector.answerToIncomingCall({
        mediaStream,
        extraHeaders,
        iceServers,
        degradationPreference,
        ontrack: handleChangeTracks,
      });
    };

    const getIncomingNumber = (): string => {
      const { remoteCallerData } = sipConnector;
      const { incomingNumber } = remoteCallerData;

      return incomingNumber;
    };
    let isSuccessProgressCall = false;
    let room: string;

    const subscribeEnterConference = () => {
      log('subscribeEnterConference: onEnterConference', onEnterConference);

      if (onEnterPurgatory || onEnterConference) {
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

    return answer().then(onSuccess).catch(onFail).finally(onFinish);
  };

  return answerIncomingCall;
};

export default resolveAnswerIncomingCall;
