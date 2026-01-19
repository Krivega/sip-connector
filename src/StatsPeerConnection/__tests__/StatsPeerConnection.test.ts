import delayPromise from '@/__fixtures__/delayPromise';
import StatsPeerConnection from '../@StatsPeerConnection';
import { INTERVAL_COLLECT_STATISTICS } from '../constants';

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

  const getPeerConnection = () => {
    return peerConnectionMocked;
  };

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

  it('должен вызывать onCollected по таймеру', async () => {
    expect.assertions(2);

    statsPeerConnection.start(getPeerConnection);
    statsPeerConnection.on('collected', onCollectedMocked);

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(onCollectedMocked).toHaveBeenCalledTimes(1);

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(onCollectedMocked).toHaveBeenCalledTimes(2);
  });

  it('должен отменять запрос по таймеру после запроса статистики и остановки', async () => {
    expect.assertions(1);

    statsPeerConnection.start(getPeerConnection);
    statsPeerConnection.on('collected', onCollectedMocked);

    await promiseGetStats;

    statsPeerConnection.stop();

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(onCollectedMocked).toHaveBeenCalledTimes(0);
  });

  it('должен отменять запрос по таймеру после onCollected и остановки', async () => {
    expect.assertions(1);

    const [promiseOnCollected, resolvePromiseOnCollected] = resolveMockPromise();

    statsPeerConnection.on('collected', onCollectedMocked);
    statsPeerConnection.on('collected', resolvePromiseOnCollected);
    statsPeerConnection.start(getPeerConnection);

    await promiseOnCollected;

    statsPeerConnection.stop();

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(onCollectedMocked).toHaveBeenCalledTimes(1);
  });

  it('должен отменять предыдущий таймер при повторном start', async () => {
    expect.assertions(2);

    statsPeerConnection.start(getPeerConnection);
    statsPeerConnection.start(getPeerConnection);

    expect(startMocked).toHaveBeenCalledTimes(2);

    statsPeerConnection.stop();

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(startMocked).toHaveBeenCalledTimes(2);
  });

  it('должен отменять предыдущий таймер при повторном start после запроса статистики', async () => {
    expect.assertions(2);

    statsPeerConnection.start(getPeerConnection);

    await promiseGetStats;

    // eslint-disable-next-line require-atomic-updates
    [promiseGetStats, resolvePromiseGetStats] = resolveMockPromise();

    statsPeerConnection.start(getPeerConnection);

    await promiseGetStats;

    expect(startMocked).toHaveBeenCalledTimes(2);

    statsPeerConnection.stop();

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(startMocked).toHaveBeenCalledTimes(2);
  });

  it('requested должен быть false по умолчанию и true после start', () => {
    expect(statsPeerConnection.requested).toBe(false);

    statsPeerConnection.start(getPeerConnection);

    expect(statsPeerConnection.requested).toBe(true);

    statsPeerConnection.stop();

    expect(statsPeerConnection.requested).toBe(false);
  });

  it('должен отменять запрос по таймеру после onCollected и повторного start', async () => {
    expect.assertions(2);

    statsPeerConnection.on('collected', onCollectedMocked);

    const [promiseOnCollected, resolvePromiseOnCollected] = resolveMockPromise();

    statsPeerConnection.on('collected', resolvePromiseOnCollected);
    statsPeerConnection.start(getPeerConnection);

    await promiseOnCollected;

    const [secondPromiseOnCollected, secondResolvePromiseOnCollected] = resolveMockPromise();

    statsPeerConnection.on('collected', secondResolvePromiseOnCollected);
    statsPeerConnection.start(getPeerConnection);

    await secondPromiseOnCollected;

    expect(onCollectedMocked).toHaveBeenCalledTimes(2);

    statsPeerConnection.stop();

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(onCollectedMocked).toHaveBeenCalledTimes(2);
  });

  it('off должен отписывать конкретный обработчик', async () => {
    expect.assertions(1);

    const [onCollectedCalled, resolveOnCollectedCalled] = resolveMockPromise();
    const handlerToRemove = jest.fn();

    // subscribe two handlers
    statsPeerConnection.on('collected', handlerToRemove);
    statsPeerConnection.on('collected', resolveOnCollectedCalled);

    // unsubscribe the first one
    statsPeerConnection.off('collected', handlerToRemove);

    // start collection and wait for one emit
    statsPeerConnection.start(getPeerConnection);

    await onCollectedCalled;

    // removed handler should not be called
    expect(handlerToRemove).not.toHaveBeenCalled();

    statsPeerConnection.stop();
  });

  it('once должен обрабатывать только первое событие collected', async () => {
    expect.assertions(1);

    const onceHandler = jest.fn();

    statsPeerConnection.once('collected', onceHandler);
    statsPeerConnection.start(getPeerConnection);

    await delayPromise(INTERVAL_COLLECT_STATISTICS);
    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(onceHandler).toHaveBeenCalledTimes(1);

    statsPeerConnection.stop();
  });

  it('onceRace должен вызываться один раз с eventName', async () => {
    expect.assertions(2);

    const [eventNamePromise, resolveEventName] = resolveMockPromise<string>();
    const raceHandler = jest.fn((_: unknown, eventName: string) => {
      resolveEventName(eventName);
    });

    statsPeerConnection.onceRace(['collected'], raceHandler);
    statsPeerConnection.start(getPeerConnection);

    const eventName = await eventNamePromise;

    expect(eventName).toBe('collected');

    await delayPromise(INTERVAL_COLLECT_STATISTICS);
    expect(raceHandler).toHaveBeenCalledTimes(1);

    statsPeerConnection.stop();
  });

  it('wait должен один раз резолвиться с payload для collected', async () => {
    expect.assertions(2);

    const waitPromise = statsPeerConnection.wait('collected');

    statsPeerConnection.start(getPeerConnection);

    const payload = await waitPromise;

    expect(payload).toHaveProperty('outbound');
    expect(payload).toHaveProperty('inbound');

    statsPeerConnection.stop();
  });

  it('должен вызывать onError при отсутствии peerConnection', async () => {
    expect.assertions(3);

    const onErrorMocked = jest.fn();
    const getUndefinedPeerConnection = () => {
      return undefined;
    };

    statsPeerConnection.start(getUndefinedPeerConnection, { onError: onErrorMocked });
    statsPeerConnection.on('collected', onCollectedMocked);

    await delayPromise(INTERVAL_COLLECT_STATISTICS);

    expect(onCollectedMocked).toHaveBeenCalledTimes(0);
    expect(onErrorMocked).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(onErrorMocked.mock.calls[0][0].message).toBe(
      'failed to collect statistics: peerConnection is not defined',
    );
  });
});
