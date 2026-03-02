import { TypedEvents } from 'events-constructor';

import { EventEmitterProxy } from '../@EventEmitterProxy';

type TTestEventMap = {
  'test-event': { value: string };
  'void-event': never;
  'error-event': Error;
};

const EVENT_NAMES = ['test-event', 'void-event', 'error-event'] as const;

class TestEventEmitterProxy extends EventEmitterProxy<TTestEventMap> {
  public readonly events: TypedEvents<TTestEventMap>;

  public constructor() {
    const events = new TypedEvents<TTestEventMap>(EVENT_NAMES);

    super(events);
    this.events = events;
  }

  public triggerTestEvent(data: { value: string }) {
    this.events.trigger('test-event', data);
  }

  public triggerVoidEvent() {
    this.events.trigger('void-event');
  }

  public triggerErrorEvent(error: Error) {
    this.events.trigger('error-event', error);
  }
}

describe('EventEmitterProxy', () => {
  let proxy: TestEventEmitterProxy;

  beforeEach(() => {
    proxy = new TestEventEmitterProxy();
  });

  describe('on', () => {
    it('должен делегировать вызов в events.on', () => {
      const handler = jest.fn();
      const data = { value: 'test' };

      const unsubscribe = proxy.on('test-event', handler);

      expect(typeof unsubscribe).toBe('function');

      proxy.triggerTestEvent(data);

      expect(handler).toHaveBeenCalledWith(data);
    });

    it('должен возвращать функцию отписки', () => {
      const handler = jest.fn();
      const unsubscribe = proxy.on('test-event', handler);

      unsubscribe();
      proxy.triggerTestEvent({ value: 'ignored' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('once', () => {
    it('должен делегировать вызов в events.once', () => {
      const handler = jest.fn();
      const data = { value: 'test' };

      proxy.once('test-event', handler);

      proxy.triggerTestEvent(data);
      proxy.triggerTestEvent({ value: 'ignored' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(data);
    });

    it('должен возвращать функцию отписки', () => {
      const handler = jest.fn();
      const unsubscribe = proxy.once('test-event', handler);

      unsubscribe();
      proxy.triggerTestEvent({ value: 'ignored' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onRace', () => {
    it('должен делегировать вызов в events.onRace', () => {
      const handler = jest.fn();
      const data = { value: 'test' };

      proxy.onRace(['test-event', 'error-event'], handler);

      proxy.triggerTestEvent(data);

      expect(handler).toHaveBeenCalledWith(data, 'test-event');
    });
  });

  describe('onceRace', () => {
    it('должен делегировать вызов в events.onceRace', () => {
      const handler = jest.fn();
      const data = { value: 'test' };

      proxy.onceRace(['test-event', 'error-event'], handler);

      proxy.triggerTestEvent(data);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(data, 'test-event');
    });

    it('должен вызывать обработчик с первым сработавшим событием', () => {
      const handler = jest.fn();
      const error = new Error('test error');

      proxy.onceRace(['test-event', 'error-event'], handler);

      proxy.triggerErrorEvent(error);

      expect(handler).toHaveBeenCalledWith(error, 'error-event');
    });
  });

  describe('wait', () => {
    it('должен делегировать вызов в events.wait', async () => {
      const data = { value: 'test' };
      const waitPromise = proxy.wait('test-event');

      proxy.triggerTestEvent(data);

      const result = await waitPromise;

      expect(result).toEqual(data);
    });

    it('должен возвращать данные для события с payload', async () => {
      const error = new Error('test error');
      const waitPromise = proxy.wait('error-event');

      proxy.triggerErrorEvent(error);

      const result = await waitPromise;

      expect(result).toBe(error);
    });

    it('должен работать для void-событий', async () => {
      const waitPromise = proxy.wait('void-event');

      proxy.triggerVoidEvent();

      const result = await waitPromise;

      expect(result).toBeUndefined();
    });
  });

  describe('off', () => {
    it('должен делегировать вызов в events.off', () => {
      const handler = jest.fn();

      proxy.on('test-event', handler);
      proxy.off('test-event', handler);
      proxy.triggerTestEvent({ value: 'ignored' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('должен отписывать только указанный обработчик', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      proxy.on('test-event', handler1);
      proxy.on('test-event', handler2);
      proxy.off('test-event', handler1);
      proxy.triggerTestEvent({ value: 'test' });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith({ value: 'test' });
    });
  });

  describe('эквивалентность proxy и events', () => {
    it('proxy.on должен работать идентично events.on', () => {
      const handler = jest.fn();
      const data = { value: 'test' };

      proxy.on('test-event', handler);
      proxy.triggerTestEvent(data);

      expect(handler).toHaveBeenCalledWith(data);
    });

    it('proxy.once должен работать идентично events.once', () => {
      const handler = jest.fn();

      proxy.once('test-event', handler);
      proxy.triggerTestEvent({ value: 'first' });
      proxy.triggerTestEvent({ value: 'second' });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('proxy.wait должен работать идентично events.wait', async () => {
      const data = { value: 'test' };

      const waitPromise = proxy.wait('test-event');

      proxy.triggerTestEvent(data);

      const result = await waitPromise;

      expect(result).toEqual(data);
    });
  });
});
