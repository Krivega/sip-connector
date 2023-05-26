import { doMock } from 'webrtc-mock';

global.navigator = global.navigator || {};

doMock();
