import { createMachine } from 'xstate';

export enum EState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CHECK_TELEPHONY = 'CHECK_TELEPHONY',
  CALLING = 'CALLING',
}

export enum EEvents {
  START_CONNECT = 'START_CONNECT',
  START_CHECK_TELEPHONY = 'START_CHECK_TELEPHONY',
  START_CALL = 'START_CALL',
  RESET = 'RESET',
}

export type TStateMachineEvent = `${EEvents}`;

type TStateMachineEvents = { type: TStateMachineEvent };

const MACHINE_ID = 'attempts-connector';

const stateMachine = createMachine({
  types: {
    events: {} as TStateMachineEvents,
  },
  id: MACHINE_ID,
  initial: EState.IDLE,
  states: {
    [EState.IDLE]: {
      on: {
        [EEvents.START_CONNECT]: { target: EState.CONNECTING },
        [EEvents.START_CHECK_TELEPHONY]: { target: EState.CHECK_TELEPHONY },
      },
    },
    [EState.CONNECTING]: {
      on: {
        [EEvents.RESET]: { target: EState.IDLE },
        [EEvents.START_CHECK_TELEPHONY]: { target: EState.CHECK_TELEPHONY },
        [EEvents.START_CALL]: {
          target: EState.CALLING,
        },
      },
    },
    [EState.CHECK_TELEPHONY]: {
      on: {
        [EEvents.RESET]: { target: EState.IDLE },
        [EEvents.START_CONNECT]: {
          target: EState.CONNECTING,
        },
      },
    },
    [EState.CALLING]: {
      on: {
        [EEvents.START_CONNECT]: {
          target: EState.CONNECTING,
        },
        [EEvents.RESET]: { target: EState.IDLE },
      },
    },
  },
});

export default stateMachine;
