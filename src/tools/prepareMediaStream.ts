import type { TContentHint } from '../types';
import setVideoTrackContentHints from './setVideoTrackContentHints';

const prepareMediaStream = (
  mediaStream?: MediaStream,
  {
    videoMode,
    audioMode,
    contentHint,
  }: {
    videoMode?: 'recvonly' | 'sendonly' | 'sendrecv';
    audioMode?: 'recvonly' | 'sendonly' | 'sendrecv';
    contentHint?: TContentHint;
  } = {},
): MediaStream | undefined => {
  if (!mediaStream || (videoMode === 'recvonly' && audioMode === 'recvonly')) {
    return undefined;
  }

  const audioTracks = audioMode === 'recvonly' ? [] : mediaStream.getAudioTracks();
  const videoTracks = videoMode === 'recvonly' ? [] : mediaStream.getVideoTracks();
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
