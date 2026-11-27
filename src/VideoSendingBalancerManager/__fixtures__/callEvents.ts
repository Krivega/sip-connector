import Request from '@/__fixtures__/Request.mock';

import type { IncomingInfoEvent } from '@krivega/jssip';
import type RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import type { CallManager } from '@/CallManager';

export const setConnection = (
  callManager: CallManager,
  connection: RTCPeerConnection | undefined,
) => {
  Object.defineProperty(callManager, 'connection', {
    value: connection,
    writable: true,
    configurable: true,
  });
};

export const sendMainCamInfo = (callManager: CallManager, headers: [string, string][]) => {
  callManager.events.trigger('newInfo', {
    originator: 'remote',
    request: new Request(headers),
  } as unknown as IncomingInfoEvent);
};

export const confirmCall = (callManager: CallManager, connection: RTCPeerConnectionMock) => {
  callManager.events.trigger('peerconnection:confirmed', connection as RTCPeerConnection);
};
