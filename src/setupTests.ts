import { doMock } from 'webrtc-mock';
import RTCPeerConnectionMock from './__fixtures__/RTCPeerConnectionMock';

type Global = {
  RTCPeerConnection: typeof RTCPeerConnectionMock;
};

declare let global: Global;

global.RTCPeerConnection = RTCPeerConnectionMock;
// @ts-expect-error
global.navigator ??= {};

doMock();
