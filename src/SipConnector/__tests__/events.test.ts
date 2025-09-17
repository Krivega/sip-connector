import JsSIP from '@/__fixtures__/jssip.mock';
import SipConnector from '../@SipConnector';

import type { TJsSIP } from '@/types';

describe('SipConnector events', () => {
  let sipConnector: SipConnector;

  beforeEach(() => {
    sipConnector = new SipConnector({
      JsSIP: JsSIP as unknown as TJsSIP,
    });
  });

  it('should have events property', () => {
    expect(sipConnector.events).toBeDefined();
    expect(typeof sipConnector.events.on).toBe('function');
    expect(typeof sipConnector.events.off).toBe('function');
    expect(typeof sipConnector.events.once).toBe('function');
    expect(typeof sipConnector.events.wait).toBe('function');
  });

  it('should handle events correctly', async () => {
    const mockHandler = jest.fn();

    // Подписываемся на событие
    sipConnector.events.on('connection:connecting', mockHandler);

    // Эмитим событие
    sipConnector.events.trigger('connection:connecting', { data: 'test' });

    // Проверяем, что обработчик был вызван
    expect(mockHandler).toHaveBeenCalledWith({ data: 'test' });

    // Отписываемся от события
    sipConnector.events.off('connection:connecting', mockHandler);

    // Эмитим событие снова
    sipConnector.events.trigger('connection:connecting', { data: 'test2' });

    // Проверяем, что обработчик не был вызван снова
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('should support once events', () => {
    const mockHandler = jest.fn();

    // Подписываемся на событие один раз
    sipConnector.events.once('connection:connected', mockHandler);

    // Эмитим событие
    sipConnector.events.trigger('connection:connected', { data: 'test' });

    // Проверяем, что обработчик был вызван
    expect(mockHandler).toHaveBeenCalledWith({ data: 'test' });

    // Эмитим событие снова
    sipConnector.events.trigger('connection:connected', { data: 'test2' });

    // Проверяем, что обработчик не был вызван снова
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('should support wait events', async () => {
    // Запускаем ожидание события
    const waitPromise = sipConnector.events.wait('connection:registered');

    // Эмитим событие
    sipConnector.events.trigger('connection:registered', { data: 'test' });

    // Проверяем, что промис разрешился с правильными данными
    const result = await waitPromise;

    expect(result).toEqual({ data: 'test' });
  });

  it('should handle events from different managers with prefixes', () => {
    const autoConnectHandler = jest.fn();
    const connectionHandler = jest.fn();
    const callHandler = jest.fn();
    const apiHandler = jest.fn();
    const incomingCallHandler = jest.fn();
    const presentationHandler = jest.fn();
    const statsHandler = jest.fn();

    // Подписываемся на события от разных менеджеров
    sipConnector.events.on('auto-connect:connected', autoConnectHandler);
    sipConnector.events.on('connection:connecting', connectionHandler);
    sipConnector.events.on('call:accepted', callHandler);
    sipConnector.events.on('api:channels', apiHandler);
    sipConnector.events.on('incoming-call:incomingCall', incomingCallHandler);
    sipConnector.events.on('presentation:presentation:start', presentationHandler);
    sipConnector.events.on('stats:collected', statsHandler);

    const stats = {
      outbound: {
        additional: {
          candidatePair: { availableOutgoingBitrate: 1000 },
        },
      },
      inbound: {
        additional: {
          candidatePair: { availableIncomingBitrate: 1000 },
        },
      },
    };

    // Эмитим события от разных менеджеров
    sipConnector.autoConnectorManager.events.trigger('connected', {});
    sipConnector.connectionManager.events.trigger('connecting', { data: 'connection' });
    sipConnector.callManager.events.trigger('accepted', { data: 'call' });
    sipConnector.apiManager.events.trigger('channels', { data: 'api' });
    sipConnector.incomingCallManager.events.trigger('incomingCall', { data: 'incoming' });
    sipConnector.presentationManager.events.trigger('presentation:start', { data: 'presentation' });
    // @ts-expect-error
    sipConnector.statsManager.events.trigger('collected', stats);

    // Проверяем, что каждый обработчик был вызван с правильными данными
    expect(autoConnectHandler).toHaveBeenCalledWith({});
    expect(connectionHandler).toHaveBeenCalledWith({ data: 'connection' });
    expect(callHandler).toHaveBeenCalledWith({ data: 'call' });
    expect(apiHandler).toHaveBeenCalledWith({ data: 'api' });
    expect(incomingCallHandler).toHaveBeenCalledWith({ data: 'incoming' });
    expect(presentationHandler).toHaveBeenCalledWith({ data: 'presentation' });
    expect(statsHandler).toHaveBeenCalledWith(stats);

    // Проверяем, что каждый обработчик был вызван только один раз
    expect(autoConnectHandler).toHaveBeenCalledTimes(1);
    expect(connectionHandler).toHaveBeenCalledTimes(1);
    expect(callHandler).toHaveBeenCalledTimes(1);
    expect(apiHandler).toHaveBeenCalledTimes(1);
    expect(incomingCallHandler).toHaveBeenCalledTimes(1);
    expect(presentationHandler).toHaveBeenCalledTimes(1);
    expect(statsHandler).toHaveBeenCalledTimes(1);
  });
});
