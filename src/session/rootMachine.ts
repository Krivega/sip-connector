import { forwardTo, setup } from 'xstate';

import { callMachine } from './callMachine';
import { connectionMachine } from './connectionMachine';
import { incomingMachine } from './incomingMachine';
import { screenShareMachine } from './screenShareMachine';

import type { ActorRefFrom, SnapshotFrom } from 'xstate';
import type { TSipSessionEvent } from './types';

export const sipSessionMachine = setup({
  types: {
    context: {} as Record<string, never>,
    events: {} as TSipSessionEvent,
  },
  actors: {
    connection: connectionMachine,
    call: callMachine,
    incoming: incomingMachine,
    screenShare: screenShareMachine,
  },
  actions: {
    forwardToConnection: forwardTo('connection'),
    forwardToCall: forwardTo('call'),
    forwardToIncoming: forwardTo('incoming'),
    forwardToScreenShare: forwardTo('screenShare'),
  },
}).createMachine({
  id: 'sipSession',
  type: 'parallel',
  context: {},
  states: {
    connection: {
      invoke: { id: 'connection', src: 'connection' },
    },
    call: {
      invoke: { id: 'call', src: 'call' },
    },
    incoming: {
      invoke: { id: 'incoming', src: 'incoming' },
    },
    screenShare: {
      invoke: { id: 'screenShare', src: 'screenShare' },
    },
  },
  on: {
    '*': {
      actions: [
        'forwardToConnection',
        'forwardToCall',
        'forwardToIncoming',
        'forwardToScreenShare',
      ],
    },
  },
});

export type TSipSessionSnapshot = SnapshotFrom<typeof sipSessionMachine>;
export type TSipSessionActor = ActorRefFrom<typeof sipSessionMachine>;
