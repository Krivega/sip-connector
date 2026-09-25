import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import UAMock from '@/__fixtures__/UA.mock';
import { EDisconnectCause } from '@/DisconnectCause';
import createDisconnectRequest from '@/DisconnectCause/__fixtures__/createDisconnectRequest';
import { createEvents } from '../events';
import { MCUSession } from '../MCUSession';

import type { EndEvent, RTCSession, UA } from '@krivega/jssip';
import type { TCallEndEvent } from '@/DisconnectCause';
import type { TEvents } from '../events';

const SIP_SERVER_HOST = 'example.com';
const CALL_NUMBER = '100';
const SESSION_START_DELAY_MS = 1000;

const getUri = (number: string): string => {
  return `sip:${number}@${SIP_SERVER_HOST}`;
};

const createEndEvent = (method: string, raw?: string): EndEvent => {
  return {
    originator: 'remote',
    cause: method === 'BYE' ? 'Terminated' : 'Canceled',
    message: createDisconnectRequest({ method, raw }),
  };
};

describe('Причина отключения основной сессии', () => {
  let events: TEvents;
  let session: MCUSession;
  let mediaStream: MediaStream;
  let ended: jest.Mock<undefined, [TCallEndEvent]>;

  beforeEach(() => {
    jest.useFakeTimers();
    events = createEvents();
    session = new MCUSession(events);
    mediaStream = new MediaStream();
    ended = jest.fn<undefined, [TCallEndEvent]>();
    events.on('ended', ended);
  });

  afterEach(() => {
    session.reset();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Исходящий звонок', () => {
    let ua: UAMock;
    let callParameters: Parameters<MCUSession['startCall']>[2];

    beforeEach(() => {
      ua = new UAMock({ uri: getUri('user'), register: false, sockets: [] });
      callParameters = { number: CALL_NUMBER, mediaStream };
    });

    it('должен передать причину BYE и сохранить исходное событие', async () => {
      const fromServer = jest.fn<undefined, [TCallEndEvent]>();

      events.on('ended:fromserver', fromServer);

      const promise = session.startCall(ua as unknown as UA, getUri, callParameters);

      await jest.advanceTimersByTimeAsync(SESSION_START_DELAY_MS);
      await promise;

      const rtcSession = ua.call.mock.results[0].value as RTCSessionMock;
      const event = createEndEvent('BYE', '1003');
      const disconnectCause = {
        raw: '1003',
        code: 1003,
        key: EDisconnectCause.DISCONNECTED_BY_MODERATOR,
      };

      rtcSession.trigger('ended', event);

      expect(ended).toHaveBeenCalledTimes(1);
      expect(ended).toHaveBeenCalledWith({ ...event, disconnectCause });
      expect(fromServer).toHaveBeenCalledWith(ended.mock.calls[0][0]);
      expect(event).not.toHaveProperty('disconnectCause');
    });

    it('должен передать одну и ту же причину в событие ended и отклонение ожидания', async () => {
      const promise = session.startCall(ua as unknown as UA, getUri, callParameters);
      const rejected = promise.catch((error: unknown) => {
        return error;
      });
      const rtcSession = ua.call.mock.results[0].value as RTCSessionMock;
      const event = createEndEvent('BYE', '1003');

      rtcSession.trigger('ended', event);

      const error = await rejected;

      expect(error).toMatchObject({ disconnectCause: { code: 1003 } });
      expect(error).toBe(ended.mock.calls[0][0]);
    });

    it('должен передать одну и ту же причину в событие failed и отклонение ожидания', async () => {
      const failed = jest.fn<undefined, [TCallEndEvent]>();

      events.on('failed', failed);

      const promise = session.startCall(ua as unknown as UA, getUri, callParameters);
      const rejected = promise.catch((error: unknown) => {
        return error;
      });
      const rtcSession = ua.call.mock.results[0].value as RTCSessionMock;
      const event = createEndEvent('CANCEL', '1003');

      rtcSession.trigger('failed', event);

      const error = await rejected;

      expect(error).toMatchObject({ disconnectCause: { code: 1003 } });
      expect(error).toBe(failed.mock.calls[0][0]);
    });
  });

  describe('Принятый входящий звонок', () => {
    let rtcSession: RTCSessionMock;

    beforeEach(async () => {
      rtcSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });

      const promise = session.answerToIncomingCall(rtcSession as unknown as RTCSession, {
        mediaStream,
      });

      await jest.advanceTimersByTimeAsync(SESSION_START_DELAY_MS);
      await promise;
    });

    it('должен передать причину завершения', () => {
      const event = createEndEvent('BYE', '1004');
      const disconnectCause = {
        raw: '1004',
        code: 1004,
        key: EDisconnectCause.CONFERENCE_FINISHED,
      };

      rtcSession.trigger('ended', event);

      expect(ended).toHaveBeenCalledWith(expect.objectContaining({ disconnectCause }));
      expect(ended).toHaveBeenCalledTimes(1);
    });

    it('не должен передавать повторное событие ended после сброса сессии', () => {
      const event = createEndEvent('BYE', '1004');

      rtcSession.trigger('ended', event);
      session.reset();
      rtcSession.trigger('ended', event);

      expect(ended).toHaveBeenCalledTimes(1);
    });

    it('должен сохранить событие без заголовка без изменений', () => {
      const event = createEndEvent('BYE');

      rtcSession.trigger('ended', event);

      expect(ended.mock.calls[0][0]).toBe(event);
    });
  });
});
