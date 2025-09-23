import { requesterByTimeoutsWithFailCalls } from '@krivega/timeout-requester';

import { doMockSipConnector } from '@/doMock';
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

  let startCall: () => void;
  let endCall: () => void;

  beforeEach(() => {
    sipConnector = doMockSipConnector();

    jest.clearAllMocks();

    pingServerRequester = new PingServerRequester({
      connectionManager: sipConnector.connectionManager,
      callManager: sipConnector.callManager,
    });

    startCall = () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);
      sipConnector.callManager.events.trigger('confirmed', {});
    };
    endCall = () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);
      // @ts-expect-error
      sipConnector.callManager.events.trigger('ended', {});
    };
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
    it('подписывается на изменение статуса звонка и сразу вызывает callback', () => {
      const callManagerOnSpy = jest.spyOn(sipConnector.callManager, 'on');

      callManagerOnSpy.mockImplementation((eventName, handler) => {
        expect(eventName).toBe('call-status-changed');
        handler({});

        return jest.fn();
      });

      const onFailRequest = jest.fn();

      pingServerRequester.start({ onFailRequest });

      expect(callManagerOnSpy).toHaveBeenCalledTimes(1);
    });

    it('запускает пинг вне звонка', () => {
      const onFailRequest = jest.fn();

      pingServerRequester.start({ onFailRequest });

      startCall();
      endCall();

      expect(startMock).toHaveBeenCalledTimes(2);
      expect(startMock).toHaveBeenCalledWith(undefined, { onFailRequest });
    });

    it('останавливает пинг при активном звонке', () => {
      pingServerRequester.start({ onFailRequest: jest.fn() });

      expect(stopMock).toHaveBeenCalledTimes(0);

      startCall();
      endCall();

      expect(stopMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('останавливает пинг и отписывается', () => {
      const disposer = jest.fn();
      const callManagerOnSpy = jest.spyOn(sipConnector.callManager, 'on');

      callManagerOnSpy.mockImplementation(() => {
        return disposer;
      });

      pingServerRequester.start({ onFailRequest: jest.fn() });
      pingServerRequester.stop();

      expect(stopMock).toHaveBeenCalledTimes(1);
      expect(disposer).toHaveBeenCalledTimes(1);
    });
  });
});
