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

  beforeEach(() => {
    sipConnector = doMockSipConnector();

    jest.clearAllMocks();

    pingServerRequester = new PingServerRequester({
      connectionManager: sipConnector.connectionManager,
    });
  });

  describe('start', () => {
    it('создаёт resolveRequesterByTimeout с корректными параметрами', async () => {
      pingServerRequester.start({ onFailRequest: jest.fn() });

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
      const onFailRequest = jest.fn();

      pingServerRequester.start({ onFailRequest });

      expect(startMock).toHaveBeenCalledTimes(1);
      expect(startMock).toHaveBeenCalledWith(undefined, {
        onFailRequest: expect.any(Function) as () => void,
        onSuccessRequest: expect.any(Function) as () => void,
      });
    });

    it('вызывает onFailRequest один раз после лимита ошибок до следующего успеха', () => {
      const onFailRequest = jest.fn();

      pingServerRequester.start({ onFailRequest });

      const [, callbacks] = startMock.mock.calls[0] as unknown as [
        undefined,
        { onFailRequest: () => void; onSuccessRequest: () => void },
      ];

      callbacks.onFailRequest();
      callbacks.onFailRequest();
      callbacks.onFailRequest();

      expect(onFailRequest).toHaveBeenCalledTimes(1);

      callbacks.onSuccessRequest();
      callbacks.onFailRequest();
      callbacks.onFailRequest();

      expect(onFailRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop', () => {
    it('останавливает ping', () => {
      pingServerRequester.start({ onFailRequest: jest.fn() });
      pingServerRequester.stop();

      expect(stopMock).toHaveBeenCalledTimes(1);
    });
  });
});
