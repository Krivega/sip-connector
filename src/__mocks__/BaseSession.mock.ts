import Events from 'events-constructor';
import { SESSION_EVENT_NAMES } from '../eventNames';
import type { TEventSession } from '../eventNames';

/* eslint-disable class-methods-use-this */

/**
 * BaseSession
 * @class
 */
class BaseSession {
  originator: string;

  _events: Events<typeof SESSION_EVENT_NAMES>;

  _mutedOptions = { audio: false, video: false };

  constructor({ originator = 'local', eventHandlers }) {
    this.originator = originator;
    this._events = new Events<typeof SESSION_EVENT_NAMES>(SESSION_EVENT_NAMES);
    this.initEvents(eventHandlers);
  }

  /**
   * initEvents
   *
   * @param {Array} [eventHandlers=[] - ]  The event handlers
   *
   * @returns {undefined}
   */
  initEvents(eventHandlers = []) {
    Object.entries(eventHandlers).forEach(([eventName, handler]) => {
      return this.on(eventName, handler);
    });
  }

  /**
   * on
   *
   * @param {string}   eventName - eventName
   * @param {Function} handler   - handler
   *
   * @returns {undefined}
   */
  on(eventName, handler) {
    this._events.on(eventName, handler);
  }

  trigger(eventName: TEventSession, data?: any) {
    this._events.trigger(eventName, data);
  }

  /**
   * sendDTMF
   *
   * @param {object} options - options
   *
   * @returns {undefined}
   */
  sendDTMF() {
    this.trigger('newDTMF', { originator: this.originator });
  }

  startPresentation(stream) {
    return Promise.resolve(stream);
  }

  stopPresentation() {
    return Promise.resolve();
  }

  isEstablished() {
    return true;
  }
}

export default BaseSession;
