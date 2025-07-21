import type Events from 'events-constructor';
import { createActor, setup, type ActorRefFrom } from 'xstate';
import logger from '../logger';
import type { EVENT_NAMES } from './constants';

// Определяем типы событий для XState машины
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
type TConnectionMachineEvents = { type: TConnectionMachineEvent };

interface IConnectionMachineContext {
  error?: Error;
  lastTransition?: string;
}

export enum EState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  INITIALIZING = 'initializing',
  CONNECTED = 'connected',
  REGISTERED = 'registered',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
}

enum EAction {
  LOG_TRANSITION = 'logTransition',
  LOG_STATE_CHANGE = 'logStateChange',
}

// Создаем XState машину с setup API для лучшей типизации
const connectionMachine = setup({
  types: {
    context: {} as IConnectionMachineContext,
    events: {} as TConnectionMachineEvents,
  },
  actions: {
    [EAction.LOG_TRANSITION]: (_, params: { from: string; to: string; event: string }) => {
      logger(`State transition: ${params.from} -> ${params.to} (${params.event})`);
    },
    [EAction.LOG_STATE_CHANGE]: (_, params: { state: string }) => {
      logger('ConnectionStateMachine state changed', params.state);
    },
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
          target: EState.CONNECTING,
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.IDLE,
              to: EState.CONNECTING,
              event: EEvents.START_CONNECT,
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
        [EEvents.START_INIT_UA]: {
          target: EState.INITIALIZING,
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.CONNECTING,
              to: EState.INITIALIZING,
              event: EEvents.START_INIT_UA, // TODO: remove
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
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.CONNECTING,
              to: EState.FAILED,
              event: EEvents.CONNECTION_FAILED,
            },
          },
        },
      },
    },
    [EState.INITIALIZING]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.INITIALIZING },
      },
      on: {
        [EEvents.UA_CONNECTED]: {
          target: EState.CONNECTED,
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.INITIALIZING,
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
              from: EState.INITIALIZING,
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
              from: EState.INITIALIZING,
              to: EState.DISCONNECTED,
              event: EEvents.UA_DISCONNECTED,
            },
          },
        },
        [EEvents.CONNECTION_FAILED]: {
          target: EState.FAILED,
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.INITIALIZING,
              to: EState.FAILED,
              event: EEvents.CONNECTION_FAILED,
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
        [EEvents.CONNECTION_FAILED]: {
          target: EState.FAILED,
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.CONNECTED,
              to: EState.FAILED,
              event: EEvents.CONNECTION_FAILED,
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
        [EEvents.CONNECTION_FAILED]: {
          target: EState.FAILED,
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.REGISTERED,
              to: EState.FAILED,
              event: EEvents.CONNECTION_FAILED,
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
          target: EState.CONNECTING,
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.DISCONNECTED,
              to: EState.CONNECTING,
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
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.FAILED,
              to: EState.IDLE,
              event: EEvents.RESET,
            },
          },
        },
        [EEvents.START_CONNECT]: {
          target: EState.CONNECTING,
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.FAILED,
              to: EState.CONNECTING,
              event: EEvents.START_CONNECT,
            },
          },
        },
      },
    },
  },
});

type TConnectionMachineActor = ActorRefFrom<typeof connectionMachine>;

export default class ConnectionStateMachine {
  private readonly actor: TConnectionMachineActor;

  private readonly stateChangeListeners = new Set<(state: EState) => void>();

  private readonly events: Events<typeof EVENT_NAMES>;

  private unsubscribeFromEvents?: () => void;

  private readonly actorSubscription?: { unsubscribe: () => void };

  public constructor(events: Events<typeof EVENT_NAMES>) {
    this.events = events;

    this.actor = createActor(connectionMachine);

    this.actorSubscription = this.actor.subscribe((snapshot) => {
      const state = snapshot.value as EState;

      this.stateChangeListeners.forEach((listener) => {
        listener(state);
      });
    });

    // Запускаем актер
    this.actor.start();

    // Подписываемся на события UA
    this.subscribeToEvents();
  }

