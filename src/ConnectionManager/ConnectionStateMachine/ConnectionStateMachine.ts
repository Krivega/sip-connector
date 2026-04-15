import resolveDebug from '@/logger';
import { BaseStateMachine } from '@/tools/BaseStateMachine';
import { EEvents, EState } from './constants';
import { createConnectionMachine } from './createConnectionMachine';

import type { TEvents } from '../events';
import type { TConnectionConfiguration } from '../types';
import type { TConnectionMachineEvents, TContext, TContextMap } from './types';

const connectionMachine = createConnectionMachine();
const debug = resolveDebug('ConnectionStateMachine');

export type TSnapshot =
  | { value: EState.IDLE; context: TContextMap[EState.IDLE] }
  | { value: EState.PREPARING; context: TContextMap[EState.PREPARING] }
  | { value: EState.CONNECTING; context: TContextMap[EState.CONNECTING] }
  | { value: EState.CONNECTED; context: TContextMap[EState.CONNECTED] }
  | { value: EState.REGISTERED; context: TContextMap[EState.REGISTERED] }
  | { value: EState.ESTABLISHED; context: TContextMap[EState.ESTABLISHED] }
  | { value: EState.DISCONNECTING; context: TContextMap[EState.DISCONNECTING] }
  | { value: EState.DISCONNECTED; context: TContextMap[EState.DISCONNECTED] };

export class ConnectionStateMachine extends BaseStateMachine<
  typeof connectionMachine,
  EState,
  TContext,
  TSnapshot
> {
  private readonly events: TEvents;

  private unsubscribeFromEvents?: () => void;

  public constructor(events: TEvents) {
    super(connectionMachine);
    this.events = events;

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

  public readonly toStartConnect = (): void => {
    this.sendEvent({ type: EEvents.START_CONNECT });
  };

  public readonly toStartUa = (configuration: TConnectionConfiguration): void => {
    this.sendEvent({ type: EEvents.START_UA, configuration });
  };

  public reset(): void {
    this.toIdle();
  }

  public getConnectionConfiguration(): TConnectionConfiguration | undefined {
    if (this.context.connectionConfiguration === undefined) {
      return undefined;
    }

    return { ...this.context.connectionConfiguration };
  }

  public isRegisterEnabled(): boolean {
    return this.context.connectionConfiguration?.register === true;
  }

  public destroy(): void {
    this.unsubscribeFromEvents?.();
    this.stop();
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
