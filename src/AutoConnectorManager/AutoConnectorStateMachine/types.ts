import type { TParametersAutoConnect } from '../types';

export const AUTO_CONNECTOR_STATE_IDS = {
  IDLE: 'idle',
  DISCONNECTING: 'disconnecting',
  ATTEMPTING_GATE: 'attemptingGate',
  ATTEMPTING_CONNECT: 'attemptingConnect',
  WAITING_BEFORE_RETRY: 'waitingBeforeRetry',
  CONNECTED_MONITORING: 'connectedMonitoring',
  TELEPHONY_CHECKING: 'telephonyChecking',
  ERROR_TERMINAL: 'errorTerminal',
} as const;

export type EAutoConnectorState =
  (typeof AUTO_CONNECTOR_STATE_IDS)[keyof typeof AUTO_CONNECTOR_STATE_IDS];

export type TAfterDisconnect = 'attempt' | 'idle';
export type TStopReason = 'halted' | 'cancelled' | 'failed';

export type TAutoConnectorContext = {
  parameters: TParametersAutoConnect | undefined;
  afterDisconnect: TAfterDisconnect;
  stopReason: TStopReason | undefined;
  lastError: unknown;
};

export type TAutoConnectorEvent =
  | { type: 'AUTO.STOP' }
  | { type: 'AUTO.RESTART'; parameters: TParametersAutoConnect }
  | { type: 'FLOW.RESTART' }
  | {
      type: 'TELEPHONY.RESULT';
      outcome: 'stillConnected';
    };
