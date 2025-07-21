import type { RegisteredEvent, UA, UnRegisteredEvent } from '@krivega/jssip';
import type Events from 'events-constructor';
import logger from '../logger';
import type { EVENT_NAMES } from './constants';
import { EEvent } from './constants';

interface IDependencies {
  events: Events<typeof EVENT_NAMES>;
  getUa: () => UA | undefined;
}

export default class RegistrationManager {
  private readonly events: IDependencies['events'];

  private readonly getUa: IDependencies['getUa'];

  public constructor(dependencies: IDependencies) {
    this.events = dependencies.events;
    this.getUa = dependencies.getUa;
  }

  public async register(): Promise<RegisteredEvent> {
    const ua = this.getUa();

    if (!ua) {
      throw new Error('UA is not initialized');
    }

    return new Promise((resolve, reject) => {
      ua.on(EEvent.REGISTERED, resolve);
      ua.on(EEvent.REGISTRATION_FAILED, reject);
      ua.register();
    });
  }

  public async unregister(): Promise<UnRegisteredEvent> {
    const ua = this.getUa();

    if (!ua) {
      throw new Error('UA is not initialized');
    }

    return new Promise((resolve) => {
      ua.on(EEvent.UNREGISTERED, resolve);
      ua.unregister();
    });
  }

  public async tryRegister(): Promise<RegisteredEvent> {
    const ua = this.getUa();

    if (!ua) {
      throw new Error('UA is not initialized');
    }

    this.events.trigger(EEvent.CONNECTING, undefined);

    try {
      await this.unregister();
    } catch (error) {
      logger('tryRegister', error);
    }

    return this.register();
  }

  public subscribeToStartEvents(
    onSuccess: () => void,
    onError: (error: Error) => void,
  ): () => void {
    const successEvent = EEvent.REGISTERED;
    const errorEvents = [EEvent.REGISTRATION_FAILED, EEvent.DISCONNECTED] as const;

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
