import type { TContentHint } from '../types';
import setVideoTrackContentHints from './setVideoTrackContentHints';

const prepareMediaStream = (
  mediaStream?: MediaStream,
  {
    directionVideo,
    directionAudio,
    contentHint,
  }: {
    directionVideo?: RTCRtpTransceiverDirection;
    directionAudio?: RTCRtpTransceiverDirection;
    contentHint?: TContentHint;
  } = {},
): MediaStream | undefined => {
  if (!mediaStream || (directionVideo === 'recvonly' && directionAudio === 'recvonly')) {
    return undefined;
  }

  const audioTracks = directionAudio === 'recvonly' ? [] : mediaStream.getAudioTracks();
  const videoTracks = directionVideo === 'recvonly' ? [] : mediaStream.getVideoTracks();
  const tracks = [...audioTracks, ...videoTracks];
  const newStream = new MediaStream(tracks);

  newStream.getTracks = () => {
    return [...newStream.getAudioTracks(), ...newStream.getVideoTracks()]; // for garante audio first order
  };

  if (contentHint && contentHint !== 'none') {
    setVideoTrackContentHints(newStream, contentHint);
  }

  return newStream;
};

export default prepareMediaStream;
