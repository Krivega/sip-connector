/// <reference types="jest" />

import { isCanceledError } from '@krivega/cancelable-promise';
import { C as JsSIP_C } from '@krivega/jssip';

import StaleParticipantManager from '../@StaleParticipantManager';

import type { CallManager } from '@/CallManager';
import type { TConnectionConfig } from '@/ConnectionManager';

type THandler = (payload?: unknown) => void;
type TCredentialsListener = (payload: { token: string; conferenceForToken: string }) => void;
type TFetchResponse = { ok: boolean; status: number };

const DISCONNECT_URL = 'https://dev.vinteo.com/api/v2/participants/self/disconnect';
const CONFIRM_LIMIT_MS = 20_000;

const createCallManager = () => {
  const handlers = new Map<string, Set<THandler>>();
  const credentialsListeners = new Set<TCredentialsListener>();
  const getBucket = (event: string) => {
    let bucket = handlers.get(event);

    if (bucket === undefined) {
      bucket = new Set();
      handlers.set(event, bucket);
    }

    return bucket;
  };
  const callManager = {
    on: (event: string, handler: THandler) => {
      getBucket(event).add(handler);

      return () => {
        getBucket(event).delete(handler);
      };
    },
    off: (event: string, handler: THandler) => {
      getBucket(event).delete(handler);
    },
    stateMachine: {
      onInRoomCredentialsChange: (listener: TCredentialsListener) => {
        credentialsListeners.add(listener);

        return () => {
          credentialsListeners.delete(listener);
        };
      },
    },
  };

  return {
    callManager: callManager as unknown as CallManager,
    enterRoom: (token: string) => {
      credentialsListeners.forEach((listener) => {
        listener({ token, conferenceForToken: '1000' });
      });
    },
    emit: (event: string, payload?: unknown) => {
      getBucket(event).forEach((handler) => {
        handler(payload);
      });
    },
  };
};

const setup = ({
  sipServerUrl = 'dev.vinteo.com',
  hasConfiguration = true,
}: { sipServerUrl?: string; hasConfiguration?: boolean } = {}) => {
  const calls = createCallManager();
  const connection: { configuration?: TConnectionConfig } = {
    configuration: hasConfiguration
      ? ({ sipServerUrl } as unknown as TConnectionConfig)
      : undefined,
  };
  const manager = new StaleParticipantManager({
    callManager: calls.callManager,
    getServerUrl: () => {
      return connection.configuration?.sipServerUrl;
    },
  });

  const disconnectStale = async (signal = new AbortController().signal) => {
    return manager.disconnectStale(signal);
  };

  return { manager, connection, disconnectStale, ...calls };
};

type TSubject = ReturnType<typeof setup>;

const endByNetwork = (subject: TSubject) => {
  subject.emit('ended', { originator: 'local', cause: JsSIP_C.causes.RTP_TIMEOUT });
};

const createStale = (subject: TSubject, token = 'token-1') => {
  subject.enterRoom(token);
  endByNetwork(subject);
};

const catchError = async (promise: Promise<unknown>): Promise<unknown> => {
  return promise.then(
    () => {
      throw new Error('Expected disconnectStale to reject');
    },
    (error: unknown) => {
      return error;
    },
  );
};

