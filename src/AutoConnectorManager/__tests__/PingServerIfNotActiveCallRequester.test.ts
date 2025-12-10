import { requesterByTimeoutsWithFailCalls } from '@krivega/timeout-requester';

import { doMockSipConnector } from '@/doMock';
import PingServerIfNotActiveCallRequester from '../PingServerIfNotActiveCallRequester';

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

describe('PingServerIfNotActiveCallRequester', () => {
  let pingServerIfNotActiveCallRequester: PingServerIfNotActiveCallRequester;
  let sipConnector: ReturnType<typeof doMockSipConnector>;

  let startCall: () => void;
  let endCall: () => void;

  beforeEach(() => {
    sipConnector = doMockSipConnector();

    jest.clearAllMocks();

    pingServerIfNotActiveCallRequester = new PingServerIfNotActiveCallRequester({
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

      callManagerOnSpy.mockImplementation((eventName) => {
        expect(eventName).toBe('call-status-changed');

        return jest.fn();
      });

      const onFailRequest = jest.fn();

      pingServerIfNotActiveCallRequester.start({ onFailRequest });

      expect(startMock).toHaveBeenCalledTimes(1);
      expect(callManagerOnSpy).toHaveBeenCalledTimes(1);
    });

    it('запускает пинг вне звонка', () => {
      const onFailRequest = jest.fn();

      pingServerIfNotActiveCallRequester.start({ onFailRequest });

      startCall();
      endCall();

      expect(startMock).toHaveBeenCalledTimes(2);
      expect(startMock).toHaveBeenCalledWith(undefined, {
        onFailRequest,
        onSuccessRequest: undefined,
      });
    });

    it('передает onSuccessRequest в ping server requester', () => {
      const onFailRequest = jest.fn();
      const onSuccessRequest = jest.fn();

      pingServerIfNotActiveCallRequester.start({ onFailRequest, onSuccessRequest });

      expect(startMock).toHaveBeenCalledTimes(1);
      expect(startMock).toHaveBeenCalledWith(undefined, { onFailRequest, onSuccessRequest });
    });

    it('передает onSuccessRequest при перезапуске пинга после окончания звонка', () => {
      const onFailRequest = jest.fn();
      const onSuccessRequest = jest.fn();

      pingServerIfNotActiveCallRequester.start({ onFailRequest, onSuccessRequest });

      startCall();
      endCall();

      expect(startMock).toHaveBeenCalledTimes(2);
      expect(startMock).toHaveBeenNthCalledWith(1, undefined, { onFailRequest, onSuccessRequest });
      expect(startMock).toHaveBeenNthCalledWith(2, undefined, { onFailRequest, onSuccessRequest });
    });

    it('останавливает пинг при активном звонке', () => {
      pingServerIfNotActiveCallRequester.start({ onFailRequest: jest.fn() });

      expect(stopMock).toHaveBeenCalledTimes(0);

      startCall();

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

      pingServerIfNotActiveCallRequester.start({ onFailRequest: jest.fn() });
      pingServerIfNotActiveCallRequester.stop();

      expect(stopMock).toHaveBeenCalledTimes(1);
      expect(disposer).toHaveBeenCalledTimes(1);
    });
  });
});
