import type { RegisteredEvent, UA, UnRegisteredEvent } from '@krivega/jssip';
import type Events from 'events-constructor';
import {
  CONNECTING,
  DISCONNECTED,
  REGISTERED,
  REGISTRATION_FAILED,
  UNREGISTERED,
} from '../constants';
import type { UA_EVENT_NAMES } from '../eventNames';
import logger from '../logger';

interface IDependencies {
  uaEvents: Events<typeof UA_EVENT_NAMES>;
  getUa: () => UA | undefined;
}

export default class RegistrationManager {
  private readonly uaEvents: IDependencies['uaEvents'];

  private readonly getUa: IDependencies['getUa'];

  public constructor(dependencies: IDependencies) {
    this.uaEvents = dependencies.uaEvents;
    this.getUa = dependencies.getUa;
  }

  public async register(): Promise<RegisteredEvent> {
    const ua = this.getUa();

    if (!ua) {
      throw new Error('UA is not initialized');
    }

    return new Promise((resolve, reject) => {
      ua.on(REGISTERED, resolve);
      ua.on(REGISTRATION_FAILED, reject);
      ua.register();
    });
  }

  public async unregister(): Promise<UnRegisteredEvent> {
    const ua = this.getUa();

    if (!ua) {
      throw new Error('UA is not initialized');
    }

    return new Promise((resolve) => {
      ua.on(UNREGISTERED, resolve);
      ua.unregister();
    });
  }

  public async tryRegister(): Promise<RegisteredEvent> {
    const ua = this.getUa();

    if (!ua) {
      throw new Error('UA is not initialized');
    }

    this.uaEvents.trigger(CONNECTING, undefined);

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
    const successEvent = REGISTERED;
    const errorEvents = [REGISTRATION_FAILED, DISCONNECTED] as const;

    this.uaEvents.on(successEvent, onSuccess);
    errorEvents.forEach((errorEvent) => {
      this.uaEvents.on(errorEvent, onError);
    });

    return () => {
      this.uaEvents.off(successEvent, onSuccess);
      errorEvents.forEach((errorEvent) => {
        this.uaEvents.off(errorEvent, onError);
      });
    };
  }
}
