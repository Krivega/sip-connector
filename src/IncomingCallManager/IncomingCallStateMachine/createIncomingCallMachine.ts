import { EAction, EEvents, EState, initialContext } from './constants';
import { createIncomingCallMachineSetup } from './createIncomingCallMachineSetup';

export const createIncomingCallMachine = () => {
  return createIncomingCallMachineSetup().createMachine({
    id: 'incoming',
    initial: EState.IDLE,
    context: initialContext,
    states: {
      [EState.IDLE]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.IDLE },
        },
        on: {
          [EEvents.RINGING]: {
            target: EState.RINGING,
            actions: [
              EAction.REMEMBER_INCOMING,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.IDLE,
                  to: EState.RINGING,
                  event: EEvents.RINGING,
                },
              },
            ],
          },
          [EEvents.CLEAR]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_INCOMING,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.IDLE,
                  to: EState.IDLE,
                  event: EEvents.CLEAR,
                },
              },
            ],
          },
        },
      },
      [EState.RINGING]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.RINGING },
        },
        on: {
          [EEvents.RINGING]: {
            target: EState.RINGING,
            actions: [
              EAction.REMEMBER_INCOMING,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.RINGING,
                  to: EState.RINGING,
                  event: EEvents.RINGING,
                },
              },
            ],
          },
          [EEvents.CONSUMED]: {
            target: EState.CONSUMED,
            actions: [
              EAction.REMEMBER_REASON,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.RINGING,
                  to: EState.CONSUMED,
                  event: EEvents.CONSUMED,
                },
              },
            ],
          },
          [EEvents.DECLINED]: {
            target: EState.DECLINED,
            actions: [
              EAction.REMEMBER_REASON,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.RINGING,
                  to: EState.DECLINED,
                  event: EEvents.DECLINED,
                },
              },
            ],
          },
          [EEvents.TERMINATED]: {
            target: EState.TERMINATED,
            actions: [
              EAction.REMEMBER_REASON,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.RINGING,
                  to: EState.TERMINATED,
                  event: EEvents.TERMINATED,
                },
              },
            ],
          },
          [EEvents.FAILED]: {
            target: EState.FAILED,
            actions: [
              EAction.REMEMBER_REASON,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.RINGING,
                  to: EState.FAILED,
                  event: EEvents.FAILED,
                },
              },
            ],
          },
          [EEvents.CLEAR]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_INCOMING,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.RINGING,
                  to: EState.IDLE,
                  event: EEvents.CLEAR,
                },
              },
            ],
          },
        },
      },
      [EState.CONSUMED]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.CONSUMED },
        },
        on: {
          [EEvents.CLEAR]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_INCOMING,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.CONSUMED,
                  to: EState.IDLE,
                  event: EEvents.CLEAR,
                },
              },
            ],
          },
          [EEvents.RINGING]: {
            target: EState.RINGING,
            actions: [
              EAction.REMEMBER_INCOMING,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.CONSUMED,
                  to: EState.RINGING,
                  event: EEvents.RINGING,
                },
              },
            ],
          },
        },
      },
      [EState.DECLINED]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.DECLINED },
        },
        on: {
          [EEvents.CLEAR]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_INCOMING,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.DECLINED,
                  to: EState.IDLE,
                  event: EEvents.CLEAR,
                },
              },
            ],
          },
          [EEvents.RINGING]: {
            target: EState.RINGING,
            actions: [
              EAction.REMEMBER_INCOMING,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.DECLINED,
                  to: EState.RINGING,
                  event: EEvents.RINGING,
                },
              },
            ],
          },
        },
      },
      [EState.TERMINATED]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.TERMINATED },
        },
        on: {
          [EEvents.CLEAR]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_INCOMING,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.TERMINATED,
                  to: EState.IDLE,
                  event: EEvents.CLEAR,
                },
              },
            ],
          },
          [EEvents.RINGING]: {
            target: EState.RINGING,
            actions: [
              EAction.REMEMBER_INCOMING,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.TERMINATED,
                  to: EState.RINGING,
                  event: EEvents.RINGING,
                },
              },
            ],
          },
        },
      },
      [EState.FAILED]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.FAILED },
        },
        on: {
          [EEvents.CLEAR]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_INCOMING,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.FAILED,
                  to: EState.IDLE,
                  event: EEvents.CLEAR,
                },
              },
            ],
          },
          [EEvents.RINGING]: {
            target: EState.RINGING,
            actions: [
              EAction.REMEMBER_INCOMING,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.FAILED,
                  to: EState.RINGING,
                  event: EEvents.RINGING,
                },
              },
            ],
          },
        },
      },
    },
  });
};
