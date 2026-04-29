import { doMockSipConnector } from '@/doMock';
import PingServerRequester from '../PingServerRequester';

jest.mock('@/logger');

describe('PingServerRequester - Integration', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('продолжает цикл ping после восстановления и повторно срабатывает на следующем сбое', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask'] });

    const sipConnector = doMockSipConnector();
    const pingServerRequester = new PingServerRequester({
      connectionManager: sipConnector.connectionManager,
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
});
