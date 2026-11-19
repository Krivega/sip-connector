import { doMockSipConnector } from '@/doMock';
import CallSignalingRecovery from '../CallSignalingRecovery';
import PingServerRequester from '../PingServerRequester';

import type { SipConnector } from '@/SipConnector';

jest.mock('@/logger');

describe('PingServerRequester - Integration', () => {
  // Та же связка с восстановлением сигнализации, что и в AutoConnectorRuntime
  const createPingServerRequester = (
    sipConnector: SipConnector,
    signalingHandlers: { onSignalingUnstable: () => void; onSignalingRestored: () => void },
  ) => {
    const pingServerRequester = new PingServerRequester({
      connectionManager: sipConnector.connectionManager,
      callManager: sipConnector.callManager,
    });
    const callSignalingRecovery = new CallSignalingRecovery({
      connectionManager: sipConnector.connectionManager,
      callManager: sipConnector.callManager,
      pingServerRequester,
      ...signalingHandlers,
    });

    return {
      start: ({ onFailRequest }: { onFailRequest: () => void }) => {
        pingServerRequester.start({
          onFailRequest,
          onPingSucceeded: () => {
            callSignalingRecovery.onPingSucceeded();
          },
          onPingFailedInCall: (payload) => {
            callSignalingRecovery.onPingFailedInCall(payload);
          },
        });
      },
      stop: () => {
        pingServerRequester.stop();
        callSignalingRecovery.stop();
      },
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('продолжает цикл ping после восстановления и повторно срабатывает на следующем сбое', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask'] });

    const sipConnector = doMockSipConnector();
    const pingServerRequester = createPingServerRequester(sipConnector, {
      onSignalingUnstable: jest.fn(),
      onSignalingRestored: jest.fn(),
    });
    const pingOutcomes: ('success' | 'fail')[] = [
      'success',
      'fail',
      'fail',
      'success',
      'fail',
      'fail',
    ];
    const pingSpy = jest
      .spyOn(sipConnector.connectionManager, 'ping')
      .mockImplementation(async () => {
        const currentOutcome = pingOutcomes.shift() ?? 'success';

        if (currentOutcome === 'fail') {
          throw new Error('Simulated ping fail');
        }
      });
    const onFailRequest = jest.fn();

    pingServerRequester.start({ onFailRequest });

    for (let index = 0; index < 6; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await jest.runOnlyPendingTimersAsync();
    }

    pingServerRequester.stop();

    expect(pingSpy.mock.calls.length).toBeGreaterThanOrEqual(6);
    expect(onFailRequest).toHaveBeenCalledTimes(2);
  });

  it('во время звонка сообщает о нестабильной сигнализации и её восстановлении', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask'] });

    const sipConnector = doMockSipConnector();

    jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);

    const onSignalingUnstable = jest.fn();
    const onSignalingRestored = jest.fn();
    const pingServerRequester = createPingServerRequester(sipConnector, {
      onSignalingUnstable,
      onSignalingRestored,
    });
    const pingOutcomes: ('success' | 'fail')[] = ['fail', 'fail', 'fail', 'success'];

    jest.spyOn(sipConnector.connectionManager, 'ping').mockImplementation(async () => {
      if (pingOutcomes.shift() === 'fail') {
        throw new Error('Simulated ping fail');
      }
    });

    const onFailRequest = jest.fn();

    pingServerRequester.start({ onFailRequest });

    for (let index = 0; index < 4; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await jest.runOnlyPendingTimersAsync();
    }

    expect(onFailRequest).not.toHaveBeenCalled();
    expect(onSignalingUnstable).toHaveBeenCalledTimes(1);
    expect(onSignalingUnstable).toHaveBeenCalledWith({ failCount: 1 });
    expect(onSignalingRestored).toHaveBeenCalledTimes(1);

    pingServerRequester.stop();

    expect(onSignalingRestored).toHaveBeenCalledTimes(1);
  });
});
