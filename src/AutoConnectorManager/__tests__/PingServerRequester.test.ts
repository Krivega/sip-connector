import { resolveRequesterByTimeout } from '@krivega/timeout-requester';

import { doMockSipConnector } from '@/doMock';
import PingServerRequester from '../PingServerRequester';

const resolveRequesterByTimeoutMock = resolveRequesterByTimeout as jest.MockedFunction<
  typeof resolveRequesterByTimeout
>;

const startMock = jest.fn(async () => {});
const stopMock = jest.fn();

jest.mock('@krivega/timeout-requester', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    ...jest.requireActual('@krivega/timeout-requester'),
    resolveRequesterByTimeout: jest.fn(() => {
      return {
        start: startMock,
        stop: stopMock,
      };
    }),
  };
});

describe('PingServerRequester', () => {
  let pingServerRequester: PingServerRequester;
  let sipConnector: ReturnType<typeof doMockSipConnector>;
  let onPingSucceeded: jest.Mock;
  let onPingFailedInCall: jest.Mock;

  const startRequester = (onFailRequest: () => void = jest.fn()) => {
    pingServerRequester.start({
      onFailRequest,
      onPingSucceeded,
      onPingFailedInCall,
    });
  };

  const getRequesterCallbacks = () => {
    return startMock.mock.calls[0] as unknown as [
      undefined,
      { onFailRequest: (error?: unknown) => void; onSuccessRequest: () => void },
    ];
  };

  beforeEach(() => {
    sipConnector = doMockSipConnector();

    jest.clearAllMocks();

    onPingSucceeded = jest.fn();
    onPingFailedInCall = jest.fn();

    pingServerRequester = new PingServerRequester({
      connectionManager: sipConnector.connectionManager,
      callManager: sipConnector.callManager,
    });
  });

  describe('start', () => {
    it('создаёт resolveRequesterByTimeout с корректными параметрами', async () => {
      startRequester();

      expect(resolveRequesterByTimeoutMock).toHaveBeenCalledTimes(1);

      const { calls } = resolveRequesterByTimeoutMock.mock;

      expect(calls.length).toBe(1);

      const [options] = calls[0] as unknown as [
        { isDontStopOnFail: boolean; requestInterval: number; request: () => Promise<void> },
      ];

      expect(options.isDontStopOnFail).toBe(true);
      expect(options.requestInterval).toBe(15_000);
      expect(typeof options.request).toBe('function');

      const pingSpy = jest
        .spyOn(sipConnector.connectionManager, 'ping')
        .mockResolvedValue(undefined);

      await options.request();

      expect(pingSpy).toHaveBeenCalledTimes(1);
    });

    it('запускает периодический ping', () => {
      expect(pingServerRequester.isStarted).toBe(false);

      startRequester();

      expect(pingServerRequester.isStarted).toBe(true);
      expect(startMock).toHaveBeenCalledTimes(1);
      expect(startMock).toHaveBeenCalledWith(undefined, {
        onFailRequest: expect.any(Function) as () => void,
        onSuccessRequest: expect.any(Function) as () => void,
      });
    });

    it('вызывает onFailRequest один раз после лимита ошибок до следующего успеха', () => {
      const onFailRequest = jest.fn();

      startRequester(onFailRequest);

      const [, callbacks] = getRequesterCallbacks();

      callbacks.onFailRequest();
      callbacks.onFailRequest();
      callbacks.onFailRequest();

      expect(onFailRequest).toHaveBeenCalledTimes(1);

      callbacks.onSuccessRequest();
      callbacks.onFailRequest();
      callbacks.onFailRequest();

      expect(onFailRequest).toHaveBeenCalledTimes(2);
    });

    it('не вызывает onFailRequest во время активного звонка и вызывает после его завершения', () => {
      const onFailRequest = jest.fn();
      const isCallActiveSpy = jest
        .spyOn(sipConnector.callManager, 'isCallActive', 'get')
        .mockReturnValue(true);

      startRequester(onFailRequest);

      const [, callbacks] = getRequesterCallbacks();

      callbacks.onFailRequest();
      callbacks.onFailRequest();
      callbacks.onFailRequest();

      expect(onFailRequest).not.toHaveBeenCalled();

      isCallActiveSpy.mockReturnValue(false);
      callbacks.onFailRequest();

      expect(onFailRequest).toHaveBeenCalledTimes(1);

      callbacks.onFailRequest();

      expect(onFailRequest).toHaveBeenCalledTimes(1);
    });

    it('после успешного ping во время звонка требует новый лимит ошибок после его завершения', () => {
      const onFailRequest = jest.fn();
      const isCallActiveSpy = jest
        .spyOn(sipConnector.callManager, 'isCallActive', 'get')
        .mockReturnValue(true);

      startRequester(onFailRequest);

      const [, callbacks] = getRequesterCallbacks();

      callbacks.onFailRequest();
      callbacks.onFailRequest();
      callbacks.onSuccessRequest();

      isCallActiveSpy.mockReturnValue(false);
      callbacks.onFailRequest();

      expect(onFailRequest).not.toHaveBeenCalled();

      callbacks.onFailRequest();

      expect(onFailRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('неуспешный ping во время звонка', () => {
    let onFailRequest: jest.Mock;
    let isCallActiveSpy: jest.SpyInstance;
    let callbacks: { onFailRequest: (error?: unknown) => void; onSuccessRequest: () => void };

    beforeEach(() => {
      onFailRequest = jest.fn();
      isCallActiveSpy = jest
        .spyOn(sipConnector.callManager, 'isCallActive', 'get')
        .mockReturnValue(true);

      startRequester(onFailRequest);

      [, callbacks] = getRequesterCallbacks();
    });

    it('сообщает о каждом неуспешном ping в звонке с числом провалов подряд и ошибкой ping', () => {
      const error = { originator: 'system', cause: 'Request Timeout' };

      callbacks.onFailRequest(error);
      callbacks.onFailRequest(error);

      expect(onPingFailedInCall).toHaveBeenCalledTimes(2);
      expect(onPingFailedInCall).toHaveBeenNthCalledWith(1, { failCount: 1, error });
      expect(onPingFailedInCall).toHaveBeenNthCalledWith(2, { failCount: 2, error });
      expect(onFailRequest).not.toHaveBeenCalled();
    });

    it('после успешного ping считает провалы заново', () => {
      callbacks.onFailRequest();
      callbacks.onFailRequest();
      callbacks.onSuccessRequest();
      callbacks.onFailRequest();

      expect(onPingFailedInCall).toHaveBeenLastCalledWith({ failCount: 1 });
    });

    it('не сообщает о неуспешном ping вне звонка', () => {
      isCallActiveSpy.mockReturnValue(false);

      callbacks.onFailRequest();
      callbacks.onFailRequest();
      callbacks.onFailRequest();

      expect(onPingFailedInCall).not.toHaveBeenCalled();
      expect(onFailRequest).toHaveBeenCalledTimes(1);
    });

    it('сообщает о каждом успешном ping в звонке и вне его', () => {
      callbacks.onFailRequest();
      callbacks.onSuccessRequest();
      isCallActiveSpy.mockReturnValue(false);
      callbacks.onSuccessRequest();

      expect(onPingSucceeded).toHaveBeenCalledTimes(2);
    });

    it('остановка ни о чём не сообщает', () => {
      callbacks.onFailRequest();
      pingServerRequester.stop();

      expect(onPingFailedInCall).toHaveBeenCalledTimes(1);
      expect(onPingSucceeded).not.toHaveBeenCalled();
      expect(onFailRequest).not.toHaveBeenCalled();
    });
  });

  describe('pingImmediately', () => {
    it('без запущенного ping ничего не отправляет', () => {
      pingServerRequester.pingImmediately();

      expect(startMock).not.toHaveBeenCalled();
    });

    it('сразу отправляет ping того же цикла', () => {
      startRequester();

      const [, callbacks] = getRequesterCallbacks();

      pingServerRequester.pingImmediately();

      expect(resolveRequesterByTimeoutMock).toHaveBeenCalledTimes(1);
      expect(startMock).toHaveBeenCalledTimes(2);
      expect(startMock).toHaveBeenLastCalledWith(undefined, callbacks);
    });

    it('после остановки ничего не отправляет', () => {
      startRequester();
      pingServerRequester.stop();
      pingServerRequester.pingImmediately();

      expect(startMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('останавливает ping', () => {
      startRequester();
      pingServerRequester.stop();

      expect(stopMock).toHaveBeenCalledTimes(1);
      expect(pingServerRequester.isStarted).toBe(false);
    });
  });
});
