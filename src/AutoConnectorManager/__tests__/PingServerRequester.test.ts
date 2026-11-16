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
  let onSignalingUnstable: jest.Mock;
  let onSignalingRestored: jest.Mock;

  const getRequesterCallbacks = () => {
    return startMock.mock.calls[0] as unknown as [
      undefined,
      { onFailRequest: () => void; onSuccessRequest: () => void },
    ];
  };

  beforeEach(() => {
    sipConnector = doMockSipConnector();

    jest.clearAllMocks();

    onSignalingUnstable = jest.fn();
    onSignalingRestored = jest.fn();

    pingServerRequester = new PingServerRequester({
      connectionManager: sipConnector.connectionManager,
      callManager: sipConnector.callManager,
    });
  });

  describe('start', () => {
    it('создаёт resolveRequesterByTimeout с корректными параметрами', async () => {
      pingServerRequester.start({
        onFailRequest: jest.fn(),
        onSignalingUnstable,
        onSignalingRestored,
      });

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

      pingServerRequester.start({ onFailRequest, onSignalingUnstable, onSignalingRestored });

      expect(startMock).toHaveBeenCalledTimes(1);
      expect(startMock).toHaveBeenCalledWith(undefined, {
        onFailRequest: expect.any(Function) as () => void,
        onSuccessRequest: expect.any(Function) as () => void,
      });
    });

    it('вызывает onFailRequest один раз после лимита ошибок до следующего успеха', () => {
      const onFailRequest = jest.fn();

      pingServerRequester.start({ onFailRequest, onSignalingUnstable, onSignalingRestored });

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

      pingServerRequester.start({ onFailRequest, onSignalingUnstable, onSignalingRestored });

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

      pingServerRequester.start({ onFailRequest, onSignalingUnstable, onSignalingRestored });

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

  describe('нестабильная сигнализация во время звонка', () => {
    let onFailRequest: jest.Mock;
    let isCallActiveSpy: jest.SpyInstance;
    let callbacks: { onFailRequest: () => void; onSuccessRequest: () => void };

    beforeEach(() => {
      onFailRequest = jest.fn();
      isCallActiveSpy = jest
        .spyOn(sipConnector.callManager, 'isCallActive', 'get')
        .mockReturnValue(true);

      pingServerRequester.start({ onFailRequest, onSignalingUnstable, onSignalingRestored });

      [, callbacks] = getRequesterCallbacks();
    });

    it('сообщает signaling-unstable один раз за эпизод при достижении лимита ошибок', () => {
      callbacks.onFailRequest();

      expect(onSignalingUnstable).not.toHaveBeenCalled();

      callbacks.onFailRequest();
      callbacks.onFailRequest();

      expect(onSignalingUnstable).toHaveBeenCalledTimes(1);
      expect(onSignalingUnstable).toHaveBeenCalledWith({ failCount: 2 });
      expect(onSignalingRestored).not.toHaveBeenCalled();
    });

    it('не сообщает signaling-unstable и signaling-restored вне звонка', () => {
      isCallActiveSpy.mockReturnValue(false);

      callbacks.onFailRequest();
      callbacks.onFailRequest();
      callbacks.onSuccessRequest();
      pingServerRequester.stop();

      expect(onFailRequest).toHaveBeenCalledTimes(1);
      expect(onSignalingUnstable).not.toHaveBeenCalled();
      expect(onSignalingRestored).not.toHaveBeenCalled();
    });

    it('сообщает signaling-restored один раз после успешного ping', () => {
      callbacks.onFailRequest();
      callbacks.onFailRequest();
      callbacks.onSuccessRequest();
      callbacks.onSuccessRequest();

      expect(onSignalingRestored).toHaveBeenCalledTimes(1);
    });

    it('сообщает signaling-restored при остановке ping', () => {
      callbacks.onFailRequest();
      callbacks.onFailRequest();
      pingServerRequester.stop();
      pingServerRequester.stop();

      expect(onSignalingRestored).toHaveBeenCalledTimes(1);
    });

    it('не сообщает signaling-restored без предшествующего signaling-unstable', () => {
      callbacks.onFailRequest();
      callbacks.onSuccessRequest();
      pingServerRequester.stop();

      expect(onSignalingUnstable).not.toHaveBeenCalled();
      expect(onSignalingRestored).not.toHaveBeenCalled();
    });

    it('сообщает signaling-unstable повторно в новом эпизоде после восстановления', () => {
      callbacks.onFailRequest();
      callbacks.onFailRequest();
      callbacks.onSuccessRequest();
      callbacks.onFailRequest();
      callbacks.onFailRequest();

      expect(onSignalingUnstable).toHaveBeenCalledTimes(2);
      expect(onSignalingRestored).toHaveBeenCalledTimes(1);
    });

    it('после завершения звонка запрашивает reconnect и сообщает signaling-restored при остановке', () => {
      callbacks.onFailRequest();
      callbacks.onFailRequest();

      isCallActiveSpy.mockReturnValue(false);
      callbacks.onFailRequest();

      expect(onFailRequest).toHaveBeenCalledTimes(1);
      expect(onSignalingRestored).not.toHaveBeenCalled();

      pingServerRequester.stop();

      expect(onSignalingUnstable).toHaveBeenCalledTimes(1);
      expect(onSignalingRestored).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('останавливает ping', () => {
      pingServerRequester.start({
        onFailRequest: jest.fn(),
        onSignalingUnstable,
        onSignalingRestored,
      });
      pingServerRequester.stop();

      expect(stopMock).toHaveBeenCalledTimes(1);
    });
  });
});
