import { EAction, EEvents, EState, initialContext } from './constants';
import { createPresentationMachineSetup } from './createPresentationMachineSetup';

const toIdleActions = (from: EState, event: EEvents) => {
  return [
    EAction.CLEAR_ERROR,
    EAction.CLEAR_VIDEO_TRACK,
    {
      type: EAction.LOG_TRANSITION,
      params: {
        event,
        from,
        to: EState.IDLE,
      },
    },
  ] as const;
};

const toFailedActions = (from: EState, event: EEvents) => {
  return [
    EAction.SET_ERROR,
    EAction.CLEAR_VIDEO_TRACK,
    {
      type: EAction.LOG_TRANSITION,
      params: {
        event,
        from,
        to: EState.FAILED,
      },
    },
  ] as const;
};

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
              EAction.SET_VIDEO_TRACK,
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
            actions: [
              EAction.SET_VIDEO_TRACK,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.STARTING,
                  to: EState.ACTIVE,
                  event: EEvents.SCREEN_STARTED,
                },
              },
            ],
          },
          [EEvents.SCREEN_FAILED]: {
            target: EState.FAILED,
            actions: toFailedActions(EState.STARTING, EEvents.SCREEN_FAILED),
          },
          [EEvents.SCREEN_ENDED]: {
            target: EState.IDLE,
            actions: toIdleActions(EState.STARTING, EEvents.SCREEN_ENDED),
          },
          [EEvents.CALL_ENDED]: {
            target: EState.IDLE,
            actions: toIdleActions(EState.STARTING, EEvents.CALL_ENDED),
          },
          [EEvents.CALL_FAILED]: {
            target: EState.FAILED,
            actions: toFailedActions(EState.STARTING, EEvents.CALL_FAILED),
          },
        },
      },
      [EState.ACTIVE]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.ACTIVE },
        },
        on: {
          [EEvents.SCREEN_UPDATING]: {
            actions: [EAction.SET_VIDEO_TRACK],
          },
          [EEvents.SCREEN_UPDATED]: {
            actions: [EAction.SET_VIDEO_TRACK],
          },
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
            actions: toIdleActions(EState.ACTIVE, EEvents.SCREEN_ENDED),
          },
          [EEvents.SCREEN_FAILED]: {
            target: EState.FAILED,
            actions: toFailedActions(EState.ACTIVE, EEvents.SCREEN_FAILED),
          },
          [EEvents.CALL_ENDED]: {
            target: EState.IDLE,
            actions: toIdleActions(EState.ACTIVE, EEvents.CALL_ENDED),
          },
          [EEvents.CALL_FAILED]: {
            target: EState.FAILED,
            actions: toFailedActions(EState.ACTIVE, EEvents.CALL_FAILED),
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
            actions: toIdleActions(EState.STOPPING, EEvents.SCREEN_ENDED),
          },
          [EEvents.SCREEN_FAILED]: {
            target: EState.FAILED,
            actions: toFailedActions(EState.STOPPING, EEvents.SCREEN_FAILED),
          },
          [EEvents.CALL_ENDED]: {
            target: EState.IDLE,
            actions: toIdleActions(EState.STOPPING, EEvents.CALL_ENDED),
          },
          [EEvents.CALL_FAILED]: {
            target: EState.FAILED,
            actions: toFailedActions(EState.STOPPING, EEvents.CALL_FAILED),
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
              EAction.SET_VIDEO_TRACK,
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
            actions: toIdleActions(EState.FAILED, EEvents.SCREEN_ENDED),
          },
          [EEvents.PRESENTATION_RESET]: {
            target: EState.IDLE,
            actions: toIdleActions(EState.FAILED, EEvents.PRESENTATION_RESET),
          },
        },
      },
    },
  });
};
