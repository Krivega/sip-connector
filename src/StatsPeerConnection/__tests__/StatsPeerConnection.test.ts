import delayPromise from '@/__fixtures__/delayPromise';
import { INTERVAL_COLLECT_STATISTICS } from '../constants';
import StatsPeerConnection from '../StatsPeerConnection';

const resolveMockPromise = <T>(): [promise: Promise<T>, resolvePromise: jest.Mock] => {
  let resolvePromise: jest.Mock = jest.fn();

  const promise = new Promise<T>((resolve) => {
    resolvePromise = jest.fn(resolve);
  });

  return [promise, resolvePromise];
};

describe('StatsPeerConnection', () => {
  let statsPeerConnection: StatsPeerConnection;
  let peerConnectionMocked: RTCPeerConnection;
  let promiseGetStats: Promise<void>;
  let resolvePromiseGetStats: () => void;
  let onCollectedMocked: jest.Mock;
  let startMocked: jest.SpyInstance;

  beforeEach(() => {
    statsPeerConnection = new StatsPeerConnection();

    startMocked = jest.spyOn(statsPeerConnection, 'start');

    onCollectedMocked = jest.fn();

    [promiseGetStats, resolvePromiseGetStats] = resolveMockPromise();

    const videoSenderMocked = {
      track: {
        kind: 'video',
      },
      getStats: async () => {
        resolvePromiseGetStats();

        return undefined;
      },
    } as unknown as RTCRtpSender;

    peerConnectionMocked = {
      getSenders: () => {
        return [videoSenderMocked];
      },
      getReceivers: () => {
        return [];
      },
    } as unknown as RTCPeerConnection;
  });

  it('should be called onCollected callback by timeout', async () => {
    expect.assertions(2);

    statsPeerConnection.start(peerConnectionMocked);
    statsPeerConnection.on('collected', onCollectedMocked);

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(onCollectedMocked).toHaveBeenCalledTimes(1);

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(onCollectedMocked).toHaveBeenCalledTimes(2);
  });

  it('should be canceled request by timeout when statistics has requested and requests has stopped', async () => {
    expect.assertions(1);

    statsPeerConnection.start(peerConnectionMocked);
    statsPeerConnection.on('collected', onCollectedMocked);

    await promiseGetStats;

    statsPeerConnection.stop();

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(onCollectedMocked).toHaveBeenCalledTimes(0);
  });

  it('should be canceled request by timeout when onCollected callback has called and requests has stopped', async () => {
    expect.assertions(1);

    const [promiseOnCollected, resolvePromiseOnCollected] = resolveMockPromise();

    statsPeerConnection.on('collected', onCollectedMocked);
    statsPeerConnection.on('collected', resolvePromiseOnCollected);
    statsPeerConnection.start(peerConnectionMocked);

    await promiseOnCollected;

    statsPeerConnection.stop();

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(onCollectedMocked).toHaveBeenCalledTimes(1);
  });

  it('should be canceled previous timeout when start has called again', async () => {
    expect.assertions(2);

    statsPeerConnection.start(peerConnectionMocked);
    statsPeerConnection.start(peerConnectionMocked);

    expect(startMocked).toHaveBeenCalledTimes(2);

    statsPeerConnection.stop();

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(startMocked).toHaveBeenCalledTimes(2);
  });

  it('should be canceled previous timeout when statistics has requested and start has called again', async () => {
    expect.assertions(2);

    statsPeerConnection.start(peerConnectionMocked);

    await promiseGetStats;

    // eslint-disable-next-line require-atomic-updates
    [promiseGetStats, resolvePromiseGetStats] = resolveMockPromise();

    statsPeerConnection.start(peerConnectionMocked);

    await promiseGetStats;

    expect(startMocked).toHaveBeenCalledTimes(2);

    statsPeerConnection.stop();

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(startMocked).toHaveBeenCalledTimes(2);
  });

  it('requested should be false by default and true after start', () => {
    expect(statsPeerConnection.requested).toBe(false);

    statsPeerConnection.start(peerConnectionMocked);

    expect(statsPeerConnection.requested).toBe(true);

    statsPeerConnection.stop();

    expect(statsPeerConnection.requested).toBe(false);
  });

  it('should be canceled request by timeout when onCollected callback has called and start has called again', async () => {
    expect.assertions(2);

    statsPeerConnection.on('collected', onCollectedMocked);

    const [promiseOnCollected, resolvePromiseOnCollected] = resolveMockPromise();

    statsPeerConnection.on('collected', resolvePromiseOnCollected);
    statsPeerConnection.start(peerConnectionMocked);

    await promiseOnCollected;

    const [secondPromiseOnCollected, secondResolvePromiseOnCollected] = resolveMockPromise();

    statsPeerConnection.on('collected', secondResolvePromiseOnCollected);
    statsPeerConnection.start(peerConnectionMocked);

    await secondPromiseOnCollected;

    expect(onCollectedMocked).toHaveBeenCalledTimes(2);

    statsPeerConnection.stop();

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(onCollectedMocked).toHaveBeenCalledTimes(2);
  });

  it('off should unsubscribe a specific handler', async () => {
    expect.assertions(1);

    const [onCollectedCalled, resolveOnCollectedCalled] = resolveMockPromise();
    const handlerToRemove = jest.fn();

    // subscribe two handlers
    statsPeerConnection.on('collected', handlerToRemove);
    statsPeerConnection.on('collected', resolveOnCollectedCalled);

    // unsubscribe the first one
    statsPeerConnection.off('collected', handlerToRemove);

    // start collection and wait for one emit
    statsPeerConnection.start(peerConnectionMocked);

    await onCollectedCalled;

    // removed handler should not be called
    expect(handlerToRemove).not.toHaveBeenCalled();

    statsPeerConnection.stop();
  });

  it('once should handle only the first collected event', async () => {
    expect.assertions(1);

    const onceHandler = jest.fn();

    statsPeerConnection.once('collected', onceHandler);
    statsPeerConnection.start(peerConnectionMocked);

    await delayPromise(INTERVAL_COLLECT_STATISTICS);
    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(onceHandler).toHaveBeenCalledTimes(1);

    statsPeerConnection.stop();
  });

  it('onceRace should be called once with eventName', async () => {
    expect.assertions(2);

    const [eventNamePromise, resolveEventName] = resolveMockPromise<string>();
    const raceHandler = jest.fn((_: unknown, eventName: string) => {
      resolveEventName(eventName);
    });

    statsPeerConnection.onceRace(['collected'], raceHandler);
    statsPeerConnection.start(peerConnectionMocked);

    const eventName = await eventNamePromise;

    expect(eventName).toBe('collected');

    await delayPromise(INTERVAL_COLLECT_STATISTICS);
    expect(raceHandler).toHaveBeenCalledTimes(1);

    statsPeerConnection.stop();
  });

  it('wait should resolve with collected payload once', async () => {
    expect.assertions(2);

    const waitPromise = statsPeerConnection.wait('collected');

    statsPeerConnection.start(peerConnectionMocked);

    const payload = await waitPromise;

    expect(payload).toHaveProperty('outbound');
    expect(payload).toHaveProperty('inbound');

    statsPeerConnection.stop();
  });
});
