import { assign, setup } from 'xstate';

import resolveDebug from '@/logger';
import { EAction, initialContext } from './constants';

import type { EEvents } from './constants';
import type { TConnectionMachineEvents, TContext } from './types';

const debug = resolveDebug('ConnectionManager: createConnectionMachineSetup');

export const createConnectionMachineSetup = () => {
  return setup({
    types: {
      context: initialContext as TContext,
      events: {} as TConnectionMachineEvents,
    },
    guards: {
      canAutoEstablish: ({ context }) => {
        return context.connectionConfiguration?.register !== true;
      },
    },
    actions: {
      [EAction.SET_CONNECTION_CONFIGURATION]: assign(({ event }) => {
        const setConfigurationEvent = event as Extract<
          TConnectionMachineEvents,
          { type: EEvents.START_UA }
        >;

        return {
          connectionConfiguration: { ...setConfigurationEvent.configuration },
        };
      }),
      [EAction.CLEAR_CONNECTION_CONFIGURATION]: assign(() => {
        return {
          connectionConfiguration: undefined,
        };
      }),
      [EAction.LOG_TRANSITION]: (_, params: { from: string; to: string; event: string }) => {
        debug(`State transition: ${params.from} -> ${params.to} (${params.event})`);
      },
      [EAction.LOG_STATE_CHANGE]: (_, params: { state: string }) => {
        debug('ConnectionStateMachine state changed', params.state);
      },
    },
  });
};
