import type { AutoConnectorManager } from '@/AutoConnectorManager';
import type { TConnectionConfig, TParametersConnection } from '@/ConnectionManager';

export enum EConnectAndCallSessionPhase {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CALLING = 'calling',
  ACTIVE = 'active',
  RECONNECTING = 'reconnecting',
  FINALIZING = 'finalizing',
  CANCELLING = 'cancelling',
  CLOSED = 'closed',
}

export type TConnectAndCallSessionCloseReason =
  | 'completed'
  | 'manual'
  | 'cancelled'
  | 'initial-call-failed'
  | 'redial-exhausted'
  | 'auto-connect-failed'
  | 'auto-connector-active'
  | 'session-active';

export type TConnectAndCallSessionContext = {
  closeReason?: TConnectAndCallSessionCloseReason;
};

export type TConnectAndCallSessionEvent =
  | { type: 'START' }
  | { type: 'REJECT'; reason: TConnectAndCallSessionCloseReason }
  | { type: 'AUTO_CONNECTED' }
  | { type: 'CALL_STARTED' }
  | { type: 'REDIAL_STARTED' }
  | { type: 'REDIAL_SUCCEEDED' }
  | { type: 'FINALIZE'; reason: TConnectAndCallSessionCloseReason }
  | { type: 'MANUAL_CLOSE' }
  | { type: 'CLEANUP_COMPLETE' };

export interface IConnectAndCallSession {
  readonly phase: EConnectAndCallSessionPhase;
  hangUp: () => Promise<void>;
  disconnect: () => Promise<void>;
  waitUntilClosed: () => Promise<TConnectAndCallSessionCloseReason>;
}

export type TConnectAndCallSessionTeardown = {
  endCall: () => Promise<void>;
  isCallOngoing: () => boolean;
};

export type TConnectAndCallSessionParameters = {
  connection: {
    options?: Parameters<AutoConnectorManager['start']>[0]['options'];
    parameters: TParametersConnection | (() => Promise<TParametersConnection>);
  };
  startCall: () => Promise<RTCPeerConnection>;
};

export type TConnectAndCallSessionStartResult =
  | {
      isSuccessful: true;
      configuration: TConnectionConfig;
      peerConnection: RTCPeerConnection;
    }
  | {
      isSuccessful: false;
      configuration: undefined;
      error?: unknown;
      peerConnection: undefined;
      reason: 'cancelled' | 'auto-connect-failed' | 'auto-connector-active' | 'session-active';
    };

export type TConnectAndCallSessionResult =
  | (Extract<TConnectAndCallSessionStartResult, { isSuccessful: true }> & {
      session: IConnectAndCallSession;
    })
  | (Extract<TConnectAndCallSessionStartResult, { isSuccessful: false }> & {
      session: undefined;
    });
