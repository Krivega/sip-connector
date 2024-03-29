import {
  createAudioMediaStreamTrackMock,
  createMediaStreamMock,
  createVideoMediaStreamTrackMock,
} from 'webrtc-mock';
import RTCPeerConnectionMock from '../../__fixtures__/RTCPeerConnectionMock';

const data = {
  mediaStream: createMediaStreamMock({
    video: {
      deviceId: {
        exact: 'videoDeviceId',
      },
    },
    audio: {
      deviceId: {
        exact: 'videoaudioDeviceIdDeviceId',
      },
    },
  }),
  conference: '1000',
  setOutgoingCall: jest.fn(),
  setRemoteStreams: jest.fn(),
};

export default data;

const audioTrack = createAudioMediaStreamTrackMock();
const videoTrack = createVideoMediaStreamTrackMock();

audioTrack.id = 'mainaudio1';
videoTrack.id = 'mainvideo1';

export const peerConnectionFromData = new RTCPeerConnectionMock(undefined, [
  audioTrack,
  videoTrack,
]);
