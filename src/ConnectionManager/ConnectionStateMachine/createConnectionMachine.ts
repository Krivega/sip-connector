import { EAction, EEvents, EState, initialContext } from './constants';
import { createConnectionMachineSetup } from './createConnectionMachineSetup';

export const createConnectionMachine = () => {
  return createConnectionMachineSetup().createMachine({
    id: 'connection',
    initial: EState.IDLE,
    context: initialContext,
    states: {
      [EState.IDLE]: {
        entry: [
          {
            type: EAction.LOG_STATE_CHANGE,
            params: { state: EState.IDLE },
          },
          {
            type: EAction.CLEAR_CONNECTION_CONFIGURATION,
          },
        ],
        on: {
          [EEvents.START_CONNECT]: {
            target: EState.PREPARING,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.IDLE,
                to: EState.PREPARING,
                event: EEvents.START_CONNECT,
              },
            },
          },
        },
      },
      [EState.PREPARING]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.PREPARING },
        },
        on: {
          [EEvents.START_UA]: {
            target: EState.CONNECTING,
            actions: [
              EAction.SET_CONNECTION_CONFIGURATION,
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.PREPARING,
                  to: EState.CONNECTING,
                  event: EEvents.START_UA,
                },
              },
            ],
          },
          [EEvents.UA_DISCONNECTED]: {
            target: EState.DISCONNECTED,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.PREPARING,
                to: EState.DISCONNECTED,
                event: EEvents.UA_DISCONNECTED,
              },
            },
          },
        },
      },
      [EState.CONNECTING]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.CONNECTING },
        },
        on: {
          [EEvents.UA_CONNECTED]: {
            target: EState.CONNECTED,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.CONNECTING,
                to: EState.CONNECTED,
                event: EEvents.UA_CONNECTED,
              },
            },
          },
          [EEvents.UA_REGISTERED]: {
            target: EState.REGISTERED,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.CONNECTING,
                to: EState.REGISTERED,
                event: EEvents.UA_REGISTERED,
              },
            },
          },
          [EEvents.START_DISCONNECT]: {
            target: EState.DISCONNECTING,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.CONNECTING,
                to: EState.DISCONNECTING,
                event: EEvents.START_DISCONNECT,
              },
            },
          },
          [EEvents.UA_DISCONNECTED]: {
            target: EState.DISCONNECTED,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.CONNECTING,
                to: EState.DISCONNECTED,
                event: EEvents.UA_DISCONNECTED,
              },
            },
          },
        },
      },
      [EState.CONNECTED]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.CONNECTED },
        },
        always: {
          target: EState.ESTABLISHED,
          guard: 'canAutoEstablish',
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.CONNECTED,
              to: EState.ESTABLISHED,
              event: 'always',
            },
          },
        },
        on: {
          [EEvents.UA_REGISTERED]: {
            target: EState.REGISTERED,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.CONNECTED,
                to: EState.REGISTERED,
                event: EEvents.UA_REGISTERED,
              },
            },
          },
          [EEvents.START_DISCONNECT]: {
            target: EState.DISCONNECTING,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.CONNECTED,
                to: EState.DISCONNECTING,
                event: EEvents.START_DISCONNECT,
              },
            },
          },
          [EEvents.UA_DISCONNECTED]: {
            target: EState.DISCONNECTED,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.CONNECTED,
                to: EState.DISCONNECTED,
                event: EEvents.UA_DISCONNECTED,
              },
            },
          },
        },
      },
      [EState.REGISTERED]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.REGISTERED },
        },
        always: {
          target: EState.ESTABLISHED,
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.REGISTERED,
              to: EState.ESTABLISHED,
              event: 'always',
            },
          },
        },
        on: {
          [EEvents.UA_UNREGISTERED]: {
            target: EState.CONNECTED,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.REGISTERED,
                to: EState.CONNECTED,
                event: EEvents.UA_UNREGISTERED,
              },
            },
          },
          [EEvents.START_DISCONNECT]: {
            target: EState.DISCONNECTING,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.REGISTERED,
                to: EState.DISCONNECTING,
                event: EEvents.START_DISCONNECT,
              },
            },
          },
          [EEvents.UA_DISCONNECTED]: {
            target: EState.DISCONNECTED,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.REGISTERED,
                to: EState.DISCONNECTED,
                event: EEvents.UA_DISCONNECTED,
              },
            },
          },
        },
      },
      [EState.ESTABLISHED]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.ESTABLISHED },
        },
        on: {
          [EEvents.START_DISCONNECT]: {
            target: EState.DISCONNECTING,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.ESTABLISHED,
                to: EState.DISCONNECTING,
                event: EEvents.START_DISCONNECT,
              },
            },
          },
          [EEvents.UA_DISCONNECTED]: {
            target: EState.DISCONNECTED,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.ESTABLISHED,
                to: EState.DISCONNECTED,
                event: EEvents.UA_DISCONNECTED,
              },
            },
          },
          [EEvents.RESET]: {
            target: EState.IDLE,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.ESTABLISHED,
                to: EState.IDLE,
                event: EEvents.RESET,
              },
            },
          },
        },
      },
      [EState.DISCONNECTING]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.DISCONNECTING },
        },
        on: {
          [EEvents.UA_DISCONNECTED]: {
            target: EState.DISCONNECTED,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.DISCONNECTING,
                to: EState.DISCONNECTED,
                event: EEvents.UA_DISCONNECTED,
              },
            },
          },
        },
      },
      [EState.DISCONNECTED]: {
        entry: {
          type: EAction.LOG_STATE_CHANGE,
          params: { state: EState.DISCONNECTED },
        },
        on: {
          [EEvents.RESET]: {
            target: EState.IDLE,
            actions: [
              {
                type: EAction.LOG_TRANSITION,
                params: {
                  from: EState.DISCONNECTED,
                  to: EState.IDLE,
                  event: EEvents.RESET,
                },
              },
            ],
          },
          [EEvents.START_CONNECT]: {
            target: EState.PREPARING,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.DISCONNECTED,
                to: EState.PREPARING,
                event: EEvents.START_CONNECT,
              },
            },
          },
          [EEvents.UA_CONNECTING]: {
            target: EState.CONNECTING,
            actions: {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.DISCONNECTED,
                to: EState.CONNECTING,
                event: EEvents.UA_CONNECTING,
              },
            },
          },
        },
      },
    },
  });
};
