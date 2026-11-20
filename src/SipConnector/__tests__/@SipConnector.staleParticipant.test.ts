/// <reference types="jest" />

import { C as JsSIP_C } from '@krivega/jssip';

import JsSIP from '@/__fixtures__/jssip.mock';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import UAMock from '@/__fixtures__/UA.mock';
import hasCanceledCallError from '@/CallManager/hasCanceledCallError';
import SipConnector from '../@SipConnector';

import type { RTCSession, UA } from '@krivega/jssip';
import type { TConnectionConfig } from '@/ConnectionManager';
import type { TJsSIP } from '@/types';

type TFetchResponse = { ok: boolean; status: number };
type TPendingRequest = {
  init: RequestInit;
  respond: (status: number) => void;
};

const SIP_SERVER_URL = 'dev.vinteo.com';
const DISCONNECT_URL = `https://${SIP_SERVER_URL}/api/v2/participants/self/disconnect`;

// Макрозадача: запрос отключения и его обработка проходят несколько цепочек Promise.
const flush = async (ms = 0) => {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const settle = async (promise: Promise<unknown>) => {
  return promise.then(
    () => {
      return { isRejected: false, error: undefined };
    },
    (error: unknown) => {
      return { isRejected: true, error };
    },
  );
};

const waitUntil = async (predicate: () => boolean): Promise<void> => {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt > 1000) {
      throw new Error('Condition was not met within 1000ms');
    }

    // eslint-disable-next-line no-await-in-loop
    await flush(5);
  }
};

const createSubject = ({ isRegistered = true }: { isRegistered?: boolean } = {}) => {
  const connector = new SipConnector(
    { JsSIP: JsSIP as unknown as TJsSIP },
    {
      callReconnectOptions: {
        baseBackoffMs: 1,
        maxBackoffMs: 1,
        backoffFactor: 1,
        jitter: 'none',
      },
    },
  );
  const ua = new UAMock({ uri: `sip:user@${SIP_SERVER_URL}`, register: false, sockets: [] });
  const failedListener = jest.fn();
  const callParameters = { number: '1000', mediaStream: new MediaStream() };

  jest.spyOn(connector.connectionManager, 'getUaProtected').mockReturnValue(ua as unknown as UA);
  jest
    .spyOn(connector.connectionManager, 'getConnectionConfiguration')
    .mockReturnValue({ sipServerUrl: SIP_SERVER_URL } as TConnectionConfig);
  jest.spyOn(connector.connectionManager, 'isRegistered', 'get').mockReturnValue(isRegistered);
  connector.callManager.on('failed', failedListener);

  const enterRoom = (token: string) => {
    connector.callManager.events.trigger('start-call', { number: '1000', answer: false });
    connector.apiManager.events.trigger('enter-room', { room: '1000', participantName: 'p1' });
    connector.apiManager.events.trigger('conference:participant-token-issued', {
      jwt: token,
      conference: '1000',
      participant: 'p1',
    });
    expect(connector.callManager.stateMachine.state).toBe('call:inRoom');
  };

  // Прошлый звонок вошёл в комнату и оборвался локально: участник остался на сервере.
  const leaveStaleParticipant = (token = 'token-1') => {
    enterRoom(token);
    connector.callManager.events.trigger('ended', {
      originator: 'local',
      cause: JsSIP_C.causes.RTP_TIMEOUT,
    } as never);
    failedListener.mockClear();
  };

  // Прошлый звонок с перезвоном оборвался из-за транспорта: перезвон и отключение участника.
  const breakArmedCallBySystem = (token = 'token-1') => {
    connector.armCallAutoRedial({
      getCallParameters: async () => {
        return callParameters;
      },
    });
    enterRoom(token);
    connector.callManager.events.trigger('ended', {
      originator: 'system',
      cause: JsSIP_C.causes.CONNECTION_ERROR,
    } as never);
    failedListener.mockClear();
  };

  return {
    connector,
    ua,
    failedListener,
    callParameters,
    leaveStaleParticipant,
    breakArmedCallBySystem,
  };
};

