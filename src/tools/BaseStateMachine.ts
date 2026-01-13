import { createActor } from 'xstate';

import type { Actor, AnyStateMachine, EventFrom, SnapshotFrom } from 'xstate';

type TUnsubscribe = () => void;
type TTeardown = TUnsubscribe | { unsubscribe: () => void };

export abstract class BaseStateMachine<TMachine extends AnyStateMachine, EState extends string> {
  protected readonly actor: Actor<TMachine>;

  private readonly subscriptions: TUnsubscribe[] = [];

  protected constructor(machine: TMachine) {
    this.actor = createActor(machine);
    this.actor.start();
  }

  public get actorRef(): Actor<TMachine> {
    return this.actor;
  }

  public get state(): EState {
    return (this.getSnapshot() as unknown as { value: EState }).value;
  }

  public send(event: EventFrom<TMachine>) {
    this.actor.send(event);
  }

  public getSnapshot() {
    return this.actor.getSnapshot();
  }

  public subscribe(listener: (snapshot: SnapshotFrom<TMachine>) => void) {
    const subscription = this.actor.subscribe(listener);

    this.addSubscription(subscription);

    return subscription;
  }

  public stop() {
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
