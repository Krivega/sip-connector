import { EAction, EEvents, EState, initialContext } from './constants';
import { createPresentationMachineSetup } from './createPresentationMachineSetup';

export const createPresentationMachine = () => {
  return createPresentationMachineSetup().createMachine({
    id: 'presentation',
    initial: EState.IDLE,
    context: initialContext,
    states: {
      [EState.IDLE]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.IDLE },
        },
        on: {
          [EEvents.SCREEN_STARTING]: {
            target: EState.STARTING,
            actions: [
              EAction.CLEAR_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.IDLE,
                  to: EState.STARTING,
                  event: EEvents.SCREEN_STARTING,
                },
              },
            ],
          },
        },
      },
      [EState.STARTING]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.STARTING },
        },
        on: {
          [EEvents.SCREEN_STARTED]: {
            target: EState.ACTIVE,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.STARTING,
                to: EState.ACTIVE,
                event: EEvents.SCREEN_STARTED,
              },
            },
          },
          [EEvents.SCREEN_FAILED]: {
            target: EState.FAILED,
            actions: [
              EAction.SET_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.STARTING,
                  to: EState.FAILED,
                  event: EEvents.SCREEN_FAILED,
                },
              },
            ],
          },
          [EEvents.SCREEN_ENDED]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.STARTING,
                  to: EState.IDLE,
                  event: EEvents.SCREEN_ENDED,
                },
              },
            ],
          },
          [EEvents.CALL_ENDED]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.STARTING,
                  to: EState.IDLE,
                  event: EEvents.CALL_ENDED,
                },
              },
            ],
          },
          [EEvents.CALL_FAILED]: {
            target: EState.FAILED,
            actions: [
              EAction.SET_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.STARTING,
                  to: EState.FAILED,
                  event: EEvents.CALL_FAILED,
                },
              },
            ],
          },
        },
      },
      [EState.ACTIVE]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.ACTIVE },
        },
        on: {
          [EEvents.SCREEN_ENDING]: {
            target: EState.STOPPING,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.ACTIVE,
                to: EState.STOPPING,
                event: EEvents.SCREEN_ENDING,
              },
            },
          },
          [EEvents.SCREEN_ENDED]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.ACTIVE,
                  to: EState.IDLE,
                  event: EEvents.SCREEN_ENDED,
                },
              },
            ],
          },
          [EEvents.SCREEN_FAILED]: {
            target: EState.FAILED,
            actions: [
              EAction.SET_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.ACTIVE,
                  to: EState.FAILED,
                  event: EEvents.SCREEN_FAILED,
                },
              },
            ],
          },
          [EEvents.CALL_ENDED]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.ACTIVE,
                  to: EState.IDLE,
                  event: EEvents.CALL_ENDED,
                },
              },
            ],
          },
          [EEvents.CALL_FAILED]: {
            target: EState.FAILED,
            actions: [
              EAction.SET_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.ACTIVE,
                  to: EState.FAILED,
                  event: EEvents.CALL_FAILED,
                },
              },
            ],
          },
        },
      },
      [EState.STOPPING]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.STOPPING },
        },
        on: {
          [EEvents.SCREEN_ENDED]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.STOPPING,
                  to: EState.IDLE,
                  event: EEvents.SCREEN_ENDED,
                },
              },
            ],
          },
          [EEvents.SCREEN_FAILED]: {
            target: EState.FAILED,
            actions: [
              EAction.SET_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.STOPPING,
                  to: EState.FAILED,
                  event: EEvents.SCREEN_FAILED,
                },
              },
            ],
          },
          [EEvents.CALL_ENDED]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.STOPPING,
                  to: EState.IDLE,
                  event: EEvents.CALL_ENDED,
                },
              },
            ],
          },
          [EEvents.CALL_FAILED]: {
            target: EState.FAILED,
            actions: [
              EAction.SET_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.STOPPING,
                  to: EState.FAILED,
                  event: EEvents.CALL_FAILED,
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
          [EEvents.SCREEN_STARTING]: {
            target: EState.STARTING,
            actions: [
              EAction.CLEAR_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.FAILED,
                  to: EState.STARTING,
                  event: EEvents.SCREEN_STARTING,
                },
              },
            ],
          },
          [EEvents.SCREEN_ENDED]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.FAILED,
                  to: EState.IDLE,
                  event: EEvents.SCREEN_ENDED,
                },
              },
            ],
          },
          [EEvents.PRESENTATION_RESET]: {
            target: EState.IDLE,
            actions: [
              EAction.CLEAR_ERROR,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.FAILED,
                  to: EState.IDLE,
                  event: EEvents.PRESENTATION_RESET,
                },
              },
            ],
          },
        },
      },
    },
  });
};