describe('SipConnector: отключение устаревшего участника перед звонком', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock<Promise<TFetchResponse>, [string, RequestInit]>;
  let requests: TPendingRequest[];
  let subjects: ReturnType<typeof createSubject>[];

  const setup = (options?: { isRegistered?: boolean }) => {
    const subject = createSubject(options);

    subjects.push(subject);

    return subject;
  };

  beforeEach(() => {
    requests = [];
    subjects = [];
    fetchMock = jest.fn<Promise<TFetchResponse>, [string, RequestInit]>(async (_url, init) => {
      return new Promise<TFetchResponse>((resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
        requests.push({
          init,
          respond: (status) => {
            resolve({ ok: status >= 200 && status < 300, status });
          },
        });
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(async () => {
    subjects.forEach(({ connector }) => {
      connector.callReconnectManager.stop();
    });
    await Promise.all(
      subjects.map(async ({ connector }) => {
        return connector.callManager.endCall();
      }),
    );
    global.fetch = originalFetch;
  });

  it('call() отправляет INVITE только после ответа 401 на запрос отключения прежнего подключения', async () => {
    const subject = setup();

    subject.leaveStaleParticipant('token-1');

    const call = settle(subject.connector.call(subject.callParameters));

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(DISCONNECT_URL);
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe(
      'Bearer token-1',
    );
    expect(subject.connector.requestedCall).toBe(true);
    expect(subject.connector.callManager.stateMachine.state).toBe('call:connecting');
    expect(subject.ua.call).not.toHaveBeenCalled();

    requests[0].respond(401);
    await flush();

    expect(subject.ua.call).toHaveBeenCalledTimes(1);

    await subject.connector.callManager.endCall();
    await call;
  });

  it('call() отправляет INVITE через UA, актуальный после запроса отключения', async () => {
    const subject = setup();
    const nextUa = new UAMock({ uri: `sip:user@${SIP_SERVER_URL}`, register: false, sockets: [] });

    subject.leaveStaleParticipant();

    const call = settle(subject.connector.call(subject.callParameters));

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    jest
      .spyOn(subject.connector.connectionManager, 'getUaProtected')
      .mockReturnValue(nextUa as unknown as UA);
    requests[0].respond(401);
    await flush();

    expect(nextUa.call).toHaveBeenCalledTimes(1);
    expect(subject.ua.call).not.toHaveBeenCalled();

    await subject.connector.callManager.endCall();
    await call;
  });

  it('call() отклоняется ошибкой отключения, сообщает failed с INTERNAL_ERROR и не армирует перезвон', async () => {
    const subject = setup();

    subject.leaveStaleParticipant();

    const call = settle(subject.connector.call(subject.callParameters, { autoRedial: true }));

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    requests[0].respond(500);

    const { isRejected, error } = await call;

    expect(isRejected).toBe(true);
    expect((error as Error).message).toBe('Stale participant disconnect failed with status 500');
    expect(subject.failedListener).toHaveBeenCalledTimes(1);
    expect(subject.failedListener).toHaveBeenCalledWith(
      expect.objectContaining({ originator: 'local', cause: JsSIP_C.causes.INTERNAL_ERROR }),
    );
    expect(subject.connector.requestedCall).toBe(false);
    expect(subject.connector.callReconnectManager.state).toBe('idle');
    expect(subject.ua.call).not.toHaveBeenCalled();
  });

  it('hangUp() во время запроса отменяет звонок: failed с CANCELED, без INVITE, машина звонка не зависает в отключении', async () => {
    const subject = setup();

    subject.leaveStaleParticipant();

    const call = settle(subject.connector.call(subject.callParameters, { autoRedial: true }));

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await subject.connector.hangUp();

    const { isRejected, error } = await call;

    expect(isRejected).toBe(true);
    expect(hasCanceledCallError(error)).toBe(true);
    expect(requests[0].init.signal?.aborted).toBe(true);
    expect(subject.failedListener).toHaveBeenCalledWith(
      expect.objectContaining({ originator: 'local', cause: JsSIP_C.causes.CANCELED }),
    );
    expect(subject.connector.callManager.stateMachine.state).toBe('call:idle');
    expect(subject.connector.callReconnectManager.state).toBe('idle');

    await flush(20);

    expect(subject.ua.call).not.toHaveBeenCalled();
  });

  it('disconnect() во время запроса отменяет звонок: failed с CANCELED, без INVITE', async () => {
    const subject = setup();

    jest.spyOn(subject.connector.connectionQueueManager, 'disconnect').mockResolvedValue();
    subject.leaveStaleParticipant();

    const call = settle(subject.connector.call(subject.callParameters, { autoRedial: true }));

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await subject.connector.disconnect();

    const { isRejected, error } = await call;

    expect(isRejected).toBe(true);
    expect(hasCanceledCallError(error)).toBe(true);
    expect(requests[0].init.signal?.aborted).toBe(true);
    expect(subject.failedListener).toHaveBeenCalledWith(
      expect.objectContaining({ originator: 'local', cause: JsSIP_C.causes.CANCELED }),
    );
    expect(subject.connector.callManager.stateMachine.state).toBe('call:idle');
    expect(subject.connector.requestedCall).toBe(false);

    await flush(20);

    expect(subject.ua.call).not.toHaveBeenCalled();
  });

  const mockIncomingSession = (subject: ReturnType<typeof createSubject>) => {
    const incomingSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });

    jest
      .spyOn(subject.connector.incomingCallManager, 'extractIncomingRTCSession')
      .mockReturnValue(incomingSession as unknown as RTCSession);

    return incomingSession;
  };

  // Обрыв принятого входящего по сети: перезвон, если бы он остался армированным, набрал бы старую конференцию.
  const breakAnsweredCallBySystem = async (subject: ReturnType<typeof createSubject>) => {
    subject.connector.callManager.events.trigger('ended', {
      originator: 'system',
      cause: JsSIP_C.causes.CONNECTION_ERROR,
    } as never);
    await flush(20);
  };

  it('answerToIncomingCall() во время запроса молча отменяет исходящий звонок, разоружает перезвон и не отправляет INVITE', async () => {
    const subject = setup();
    const incomingSession = mockIncomingSession(subject);
    const onAttemptStarted = jest.fn();

    subject.connector.callReconnectManager.on('attempt-started', onAttemptStarted);
    subject.leaveStaleParticipant();

    const call = settle(subject.connector.call(subject.callParameters, { autoRedial: true }));

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(subject.connector.callReconnectManager.state).toBe('armed');

    const answer = settle(
      subject.connector.answerToIncomingCall({ mediaStream: new MediaStream() }),
    );

    await flush();

    expect(requests[0].init.signal?.aborted).toBe(true);

    const { isRejected, error } = await call;

    expect(isRejected).toBe(true);
    expect(hasCanceledCallError(error)).toBe(true);
    expect(subject.failedListener).not.toHaveBeenCalled();
    expect(subject.connector.requestedCall).toBe(true);
    expect(subject.connector.callManager.stateMachine.state).toBe('call:connecting');
    expect(subject.connector.callReconnectManager.state).toBe('idle');
    expect(incomingSession.answer).toHaveBeenCalledTimes(1);

    await breakAnsweredCallBySystem(subject);

    expect(onAttemptStarted).not.toHaveBeenCalled();
    expect(requests).toHaveLength(1);
    expect(subject.ua.call).not.toHaveBeenCalled();

    await subject.connector.callManager.endCall();
    await answer;
  });

  it('answerToIncomingCall() без идущего запроса не отправляет запрос отключения', async () => {
    const subject = setup();
    const incomingSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });

    jest
      .spyOn(subject.connector.incomingCallManager, 'extractIncomingRTCSession')
      .mockReturnValue(incomingSession as unknown as RTCSession);
    subject.leaveStaleParticipant();

    const answer = settle(
      subject.connector.answerToIncomingCall({ mediaStream: new MediaStream() }),
    );

    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(subject.failedListener).not.toHaveBeenCalled();
    expect(incomingSession.answer).toHaveBeenCalledTimes(1);

    await subject.connector.callManager.endCall();
    await answer;
  });

  describe('перезвон', () => {
    it('попытка перезвона с ошибкой отключения завершается неудачей и планирует следующую', async () => {
      const subject = setup();
      const events: string[] = [];

      subject.connector.callReconnectManager.on('attempt-failed', () => {
        events.push('attempt-failed');
      });
      subject.connector.callReconnectManager.on('attempt-scheduled', () => {
        events.push('attempt-scheduled');
      });
      subject.breakArmedCallBySystem();

      await waitUntil(() => {
        return requests.length === 1;
      });
      requests[0].respond(500);
      await waitUntil(() => {
        return events.length >= 3;
      });

      expect(events.slice(0, 3)).toEqual([
        'attempt-scheduled',
        'attempt-failed',
        'attempt-scheduled',
      ]);
      expect(subject.failedListener).toHaveBeenCalledWith(
        expect.objectContaining({ originator: 'local', cause: JsSIP_C.causes.INTERNAL_ERROR }),
      );

      await waitUntil(() => {
        return subject.ua.call.mock.calls.length === 1;
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('cancelCurrentCallReconnectAttempt() во время запроса попытки оставляет запрос, INVITE и перезвон армированным', async () => {
      const subject = setup();
      const reconnectEvents: string[] = [];

      subject.breakArmedCallBySystem();
      await waitUntil(() => {
        return requests.length === 1;
      });
      (['disarmed', 'cancelled', 'termination-classified'] as const).forEach((event) => {
        subject.connector.callReconnectManager.on(event, () => {
          reconnectEvents.push(event);
        });
      });

      subject.connector.cancelCurrentCallReconnectAttempt();
      await flush(20);

      expect(requests[0].init.signal?.aborted).toBe(false);
      expect(subject.connector.callReconnectManager.state).toBe('armed');
      expect(reconnectEvents).toEqual([]);
      expect(subject.failedListener).not.toHaveBeenCalled();
      expect(subject.connector.callManager.stateMachine.state).toBe('call:connecting');

      requests[0].respond(401);
      await flush(20);

      expect(subject.ua.call).toHaveBeenCalledTimes(1);
    });

    it('disarmCallAutoRedial() во время запроса попытки разоружает перезвон и оставляет запрос и INVITE', async () => {
      const subject = setup();

      subject.breakArmedCallBySystem();
      await waitUntil(() => {
        return requests.length === 1;
      });

      subject.connector.disarmCallAutoRedial();
      await flush(20);

      expect(requests[0].init.signal?.aborted).toBe(false);
      expect(subject.connector.callReconnectManager.state).toBe('idle');
      expect(subject.failedListener).not.toHaveBeenCalled();
      expect(subject.connector.callManager.stateMachine.state).toBe('call:connecting');

      requests[0].respond(401);
      await flush(20);

      expect(subject.ua.call).toHaveBeenCalledTimes(1);
    });

    it.each(['hangUp', 'disconnect'] as const)(
      '%s() во время запроса попытки отменяет звонок: failed с CANCELED, без INVITE и без зависания в отключении',
      async (method) => {
        const subject = setup();

        jest.spyOn(subject.connector.connectionQueueManager, 'disconnect').mockResolvedValue();
        subject.breakArmedCallBySystem();
        await waitUntil(() => {
          return requests.length === 1;
        });

        await subject.connector[method]();
        await flush(20);

        expect(requests[0].init.signal?.aborted).toBe(true);
        expect(subject.connector.callReconnectManager.state).toBe('idle');
        expect(subject.failedListener).toHaveBeenCalledTimes(1);
        expect(subject.failedListener).toHaveBeenCalledWith(
          expect.objectContaining({ originator: 'local', cause: JsSIP_C.causes.CANCELED }),
        );
        expect(subject.connector.callManager.stateMachine.state).toBe('call:idle');
        expect(subject.connector.requestedCall).toBe(false);
        expect(subject.ua.call).not.toHaveBeenCalled();
      },
    );

    it('armCallAutoRedial() во время запроса попытки оставляет перезвон армированным, запрос и INVITE', async () => {
      const subject = setup();
      const onDisarmed = jest.fn();

      subject.connector.callReconnectManager.on('disarmed', onDisarmed);
      subject.breakArmedCallBySystem();
      await waitUntil(() => {
        return requests.length === 1;
      });

      subject.connector.armCallAutoRedial({
        getCallParameters: async () => {
          return subject.callParameters;
        },
      });
      await flush(20);

      expect(onDisarmed).not.toHaveBeenCalled();
      expect(subject.connector.callReconnectManager.state).toBe('armed');
      expect(requests[0].init.signal?.aborted).toBe(false);

      requests[0].respond(401);
      await flush(20);

      expect(subject.ua.call).toHaveBeenCalledTimes(1);
    });

    it('answerToIncomingCall() во время запроса попытки молча отменяет её и разоружает перезвон', async () => {
      const subject = setup();
      const incomingSession = mockIncomingSession(subject);
      const onAttemptStarted = jest.fn();

      subject.breakArmedCallBySystem();
      await waitUntil(() => {
        return requests.length === 1;
      });
      subject.connector.callReconnectManager.on('attempt-started', onAttemptStarted);

      const answer = settle(
        subject.connector.answerToIncomingCall({ mediaStream: new MediaStream() }),
      );

      await flush(20);

      expect(requests[0].init.signal?.aborted).toBe(true);
      expect(subject.failedListener).not.toHaveBeenCalled();
      expect(subject.connector.callManager.stateMachine.state).toBe('call:connecting');
      expect(subject.connector.callReconnectManager.state).toBe('idle');
      expect(incomingSession.answer).toHaveBeenCalledTimes(1);

      await breakAnsweredCallBySystem(subject);

      expect(onAttemptStarted).not.toHaveBeenCalled();
      expect(requests).toHaveLength(1);
      expect(subject.ua.call).not.toHaveBeenCalled();

      await subject.connector.callManager.endCall();
      await answer;
    });

    it('попытка перезвона отправляет INVITE через UA, актуальный после запроса отключения', async () => {
      const subject = setup();
      const nextUa = new UAMock({
        uri: `sip:user@${SIP_SERVER_URL}`,
        register: false,
        sockets: [],
      });

      subject.breakArmedCallBySystem();
      await waitUntil(() => {
        return requests.length === 1;
      });
      jest
        .spyOn(subject.connector.connectionManager, 'getUaProtected')
        .mockReturnValue(nextUa as unknown as UA);

      requests[0].respond(401);
      await waitUntil(() => {
        return nextUa.call.mock.calls.length === 1;
      });

      expect(subject.ua.call).not.toHaveBeenCalled();
    });

    it('ручной call() во время запроса попытки отменяет её и отправляет один INVITE', async () => {
      const subject = setup();

      subject.breakArmedCallBySystem();
      await waitUntil(() => {
        return requests.length === 1;
      });

      const manualCall = settle(
        subject.connector.call(subject.callParameters, { autoRedial: true }),
      );

      await flush();

      expect(requests[0].init.signal?.aborted).toBe(true);
      expect(requests).toHaveLength(2);
      expect(subject.failedListener).not.toHaveBeenCalled();
      expect(subject.connector.requestedCall).toBe(true);
      expect(subject.connector.callManager.stateMachine.state).toBe('call:connecting');

      requests[1].respond(401);
      await flush(20);

      expect(subject.ua.call).toHaveBeenCalledTimes(1);

      await subject.connector.callManager.endCall();
      await manualCall;
    });

    it('ручной call() во время ожидания сигнализации отправляет один INVITE после появления регистрации', async () => {
      const subject = setup({ isRegistered: false });

      subject.breakArmedCallBySystem();

      expect(subject.connector.callReconnectManager.state).toBe('waitingSignaling');

      const manualCall = settle(
        subject.connector.call(subject.callParameters, { autoRedial: true }),
      );

      await flush();
      subject.connector.connectionManager.events.trigger('registered', {} as never);
      await flush(20);

      expect(requests).toHaveLength(1);

      requests[0].respond(401);
      await flush(20);

      expect(subject.ua.call).toHaveBeenCalledTimes(1);

      await subject.connector.callManager.endCall();
      await manualCall;
    });
  });
});