  public get state(): EState {
    return this.actor.getSnapshot().value as EState;
  }

  public get isIdle(): boolean {
    return this.hasState(EState.IDLE);
  }

  public get isConnecting(): boolean {
    return this.hasState(EState.CONNECTING);
  }

  public get isInitializing(): boolean {
    return this.hasState(EState.INITIALIZING);
  }

  public get isConnected(): boolean {
    return this.hasState(EState.CONNECTED);
  }

  public get isRegistered(): boolean {
    return this.hasState(EState.REGISTERED);
  }

  public get isDisconnected(): boolean {
    return this.hasState(EState.DISCONNECTED);
  }

  public get isFailed(): boolean {
    return this.hasState(EState.FAILED);
  }

  public get isPending(): boolean {
    return this.isConnecting || this.isInitializing;
  }

  public get isPendingConnect(): boolean {
    return this.isConnecting;
  }

  public get isPendingInitUa(): boolean {
    return this.isInitializing;
  }

  public get isActiveConnection(): boolean {
    return this.isConnected || this.isRegistered;
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
    this.actorSubscription?.unsubscribe();
    this.actor.stop();
  }

  public onStateChange(listener: (state: EState) => void): () => void {
    this.stateChangeListeners.add(listener);

    // Возвращаем функцию для отписки
    return () => {
      this.stateChangeListeners.delete(listener);
    };
  }

  public canTransition(event: TConnectionMachineEvent): boolean {
    const snapshot = this.actor.getSnapshot();

    return snapshot.can({ type: event } as TConnectionMachineEvents);
  }

  public getValidEvents(): TConnectionMachineEvent[] {
    // Возвращаем все события, которые машина может обработать в текущем состоянии
    return Object.values(EEvents).filter((event) => {
      return this.canTransition(event);
    });
  }

  private hasState(state: EState): boolean {
    return this.actor.getSnapshot().matches(state);
  }

  private sendEvent(eventName: TConnectionMachineEvent): void {
    const snapshot = this.actor.getSnapshot();
    const event = { type: eventName };

    if (!snapshot.can(event)) {
      logger(
        `Invalid transition: ${event.type} from ${this.state}. Event cannot be processed in current state.`,
      );

      return;
    }

    this.actor.send(event);
  }

  private readonly toStartConnect = (): void => {
    this.sendEvent(EEvents.START_CONNECT);
  };

  private readonly toStartInitUa = (): void => {
    this.sendEvent(EEvents.START_INIT_UA);
  };

  private readonly toConnected = (): void => {
    this.sendEvent(EEvents.UA_CONNECTED);
  };

  private readonly toRegistered = (): void => {
    this.sendEvent(EEvents.UA_REGISTERED);
  };

  private readonly toUnregistered = (): void => {
    this.sendEvent(EEvents.UA_UNREGISTERED);
  };

  private readonly toDisconnected = (): void => {
    this.sendEvent(EEvents.UA_DISCONNECTED);
  };

  private readonly toFailed = (): void => {
    this.sendEvent(EEvents.CONNECTION_FAILED);
  };

  private readonly toIdle = (): void => {
    this.sendEvent(EEvents.RESET);
  };

  private subscribeToEvents(): void {
    this.events.on('connected', this.toConnected);
    this.events.on('registered', this.toRegistered);
    this.events.on('unregistered', this.toUnregistered);
    this.events.on('disconnected', this.toDisconnected);
    this.events.on('registrationFailed', this.toFailed);

    this.unsubscribeFromEvents = () => {
      this.events.off('connected', this.toConnected);
      this.events.off('registered', this.toRegistered);
      this.events.off('unregistered', this.toUnregistered);
      this.events.off('disconnected', this.toDisconnected);
      this.events.off('registrationFailed', this.toFailed);
    };
  }
}
