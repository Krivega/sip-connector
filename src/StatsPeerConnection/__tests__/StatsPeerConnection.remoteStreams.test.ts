import StatsPeerConnection from '../@StatsPeerConnection';
import { INTERVAL_COLLECT_STATISTICS } from '../constants';
import requestAllStatistics from '../requestAllStatistics';

jest.mock('../requestAllStatistics');

it('reads current classified streams on each statistics poll', async () => {
  jest.useFakeTimers();

  const first = { mainStream: {} as MediaStream };
  const second = { contentedStream: {} as MediaStream };
  const getStreams = jest.fn().mockReturnValue(first);
  const pc = {} as RTCPeerConnection;
  const request = jest.mocked(requestAllStatistics);

  request.mockResolvedValue({
    synchronizationSources: { audio: {}, video: {} },
    audioSenderStats: undefined,
    videoSenderFirstStats: undefined,
    videoSenderSecondStats: undefined,
    audioReceiverStats: undefined,
    videoReceiverFirstStats: undefined,
    videoReceiverSecondStats: undefined,
  });

  const collector = new StatsPeerConnection(getStreams);

  try {
    collector.start(() => {
      return pc;
    });
    await jest.advanceTimersByTimeAsync(INTERVAL_COLLECT_STATISTICS);
    expect(request).toHaveBeenLastCalledWith(pc, first);
    getStreams.mockReturnValue(second);
    await jest.advanceTimersByTimeAsync(INTERVAL_COLLECT_STATISTICS);
    expect(request).toHaveBeenLastCalledWith(pc, second);
    expect(getStreams).toHaveBeenCalledTimes(2);
  } finally {
    collector.stop({ reason: 'call-ended' });
    jest.useRealTimers();
  }
});
