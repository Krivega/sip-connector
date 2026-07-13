import { EventEmitterProxy } from 'events-constructor';
import { isEqual } from 'lodash';

import { createEvents } from './events';

import type { Subscription } from 'xstate';
import type { AutoConnectorManager } from '@/AutoConnectorManager';
import type { CallManager } from '@/CallManager';
import type { CallReconnectManager } from '@/CallReconnectManager';
import type { CallSessionState } from '@/CallSessionState';
import type { ConnectionManager } from '@/ConnectionManager';
import type { IncomingCallManager } from '@/IncomingCallManager';
import type { PresentationManager } from '@/PresentationManager';
import type { TEventMap } from './events';
import type { TSessionMachines, TSessionSnapshot } from './types';

type TEqualityFunction<T> = (previous: T, next: T) => boolean;
type TSelector<T> = (snapshot: TSessionSnapshot) => T;

const defaultEquals = <T>(previous: T, next: T) => {
  return Object.is(previous, next);
};

const defaultSnapshotEquals: TEqualityFunction<TSessionSnapshot> = (previous, next) => {
  return (
    previous.connection.value === next.connection.value &&
    // Call: full snapshot so room/context updates without a state `value` change still emit snapshot-changed
    isEqual(previous.call, next.call) &&
    // Incoming: value only — repeated RINGING with different callee metadata must not emit again
    previous.incoming.value === next.incoming.value &&
    isEqual(previous.presentation, next.presentation) &&
    previous.autoConnector.value === next.autoConnector.value &&
    // CallReconnect: full snapshot so attempt/delay context updates без смены `value` тоже эмитят событие
    isEqual(previous.callReconnect, next.callReconnect) &&
    // CallSession: full snapshot — смена роли должна эмитить snapshot-changed
    isEqual(previous.callSessionState, next.callSessionState)
  );
};

type TCallSessionSource = Pick<CallSessionState, 'getSnapshot' | 'subscribe'>;

type TSessionManagerDeps = {
  connectionManager: Pick<ConnectionManager, 'stateMachine'>;
  callManager: Pick<CallManager, 'stateMachine'>;
  incomingCallManager: Pick<IncomingCallManager, 'stateMachine'>;
  presentationManager: Pick<PresentationManager, 'stateMachine'>;
  autoConnectorManager: Pick<AutoConnectorManager, 'stateMachine'>;
  callReconnectManager: Pick<CallReconnectManager, 'stateMachine'>;
  callSessionState: TCallSessionSource;
};

const collectSnapshot = (
  machines: TSessionMachines,
  callSessionState: Pick<CallSessionState, 'getSnapshot'>,
): TSessionSnapshot => {
  return {
    connection: machines.connection.getSnapshot(),
    call: machines.call.getSnapshot(),
    incoming: machines.incoming.getSnapshot(),
    presentation: machines.presentation.getSnapshot(),
    autoConnector: machines.autoConnector.getSnapshot(),
    callReconnect: machines.callReconnect.getSnapshot(),
    callSessionState: callSessionState.getSnapshot(),
  };
};

class SessionManager extends EventEmitterProxy<TEventMap> {
  public readonly machines: TSessionMachines;

  private readonly callSessionState: TCallSessionSource;

  private currentSnapshot: TSessionSnapshot;

  private readonly subscribers = new Set<{
    selector: TSelector<unknown>;
    listener: (value: unknown) => void;
    equals: TEqualityFunction<unknown>;
    current: unknown;
  }>();

  private readonly actorSubscriptions: Subscription[] = [];

  public constructor(deps: TSessionManagerDeps) {
    super(createEvents());

    this.machines = {
      connection: deps.connectionManager.stateMachine,
      call: deps.callManager.stateMachine,
      incoming: deps.incomingCallManager.stateMachine,
      presentation: deps.presentationManager.stateMachine,
      autoConnector: deps.autoConnectorManager.stateMachine,
      callReconnect: deps.callReconnectManager.stateMachine,
    };
    this.callSessionState = deps.callSessionState;

    this.currentSnapshot = collectSnapshot(this.machines, this.callSessionState);

    this.actorSubscriptions.push(
      this.machines.connection.subscribe(this.notifySubscribers),
      this.machines.call.subscribe(this.notifySubscribers),
      this.machines.incoming.subscribe(this.notifySubscribers),
      this.machines.presentation.subscribe(this.notifySubscribers),
      this.machines.autoConnector.subscribe(this.notifySubscribers),
      this.machines.callReconnect.subscribe(this.notifySubscribers),

      // callSessionState — не xstate-машина, а отдельный read-model роли;
      // включаем его в единый снапшот, чтобы роль и call-статус были согласованы
      { unsubscribe: this.callSessionState.subscribe(this.notifySubscribers) },
    );
  }

  public getSnapshot(): TSessionSnapshot {
    return this.currentSnapshot;
  }

  public subscribe(listener: (snapshot: TSessionSnapshot) => void): () => void;
  public subscribe<T>(
    selector: TSelector<T>,
    listener: (value: T) => void,
    equals?: TEqualityFunction<T>,
  ): () => void;
  public subscribe(
    selectorOrListener: TSelector<unknown> | ((snapshot: TSessionSnapshot) => void),
    maybeListener?: (value: unknown) => void,
    maybeEquals?: TEqualityFunction<unknown>,
  ) {
    const hasSelector = typeof maybeListener === 'function';

    const selector = hasSelector
      ? (selectorOrListener as TSelector<unknown>)
      : (sessionSnapshot: TSessionSnapshot) => {
          return sessionSnapshot;
        };
    const listener = hasSelector
      ? (maybeListener as (value: unknown) => void)
      : (selectorOrListener as (value: unknown) => void);
    const selectorEquals = (maybeEquals as TEqualityFunction<unknown> | undefined) ?? defaultEquals;
    const equals = hasSelector
      ? selectorEquals
      : (defaultSnapshotEquals as TEqualityFunction<unknown>);
    const current = selector(this.currentSnapshot);
    const subscriber = {
      selector,
      listener,
      equals,
      current,
    };

    this.subscribers.add(subscriber);

    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public stop(): void {
    this.subscribers.clear();
    this.actorSubscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
  }

  private readonly notifySubscribers = () => {
    const previousSnapshot = this.currentSnapshot;

    this.currentSnapshot = collectSnapshot(this.machines, this.callSessionState);

    const isSnapshotEqual = defaultSnapshotEquals(previousSnapshot, this.currentSnapshot);

    for (const subscriber of this.subscribers) {
      const next = subscriber.selector(this.currentSnapshot);
      const isSubscriberEqual = subscriber.equals(subscriber.current, next);

      if (!isSubscriberEqual) {
        subscriber.current = next;
        subscriber.listener(next);
      }
    }

    if (!isSnapshotEqual) {
      this.events.trigger('snapshot-changed', {
        previous: previousSnapshot,
        current: this.currentSnapshot,
      });
    }
  };
}

export default SessionManager;
