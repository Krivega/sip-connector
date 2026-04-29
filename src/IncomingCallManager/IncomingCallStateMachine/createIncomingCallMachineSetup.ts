import { assign, setup } from 'xstate';

import resolveDebug from '@/logger';
import { EAction, EEvents, EState, initialContext } from './constants';

import type { TIncomingMachineEvents, TContext } from './types';

const debug = resolveDebug('IncomingCallManager: createIncomingCallMachineSetup');

export const createIncomingCallMachineSetup = () => {
  return setup({
    types: {
      context: initialContext as TContext,
      events: {} as TIncomingMachineEvents,
    },
    actions: {
      [EAction.LOG_TRANSITION]: (_, params: { from: string; to: string; event: string }) => {
        debug(`State transition: ${params.from} -> ${params.to} (${params.event})`);
      },
      [EAction.LOG_STATE_CHANGE]: (_, params: { state: string }) => {
        debug('IncomingCallStateMachine state changed', params.state);
      },
      [EAction.REMEMBER_INCOMING]: assign(({ event }) => {
        const ringingEvent = event as Extract<TIncomingMachineEvents, { type: EEvents.RINGING }>;

        return {
          remoteCallerData: ringingEvent.data,
          lastReason: undefined,
        };
      }),
      [EAction.REMEMBER_REASON]: assign(({ event, context }) => {
        if (event.type === EEvents.CONSUMED) {
          return {
            remoteCallerData: context.remoteCallerData,
            lastReason: EState.CONSUMED,
          };
        }

        if (event.type === EEvents.DECLINED) {
          return {
            remoteCallerData: event.data,
            lastReason: EState.DECLINED,
          };
        }

        if (event.type === EEvents.TERMINATED) {
          return {
            remoteCallerData: event.data,
            lastReason: EState.TERMINATED,
          };
        }

        const failedEvent = event as Extract<TIncomingMachineEvents, { type: EEvents.FAILED }>;

        return {
          remoteCallerData: failedEvent.data,
          lastReason: EState.FAILED,
        };
      }),
      [EAction.CLEAR_INCOMING]: assign(() => {
        return {
          remoteCallerData: undefined,
          lastReason: undefined,
        };
      }),
    },
  });
};
