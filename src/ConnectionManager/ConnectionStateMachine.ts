import { assign, setup } from 'xstate';

import logger from '@/logger';
import { BaseStateMachine } from '@/tools/BaseStateMachine';

import type { TEventMap, TEvents } from './events';

export enum EState {
  IDLE = 'connection:idle',
  PREPARING = 'connection:preparing',
  CONNECTING = 'connection:connecting',
  CONNECTED = 'connection:connected',
  REGISTERED = 'connection:registered',
  ESTABLISHED = 'connection:established',
  DISCONNECTED = 'connection:disconnected',
  FAILED = 'connection:failed',
}

enum EAction {
  LOG_TRANSITION = 'logTransition',
  LOG_STATE_CHANGE = 'logStateChange',
  SET_ERROR = 'setError',
  CLEAR_ERROR = 'clearError',
}

export enum EEvents {
  START_CONNECT = 'START_CONNECT',
  START_INIT_UA = 'START_INIT_UA',
  UA_CONNECTED = 'UA_CONNECTED',
  UA_REGISTERED = 'UA_REGISTERED',
  UA_UNREGISTERED = 'UA_UNREGISTERED',
  UA_DISCONNECTED = 'UA_DISCONNECTED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  RESET = 'RESET',
}

type TConnectionMachineEvent = `${EEvents}`;

type TConnectionFailedEvent = {
  type: typeof EEvents.CONNECTION_FAILED;
  error?: Error;
};

type TConnectionMachineEvents = { type: TConnectionMachineEvent } | TConnectionFailedEvent;

const ALL_MACHINE_EVENTS: TConnectionMachineEvent[] = Object.values(EEvents);

type TContext = {
  error?: Error;
};

// Создаем XState машину с setup API для лучшей типизации
const connectionMachine = setup({
  types: {
    context: {} as TContext,
    events: {} as TConnectionMachineEvents,
  },
  actions: {
    [EAction.LOG_TRANSITION]: (_, params: { from: string; to: string; event: string }) => {
      logger(`State transition: ${params.from} -> ${params.to} (${params.event})`);
    },
    [EAction.LOG_STATE_CHANGE]: (_, params: { state: string }) => {
      logger('ConnectionStateMachine state changed', params.state);
    },
    [EAction.SET_ERROR]: assign({
      error: ({ event }) => {
        if (event.type === EEvents.CONNECTION_FAILED && 'error' in event) {
          return event.error;
        }

        return undefined;
      },
    }),
    [EAction.CLEAR_ERROR]: assign({
      error: () => {
        return undefined;
      },
    }),
  },
}).createMachine({
  id: 'connection',
  initial: EState.IDLE,
  context: {},
  states: {
    [EState.IDLE]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.IDLE },
      },
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
        [EEvents.START_INIT_UA]: {
          target: EState.CONNECTING,
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.PREPARING,
              to: EState.CONNECTING,
              event: EEvents.START_INIT_UA,
            },
          },
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
        [EEvents.CONNECTION_FAILED]: {
          target: EState.FAILED,
          actions: [
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.PREPARING,
                to: EState.FAILED,
                event: EEvents.CONNECTION_FAILED,
              },
            },
            { type: EAction.SET_ERROR },
          ],
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
        [EEvents.CONNECTION_FAILED]: {
          target: EState.FAILED,
          actions: [
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.CONNECTING,
                to: EState.FAILED,
                event: EEvents.CONNECTION_FAILED,
              },
            },
            { type: EAction.SET_ERROR },
          ],
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
    [EState.DISCONNECTED]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.DISCONNECTED },
      },
      on: {
        [EEvents.RESET]: {
          target: EState.IDLE,
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.DISCONNECTED,
              to: EState.IDLE,
              event: EEvents.RESET,
            },
          },
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
      },
    },
    [EState.FAILED]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.FAILED },
      },
      on: {
        [EEvents.RESET]: {
          target: EState.IDLE,
          actions: [
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.FAILED,
                to: EState.IDLE,
                event: EEvents.RESET,
              },
            },
            { type: EAction.CLEAR_ERROR },
          ],
        },
        [EEvents.START_CONNECT]: {
          target: EState.PREPARING,
          actions: [
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.FAILED,
                to: EState.PREPARING,
                event: EEvents.START_CONNECT,
              },
            },
            { type: EAction.CLEAR_ERROR },
          ],
        },
      },
    },
  },
});

export type TConnectionSnapshot = { value: EState; context: TContext };

export class ConnectionStateMachine extends BaseStateMachine<
  typeof connectionMachine,
  EState,
  TContext
