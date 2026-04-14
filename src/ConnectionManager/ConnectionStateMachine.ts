import { assign, setup } from 'xstate';

import resolveDebug from '@/logger';
import { BaseStateMachine } from '@/tools/BaseStateMachine';

import type { TEvents } from './events';

const debug = resolveDebug('ConnectionStateMachine');

export enum EState {
  IDLE = 'connection:idle',
  PREPARING = 'connection:preparing',
  CONNECTING = 'connection:connecting',
  CONNECTED = 'connection:connected',
  REGISTERED = 'connection:registered',
  ESTABLISHED = 'connection:established',
  DISCONNECTING = 'connection:disconnecting',
  DISCONNECTED = 'connection:disconnected',
}

enum EAction {
  LOG_TRANSITION = 'logTransition',
  LOG_STATE_CHANGE = 'logStateChange',
  SET_REGISTER_REQUIRED = 'setRegisterRequired',
  RESET_REGISTER_REQUIRED = 'resetRegisterRequired',
}

export enum EEvents {
  START_CONNECT = 'START_CONNECT',
  START_INIT_UA = 'START_INIT_UA',
  START_DISCONNECT = 'START_DISCONNECT',
  UA_CONNECTED = 'UA_CONNECTED',
  UA_CONNECTING = 'UA_CONNECTING',
  UA_REGISTERED = 'UA_REGISTERED',
  UA_UNREGISTERED = 'UA_UNREGISTERED',
  UA_DISCONNECTED = 'UA_DISCONNECTED',
  RESET = 'RESET',
}

type TConnectionMachineEvent = EEvents;

type TConnectionMachineEvents =
  | { type: EEvents.START_CONNECT }
  | { type: EEvents.START_INIT_UA; registerRequired: boolean }
  | { type: EEvents.START_DISCONNECT }
  | { type: EEvents.UA_CONNECTED }
  | { type: EEvents.UA_CONNECTING }
  | { type: EEvents.UA_REGISTERED }
  | { type: EEvents.UA_UNREGISTERED }
  | { type: EEvents.UA_DISCONNECTED }
  | { type: EEvents.RESET };

const ALL_MACHINE_EVENTS: TConnectionMachineEvent[] = Object.values(EEvents);

type TContext = {
  registerRequired: boolean;
};

/** Контекст для `SET_REGISTER_REQUIRED`; пустой partial, если событие не `START_INIT_UA`. */
export function applyRegisterRequiredFromMachineEvent(
  event: TConnectionMachineEvents,
): Partial<TContext> {
  if (event.type !== EEvents.START_INIT_UA) {
    return {};
  }

  return {
    registerRequired: event.registerRequired,
  };
}

// Создаем XState машину с setup API для лучшей типизации
const connectionMachine = setup({
  types: {
    context: {} as TContext,
    events: {} as TConnectionMachineEvents,
  },
  guards: {
    canAutoEstablish: ({ context }) => {
      return !context.registerRequired;
    },
  },
  actions: {
    [EAction.SET_REGISTER_REQUIRED]: assign(({ event }) => {
      return applyRegisterRequiredFromMachineEvent(event);
    }),
    [EAction.RESET_REGISTER_REQUIRED]: assign(() => {
      return {
        registerRequired: false,
      };
    }),
    [EAction.LOG_TRANSITION]: (_, params: { from: string; to: string; event: string }) => {
      debug(`State transition: ${params.from} -> ${params.to} (${params.event})`);
    },
    [EAction.LOG_STATE_CHANGE]: (_, params: { state: string }) => {
      debug('ConnectionStateMachine state changed', params.state);
    },
  },
}).createMachine({
  id: 'connection',
  initial: EState.IDLE,
  context: {
    registerRequired: false,
  },
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
          actions: [
            EAction.SET_REGISTER_REQUIRED,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.PREPARING,
                to: EState.CONNECTING,
                event: EEvents.START_INIT_UA,
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
          actions: [
            EAction.RESET_REGISTER_REQUIRED,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.ESTABLISHED,
                to: EState.IDLE,
                event: EEvents.RESET,
              },
            },
          ],
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
            EAction.RESET_REGISTER_REQUIRED,
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

  public get isDisconnecting(): boolean {
    return this.hasState(EState.DISCONNECTING);
  }

  public get isDisconnected(): boolean {
    return this.hasState(EState.DISCONNECTED);
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

  public startInitUa(registerRequired = false): void {
    this.toStartInitUa(registerRequired);
  }

  public startDisconnect(): void {
    this.toStartDisconnect();
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
    const machineEvent =
      event === EEvents.START_INIT_UA
        ? { type: EEvents.START_INIT_UA, registerRequired: false }
        : { type: event };

    return snapshot.can(machineEvent);
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
      debug(
        `Invalid transition: ${event.type} from ${this.state}. Event cannot be processed in current state.`,
      );

      return;
    }

    this.send(event);
  }

  private readonly toStartConnect = (): void => {
    this.sendEvent({ type: EEvents.START_CONNECT });
  };

  private readonly toStartInitUa = (registerRequired: boolean): void => {
    this.sendEvent({ type: EEvents.START_INIT_UA, registerRequired });
  };

  private readonly toStartDisconnect = (): void => {
    this.sendEvent({ type: EEvents.START_DISCONNECT });
  };

  private readonly toConnecting = (): void => {
    this.sendEvent({ type: EEvents.UA_CONNECTING });
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

  private readonly toIdle = (): void => {
    this.sendEvent({ type: EEvents.RESET });
  };

  private subscribeToEvents(): void {
    this.events.on('connected', this.toConnected);
    this.events.on('connecting', this.toConnecting);
    this.events.on('registered', this.toRegistered);
    this.events.on('unregistered', this.toUnregistered);
    this.events.on('disconnecting', this.toStartDisconnect);
    this.events.on('disconnected', this.toDisconnected);
    this.events.on('registrationFailed', this.toDisconnected);
    this.events.on('connect-failed', this.toDisconnected);

    this.unsubscribeFromEvents = () => {
      this.events.off('connected', this.toConnected);
      this.events.off('connecting', this.toConnecting);
      this.events.off('registered', this.toRegistered);
      this.events.off('unregistered', this.toUnregistered);
      this.events.off('disconnecting', this.toStartDisconnect);
      this.events.off('disconnected', this.toDisconnected);
      this.events.off('registrationFailed', this.toDisconnected);
      this.events.off('connect-failed', this.toDisconnected);
    };
  }
}
