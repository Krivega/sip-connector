import { assign, setup } from 'xstate';

import { EConnectAndCallSessionPhase } from './types';

import type { TConnectAndCallSessionContext, TConnectAndCallSessionEvent } from './types';

export const createConnectAndCallSessionMachine = () => {
  return setup({
    types: {
      context: {} as TConnectAndCallSessionContext,
      events: {} as TConnectAndCallSessionEvent,
    },
    actions: {
      assignRejectReason: assign({
        closeReason: ({ event }) => {
          return (event as Extract<TConnectAndCallSessionEvent, { type: 'REJECT' }>).reason;
        },
      }),
      assignFinalizeReason: assign({
        closeReason: ({ event }) => {
          return (event as Extract<TConnectAndCallSessionEvent, { type: 'FINALIZE' }>).reason;
        },
      }),
      assignManualCloseReason: assign({
        closeReason: () => {
          return 'manual' as const;
        },
      }),
    },
  }).createMachine({
    id: 'connectAndCallSession',
    initial: EConnectAndCallSessionPhase.IDLE,
    context: {},
    states: {
      [EConnectAndCallSessionPhase.IDLE]: {
        on: {
          START: EConnectAndCallSessionPhase.CONNECTING,
        },
      },
      [EConnectAndCallSessionPhase.CONNECTING]: {
        on: {
          REJECT: {
            target: EConnectAndCallSessionPhase.CLOSED,
            actions: 'assignRejectReason',
          },
          AUTO_CONNECTED: EConnectAndCallSessionPhase.CALLING,
          FINALIZE: {
            target: EConnectAndCallSessionPhase.FINALIZING,
            actions: 'assignFinalizeReason',
          },
          MANUAL_CLOSE: {
            target: EConnectAndCallSessionPhase.CANCELLING,
            actions: 'assignManualCloseReason',
          },
        },
      },
      [EConnectAndCallSessionPhase.CALLING]: {
        on: {
          CALL_STARTED: EConnectAndCallSessionPhase.ACTIVE,
          REDIAL_STARTED: EConnectAndCallSessionPhase.RECONNECTING,
          FINALIZE: {
            target: EConnectAndCallSessionPhase.FINALIZING,
            actions: 'assignFinalizeReason',
          },
          MANUAL_CLOSE: {
            target: EConnectAndCallSessionPhase.CANCELLING,
            actions: 'assignManualCloseReason',
          },
        },
      },
      [EConnectAndCallSessionPhase.ACTIVE]: {
        on: {
          REDIAL_STARTED: EConnectAndCallSessionPhase.RECONNECTING,
          FINALIZE: {
            target: EConnectAndCallSessionPhase.FINALIZING,
            actions: 'assignFinalizeReason',
          },
          MANUAL_CLOSE: {
            target: EConnectAndCallSessionPhase.CANCELLING,
            actions: 'assignManualCloseReason',
          },
        },
      },
      [EConnectAndCallSessionPhase.RECONNECTING]: {
        on: {
          REDIAL_SUCCEEDED: EConnectAndCallSessionPhase.ACTIVE,
          FINALIZE: {
            target: EConnectAndCallSessionPhase.FINALIZING,
            actions: 'assignFinalizeReason',
          },
          MANUAL_CLOSE: {
            target: EConnectAndCallSessionPhase.CANCELLING,
            actions: 'assignManualCloseReason',
          },
        },
      },
      [EConnectAndCallSessionPhase.FINALIZING]: {
        on: {
          CLEANUP_COMPLETE: EConnectAndCallSessionPhase.CLOSED,
        },
      },
      [EConnectAndCallSessionPhase.CANCELLING]: {
        on: {
          CLEANUP_COMPLETE: EConnectAndCallSessionPhase.CLOSED,
        },
      },
      [EConnectAndCallSessionPhase.CLOSED]: {
        type: 'final',
      },
    },
  });
};
