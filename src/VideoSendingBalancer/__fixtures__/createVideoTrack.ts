import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

const createVideoTrack = (width: number, height: number): MediaStreamVideoTrack => {
  return createVideoMediaStreamTrackMock({
    constraints: { width, height },
  }) as MediaStreamVideoTrack;
};

export default createVideoTrack;
