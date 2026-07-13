import type { RTCSession } from '@krivega/jssip';

export type TPresentationSessionPort = {
  getConnection: () => RTCPeerConnection | undefined;
  getEstablishedSession: () => RTCSession | undefined;
  renegotiate: () => Promise<boolean>;
  onCallEnded: (handler: () => void) => () => void;
};

export const createCallManagerPort = (callManager: {
  connection: RTCPeerConnection | undefined;
  getEstablishedRTCSession: () => RTCSession | undefined;
  renegotiate: () => Promise<boolean>;
  on: (event: 'failed' | 'ended', handler: () => void) => void;
  off: (event: 'failed' | 'ended', handler: () => void) => void;
}): TPresentationSessionPort => {
  return {
    getConnection: () => {
      return callManager.connection;
    },
    getEstablishedSession: () => {
      return callManager.getEstablishedRTCSession();
    },
    renegotiate: async () => {
      return callManager.renegotiate();
    },
    onCallEnded: (handler) => {
      callManager.on('failed', handler);
      callManager.on('ended', handler);

      return () => {
        callManager.off('failed', handler);
        callManager.off('ended', handler);
      };
    },
  };
};
