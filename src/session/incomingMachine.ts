import { assign, setup } from 'xstate';

import { EIncomingStatus } from './types';

import type { TRemoteCallerData } from '@/IncomingCallManager/eventNames';
import type { TIncomingEvent } from './types';

interface IncomingContext {
  remoteCallerData?: TRemoteCallerData;
  lastReason?:
    | EIncomingStatus.CONSUMED
    | EIncomingStatus.DECLINED
    | EIncomingStatus.TERMINATED
    | EIncomingStatus.FAILED;
}

export const incomingMachine = setup({
  types: {
    context: {} as IncomingContext,
    events: {} as TIncomingEvent,
  },
  actions: {
    rememberIncoming: assign(({ event }) => {
      if (event.type === 'INCOMING.RINGING') {
        return { remoteCallerData: event.data, lastReason: undefined };
      }

      return {};
    }),
    rememberReason: assign(({ event, context }) => {
      if (event.type === 'INCOMING.CONSUMED') {
        return { remoteCallerData: context.remoteCallerData, lastReason: EIncomingStatus.CONSUMED };
      }

      if (event.type === 'INCOMING.DECLINED') {
        return {
          remoteCallerData: event.data,
          lastReason: EIncomingStatus.DECLINED,
        };
      }

      if (event.type === 'INCOMING.TERMINATED') {
        return {
          remoteCallerData: event.data,
          lastReason: EIncomingStatus.TERMINATED,
        };
      }

      if (event.type === 'INCOMING.FAILED') {
        return {
          remoteCallerData: event.data,
          lastReason: EIncomingStatus.FAILED,
        };
      }

      return {};
    }),
    clearIncoming: assign(() => {
      return {
        remoteCallerData: undefined,
        lastReason: undefined,
      };
    }),
  },
}).createMachine({
  id: 'incoming',
  initial: EIncomingStatus.IDLE,
  context: {},
  states: {
    [EIncomingStatus.IDLE]: {
      on: {
        'INCOMING.RINGING': {
          target: EIncomingStatus.RINGING,
          actions: ['rememberIncoming'],
        },
        'INCOMING.CLEAR': {
          target: EIncomingStatus.IDLE,
          actions: 'clearIncoming',
        },
      },
    },
    [EIncomingStatus.RINGING]: {
      on: {
        'INCOMING.RINGING': {
          target: EIncomingStatus.RINGING,
          actions: ['rememberIncoming'],
        },
        'INCOMING.CONSUMED': {
          target: EIncomingStatus.CONSUMED,
          actions: 'rememberReason',
        },
        'INCOMING.DECLINED': {
          target: EIncomingStatus.DECLINED,
          actions: 'rememberReason',
        },
        'INCOMING.TERMINATED': {
          target: EIncomingStatus.TERMINATED,
          actions: 'rememberReason',
        },
        'INCOMING.FAILED': {
          target: EIncomingStatus.FAILED,
          actions: 'rememberReason',
        },
        'INCOMING.CLEAR': {
          target: EIncomingStatus.IDLE,
          actions: 'clearIncoming',
        },
      },
    },
    [EIncomingStatus.CONSUMED]: {
      on: {
        'INCOMING.CLEAR': {
          target: EIncomingStatus.IDLE,
          actions: 'clearIncoming',
        },
        'INCOMING.RINGING': {
          target: EIncomingStatus.RINGING,
          actions: ['rememberIncoming'],
        },
      },
    },
    [EIncomingStatus.DECLINED]: {
      on: {
        'INCOMING.CLEAR': {
          target: EIncomingStatus.IDLE,
          actions: 'clearIncoming',
        },
        'INCOMING.RINGING': {
          target: EIncomingStatus.RINGING,
          actions: ['rememberIncoming'],
        },
      },
    },
    [EIncomingStatus.TERMINATED]: {
      on: {
        'INCOMING.CLEAR': {
          target: EIncomingStatus.IDLE,
          actions: 'clearIncoming',
        },
        'INCOMING.RINGING': {
          target: EIncomingStatus.RINGING,
          actions: ['rememberIncoming'],
        },
      },
    },
    [EIncomingStatus.FAILED]: {
      on: {
        'INCOMING.CLEAR': {
          target: EIncomingStatus.IDLE,
          actions: 'clearIncoming',
        },
        'INCOMING.RINGING': {
          target: EIncomingStatus.RINGING,
          actions: ['rememberIncoming'],
        },
      },
    },
  },
});
