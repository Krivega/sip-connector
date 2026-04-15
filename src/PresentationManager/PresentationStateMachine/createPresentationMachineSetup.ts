import { assign, setup } from 'xstate';

import resolveDebug from '@/logger';
import { EAction, initialContext } from './constants';

import type { TContext, TPresentationMachineEvents } from './types';

const debug = resolveDebug('PresentationStateMachine');

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(JSON.stringify(error));
};

export const createPresentationMachineSetup = () => {
  return setup({
    types: {
      context: initialContext as TContext,
      events: {} as TPresentationMachineEvents,
    },
    actions: {
      [EAction.LOG_TRANSITION]: (_, params: { from: string; to: string; event: string }) => {
        debug(`State transition: ${params.from} -> ${params.to} (${params.event})`);
      },
      [EAction.LOG_STATE_CHANGE]: (_, params: { state: string }) => {
        debug('PresentationStateMachine state changed', params.state);
      },
      [EAction.SET_ERROR]: assign(({ event }) => {
        if ('error' in event && event.error !== undefined) {
          return {
            lastError: normalizeError(event.error),
          };
        }

        return { lastError: undefined };
      }),
      [EAction.CLEAR_ERROR]: assign(() => {
        return {
          lastError: undefined,
        };
      }),
    },
  });
};
