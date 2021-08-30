import { doMock } from 'webrtc-mock';
import { Headers } from 'node-fetch';

global.navigator = global.navigator || {};

// @ts-ignore
global.Headers = global.Headers || Headers;

doMock();
