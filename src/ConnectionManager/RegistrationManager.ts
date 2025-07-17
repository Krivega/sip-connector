/* eslint-disable class-methods-use-this */
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

export default class RegistrationManager {
  private readonly uaEvents: Events<typeof UA_EVENT_NAMES>;

  public constructor(uaEvents: Events<typeof UA_EVENT_NAMES>) {
    this.uaEvents = uaEvents;
  }

  public async register(ua: UA): Promise<RegisteredEvent> {
    return new Promise((resolve, reject) => {
      ua.on(REGISTERED, resolve);
      ua.on(REGISTRATION_FAILED, reject);
      ua.register();
    });
  }

  public async unregister(ua: UA): Promise<UnRegisteredEvent> {
    return new Promise((resolve) => {
      ua.on(UNREGISTERED, resolve);
      ua.unregister();
    });
  }

  public async tryRegister(ua: UA): Promise<RegisteredEvent> {
    this.uaEvents.trigger(CONNECTING, undefined);

    try {
      await this.unregister(ua);
    } catch (error) {
      logger('tryRegister', error);
    }

    return this.register(ua);
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
