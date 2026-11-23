/// <reference types="jest" />

import { IncomingResponse, C as JsSIP_C } from '@krivega/jssip';

import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import UAMock from '@/__fixtures__/UA.mock';
import { ApiManager } from '@/ApiManager';
import { CallSessionState } from '@/CallSessionState';
import { ContentedStreamManager } from '@/ContentedStreamManager';
import CallManager from '../@CallManager';
import hasCanceledCallError from '../hasCanceledCallError';

import type { RTCSession, UA } from '@krivega/jssip';

type TFetchResponse = { ok: boolean; status: number };
type TPendingRequest = {
  init: RequestInit;
  respond: (status: number) => void;
};

const SIP_SERVER_URL = 'dev.vinteo.com';
const DISCONNECT_URL = `https://${SIP_SERVER_URL}/api/v2/participants/self/disconnect`;

const getUri = (number: string) => {
  return `sip:${number}@${SIP_SERVER_URL}`;
};

// Макрозадача: запрос отключения и его обработка проходят несколько цепочек Promise.
const flush = async () => {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
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

const createSubject = () => {
  const apiManager = new ApiManager();
  const callManager = new CallManager(
    { contentedStreamManager: new ContentedStreamManager() },
    {
      sendOffer: jest.fn().mockResolvedValue({} as RTCSessionDescription),
      waitForSignaling: jest.fn().mockResolvedValue(true),
      getSipServerUrl: () => {
        return SIP_SERVER_URL;
      },
    },
    { callSessionState: new CallSessionState() },
  );
  const ua = new UAMock({ uri: `sip:user@${SIP_SERVER_URL}`, register: false, sockets: [] });
  const timeline: string[] = [];
  const states: string[] = [];
  const failedListener = jest.fn();
  const endCallListener = jest.fn();

  callManager.subscribeToApiEvents(apiManager);
  callManager.on('start-call', ({ answer }) => {
    timeline.push(answer ? 'start-call:answer' : 'start-call:outgoing');
  });
  callManager.on('failed', (event) => {
    timeline.push(`failed:${String(event.cause)}`);
    failedListener(event);
  });
  callManager.on('end-call', endCallListener);
  callManager.stateMachine.onStateChange((state) => {
    states.push(state);
  });

  const startCall = async (number = '1000') => {
    return callManager.startCall(ua as unknown as UA, getUri, {
      number,
      mediaStream: new MediaStream(),
    });
  };

  const enterRoom = (token: string) => {
    apiManager.events.trigger('enter-room', { room: '1000', participantName: 'p1' });
    apiManager.events.trigger('conference:participant-token-issued', {
      jwt: token,
      conference: '1000',
      participant: 'p1',
    });
    expect(callManager.stateMachine.state).toBe('call:inRoom');
  };

  // Прошлый звонок вошёл в комнату и оборвался локально: участник остался на сервере.
  const leaveStaleParticipant = (token = 'token-1') => {
    callManager.events.trigger('start-call', { number: '1000', answer: false });
    enterRoom(token);
    callManager.events.trigger('ended', {
      originator: 'local',
      cause: JsSIP_C.causes.RTP_TIMEOUT,
    } as never);
    timeline.length = 0;
    states.length = 0;
  };

  return {
    apiManager,
    callManager,
    ua,
    timeline,
    states,
    failedListener,
    endCallListener,
    startCall,
    enterRoom,
    leaveStaleParticipant,
  };
};

describe('CallManager: отключение устаревшего участника перед исходящим звонком', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock<Promise<TFetchResponse>, [string, RequestInit]>;
  let requests: TPendingRequest[];

  beforeEach(() => {
    requests = [];
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

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('отправляет INVITE только после ответа 401 на запрос отключения прежнего подключения', async () => {
    const subject = createSubject();

    subject.leaveStaleParticipant('token-1');

    const call = settle(subject.startCall());

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(DISCONNECT_URL);
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe(
      'Bearer token-1',
    );
    expect(subject.ua.call).not.toHaveBeenCalled();

    requests[0].respond(401);
    await flush();

    expect(subject.ua.call).toHaveBeenCalledTimes(1);

    await subject.callManager.endCall();
    await call;
  });

  it('держит звонок в подключении, пока идёт запрос отключения', async () => {
    const subject = createSubject();

    subject.leaveStaleParticipant();

    const call = settle(subject.startCall());

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(subject.callManager.stateMachine.state).toBe('call:connecting');
    expect(subject.callManager.requested).toBe(true);
    expect(subject.ua.call).not.toHaveBeenCalled();

    await subject.callManager.endCall();
    await call;
  });

  it.each([
    [
      'не отправляет запрос отключения, когда сервер ответил 2xx на BYE отбоя',
      (session: RTCSessionMock) => {
        session.byeEventHandlers?.onSuccessResponse?.(new IncomingResponse());
      },
      0,
    ],
    ['отключает прежнее подключение, когда ответа 2xx на BYE отбоя нет', () => {}, 1],
  ])('%s', async (_name, answerBye, expectedRequests) => {
    const subject = createSubject();

    await subject.startCall();
    subject.enterRoom('token-1');
    await subject.callManager.endCall();
    answerBye(subject.ua.call.mock.results[0].value as RTCSessionMock);

    const call = settle(subject.startCall());

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(expectedRequests);

    await subject.callManager.endCall();
    await call;
  });

  it('отключает подключение отбоя до INVITE звонка, начатого из обработчика end-call', async () => {
    const subject = createSubject();
    let redial: Promise<unknown> | undefined;

    await subject.startCall();
    subject.enterRoom('token-1');
    subject.callManager.once('end-call', () => {
      redial = settle(subject.startCall('2000'));
    });
    await subject.callManager.endCall();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe(
      'Bearer token-1',
    );
    expect(subject.ua.call).toHaveBeenCalledTimes(1);

    requests[0].respond(401);
    await flush();

    expect(subject.ua.call).toHaveBeenCalledTimes(2);
    expect(subject.ua.call.mock.calls[1][0]).toBe(getUri('2000'));

    await subject.callManager.endCall();
    await redial;
  });

  it('отправляет INVITE без запроса отключения, когда устаревшего участника нет', async () => {
    const subject = createSubject();

    const call = settle(subject.startCall());

    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(subject.ua.call).toHaveBeenCalledTimes(1);

    await subject.callManager.endCall();
    await call;
  });

  it('отклоняет звонок ошибкой отключения и сообщает failed с INTERNAL_ERROR без INVITE', async () => {
    const subject = createSubject();

    subject.leaveStaleParticipant();

    const call = settle(subject.startCall());

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    requests[0].respond(500);

    const { isRejected, error } = await call;

    expect(isRejected).toBe(true);
    expect((error as Error).message).toBe('Stale participant disconnect failed with status 500');
    expect(subject.failedListener).toHaveBeenCalledTimes(1);
    expect(subject.failedListener).toHaveBeenCalledWith(
      expect.objectContaining({
        originator: 'local',
        cause: JsSIP_C.causes.INTERNAL_ERROR,
        message: expect.objectContaining({
          body: 'Stale participant disconnect failed with status 500',
        }) as unknown,
      }),
    );
    expect(subject.endCallListener).not.toHaveBeenCalled();
    expect(subject.callManager.requested).toBe(false);
    expect(subject.callManager.stateMachine.state).toBe('call:idle');
    expect(subject.ua.call).not.toHaveBeenCalled();
  });

  it('сообщает failed с INTERNAL_ERROR и текстом отказа, когда запрос отклонён не ошибкой', async () => {
    const subject = createSubject();

    fetchMock.mockRejectedValueOnce('boom');
    subject.leaveStaleParticipant();

    const { isRejected, error } = await settle(subject.startCall());

    expect(isRejected).toBe(true);
    expect(error).toBe('boom');
    expect(subject.failedListener).toHaveBeenCalledTimes(1);
    expect(subject.failedListener).toHaveBeenCalledWith(
      expect.objectContaining({
        originator: 'local',
        cause: JsSIP_C.causes.INTERNAL_ERROR,
        message: expect.objectContaining({ body: 'boom' }) as unknown,
      }),
    );
    expect(subject.callManager.requested).toBe(false);
    expect(subject.ua.call).not.toHaveBeenCalled();
  });

  it('отменяет звонок при endCall во время запроса: failed с CANCELED, без INVITE и без зависания в отключении', async () => {
    const subject = createSubject();

    subject.leaveStaleParticipant();

    const call = settle(subject.startCall());

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await subject.callManager.endCall();

    const { isRejected, error } = await call;

    expect(isRejected).toBe(true);
    expect(hasCanceledCallError(error)).toBe(true);
    expect(requests[0].init.signal?.aborted).toBe(true);
    expect(subject.failedListener).toHaveBeenCalledTimes(1);
    expect(subject.failedListener).toHaveBeenCalledWith(
      expect.objectContaining({ originator: 'local', cause: JsSIP_C.causes.CANCELED }),
    );
    expect(subject.callManager.requested).toBe(false);
    expect(subject.callManager.stateMachine.state).toBe('call:idle');
    expect(subject.ua.call).not.toHaveBeenCalled();
  });

  it('не отправляет запрос отключения при endCall из обработчика start-call', async () => {
    const subject = createSubject();

    subject.leaveStaleParticipant();
    subject.callManager.on('start-call', () => {
      subject.callManager.endCall().catch(() => {});
    });

    const { isRejected, error } = await settle(subject.startCall());

    expect(isRejected).toBe(true);
    expect(hasCanceledCallError(error)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(subject.failedListener).toHaveBeenCalledWith(
      expect.objectContaining({ originator: 'local', cause: JsSIP_C.causes.CANCELED }),
    );
    expect(subject.callManager.stateMachine.state).toBe('call:idle');
    expect(subject.ua.call).not.toHaveBeenCalled();
  });

  it('сохраняет устаревшего участника после отбоя во время запроса и отключает его на следующем звонке', async () => {
    const subject = createSubject();

    subject.leaveStaleParticipant('token-1');

    const canceledCall = settle(subject.startCall());

    await flush();
    await subject.callManager.endCall();
    await canceledCall;

    const call = settle(subject.startCall());

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe(
      'Bearer token-1',
    );

    await subject.callManager.endCall();
    await call;
  });

  const answerIncoming = (subject: ReturnType<typeof createSubject>) => {
    const incomingSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });
    const answer = settle(
      subject.callManager.answerToIncomingCall(
        () => {
          return incomingSession as unknown as RTCSession;
        },
        { mediaStream: new MediaStream() },
      ),
    );

    return { incomingSession, answer };
  };

  it('молча отменяет исходящий звонок при ответе на входящий во время запроса и не отправляет INVITE', async () => {
    const subject = createSubject();

    subject.leaveStaleParticipant();

    const call = settle(subject.startCall());

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { incomingSession, answer } = answerIncoming(subject);
    const { isRejected, error } = await call;

    await flush();

    expect(isRejected).toBe(true);
    expect(hasCanceledCallError(error)).toBe(true);
    expect(requests[0].init.signal?.aborted).toBe(true);
    expect(subject.failedListener).not.toHaveBeenCalled();
    expect(subject.timeline).toEqual(['start-call:outgoing', 'start-call:answer']);
    expect(subject.states.slice(-2)).toEqual(['call:idle', 'call:connecting']);
    expect(subject.callManager.number).toBe('caller1');
    expect(subject.callManager.requested).toBe(true);
    expect(incomingSession.answer).toHaveBeenCalledTimes(1);
    expect(subject.ua.call).not.toHaveBeenCalled();

    await subject.callManager.endCall();
    await answer;
  });

  it('не сообщает failed, когда ответ на входящий идёт в том же такте за вытеснением звонка вторым', async () => {
    const subject = createSubject();

    subject.leaveStaleParticipant();

    const firstCall = settle(subject.startCall());

    await flush();

    const secondCall = settle(subject.startCall());
    const { incomingSession, answer } = answerIncoming(subject);
    const outcomes = await Promise.all([firstCall, secondCall]);

    await flush();

    outcomes.forEach(({ isRejected, error }) => {
      expect(isRejected).toBe(true);
      expect(hasCanceledCallError(error)).toBe(true);
    });
    expect(subject.failedListener).not.toHaveBeenCalled();
    expect(subject.callManager.stateMachine.state).toBe('call:connecting');
    expect(subject.callManager.number).toBe('caller1');
    expect(subject.callManager.requested).toBe(true);
    expect(incomingSession.answer).toHaveBeenCalledTimes(1);
    expect(subject.ua.call).not.toHaveBeenCalled();

    await subject.callManager.endCall();
    await answer;
  });

  describe('перекрывающиеся звонки', () => {
    it('отправляет один INVITE, когда второй звонок начат во время запроса отключения первого', async () => {
      const subject = createSubject();

      subject.leaveStaleParticipant();

      const firstCall = settle(subject.startCall());

      await flush();

      const secondCall = settle(subject.startCall());

      await flush();

      expect(fetchMock).toHaveBeenCalled();

      requests.forEach((request) => {
        request.respond(401);
      });
      await flush();

      expect(subject.ua.call).toHaveBeenCalledTimes(1);

      await subject.callManager.endCall();
      await firstCall;
      await secondCall;
    });

    it('отклоняет вытесненный первый звонок отменой без failed и не сбрасывает второй', async () => {
      const subject = createSubject();

      subject.leaveStaleParticipant();

      const firstCall = settle(subject.startCall());

      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const secondCall = settle(subject.startCall());
      const { isRejected, error } = await firstCall;

      await flush();

      expect(isRejected).toBe(true);
      expect(hasCanceledCallError(error)).toBe(true);
      expect(requests[0].init.signal?.aborted).toBe(true);
      expect(subject.failedListener).not.toHaveBeenCalled();
      expect(subject.callManager.requested).toBe(true);
      expect(subject.callManager.stateMachine.state).toBe('call:connecting');
      expect(requests).toHaveLength(2);

      requests[1].respond(401);
      await flush();

      expect(subject.ua.call).toHaveBeenCalledTimes(1);

      await subject.callManager.endCall();
      await secondCall;
    });
  });

  it('отправляет INVITE нового звонка, начатого сразу после отбоя во время запроса', async () => {
    const subject = createSubject();

    subject.leaveStaleParticipant();

    const canceledCall = settle(subject.startCall());

    await flush();

    const endCall = subject.callManager.endCall();
    const call = settle(subject.startCall('2000'));

    await endCall;

    const { isRejected, error } = await canceledCall;

    await flush();
    requests[1].respond(401);
    await flush();

    expect(isRejected).toBe(true);
    expect(hasCanceledCallError(error)).toBe(true);
    expect(subject.failedListener).toHaveBeenCalledTimes(1);
    expect(subject.failedListener).toHaveBeenCalledWith(
      expect.objectContaining({ originator: 'local', cause: JsSIP_C.causes.CANCELED }),
    );
    expect(subject.callManager.requested).toBe(true);
    expect(subject.callManager.stateMachine.state).toBe('call:connecting');
    expect(subject.callManager.number).toBe('2000');
    expect(subject.ua.call).toHaveBeenCalledTimes(1);
    expect(subject.ua.call.mock.calls[0][0]).toBe(getUri('2000'));

    await subject.callManager.endCall();
    await call;
  });

  describe('прерывание запуска до продолжения startCall', () => {
    type TSubject = ReturnType<typeof createSubject>;
    type TWindow = (
      subject: TSubject,
      interrupt: () => void,
    ) => Promise<{ isRejected: boolean; error: unknown }>;

    // Прерывание идёт синхронно в окне, где отключение уже завершилось, а запуск ещё не продолжился.
    const windows: [string, TWindow][] = [
      [
        'в том же такте без устаревшего участника',
        async (subject, interrupt) => {
          const call = settle(subject.startCall());

          interrupt();

          return call;
        },
      ],
      [
        'сразу после ответа 401',
        async (subject, interrupt) => {
          subject.leaveStaleParticipant();

          const call = settle(subject.startCall());

          await flush();
          requests[0].respond(401);
          interrupt();

          return call;
        },
      ],
    ];

    it.each(windows)(
      'endCall %s: failed с CANCELED, без INVITE и без зависания в отключении',
      async (_name, openWindow) => {
        const subject = createSubject();
        let endCall: Promise<void> | undefined;
        const { isRejected, error } = await openWindow(subject, () => {
          endCall = subject.callManager.endCall();
        });

        await endCall;
        await flush();

        expect(isRejected).toBe(true);
        expect(hasCanceledCallError(error)).toBe(true);
        expect(subject.failedListener).toHaveBeenCalledTimes(1);
        expect(subject.failedListener).toHaveBeenCalledWith(
          expect.objectContaining({ originator: 'local', cause: JsSIP_C.causes.CANCELED }),
        );
        expect(subject.callManager.requested).toBe(false);
        expect(subject.callManager.stateMachine.state).toBe('call:idle');
        expect(subject.ua.call).not.toHaveBeenCalled();
      },
    );

    it.each(windows)(
      'второй startCall %s: один INVITE второго звонка, без failed',
      async (_name, openWindow) => {
        const subject = createSubject();
        let secondCall: Promise<unknown> | undefined;
        const { isRejected, error } = await openWindow(subject, () => {
          secondCall = settle(subject.startCall('2000'));
        });

        await flush();
        requests.slice(1).forEach((request) => {
          request.respond(401);
        });
        await flush();

        expect(isRejected).toBe(true);
        expect(hasCanceledCallError(error)).toBe(true);
        expect(subject.failedListener).not.toHaveBeenCalled();
        expect(subject.callManager.requested).toBe(true);
        expect(subject.callManager.stateMachine.state).toBe('call:connecting');
        expect(subject.ua.call).toHaveBeenCalledTimes(1);
        expect(subject.ua.call.mock.calls[0][0]).toBe(getUri('2000'));

        await subject.callManager.endCall();
        await secondCall;
      },
    );

    it.each(windows)('ответ на входящий %s: без failed и без INVITE', async (_name, openWindow) => {
      const subject = createSubject();
      let incoming: ReturnType<typeof answerIncoming> | undefined;
      const { isRejected, error } = await openWindow(subject, () => {
        incoming = answerIncoming(subject);
      });

      await flush();

      expect(isRejected).toBe(true);
      expect(hasCanceledCallError(error)).toBe(true);
      expect(subject.failedListener).not.toHaveBeenCalled();
      expect(subject.timeline).toEqual(['start-call:outgoing', 'start-call:answer']);
      expect(subject.states.slice(-2)).toEqual(['call:idle', 'call:connecting']);
      expect(subject.callManager.number).toBe('caller1');
      expect(subject.callManager.requested).toBe(true);
      expect(incoming?.incomingSession.answer).toHaveBeenCalledTimes(1);
      expect(subject.ua.call).not.toHaveBeenCalled();

      await subject.callManager.endCall();
      await incoming?.answer;
    });
  });
});
