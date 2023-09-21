import { doMock } from 'webrtc-mock';
import RTCPeerConnectionMock from './__fixtures__/RTCPeerConnectionMock';

interface Global {
  RTCPeerConnection: typeof RTCPeerConnectionMock;
}

declare let global: Global;

global.RTCPeerConnection = RTCPeerConnectionMock;
// @ts-ignore
global.navigator = global.navigator || {};

doMock();
