import { requesterByTimeoutsWithFailCalls } from '@krivega/timeout-requester';

import { doMockSipConnector } from '@/doMock';
import CallStatusSubscriber from '../CallStatusSubscriber';
import PingServerRequester from '../PingServerRequester';

const requesterByTimeoutsWithFailCallsMock =
  requesterByTimeoutsWithFailCalls as jest.MockedFunction<typeof requesterByTimeoutsWithFailCalls>;

const startMock = jest.fn(async () => {});
const stopMock = jest.fn();

jest.mock('@krivega/timeout-requester', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    ...jest.requireActual('@krivega/timeout-requester'),
    requesterByTimeoutsWithFailCalls: jest.fn(() => {
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
      callManager: sipConnector.callManager,
    });
  });

  describe('инициализация', () => {
    it('создаёт requesterByTimeoutsWithFailCalls с корректными параметрами', async () => {
      expect(requesterByTimeoutsWithFailCallsMock).toHaveBeenCalledTimes(1);

      const { calls } = requesterByTimeoutsWithFailCallsMock.mock;

      expect(calls.length).toBe(1);

      const firstCall = calls[0] as unknown as [
        number,
        { requestInterval: number; request: () => Promise<void> },
      ];
      const [maxFails, options] = firstCall;

      expect(maxFails).toBe(2);
      expect(options.requestInterval).toBe(15_000);
      expect(typeof options.request).toBe('function');

      const pingSpy = jest
        .spyOn(sipConnector.connectionManager, 'ping')
        .mockResolvedValue(undefined);

      await options.request();

      expect(pingSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('start', () => {
    it('подписывается на CallStatusSubscriber с fireImmediately=true', () => {
      const subscribeSpy = jest.spyOn(CallStatusSubscriber.prototype, 'subscribe');

      subscribeSpy.mockImplementation((callback, options) => {
        expect(options).toEqual({ fireImmediately: true });
        callback(false);
      });

      const onFailRequest = jest.fn();

      pingServerRequester.start({ onFailRequest });

      expect(subscribeSpy).toHaveBeenCalledTimes(1);
    });

    it('запускает пинг вне звонка', () => {
      const subscribeSpy = jest.spyOn(CallStatusSubscriber.prototype, 'subscribe');

      subscribeSpy.mockImplementation((callback) => {
        callback(false);
      });

      const onFailRequest = jest.fn();

      pingServerRequester.start({ onFailRequest });

      expect(startMock).toHaveBeenCalledTimes(1);
      expect(startMock).toHaveBeenCalledWith(undefined, { onFailRequest });
    });

    it('останавливает пинг при активном звонке', () => {
      const subscribeSpy = jest.spyOn(CallStatusSubscriber.prototype, 'subscribe');

      subscribeSpy.mockImplementation((callback) => {
        callback(true);
      });

      pingServerRequester.start({ onFailRequest: jest.fn() });

      expect(stopMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('останавливает пинг и отписывается', () => {
      const unsubscribeSpy = jest.spyOn(CallStatusSubscriber.prototype, 'unsubscribe');

      pingServerRequester.stop();

      expect(stopMock).toHaveBeenCalledTimes(1);
      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