describe('StaleParticipantManager', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock<Promise<TFetchResponse>, [string, RequestInit]>;

  const respond = (status: number) => {
    fetchMock.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status });
  };

  const holdUntilAbort = () => {
    fetchMock.mockImplementationOnce(async (_url, init) => {
      return new Promise<TFetchResponse>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });
  };

  const getRequestInit = (index = 0): RequestInit => {
    return fetchMock.mock.calls[index][1];
  };

  beforeEach(() => {
    fetchMock = jest.fn<Promise<TFetchResponse>, [string, RequestInit]>();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('не отправляет запрос, пока звонок в комнате не завершился', async () => {
    const subject = setup();

    subject.enterRoom('token-1');

    await expect(subject.disconnectStale()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['ended', 'local'],
    ['failed', 'local'],
    ['failed', 'system'],
  ])('не отправляет запрос после %s от %s до входа в комнату', async (event, originator) => {
    const subject = setup();

    respond(401);
    subject.emit(event, { originator, cause: JsSIP_C.causes.CONNECTION_ERROR });
    subject.emit('end-call');

    await expect(subject.disconnectStale()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('не запоминает подключение, когда в конфигурации нет sipServerUrl', async () => {
    const subject = setup({ hasConfiguration: false });

    createStale(subject);

    await expect(subject.disconnectStale()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['ended', 'local', JsSIP_C.causes.RTP_TIMEOUT],
    ['ended', 'local', JsSIP_C.causes.CONNECTION_ERROR],
    ['ended', 'local', JsSIP_C.causes.BYE],
    ['ended', 'system', JsSIP_C.causes.CONNECTION_ERROR],
    ['failed', 'system', JsSIP_C.causes.CONNECTION_ERROR],
    ['failed', 'local', JsSIP_C.causes.INTERNAL_ERROR],
  ])(
    'отключает прежнее подключение после %s от %s с причиной %s',
    async (event, originator, cause) => {
      const subject = setup();

      respond(401);
      subject.enterRoom('token-1');
      subject.emit(event, { originator, cause });

      await subject.disconnectStale();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(DISCONNECT_URL);
    },
  );

  it('отключает прежнее подключение на следующем звонке после ручного отбоя', async () => {
    const subject = setup();

    respond(401);
    subject.enterRoom('token-1');
    subject.emit('end-call');

    await expect(subject.disconnectStale()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Headers(getRequestInit().headers).get('Authorization')).toBe('Bearer token-1');
  });

  it('отправляет POST без тела с токеном комнаты, same-origin и сигналом отмены', async () => {
    const subject = setup();

    respond(401);
    createStale(subject, 'room-token');

    await subject.disconnectStale();

    const init = getRequestInit();

    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer room-token');
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBe('same-origin');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each(['dev.vinteo.com', 'dev.vinteo.com/'])(
    'строит адрес отключения без двойного слеша для сервера %s',
    async (sipServerUrl) => {
      const subject = setup({ sipServerUrl });

      respond(401);
      createStale(subject);

      await subject.disconnectStale();

      expect(fetchMock.mock.calls[0][0]).toBe(DISCONNECT_URL);
    },
  );

  it.each([
    ['ended', JsSIP_C.causes.BYE],
    ['ended', JsSIP_C.causes.REQUEST_TIMEOUT],
    ['ended', JsSIP_C.causes.ADDRESS_INCOMPLETE],
    ['failed', JsSIP_C.causes.BUSY],
    ['failed', JsSIP_C.causes.REQUEST_TIMEOUT],
  ])('забывает подключение без запроса после %s от сервера с причиной %s', async (event, cause) => {
    const subject = setup();

    respond(401);
    subject.enterRoom('token-1');
    subject.emit(event, { originator: 'remote', cause });

    await expect(subject.disconnectStale()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([403, 500])('отклоняет отключение при ответе %s', async (status) => {
    const subject = setup();

    respond(status);
    createStale(subject);

    const error = await catchError(subject.disconnectStale());

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      `Stale participant disconnect failed with status ${status}`,
    );
    expect(isCanceledError(error)).toBe(false);
  });

  it('отклоняет отключение не отменой при сетевой ошибке', async () => {
    const subject = setup();

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    createStale(subject);

    const error = await catchError(subject.disconnectStale());

    expect(isCanceledError(error)).toBe(false);
  });

  it.each([
    [401, false],
    [403, false],
    [500, false],
  ])('не повторяет запрос после ответа %s', async (status, ok) => {
    const subject = setup();

    fetchMock.mockResolvedValueOnce({ ok, status });
    createStale(subject);
    await subject.disconnectStale().catch(() => {});

    await expect(subject.disconnectStale()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('не повторяет запрос после сетевой ошибки', async () => {
    const subject = setup();

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    createStale(subject);
    await subject.disconnectStale().catch(() => {});

    await expect(subject.disconnectStale()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('не оставляет таймеров после ответа сервера', async () => {
    jest.useFakeTimers();

    const subject = setup();

    respond(401);
    createStale(subject);

    await subject.disconnectStale();

    expect(jest.getTimerCount()).toBe(0);
  });

  it('не прерывает зависший запрос раньше предела 20 секунд и разрешает звонок по пределу', async () => {
    jest.useFakeTimers();

    const subject = setup();

    holdUntilAbort();
    createStale(subject);

    const result = subject.disconnectStale();

    await jest.advanceTimersByTimeAsync(CONFIRM_LIMIT_MS - 1);

    expect(getRequestInit().signal?.aborted).toBe(false);

    await jest.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBeUndefined();
    expect(getRequestInit().signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('отклоняет отключение причиной отмены сигнала и прерывает запрос', async () => {
    jest.useFakeTimers();

    const subject = setup();
    const abortController = new AbortController();
    const reason = new Error('canceled');

    holdUntilAbort();
    createStale(subject);

    const result = catchError(subject.disconnectStale(abortController.signal));

    abortController.abort(reason);

    expect(await result).toBe(reason);
    expect(getRequestInit().signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('сохраняет устаревшего участника после отмены и отправляет запрос при следующем вызове', async () => {
    const subject = setup();
    const abortController = new AbortController();

    holdUntilAbort();
    respond(401);
    createStale(subject, 'token-1');

    const result = subject.disconnectStale(abortController.signal).catch(() => {});

    abortController.abort();
    await result;
    await subject.disconnectStale();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(getRequestInit(1).headers).get('Authorization')).toBe('Bearer token-1');
  });

  it('сохраняет устаревшего участника, когда сигнал отменён сразу после ответа 401', async () => {
    const subject = setup();
    const abortController = new AbortController();

    respond(401);
    respond(401);
    createStale(subject);

    const result = subject.disconnectStale(abortController.signal);

    abortController.abort();
    await result;
    await subject.disconnectStale();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('прерывает по сигналу только свой запрос при перекрывающихся вызовах', async () => {
    const subject = setup();
    const firstController = new AbortController();
    const secondController = new AbortController();
    const reason = new Error('canceled');

    holdUntilAbort();
    holdUntilAbort();
    createStale(subject);

    const first = catchError(subject.disconnectStale(firstController.signal));
    const second = catchError(subject.disconnectStale(secondController.signal));

    firstController.abort(reason);

    expect(await first).toBe(reason);
    expect(getRequestInit(0).signal?.aborted).toBe(true);
    expect(getRequestInit(1).signal?.aborted).toBe(false);

    secondController.abort();
    await second;
  });

  it.each([
    ['ended', { originator: 'remote', cause: JsSIP_C.causes.BYE }],
    ['failed', { originator: 'remote', cause: JsSIP_C.causes.BUSY }],
    ['ended', { originator: 'local', cause: JsSIP_C.causes.RTP_TIMEOUT }],
    ['end-call', undefined],
  ])('не забывает устаревшего участника при последующем %s', async (event, payload) => {
    const subject = setup();

    respond(401);
    createStale(subject);
    subject.emit(event, payload);

    await subject.disconnectStale();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('заменяет устаревшего участника новым подключением в комнате без запроса', async () => {
    const subject = setup();

    createStale(subject, 'token-1');
    subject.enterRoom('token-2');

    await expect(subject.disconnectStale()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('отключает устаревшего участника с токеном нового подключения после его сетевого обрыва', async () => {
    const subject = setup();

    respond(401);
    createStale(subject, 'token-1');
    createStale(subject, 'token-2');

    await subject.disconnectStale();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Headers(getRequestInit().headers).get('Authorization')).toBe('Bearer token-2');
  });

  it('не отправляет запрос, когда соединение уже на другом сервере', async () => {
    const subject = setup({ sipServerUrl: 'dev.vinteo.com' });

    createStale(subject);
    subject.connection.configuration = { sipServerUrl: 'other.vinteo.com' } as TConnectionConfig;

    await expect(subject.disconnectStale()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('забывает устаревшего участника другого сервера после повторного звонка', async () => {
    const subject = setup({ sipServerUrl: 'dev.vinteo.com' });

    createStale(subject);
    subject.connection.configuration = { sipServerUrl: 'other.vinteo.com' } as TConnectionConfig;
    await subject.disconnectStale();
    subject.connection.configuration = { sipServerUrl: 'dev.vinteo.com' } as TConnectionConfig;

    await subject.disconnectStale();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('не отправляет запрос, пока конфигурации соединения нет', async () => {
    const subject = setup();

    createStale(subject);
    subject.connection.configuration = undefined;

    await expect(subject.disconnectStale()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('отключает устаревшего участника после появления конфигурации того же сервера', async () => {
    const subject = setup();

    respond(401);
    createStale(subject);
    subject.connection.configuration = undefined;
    await subject.disconnectStale();
    subject.connection.configuration = { sipServerUrl: 'dev.vinteo.com' } as TConnectionConfig;

    await subject.disconnectStale();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(DISCONNECT_URL);
  });

  it.each([
    ['dev.vinteo.com', 'dev.vinteo.com/'],
    ['dev.vinteo.com/', 'dev.vinteo.com'],
  ])(
    'отключает устаревшего участника, когда сервер %s при входе и %s при звонке отличаются только слешем',
    async (roomServerUrl, callServerUrl) => {
      const subject = setup({ sipServerUrl: roomServerUrl });

      respond(401);
      createStale(subject);
      subject.connection.configuration = { sipServerUrl: callServerUrl } as TConnectionConfig;

      await subject.disconnectStale();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(DISCONNECT_URL);
    },
  );

  describe('ожидание подтверждения отключения', () => {
    const CONFIRM_INTERVAL_MS = 1000;

    const trackSettled = (promise: Promise<unknown>) => {
      const state = { settled: false };

      promise.then(
        () => {
          state.settled = true;
        },
        () => {
          state.settled = true;
        },
      );

      return state;
    };

    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('звонит после первого ответа 401 одним запросом', async () => {
      const subject = setup();

      respond(401);
      createStale(subject);

      await expect(subject.disconnectStale()).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('не повторяет запрос раньше чем через 1 секунду после ответа 204', async () => {
      const subject = setup();

      respond(204);
      respond(401);
      createStale(subject);
      subject.disconnectStale().catch(() => {});

      await jest.advanceTimersByTimeAsync(CONFIRM_INTERVAL_MS - 1);

      expect(fetchMock).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each([204, 200])(
      'повторяет запрос после ответа %s до ответа 401 и разрешает звонок',
      async (status) => {
        const subject = setup();

        respond(status);
        respond(status);
        respond(401);
        createStale(subject);

        const result = subject.disconnectStale();

        await jest.advanceTimersByTimeAsync(2 * CONFIRM_INTERVAL_MS);

        await expect(result).resolves.toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(3);
      },
    );

    it('повторяет запрос с токеном прежнего подключения', async () => {
      const subject = setup();

      respond(204);
      respond(401);
      createStale(subject, 'room-token');

      const result = subject.disconnectStale();

      await jest.advanceTimersByTimeAsync(CONFIRM_INTERVAL_MS);
      await result;

      expect(new Headers(getRequestInit(0).headers).get('Authorization')).toBe('Bearer room-token');
      expect(new Headers(getRequestInit(1).headers).get('Authorization')).toBe('Bearer room-token');
    });

    it('не оставляет таймеров после ответа 401 на повторный запрос', async () => {
      const subject = setup();

      respond(204);
      respond(401);
      createStale(subject);

      const result = subject.disconnectStale();

      await jest.advanceTimersByTimeAsync(CONFIRM_INTERVAL_MS);
      await result;

      expect(jest.getTimerCount()).toBe(0);
    });

    it('разрешает звонок через 20 секунд без ответа 401', async () => {
      const subject = setup();

      fetchMock.mockResolvedValue({ ok: true, status: 204 });
      createStale(subject);

      const state = trackSettled(subject.disconnectStale());

      await jest.advanceTimersByTimeAsync(CONFIRM_LIMIT_MS - 1);

      expect(state.settled).toBe(false);

      await jest.advanceTimersByTimeAsync(1);

      expect(state.settled).toBe(true);
    });

    it('отправляет запрос раз в секунду до предела 20 секунд и не продолжает после него', async () => {
      const subject = setup();

      fetchMock.mockResolvedValue({ ok: true, status: 204 });
      createStale(subject);

      const result = subject.disconnectStale();

      await jest.advanceTimersByTimeAsync(CONFIRM_LIMIT_MS);
      await result;

      const callsAtLimit = fetchMock.mock.calls.length;

      await jest.advanceTimersByTimeAsync(5 * CONFIRM_INTERVAL_MS);

      expect(callsAtLimit).toBeGreaterThanOrEqual(20);
      expect(callsAtLimit).toBeLessThanOrEqual(21);
      expect(fetchMock).toHaveBeenCalledTimes(callsAtLimit);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('забывает устаревшего участника после предела 20 секунд без ответа 401', async () => {
      const subject = setup();

      fetchMock.mockResolvedValue({ ok: true, status: 204 });
      createStale(subject);

      const result = subject.disconnectStale();

      await jest.advanceTimersByTimeAsync(CONFIRM_LIMIT_MS);
      await result;

      const callsAtLimit = fetchMock.mock.calls.length;

      await subject.disconnectStale();

      expect(fetchMock).toHaveBeenCalledTimes(callsAtLimit);
    });

    it.each([
      [
        'ответ 500',
        () => {
          fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
        },
      ],
      [
        'сетевую ошибку',
        () => {
          fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        },
      ],
    ])(
      'отклоняет звонок не отменой, когда повторный запрос получил %s',
      async (_name, failRepeat) => {
        const subject = setup();

        respond(204);
        failRepeat();
        createStale(subject);

        const result = catchError(subject.disconnectStale());

        await jest.advanceTimersByTimeAsync(CONFIRM_INTERVAL_MS);

        const error = await result;

        expect(error).toBeInstanceOf(Error);
        expect(isCanceledError(error)).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      },
    );

    it('забывает устаревшего участника после ошибки повторного запроса', async () => {
      const subject = setup();

      respond(204);
      respond(500);
      createStale(subject);

      const result = subject.disconnectStale().catch(() => {});

      await jest.advanceTimersByTimeAsync(CONFIRM_INTERVAL_MS);
      await result;
      await subject.disconnectStale();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('отклоняет звонок причиной отмены сигнала в паузе между запросами', async () => {
      const subject = setup();
      const abortController = new AbortController();
      const reason = new Error('canceled');

      respond(204);
      createStale(subject);

      const result = catchError(subject.disconnectStale(abortController.signal));

      await jest.advanceTimersByTimeAsync(CONFIRM_INTERVAL_MS / 2);
      abortController.abort(reason);

      expect(await result).toBe(reason);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('сохраняет устаревшего участника после отмены в паузе между запросами', async () => {
      const subject = setup();
      const abortController = new AbortController();

      respond(204);
      respond(401);
      createStale(subject);

      const result = subject.disconnectStale(abortController.signal).catch(() => {});

      await jest.advanceTimersByTimeAsync(CONFIRM_INTERVAL_MS / 2);
      abortController.abort();
      await result;
      await subject.disconnectStale();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('прерывает повторный запрос и отклоняет звонок причиной отмены сигнала', async () => {
      const subject = setup();
      const abortController = new AbortController();
      const reason = new Error('canceled');

      respond(204);
      holdUntilAbort();
      createStale(subject);

      const result = catchError(subject.disconnectStale(abortController.signal));

      await jest.advanceTimersByTimeAsync(CONFIRM_INTERVAL_MS);
      abortController.abort(reason);

      expect(await result).toBe(reason);
      expect(getRequestInit(1).signal?.aborted).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('отклоняет звонок причиной отмены без паузы при отмене сразу после ответа 204', async () => {
      const subject = setup();
      const abortController = new AbortController();
      const reason = new Error('canceled');

      fetchMock.mockImplementationOnce(async () => {
        return Promise.resolve({ ok: true, status: 204 }).then((response) => {
          // Настоящая микрозадача: фейковые таймеры подменяют queueMicrotask, но не цепочки Promise.
          Promise.resolve()
            .then(() => {
              abortController.abort(reason);
            })
            .catch(() => {});

          return response;
        });
      });
      createStale(subject);

      const result = catchError(subject.disconnectStale(abortController.signal));

      await jest.advanceTimersByTimeAsync(0);

      expect(jest.getTimerCount()).toBe(0);
      expect(await result).toBe(reason);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('разрешает звонок ровно на 20 секундах, обрывая зависший запрос', async () => {
      const subject = setup();

      for (let index = 0; index < 7; index += 1) {
        respond(204);
      }

      holdUntilAbort();
      createStale(subject);

      const state = trackSettled(subject.disconnectStale());

      await jest.advanceTimersByTimeAsync(CONFIRM_LIMIT_MS - 1);

      expect(fetchMock).toHaveBeenCalledTimes(8);
      expect(state.settled).toBe(false);

      await jest.advanceTimersByTimeAsync(1);

      expect(state.settled).toBe(true);
      expect(getRequestInit(7).signal?.aborted).toBe(true);
    });

    it('не отправляет запросов и не оставляет таймеров после обрыва зависшего запроса пределом', async () => {
      const subject = setup();

      for (let index = 0; index < 7; index += 1) {
        respond(204);
      }

      holdUntilAbort();
      createStale(subject);

      const result = subject.disconnectStale();

      await jest.advanceTimersByTimeAsync(CONFIRM_LIMIT_MS);
      await expect(result).resolves.toBeUndefined();
      await jest.advanceTimersByTimeAsync(5 * CONFIRM_INTERVAL_MS);

      expect(fetchMock).toHaveBeenCalledTimes(8);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('сохраняет новое подключение, когда 401 по прежнему токену приходит после смены токена', async () => {
      const subject = setup();

      respond(204);
      respond(401);
      createStale(subject, 'token-1');

      const result = subject.disconnectStale();

      subject.enterRoom('token-2');
      await jest.advanceTimersByTimeAsync(CONFIRM_INTERVAL_MS);
      await result;
      respond(401);
      endByNetwork(subject);

      const callsBefore = fetchMock.mock.calls.length;

      await subject.disconnectStale();

      expect(fetchMock).toHaveBeenCalledTimes(callsBefore + 1);
      expect(new Headers(getRequestInit(callsBefore).headers).get('Authorization')).toBe(
        'Bearer token-2',
      );
    });
  });

  describe('срок жизни устаревшего участника', () => {
    const STALE_TTL_MS = 60_000;

    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('отключает устаревшего участника ровно через 60 секунд после окончания звонка', async () => {
      const subject = setup();

      respond(401);
      createStale(subject);
      jest.advanceTimersByTime(STALE_TTL_MS);

      await subject.disconnectStale();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('забывает устаревшего участника без запроса позже 60 секунд после окончания звонка', async () => {
      const subject = setup();

      respond(401);
      respond(401);
      createStale(subject);
      jest.advanceTimersByTime(STALE_TTL_MS + 1);

      await expect(subject.disconnectStale()).resolves.toBeUndefined();
      await expect(subject.disconnectStale()).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('отсчитывает срок от окончания звонка, а не от входа в комнату', async () => {
      const subject = setup();

      respond(401);
      subject.enterRoom('token-1');
      jest.advanceTimersByTime(STALE_TTL_MS * 2);
      endByNetwork(subject);

      await subject.disconnectStale();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('не продлевает срок событиями звонка после окончания', async () => {
      const subject = setup();

      respond(401);
      createStale(subject);
      jest.advanceTimersByTime(STALE_TTL_MS / 2);
      subject.emit('end-call');
      subject.emit('failed', { originator: 'local', cause: JsSIP_C.causes.INTERNAL_ERROR });
      endByNetwork(subject);
      jest.advanceTimersByTime(STALE_TTL_MS / 2 + 1);

      await subject.disconnectStale();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('не продлевает срок отменой отключения', async () => {
      const subject = setup();
      const abortController = new AbortController();

      holdUntilAbort();
      respond(401);
      createStale(subject);
      jest.advanceTimersByTime(STALE_TTL_MS / 2);

      const result = catchError(subject.disconnectStale(abortController.signal));

      abortController.abort();
      await result;

      jest.advanceTimersByTime(STALE_TTL_MS / 2 + 1);

      await subject.disconnectStale();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
