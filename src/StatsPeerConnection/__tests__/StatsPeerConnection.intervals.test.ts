import { INTERVAL_COLLECT_STATISTICS } from '../constants';
import StatsPeerConnection from '../StatsPeerConnection';
import mockedNow from '../utils/now';

jest.mock('../utils/now');

const createVideoSender = () => {
  return {
    track: { kind: 'video' },
    getStats: async () => {
      return undefined as unknown as RTCStatsReport;
    },
  } as unknown as RTCRtpSender;
};

const createPeerConnection = () => {
  const videoSender = createVideoSender();

  return {
    getSenders: () => {
      return [videoSender];
    },
    getReceivers: () => {
      return [] as RTCRtpReceiver[];
    },
  } as unknown as RTCPeerConnection;
};

describe('StatsPeerConnection intervals by elapsed time', () => {
  beforeEach(() => {
    (mockedNow as jest.Mock).mockReset();
  });
  it('sets interval x4 when elapsed > 48 (covers line 90)', async () => {
    const statsPeerConnection = new StatsPeerConnection();
    const startSpy = jest.spyOn(statsPeerConnection, 'start');

    // First call to now() → startTime; second call → endTime
    (mockedNow as jest.Mock)
      .mockReturnValueOnce(1000) // startTime
      .mockReturnValueOnce(1055); // endTime (elapsed = 55 > 48)

    // Force successful request resolution
    // @ts-expect-error access private for test
    statsPeerConnection.requesterAllStatistics.request = jest.fn().mockResolvedValue({
      synchronizationSources: {
        audio: { trackIdentifier: undefined, item: undefined },
        video: { trackIdentifier: undefined, item: undefined },
      },
      audioSenderStats: undefined,
      videoSenderFirstStats: undefined,
      videoSenderSecondStats: undefined,
      audioReceiverStats: undefined,
      videoReceiverFirstStats: undefined,
      videoReceiverSecondStats: undefined,
    });

    // @ts-expect-error
    statsPeerConnection.collectStatistics(createPeerConnection(), {
      onError: undefined,
    });

    // wait microtasks
    await Promise.resolve();

    expect(startSpy).toHaveBeenCalledTimes(1);

    const [, options] = startSpy.mock.calls[0];

    expect(options?.interval).toBe(INTERVAL_COLLECT_STATISTICS * 4);

    statsPeerConnection.stop();
  });

  it('sets interval x2 when 16 < elapsed ≤ 32 (covers line 94)', async () => {
    const statsPeerConnection = new StatsPeerConnection();
    const startSpy = jest.spyOn(statsPeerConnection, 'start');

    (mockedNow as jest.Mock)
      .mockReturnValueOnce(2000) // startTime
      .mockReturnValueOnce(2025); // endTime (elapsed = 25 > 16 and ≤ 32)

    // @ts-expect-error access private for test
    statsPeerConnection.requesterAllStatistics.request = jest.fn().mockResolvedValue({
      synchronizationSources: {
        audio: { trackIdentifier: undefined, item: undefined },
        video: { trackIdentifier: undefined, item: undefined },
      },
      audioSenderStats: undefined,
      videoSenderFirstStats: undefined,
      videoSenderSecondStats: undefined,
      audioReceiverStats: undefined,
      videoReceiverFirstStats: undefined,
      videoReceiverSecondStats: undefined,
    });

    // @ts-expect-error
    statsPeerConnection.collectStatistics(createPeerConnection(), {
      onError: undefined,
    });

    await Promise.resolve();

    expect(startSpy).toHaveBeenCalledTimes(1);

    const [, options] = startSpy.mock.calls[0];

    expect(options?.interval).toBe(INTERVAL_COLLECT_STATISTICS * 2);

    statsPeerConnection.stop();
  });

  it('sets interval x3 when 32 < elapsed ≤ 48 (covers line 92)', async () => {
    const statsPeerConnection = new StatsPeerConnection();
    const startSpy = jest.spyOn(statsPeerConnection, 'start');

    (mockedNow as jest.Mock)
      .mockReturnValueOnce(3000) // startTime
      .mockReturnValueOnce(3035); // endTime (elapsed = 35 > 32 and ≤ 48)

    // @ts-expect-error access private for test
    statsPeerConnection.requesterAllStatistics.request = jest.fn().mockResolvedValue({
      synchronizationSources: {
        audio: { trackIdentifier: undefined, item: undefined },
        video: { trackIdentifier: undefined, item: undefined },
      },
      audioSenderStats: undefined,
      videoSenderFirstStats: undefined,
      videoSenderSecondStats: undefined,
      audioReceiverStats: undefined,
      videoReceiverFirstStats: undefined,
      videoReceiverSecondStats: undefined,
    });

    // @ts-expect-error
    statsPeerConnection.collectStatistics(createPeerConnection(), {
      onError: undefined,
    });

    await Promise.resolve();

    expect(startSpy).toHaveBeenCalledTimes(1);

    const [, options] = startSpy.mock.calls[0];

    expect(options?.interval).toBe(INTERVAL_COLLECT_STATISTICS * 3);

    statsPeerConnection.stop();
  });

  it('handles rejection without onError (covers else path in catch at line 103)', async () => {
    const statsPeerConnection = new StatsPeerConnection();
    const startSpy = jest.spyOn(statsPeerConnection, 'start');

    // @ts-expect-error
    statsPeerConnection.requesterAllStatistics.request = jest
      .fn()
      .mockRejectedValue(new Error('failure'));

    // @ts-expect-error
    statsPeerConnection.collectStatistics(createPeerConnection(), {
      onError: undefined,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(startSpy).not.toHaveBeenCalled();

    statsPeerConnection.stop();
  });
});
