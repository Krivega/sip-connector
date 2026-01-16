import JsSIP from '@/__fixtures__/jssip.mock';
import SipConnector from '../@SipConnector';

import type { IncomingResponse, Socket } from '@krivega/jssip';
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
    sipConnector.events.trigger('connection:connecting', {
      socket: {} as Socket,
      attempts: 1,
    });

    // Проверяем, что обработчик был вызван
    expect(mockHandler).toHaveBeenCalledWith({ socket: {} as Socket, attempts: 1 });

    // Отписываемся от события
    sipConnector.events.off('connection:connecting', mockHandler);

    // Эмитим событие снова
    sipConnector.events.trigger('connection:connecting', { socket: {} as Socket, attempts: 1 });

    // Проверяем, что обработчик не был вызван снова
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('should support once events', () => {
    const mockHandler = jest.fn();

    // Подписываемся на событие один раз
    sipConnector.events.once('connection:connected', mockHandler);

    // Эмитим событие
    sipConnector.events.trigger('connection:connected', { socket: {} as Socket });

    // Проверяем, что обработчик был вызван
    expect(mockHandler).toHaveBeenCalledWith({ socket: {} as Socket });

    // Эмитим событие снова
    sipConnector.events.trigger('connection:connected', { socket: {} as Socket });

    // Проверяем, что обработчик не был вызван снова
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('should support wait events', async () => {
    // Запускаем ожидание события
    const waitPromise = sipConnector.events.wait('connection:registered');

    // Эмитим событие
    sipConnector.events.trigger('connection:registered', { response: {} as IncomingResponse });

    // Проверяем, что промис разрешился с правильными данными
    const result = await waitPromise;

    expect(result).toEqual({ response: {} as IncomingResponse });
  });

  it('should handle events from different managers with prefixes', () => {
    const autoConnectHandler = jest.fn();
    const connectionHandler = jest.fn();
    const callHandler = jest.fn();
    const conferenceStateHandler = jest.fn();
    const conferenceStateResetHandler = jest.fn();
    const apiHandler = jest.fn();
    const incomingCallHandler = jest.fn();
    const presentationHandler = jest.fn();
    const statsHandler = jest.fn();
    const mainStreamHealthHandler = jest.fn();

    // Подписываемся на события от разных менеджеров
    sipConnector.events.on('auto-connect:success', autoConnectHandler);
    sipConnector.events.on('connection:connecting', connectionHandler);
    sipConnector.events.on('call:accepted', callHandler);
    sipConnector.events.on('conference-state:state-changed', conferenceStateHandler);
    sipConnector.events.on('conference-state:state-reset', conferenceStateResetHandler);
    sipConnector.events.on('api:channels:all', apiHandler);
    sipConnector.events.on('incoming-call:ringing', incomingCallHandler);
    sipConnector.events.on('presentation:presentation:start', presentationHandler);
    sipConnector.events.on('stats:collected', statsHandler);
    sipConnector.events.on('main-stream-health:no-inbound-frames', mainStreamHealthHandler);

    const stats = {
      outbound: {
        additional: {
          candidatePair: { availableOutgoingBitrate: 1000 },
        },
      },
      inbound: {
        video: {},
        additional: {
          candidatePair: { availableIncomingBitrate: 1000 },
        },
      },
    };

    // Эмитим события от разных менеджеров
    sipConnector.autoConnectorManager.events.trigger('success');
    sipConnector.connectionManager.events.trigger('connecting', {
      socket: {} as Socket,
      attempts: 1,
    });
    sipConnector.callManager.events.trigger('accepted', { data: 'call' });
    sipConnector.apiManager.events.trigger('channels:all', {
      inputChannels: '1',
      outputChannels: '2',
    });
    sipConnector.conferenceStateManager.events.trigger('state-changed', {
      previous: {},
      current: { number: '123', answer: true },
      updates: { number: '123', answer: true },
    });
    sipConnector.conferenceStateManager.events.trigger('state-reset', {});
    sipConnector.incomingCallManager.events.trigger('ringing', {
      displayName: 'incoming',
      host: 'incoming',
      incomingNumber: 'incoming',
    });

    const mediaStream = new MediaStream();

    sipConnector.presentationManager.events.trigger('presentation:start', mediaStream);
    // @ts-expect-error
    sipConnector.statsManager.events.trigger('collected', stats);

    sipConnector.mainStreamHealthMonitor.events.trigger('no-inbound-frames', {});

    // Проверяем, что каждый обработчик был вызван с правильными данными
    expect(autoConnectHandler).toHaveBeenCalledWith(undefined);
    expect(connectionHandler).toHaveBeenCalledWith({
      socket: {} as Socket,
      attempts: 1,
    });
    expect(callHandler).toHaveBeenCalledWith({ data: 'call' });
    expect(conferenceStateHandler).toHaveBeenCalledWith({
      previous: {},
      current: { number: '123', answer: true },
      updates: { number: '123', answer: true },
    });
    expect(conferenceStateResetHandler).toHaveBeenCalledWith({});
    // channels вызывает updateState, который триггерит state-changed
    // поэтому conferenceStateHandler вызывается дважды: один раз напрямую, один раз через channels
    expect(conferenceStateHandler).toHaveBeenCalledTimes(2);
    expect(apiHandler).toHaveBeenCalledWith({ inputChannels: '1', outputChannels: '2' });
    expect(incomingCallHandler).toHaveBeenCalledWith({
      displayName: 'incoming',
      host: 'incoming',
      incomingNumber: 'incoming',
    });
    expect(presentationHandler).toHaveBeenCalledWith(mediaStream);
    expect(statsHandler).toHaveBeenCalledWith(stats);
    expect(mainStreamHealthHandler).toHaveBeenCalledWith({});

    // Проверяем, что каждый обработчик был вызван только один раз
    expect(autoConnectHandler).toHaveBeenCalledTimes(1);
    expect(connectionHandler).toHaveBeenCalledTimes(1);
    expect(callHandler).toHaveBeenCalledTimes(1);
    // conferenceStateHandler вызывается дважды: один раз напрямую, один раз через channels->updateState
    expect(conferenceStateResetHandler).toHaveBeenCalledTimes(1);
    expect(apiHandler).toHaveBeenCalledTimes(1);
    expect(incomingCallHandler).toHaveBeenCalledTimes(1);
    expect(presentationHandler).toHaveBeenCalledTimes(1);
    expect(statsHandler).toHaveBeenCalledTimes(1);
    expect(mainStreamHealthHandler).toHaveBeenCalledTimes(1);
  });

  it('should handle conference-state events correctly', () => {
    const stateChangedHandler = jest.fn();
    const stateResetHandler = jest.fn();

    // Подписываемся на события conference-state
    sipConnector.events.on('conference-state:state-changed', stateChangedHandler);
    sipConnector.events.on('conference-state:state-reset', stateResetHandler);

    // Эмитим события
    const previousState = { number: '123' };
    const currentState = { number: '123', answer: true };
    const updates = { answer: true };

    sipConnector.conferenceStateManager.events.trigger('state-changed', {
      previous: previousState,
      current: currentState,
      updates,
    });

    sipConnector.conferenceStateManager.events.trigger('state-reset', {});

    // Проверяем, что обработчики были вызваны с правильными данными
    expect(stateChangedHandler).toHaveBeenCalledWith({
      previous: previousState,
      current: currentState,
      updates,
    });
    expect(stateResetHandler).toHaveBeenCalledWith({});

    // Проверяем, что каждый обработчик был вызван только один раз
    expect(stateChangedHandler).toHaveBeenCalledTimes(1);
    expect(stateResetHandler).toHaveBeenCalledTimes(1);
  });
});
