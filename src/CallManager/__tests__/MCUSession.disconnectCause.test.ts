import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import UAMock from '@/__fixtures__/UA.mock';
import { EDisconnectCause } from '@/tools';
import createDisconnectRequest from '@/tools/disconnectCause/__fixtures__/createDisconnectRequest';
import { createEvents } from '../events';
import { MCUSession } from '../MCUSession';

import type { EndEvent, RTCSession, UA } from '@krivega/jssip';
import type { TCallEndEvent } from '@/tools';

const createEndEvent = (method: string, raw?: string): EndEvent => {
  return {
    originator: 'remote',
    cause: method === 'BYE' ? 'Terminated' : 'Canceled',
    message: createDisconnectRequest({ method, raw }),
  };
};

describe('Причина отключения основной сессии', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('должен передать причину BYE исходящего звонка и сохранить исходное событие', async () => {
    const events = createEvents();
    const session = new MCUSession(events);
    const ua = new UAMock({ uri: 'sip:user@example.com', register: false, sockets: [] });
    const ended = jest.fn<undefined, [TCallEndEvent]>();
    const fromServer = jest.fn<undefined, [TCallEndEvent]>();

    events.on('ended', ended);
    events.on('ended:fromserver', fromServer);

    const promise = session.startCall(
      ua as unknown as UA,
      (number) => {
        return `sip:${number}@example.com`;
      },
      {
        number: '100',
        mediaStream: new MediaStream(),
      },
    );

    await jest.advanceTimersByTimeAsync(1000);
    await promise;

    const rtcSession = ua.call.mock.results[0].value as RTCSessionMock;
    const event = createEndEvent('BYE', '1003');

    rtcSession.trigger('ended', event);

    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledWith({
      ...event,
      disconnectCause: {
        raw: '1003',
        code: 1003,
        key: EDisconnectCause.DISCONNECTED_BY_MODERATOR,
      },
    });
    expect(fromServer).toHaveBeenCalledWith(ended.mock.calls[0][0]);
    expect(event).not.toHaveProperty('disconnectCause');
    session.reset();
  });

  it('должен передать одну и ту же причину в событие ended и отклонение ожидания', async () => {
    const events = createEvents();
    const session = new MCUSession(events);
    const ua = new UAMock({ uri: 'sip:user@example.com', register: false, sockets: [] });
    const listener = jest.fn<undefined, [TCallEndEvent]>();

    events.on('ended', listener);

    const promise = session.startCall(
      ua as unknown as UA,
      (number) => {
        return `sip:${number}@example.com`;
      },
      {
        number: '100',
        mediaStream: new MediaStream(),
      },
    );
    const rejected = promise.catch((error: unknown) => {
      return error;
    });
    const rtcSession = ua.call.mock.results[0].value as RTCSessionMock;

    rtcSession.trigger('ended', createEndEvent('BYE', '1003'));

    const error = await rejected;

    expect(error).toMatchObject({ disconnectCause: { code: 1003 } });
    expect(error).toBe(listener.mock.calls[0][0]);
    session.reset();
  });

  it('должен передать одну и ту же причину в событие failed и отклонение ожидания', async () => {
    const events = createEvents();
    const session = new MCUSession(events);
    const ua = new UAMock({ uri: 'sip:user@example.com', register: false, sockets: [] });
    const listener = jest.fn<undefined, [TCallEndEvent]>();

    events.on('failed', listener);

    const promise = session.startCall(
      ua as unknown as UA,
      (number) => {
        return `sip:${number}@example.com`;
      },
      {
        number: '100',
        mediaStream: new MediaStream(),
      },
    );
    const rejected = promise.catch((error: unknown) => {
      return error;
    });
    const rtcSession = ua.call.mock.results[0].value as RTCSessionMock;

    rtcSession.trigger('failed', createEndEvent('CANCEL', '1003'));

    const error = await rejected;

    expect(error).toMatchObject({ disconnectCause: { code: 1003 } });
    expect(error).toBe(listener.mock.calls[0][0]);
    session.reset();
  });

  it('должен передать причину завершения принятого входящего звонка', async () => {
    const events = createEvents();
    const session = new MCUSession(events);
    const rtcSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });
    const ended = jest.fn<undefined, [TCallEndEvent]>();

    events.on('ended', ended);

    const promise = session.answerToIncomingCall(rtcSession as unknown as RTCSession, {
      mediaStream: new MediaStream(),
    });

    await jest.advanceTimersByTimeAsync(1000);
    await promise;
    rtcSession.trigger('ended', createEndEvent('BYE', '1004'));

    expect(ended).toHaveBeenCalledWith(
      expect.objectContaining({
        disconnectCause: { raw: '1004', code: 1004, key: EDisconnectCause.CONFERENCE_FINISHED },
      }),
    );
    session.reset();
    rtcSession.trigger('ended', createEndEvent('BYE', '1004'));
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('должен сохранить событие без заголовка без изменений', async () => {
    const events = createEvents();
    const session = new MCUSession(events);
    const rtcSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });
    const ended = jest.fn<undefined, [TCallEndEvent]>();

    events.on('ended', ended);

    const promise = session.answerToIncomingCall(rtcSession as unknown as RTCSession, {
      mediaStream: new MediaStream(),
    });

    await jest.advanceTimersByTimeAsync(1000);
    await promise;

    const event = createEndEvent('BYE');

    rtcSession.trigger('ended', event);

    expect(ended.mock.calls[0][0]).toBe(event);
    session.reset();
  });
});
