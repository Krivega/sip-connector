import { getMockedLoggerDefault } from '@/__fixtures__/logger.mock';
import logger from '@/logger';
import { ConnectionStateMachine, EState } from '../ConnectionStateMachine';
import { createEvents } from '../events';

import type { IncomingResponse, Socket } from '@krivega/jssip';
import type { TEvents } from '../events';
import type { TConnectionConfiguration } from '../types';

jest.mock('@/logger');

describe('ConnectionStateMachine', () => {
  const mockLogger = getMockedLoggerDefault(logger);
  let events: TEvents;
  let stateMachine: ConnectionStateMachine;

  const baseConfiguration: TConnectionConfiguration = {
    sipServerIp: '192.168.0.1',
    sipServerUrl: 'sip.example.com',
    displayName: 'Test User',
    authorizationUser: 'testuser',
    register: false,
    user: 'testuser',
    password: 'password',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    events = createEvents();
    stateMachine = new ConnectionStateMachine(events);
  });

  afterEach(() => {
    stateMachine.destroy();
  });

  it('инициализируется в IDLE и без connectionConfiguration', () => {
    expect(stateMachine.state).toBe(EState.IDLE);
    expect(stateMachine.isIdle).toBe(true);
    expect(stateMachine.isPending).toBe(false);
    expect(stateMachine.getConnectionConfiguration()).toBeUndefined();
  });

  it('подписывается и отписывается от событий UA', () => {
    const onSpy = jest.spyOn(events, 'on');
    const offSpy = jest.spyOn(events, 'off');
    const localMachine = new ConnectionStateMachine(events);

    expect(onSpy).toHaveBeenCalledWith('connected', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('connecting', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('registered', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('unregistered', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('disconnecting', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('disconnected', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('registrationFailed', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('connect-failed', expect.any(Function));

    localMachine.destroy();
    expect(offSpy).toHaveBeenCalledTimes(8);
  });

  it('toStartConnect переводит в PREPARING и логирует переход', () => {
    mockLogger.mockClear();

    stateMachine.toStartConnect();

    expect(stateMachine.state).toBe(EState.PREPARING);
    expect(stateMachine.isPendingConnect).toBe(true);
    expect(mockLogger).toHaveBeenCalledWith(
      'State transition: connection:idle -> connection:preparing (START_CONNECT)',
    );
  });

  it('toStartUa переводит в CONNECTING и сохраняет configuration', () => {
    stateMachine.toStartConnect();
    stateMachine.toStartUa(baseConfiguration);

    expect(stateMachine.state).toBe(EState.CONNECTING);
    expect(stateMachine.getConnectionConfiguration()).toEqual(baseConfiguration);
  });

  it('копирует configuration при чтении', () => {
    stateMachine.toStartConnect();
    stateMachine.toStartUa(baseConfiguration);

    const configuration = stateMachine.getConnectionConfiguration();

    expect(configuration).toEqual(baseConfiguration);
    expect(configuration).not.toBe(baseConfiguration);
  });

  it('для register=false connected ведет в ESTABLISHED', () => {
    stateMachine.toStartConnect();
    stateMachine.toStartUa({ ...baseConfiguration, register: false });

    events.trigger('connected', { socket: {} as Socket });

    expect(stateMachine.state).toBe(EState.ESTABLISHED);
    expect(stateMachine.isEstablished).toBe(true);
    expect(stateMachine.isActiveConnection).toBe(true);
  });

  it('для register=true connected ведет в CONNECTED до registered', () => {
    stateMachine.toStartConnect();
    stateMachine.toStartUa({ ...baseConfiguration, register: true });

    events.trigger('connected', { socket: {} as Socket });
    expect(stateMachine.state).toBe(EState.CONNECTED);
    expect(stateMachine.isConnected).toBe(true);

    events.trigger('registered', { response: {} as IncomingResponse });
    expect(stateMachine.state).toBe(EState.ESTABLISHED);
  });

  it('isRegistered доступен и возвращает false для не-REGISTERED snapshot', () => {
    expect(stateMachine.isRegistered).toBe(false);

    stateMachine.toStartConnect();
    stateMachine.toStartUa({ ...baseConfiguration, register: true });
    events.trigger('connected', { socket: {} as Socket });
    events.trigger('registered', { response: {} as IncomingResponse });

    // REGISTERED в машине транзиентный: сразу переходит в ESTABLISHED
    expect(stateMachine.state).toBe(EState.ESTABLISHED);
    expect(stateMachine.isRegistered).toBe(false);
  });

  it('disconnecting/disconnected переводят в DISCONNECTING и DISCONNECTED', () => {
    stateMachine.toStartConnect();
    stateMachine.toStartUa(baseConfiguration);
    events.trigger('connected', { socket: {} as Socket });

    events.trigger('disconnecting', {});
    expect(stateMachine.state).toBe(EState.DISCONNECTING);
    expect(stateMachine.isDisconnecting).toBe(true);

    events.trigger('disconnected', { socket: {} as Socket, error: false });
    expect(stateMachine.state).toBe(EState.DISCONNECTED);
    expect(stateMachine.isDisconnected).toBe(true);
  });

  it('reset переводит в IDLE и очищает configuration только из DISCONNECTED', () => {
    stateMachine.toStartConnect();
    stateMachine.toStartUa(baseConfiguration);
    events.trigger('connected', { socket: {} as Socket });
    events.trigger('disconnected', { socket: {} as Socket, error: false });
    expect(stateMachine.getConnectionConfiguration()).toBeDefined();

    stateMachine.reset();

    expect(stateMachine.state).toBe(EState.IDLE);
    expect(stateMachine.getConnectionConfiguration()).toBeUndefined();
  });

  it('isActiveConnection возвращает false вне connected/registered/established', () => {
    expect(stateMachine.isActiveConnection).toBe(false);

    stateMachine.toStartConnect();
    expect(stateMachine.state).toBe(EState.PREPARING);
    expect(stateMachine.isActiveConnection).toBe(false);

    stateMachine.toStartUa(baseConfiguration);
    expect(stateMachine.state).toBe(EState.CONNECTING);
    expect(stateMachine.isActiveConnection).toBe(false);

    events.trigger('disconnected', { socket: {} as Socket, error: false });
    expect(stateMachine.state).toBe(EState.DISCONNECTED);
    expect(stateMachine.isActiveConnection).toBe(false);
  });

  it('isRegisterEnabled отражает register flag из configuration', () => {
    stateMachine.toStartConnect();
    stateMachine.toStartUa({ ...baseConfiguration, register: true });
    expect(stateMachine.isRegisterEnabled()).toBe(true);
  });

  it('невалидный toStartUa из IDLE логирует invalid transition', () => {
    mockLogger.mockClear();

    stateMachine.toStartUa(baseConfiguration);

    expect(stateMachine.state).toBe(EState.IDLE);
    expect(mockLogger).toHaveBeenCalledWith(
      'Invalid transition: START_UA from connection:idle. Event cannot be processed in current state.',
    );
  });

  it('onStateChange вызывает слушатели и поддерживает отписку', () => {
    const listener = jest.fn();
    const unsubscribe = stateMachine.onStateChange(listener);

    stateMachine.toStartConnect();
    expect(listener).toHaveBeenCalledWith(EState.PREPARING);

    unsubscribe();
    stateMachine.toStartUa(baseConfiguration);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