> {
  private readonly events: TEvents;

  private unsubscribeFromEvents?: () => void;

  public constructor(events: TEvents) {
    super(connectionMachine);
    this.events = events;

    // Подписываемся на события UA
    this.subscribeToEvents();
  }

  public get isIdle(): boolean {
    return this.hasState(EState.IDLE);
  }

  public get isPreparing(): boolean {
    return this.hasState(EState.PREPARING);
  }

  public get isConnecting(): boolean {
    return this.hasState(EState.CONNECTING);
  }

  public get isConnected(): boolean {
    return this.hasState(EState.CONNECTED);
  }

  public get isRegistered(): boolean {
    return this.hasState(EState.REGISTERED);
  }

  public get isEstablished(): boolean {
    return this.hasState(EState.ESTABLISHED);
  }

  public get isDisconnected(): boolean {
    return this.hasState(EState.DISCONNECTED);
  }

  public get isFailed(): boolean {
    return this.hasState(EState.FAILED);
  }

  public get error(): Error | undefined {
    return this.getSnapshot().context.error;
  }

  public get isPending(): boolean {
    return this.isPreparing || this.isConnecting;
  }

  public get isPendingConnect(): boolean {
    return this.isPreparing;
  }

  public get isPendingInitUa(): boolean {
    return this.isConnecting;
  }

  public get isActiveConnection(): boolean {
    return this.isEstablished || this.isConnected || this.isRegistered;
  }

  // Публичные методы для уведомления о начале операций
  public startConnect(): void {
    this.toStartConnect();
  }

  public startInitUa(): void {
    this.toStartInitUa();
  }

  public reset(): void {
    this.toIdle();
  }

  public destroy(): void {
    this.unsubscribeFromEvents?.();
    this.stop();
  }

  public canTransition(event: TConnectionMachineEvent): boolean {
    const snapshot = this.actor.getSnapshot();

    return snapshot.can({ type: event });
  }

  public getValidEvents(): TConnectionMachineEvent[] {
    // Возвращаем все события, которые машина может обработать в текущем состоянии
    return ALL_MACHINE_EVENTS.filter((event) => {
      return this.canTransition(event);
    });
  }

  private hasState(state: EState): boolean {
    return this.actor.getSnapshot().matches(state);
  }

  private sendEvent(event: TConnectionMachineEvents): void {
    const snapshot = this.actor.getSnapshot();

    if (!snapshot.can(event)) {
      logger(
        `Invalid transition: ${event.type} from ${this.state}. Event cannot be processed in current state.`,
      );

      return;
    }

    this.send(event);
  }

  private readonly toStartConnect = (): void => {
    this.sendEvent({ type: EEvents.START_CONNECT });
  };

  private readonly toStartInitUa = (): void => {
    this.sendEvent({ type: EEvents.START_INIT_UA });
  };

  private readonly toConnected = (): void => {
    this.sendEvent({ type: EEvents.UA_CONNECTED });
  };

  private readonly toRegistered = (): void => {
    this.sendEvent({ type: EEvents.UA_REGISTERED });
  };

  private readonly toUnregistered = (): void => {
    this.sendEvent({ type: EEvents.UA_UNREGISTERED });
  };

  private readonly toDisconnected = (): void => {
    this.sendEvent({ type: EEvents.UA_DISCONNECTED });
  };

  private readonly toFailed = (error?: Error): void => {
    this.sendEvent({ type: EEvents.CONNECTION_FAILED, error });
  };

  private readonly toIdle = (): void => {
    this.sendEvent({ type: EEvents.RESET });
  };

  private subscribeToEvents(): void {
    this.events.on('connected', this.toConnected);
    this.events.on('registered', this.toRegistered);
    this.events.on('unregistered', this.toUnregistered);
    this.events.on('disconnected', this.toDisconnected);
    this.events.on('registrationFailed', this.handleRegistrationFailed);
    this.events.on('connect-failed', this.handleConnectFailed);

    this.unsubscribeFromEvents = () => {
      this.events.off('connected', this.toConnected);
      this.events.off('registered', this.toRegistered);
      this.events.off('unregistered', this.toUnregistered);
      this.events.off('disconnected', this.toDisconnected);
      this.events.off('registrationFailed', this.handleRegistrationFailed);
      this.events.off('connect-failed', this.handleConnectFailed);
    };
  }

  private readonly handleRegistrationFailed = (event: TEventMap['registrationFailed']): void => {
    const statusCode = event.response?.status_code ?? 'Unknown';
    const reason = event.response?.reason_phrase ?? 'Registration failed';

    const error = new Error(`Registration failed: ${statusCode} ${reason}`);

    this.toFailed(error);
  };

  private readonly handleConnectFailed = (error: TEventMap['connect-failed']): void => {
    this.toFailed(error instanceof Error ? error : undefined);
  };
}
