import { EventEmitter } from 'node:events';

import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import { doMockSipConnector } from '@/doMock';
import { SipConnectorFacade } from '@/SipConnectorFacade';
import { EDisconnectCause } from '@/tools';
import createDisconnectRequest from '@/tools/disconnectCause/__fixtures__/createDisconnectRequest';

import type { RTCSession } from '@krivega/jssip';
import type { TIncomingCallManagerEventMap } from '@/IncomingCallManager';
import type { SipConnector } from '@/SipConnector';
import type { TCallEndEvent } from '@/tools';

const SESSION_START_DELAY_MS = 1000;
const MODERATOR_DISCONNECT_CAUSE = {
  raw: '1003',
  code: 1003,
  key: EDisconnectCause.DISCONNECTED_BY_MODERATOR,
};

const createEndEvent = (method: string, raw?: string) => {
  return {
    originator: 'remote' as const,
    cause: method === 'BYE' ? 'Terminated' : 'Canceled',
    message: createDisconnectRequest({ method, raw }),
  };
};

describe('Причина отключения входящего звонка через публичные события', () => {
  let sipConnector: SipConnector;
  let facade: SipConnectorFacade;
  let incomingCallManager: SipConnector['incomingCallManager'];
  let incomingFailed: jest.Mock<undefined, [TIncomingCallManagerEventMap['failedIncomingCall']]>;

  const receiveIncoming = () => {
    const session = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });

    sipConnector.connectionManager.events.trigger('newRTCSession', {
      originator: 'remote',
      session: session as unknown as RTCSession,
      request: createDisconnectRequest({ method: 'INVITE' }),
    });

    return session;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    sipConnector = doMockSipConnector();
    facade = new SipConnectorFacade(sipConnector);
    incomingCallManager = sipConnector.incomingCallManager;
    incomingFailed = jest.fn<undefined, [TIncomingCallManagerEventMap['failedIncomingCall']]>();

    facade.on('incoming-call:failedIncomingCall', incomingFailed);
  });

  afterEach(() => {
    facade.off('incoming-call:failedIncomingCall', incomingFailed);
    incomingCallManager.stop();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('До ответа', () => {
    let session: RTCSessionMock;
    let caller: TIncomingCallManagerEventMap['ringing'] | undefined;

    beforeEach(() => {
      session = receiveIncoming();
      caller = incomingCallManager.remoteCallerData;
    });

    it('должен передать причину BYE и сохранить данные звонящего', () => {
      const event = createEndEvent('BYE', '1003');

      session.trigger('ended', event);

      expect(incomingFailed).toHaveBeenCalledTimes(1);
      expect(incomingFailed).toHaveBeenCalledWith({
        ...caller,
        disconnectCause: MODERATOR_DISCONNECT_CAUSE,
      });
      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
    });

    it('должен передать причину CANCEL и сохранить данные звонящего', () => {
      const event = createEndEvent('CANCEL', '1003');

      session.trigger('failed', event);

      expect(incomingFailed).toHaveBeenCalledTimes(1);
      expect(incomingFailed).toHaveBeenCalledWith({
        ...caller,
        disconnectCause: MODERATOR_DISCONNECT_CAUSE,
      });
      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
    });

    it('должен сохранить прежние данные CANCEL без заголовка', () => {
      const event = createEndEvent('CANCEL');

      session.trigger('failed', event);

      expect(incomingFailed).toHaveBeenCalledWith({ ...caller, disconnectCause: undefined });
    });

    it('должен завершить входящий звонок при BYE без заголовка', () => {
      const event = createEndEvent('BYE');

      session.trigger('ended', event);

      expect(incomingFailed).toHaveBeenCalledTimes(1);
      expect(incomingFailed).toHaveBeenCalledWith({ ...caller, disconnectCause: undefined });
      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
      expect(incomingCallManager.remoteCallerData).toBeUndefined();
      expect(incomingCallManager.stateMachine.isFailed).toBe(true);

      session.trigger('ended', event);

      expect(incomingFailed).toHaveBeenCalledTimes(1);
    });

    it('должен завершить локально закончившийся входящий звонок без события ошибки', () => {
      const terminated = jest.fn();
      const event = { ...createEndEvent('BYE'), originator: 'local' as const };

      facade.on('incoming-call:terminatedIncomingCall', terminated);
      session.trigger('ended', event);

      expect(terminated).toHaveBeenCalledTimes(1);
      expect(terminated).toHaveBeenCalledWith(caller);
      expect(incomingFailed).not.toHaveBeenCalled();
      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
      expect(incomingCallManager.stateMachine.isTerminated).toBe(true);
    });

    it('должен передать неизвестную причину', () => {
      const event = createEndEvent('CANCEL', '9999');
      const disconnectCause = { raw: '9999', code: 9999 };

      session.trigger('failed', event);

      expect(incomingFailed.mock.calls[0][0].disconnectCause).toEqual(disconnectCause);
    });

    it('должен передать некорректную причину', () => {
      const event = createEndEvent('CANCEL', 'invalid');
      const disconnectCause = { raw: 'invalid' };

      session.trigger('failed', event);

      expect(incomingFailed.mock.calls[0][0].disconnectCause).toEqual(disconnectCause);
    });

    it('не должен передавать причину для локального завершения', () => {
      const terminated = jest.fn<
        undefined,
        [TIncomingCallManagerEventMap['terminatedIncomingCall']]
      >();
      const event = { ...createEndEvent('CANCEL', '1003'), originator: 'local' as const };

      facade.on('incoming-call:terminatedIncomingCall', terminated);
      session.trigger('failed', event);

      expect(incomingFailed).not.toHaveBeenCalled();
      expect(terminated.mock.calls[0][0]).not.toHaveProperty('disconnectCause');
    });

    it('не должен публиковать причину повторного завершения одной сессии', () => {
      const failedEvent = createEndEvent('CANCEL', '1003');
      const endedEvent = createEndEvent('BYE', '1003');

      session.trigger('failed', failedEvent);
      session.trigger('ended', endedEvent);

      expect(incomingFailed).toHaveBeenCalledTimes(1);
    });
  });

  describe('Передача сессии основному звонку', () => {
    let session: RTCSessionMock;

    beforeEach(() => {
      session = receiveIncoming();
    });

    it('должен передать причину только через основной звонок после ответа', async () => {
      const callEnded = jest.fn<undefined, [TCallEndEvent]>();
      const mediaStream = new MediaStream();
      const event = createEndEvent('BYE', '1003');

      facade.on('call:ended', callEnded);

      const answer = sipConnector.answerToIncomingCall({ mediaStream });

      await jest.advanceTimersByTimeAsync(SESSION_START_DELAY_MS);
      await answer;
      session.trigger('ended', event);

      expect(callEnded).toHaveBeenCalledTimes(1);
      expect(callEnded.mock.calls[0][0].disconnectCause?.code).toBe(1003);
      expect(incomingFailed).not.toHaveBeenCalled();
    });

    it('не должен привязывать причину BYE старой сессии к новому входящему звонку', () => {
      incomingCallManager.extractIncomingRTCSession();

      const current = receiveIncoming();
      const event = createEndEvent('BYE', '1003');

      session.trigger('ended', event);

      expect(incomingFailed).not.toHaveBeenCalled();
      expect(incomingCallManager.getIncomingRTCSession()).toBe(current);
    });
  });

  it('не должен публиковать причину, если другой обработчик уже передал сессию на ответ', () => {
    const { remote_identity: remoteIdentity } = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });
    // JsSIP использует EventEmitter: удаление подписки не отменяет уже начатый emit.
    // eslint-disable-next-line unicorn/prefer-event-target
    const emittingSession = Object.assign(new EventEmitter(), { remote_identity: remoteIdentity });
    const event = createEndEvent('BYE', '1003');

    emittingSession.on('ended', () => {
      incomingCallManager.extractIncomingRTCSession();
    });
    sipConnector.connectionManager.events.trigger('newRTCSession', {
      originator: 'remote',
      session: emittingSession as unknown as RTCSession,
      request: createDisconnectRequest({ method: 'INVITE' }),
    });

    emittingSession.emit('ended', event);

    expect(incomingFailed).not.toHaveBeenCalled();
    expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
  });
});
