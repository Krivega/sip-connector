import resolveDebug from '@/logger';

import type { RegisteredEvent, UA, UnRegisteredEvent, DisconnectEvent } from '@krivega/jssip';
import type { TEvents } from './events';

interface IDependencies {
  events: TEvents;
  getUaProtected: () => UA;
}

const debug = resolveDebug('RegistrationManager');

export default class RegistrationManager {
  private readonly events: IDependencies['events'];

  private readonly getUaProtected: IDependencies['getUaProtected'];

  public constructor(dependencies: IDependencies) {
    this.events = dependencies.events;
    this.getUaProtected = dependencies.getUaProtected;
  }

  public async register(): Promise<RegisteredEvent> {
    const ua = this.getUaProtected();

    return new Promise((resolve, reject) => {
      ua.on('registered', resolve);
      ua.on('registrationFailed', reject);
      ua.register();
    });
  }

  public async unregister(): Promise<UnRegisteredEvent> {
    const ua = this.getUaProtected();

    return new Promise((resolve) => {
      ua.on('unregistered', resolve);
      ua.unregister();
    });
  }

  public async tryRegister(): Promise<RegisteredEvent> {
    try {
      await this.unregister();
    } catch (error) {
      debug('tryRegister', error);
    }

    return this.register();
  }

  public subscribeToStartEvents(
    onSuccess: () => void,
    onError: (event: DisconnectEvent | UnRegisteredEvent) => void,
  ): () => void {
    const successEvent = 'registered';
    const errorEvents = ['registrationFailed', 'disconnected'] as const;

    this.events.on(successEvent, onSuccess);
    errorEvents.forEach((errorEvent) => {
      this.events.on(errorEvent, onError);
    });

    return () => {
      this.events.off(successEvent, onSuccess);
      errorEvents.forEach((errorEvent) => {
        this.events.off(errorEvent, onError);
      });
    };
  }
}
