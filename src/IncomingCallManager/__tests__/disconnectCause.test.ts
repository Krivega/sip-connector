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
    incomingFailed = jest.fn<undefined, [TIncomingCallManagerEventMap['failedIncomingCall']]>();

    facade.on('incoming-call:failedIncomingCall', incomingFailed);
  });

  afterEach(() => {
    facade.off('incoming-call:failedIncomingCall', incomingFailed);
    sipConnector.incomingCallManager.stop();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('должен передать причину BYE до ответа и сохранить данные звонящего', () => {
    const session = receiveIncoming();
    const caller = sipConnector.incomingCallManager.remoteCallerData;

    session.trigger('ended', createEndEvent('BYE', '1003'));

    expect(incomingFailed).toHaveBeenCalledTimes(1);
    expect(incomingFailed).toHaveBeenCalledWith({
      ...caller,
      disconnectCause: {
        raw: '1003',
        code: 1003,
        key: EDisconnectCause.DISCONNECTED_BY_MODERATOR,
      },
    });
    expect(sipConnector.incomingCallManager.isAvailableIncomingCall).toBe(false);
  });

  it('должен передать причину CANCEL до ответа и сохранить данные звонящего', () => {
    const session = receiveIncoming();
    const caller = sipConnector.incomingCallManager.remoteCallerData;

    session.trigger('failed', createEndEvent('CANCEL', '1003'));

    expect(incomingFailed).toHaveBeenCalledTimes(1);
    expect(incomingFailed).toHaveBeenCalledWith({
      ...caller,
      disconnectCause: {
        raw: '1003',
        code: 1003,
        key: EDisconnectCause.DISCONNECTED_BY_MODERATOR,
      },
    });
    expect(sipConnector.incomingCallManager.isAvailableIncomingCall).toBe(false);
  });

  it('должен сохранить прежние данные CANCEL без заголовка', () => {
    const session = receiveIncoming();
    const caller = sipConnector.incomingCallManager.remoteCallerData;

    session.trigger('failed', createEndEvent('CANCEL'));

    expect(incomingFailed).toHaveBeenCalledWith({ ...caller, disconnectCause: undefined });
  });

  it('не должен добавлять событие для BYE без заголовка', () => {
    const session = receiveIncoming();

    session.trigger('ended', createEndEvent('BYE'));

    expect(incomingFailed).not.toHaveBeenCalled();
  });

  it('должен передать неизвестную и некорректную причину', () => {
    receiveIncoming().trigger('failed', createEndEvent('CANCEL', '9999'));
    receiveIncoming().trigger('failed', createEndEvent('CANCEL', 'invalid'));

    expect(incomingFailed.mock.calls[0][0].disconnectCause).toEqual({ raw: '9999', code: 9999 });
    expect(incomingFailed.mock.calls[1][0].disconnectCause).toEqual({ raw: 'invalid' });
  });

  it('не должен передавать причину для локального завершения', () => {
    const session = receiveIncoming();
    const terminated = jest.fn<
      undefined,
      [TIncomingCallManagerEventMap['terminatedIncomingCall']]
    >();

    facade.on('incoming-call:terminatedIncomingCall', terminated);
    session.trigger('failed', { ...createEndEvent('CANCEL', '1003'), originator: 'local' });

    expect(incomingFailed).not.toHaveBeenCalled();
    expect(terminated.mock.calls[0][0]).not.toHaveProperty('disconnectCause');
  });

  it('должен передать причину только через основной звонок после ответа', async () => {
    const session = receiveIncoming();
    const callEnded = jest.fn<undefined, [TCallEndEvent]>();

    facade.on('call:ended', callEnded);

    const answer = sipConnector.answerToIncomingCall({ mediaStream: new MediaStream() });

    await jest.advanceTimersByTimeAsync(1000);
    await answer;
    session.trigger('ended', createEndEvent('BYE', '1003'));

    expect(callEnded).toHaveBeenCalledTimes(1);
    expect(callEnded.mock.calls[0][0].disconnectCause?.code).toBe(1003);
    expect(incomingFailed).not.toHaveBeenCalled();
  });

  it('не должен привязывать причину BYE старой сессии к новому входящему звонку', () => {
    const previous = receiveIncoming();

    sipConnector.incomingCallManager.extractIncomingRTCSession();

    const current = receiveIncoming();

    previous.trigger('ended', createEndEvent('BYE', '1003'));

    expect(incomingFailed).not.toHaveBeenCalled();
    expect(sipConnector.incomingCallManager.getIncomingRTCSession()).toBe(current);
  });

  it('не должен публиковать причину, если другой обработчик уже передал сессию на ответ', () => {
    const { remote_identity: remoteIdentity } = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });
    // JsSIP использует EventEmitter: удаление подписки не отменяет уже начатый emit.
    // eslint-disable-next-line unicorn/prefer-event-target
    const session = Object.assign(new EventEmitter(), { remote_identity: remoteIdentity });

    session.on('ended', () => {
      sipConnector.incomingCallManager.extractIncomingRTCSession();
    });
    sipConnector.connectionManager.events.trigger('newRTCSession', {
      originator: 'remote',
      session: session as unknown as RTCSession,
      request: createDisconnectRequest({ method: 'INVITE' }),
    });

    session.emit('ended', createEndEvent('BYE', '1003'));

    expect(incomingFailed).not.toHaveBeenCalled();
    expect(sipConnector.incomingCallManager.isAvailableIncomingCall).toBe(false);
  });

  it('не должен публиковать причину повторного завершения одной сессии', () => {
    const session = receiveIncoming();

    session.trigger('failed', createEndEvent('CANCEL', '1003'));
    session.trigger('ended', createEndEvent('BYE', '1003'));

    expect(incomingFailed).toHaveBeenCalledTimes(1);
  });
});
