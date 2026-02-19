import { createActor } from 'xstate';

import type { Actor, AnyStateMachine, EventFrom, SnapshotFrom } from 'xstate';

type TUnsubscribe = () => void;
type TTeardown = TUnsubscribe | { unsubscribe: () => void };

export abstract class BaseStateMachine<
  TMachine extends AnyStateMachine,
  EState extends string,
  TContext extends Record<string, unknown>,
  TSnapshot extends { value: EState; context: TContext } = { value: EState; context: TContext },
> {
  protected readonly actor: Actor<TMachine>;

  private readonly subscriptions: TUnsubscribe[] = [];

  private readonly stateChangeListeners = new Set<(state: EState) => void>();

  protected constructor(machine: TMachine) {
    this.actor = createActor(machine);
    this.actor.start();

    this.addSubscription(
      this.subscribe((snapshot: SnapshotFrom<TMachine>) => {
        // @ts-expect-error
        const state = snapshot.value as unknown as EState;

        this.stateChangeListeners.forEach((listener) => {
          listener(state);
        });
      }),
    );
  }

  public get state(): EState {
    return this.getSnapshot().value;
  }

  public get context(): TContext {
    return this.getSnapshot().context;
  }

  public send(event: EventFrom<TMachine>) {
    this.actor.send(event);
  }

  public getSnapshot() {
    return this.actor.getSnapshot() as unknown as TSnapshot;
  }

  public subscribe(listener: (snapshot: SnapshotFrom<TMachine>) => void) {
    const subscription = this.actor.subscribe(listener);

    this.addSubscription(subscription);

    return subscription;
  }

  public onStateChange(listener: (state: EState) => void): () => void {
    this.stateChangeListeners.add(listener);

    // Возвращаем функцию для отписки
    return () => {
      this.stateChangeListeners.delete(listener);
    };
  }

  public stop() {
    this.stateChangeListeners.clear();
    this.subscriptions.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.subscriptions.length = 0;
    this.actor.stop();
  }

  protected addSubscription(subscription: TTeardown) {
    const unsubscribe =
      typeof subscription === 'function'
        ? subscription
        : () => {
            subscription.unsubscribe();
          };

    this.subscriptions.push(unsubscribe);

    return unsubscribe;
  }
}
