import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import {
  createAudioMediaStreamTrackMock,
  createMediaStreamMock,
  createVideoMediaStreamTrackMock,
} from 'webrtc-mock';

const PURGATORY_NUMBER = 'purgatory';

export const onEnterPurgatory = jest.fn();
export const onEnterConference = jest.fn();

const data = {
  onEnterPurgatory,
  onEnterConference,
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

export const dataCallPurgatory = {
  ...data,
  onEnterPurgatory,
  onEnterConference,
  conference: PURGATORY_NUMBER,
};

const audioTrack = createAudioMediaStreamTrackMock();
const videoTrack = createVideoMediaStreamTrackMock();

audioTrack.id = 'mainaudio1';
videoTrack.id = 'mainvideo1';

export const peerConnectionFromData = new RTCPeerConnectionMock(undefined, [
  audioTrack,
  videoTrack,
]);
