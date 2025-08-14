import requestAllStatistics from '../requestAllStatistics';

type SenderMock = {
  track: { kind: 'audio' | 'video' };
  getStats: () => Promise<RTCStatsReport | undefined>;
};

type ReceiverMock = {
  track: { kind: 'audio' | 'video'; id: string };
  getSynchronizationSources: () => unknown[];
  getStats: () => Promise<RTCStatsReport | undefined>;
};

const createSender = (kind: 'audio' | 'video', stats: RTCStatsReport | undefined): SenderMock => {
  return {
    track: { kind },
    getStats: async () => {
      return stats;
    },
  };
};

const createReceiver = (
  { kind, id }: { kind: 'audio' | 'video'; id: string },
  syncItem: unknown,
  stats: RTCStatsReport | undefined,
): ReceiverMock => {
  return {
    track: { kind, id },
    getSynchronizationSources: () => {
      return [syncItem];
    },
    getStats: async () => {
      return stats;
    },
  };
};

describe('requestAllStatistics', () => {
  it('#1 returns all stats and synchronization sources when present', async () => {
    const AS = {} as RTCStatsReport; // audio sender
    const VS1 = {} as RTCStatsReport; // first video sender
    const VS2 = {} as RTCStatsReport; // second video sender
    const AR = {} as RTCStatsReport; // audio receiver
    const VR1 = {} as RTCStatsReport; // first video receiver
    const VR2 = {} as RTCStatsReport; // second video receiver

    const audioSender = createSender('audio', AS);
    const videoSender1 = createSender('video', VS1);
    const videoSender2 = createSender('video', VS2);

    const audioReceiver = createReceiver(
      { kind: 'audio', id: 'audio-track-id' },
      { ssrc: 'a-ssrc' },
      AR,
    );
    const videoReceiver1 = createReceiver(
      { kind: 'video', id: 'video1-track-id' },
      { ssrc: 'v1-ssrc' },
      VR1,
    );
    const videoReceiver2 = createReceiver(
      { kind: 'video', id: 'video2-track-id' },
      { ssrc: 'v2-ssrc' },
      VR2,
    );

    const peerConnection = {
      getSenders: () => {
        return [audioSender, videoSender1, videoSender2];
      },
      getReceivers: () => {
        return [audioReceiver, videoReceiver1, videoReceiver2];
      },
    } as unknown as RTCPeerConnection;

    const result = await requestAllStatistics(peerConnection);

    expect(result.audioSenderStats).toBe(AS);
    expect(result.videoSenderFirstStats).toBe(VS1);
    expect(result.videoSenderSecondStats).toBe(VS2);
    expect(result.audioReceiverStats).toBe(AR);
    expect(result.videoReceiverFirstStats).toBe(VR1);
    expect(result.videoReceiverSecondStats).toBe(VR2);

    expect(result.synchronizationSources.audio).toEqual({
      trackIdentifier: 'audio-track-id',
      item: { ssrc: 'a-ssrc' },
    });

    expect(result.synchronizationSources.video).toEqual({
      trackIdentifier: 'video1-track-id',
      item: { ssrc: 'v1-ssrc' },
    });
  });

  it('#2 handles missing second video sender/receiver (undefined stats and sync present for first only)', async () => {
    const AS = {} as RTCStatsReport;
    const VS1 = {} as RTCStatsReport;
    const AR = {} as RTCStatsReport;
    const VR1 = {} as RTCStatsReport;

    const audioSender = createSender('audio', AS);
    const videoSender1 = createSender('video', VS1);

    const audioReceiver = createReceiver(
      { kind: 'audio', id: 'audio-track-id' },
      { ssrc: 'a-ssrc' },
      AR,
    );
    const videoReceiver1 = createReceiver(
      { kind: 'video', id: 'video1-track-id' },
      { ssrc: 'v1-ssrc' },
      VR1,
    );

    const peerConnection = {
      getSenders: () => {
        return [audioSender, videoSender1];
      },
      getReceivers: () => {
        return [audioReceiver, videoReceiver1];
      },
    } as unknown as RTCPeerConnection;

    const result = await requestAllStatistics(peerConnection);

    expect(result.audioSenderStats).toBe(AS);
    expect(result.videoSenderFirstStats).toBe(VS1);
    expect(result.videoSenderSecondStats).toBeUndefined();
    expect(result.audioReceiverStats).toBe(AR);
    expect(result.videoReceiverFirstStats).toBe(VR1);
    expect(result.videoReceiverSecondStats).toBeUndefined();

    expect(result.synchronizationSources.video).toEqual({
      trackIdentifier: 'video1-track-id',
      item: { ssrc: 'v1-ssrc' },
    });
  });

  it('#3 handles absence of receivers and senders gracefully', async () => {
    const peerConnection = {
      getSenders: () => {
        return [];
      },
      getReceivers: () => {
        return [];
      },
    } as unknown as RTCPeerConnection;

    const result = await requestAllStatistics(peerConnection);

    expect(result.audioSenderStats).toBeUndefined();
    expect(result.videoSenderFirstStats).toBeUndefined();
    expect(result.videoSenderSecondStats).toBeUndefined();
    expect(result.audioReceiverStats).toBeUndefined();
    expect(result.videoReceiverFirstStats).toBeUndefined();
    expect(result.videoReceiverSecondStats).toBeUndefined();

    expect(result.synchronizationSources.audio).toEqual({
      trackIdentifier: undefined,
      item: undefined,
    });

    expect(result.synchronizationSources.video).toEqual({
      trackIdentifier: undefined,
      item: undefined,
    });
  });

  it('#4 handles sender without track (covers optional chaining branch in find)', async () => {
    const senderWithoutTrack = {
      getStats: async () => {
        return undefined as unknown as RTCStatsReport;
      },
    } as unknown as RTCRtpSender;

    const peerConnection = {
      getSenders: () => {
        return [senderWithoutTrack];
      },
      getReceivers: () => {
        return [] as RTCRtpReceiver[];
      },
    } as unknown as RTCPeerConnection;

    const result = await requestAllStatistics(peerConnection);

    expect(result.audioSenderStats).toBeUndefined();
    expect(result.videoSenderFirstStats).toBeUndefined();
    expect(result.videoSenderSecondStats).toBeUndefined();
  });

  it('#5 filters out sender without track when selecting video senders (covers optional chaining in filter)', async () => {
    const VS1 = {} as RTCStatsReport;

    const senderWithoutTrack = {
      getStats: async () => {
        return undefined as unknown as RTCStatsReport;
      },
    } as unknown as RTCRtpSender;

    const videoSender1 = {
      track: { kind: 'video' },
      getStats: async () => {
        return VS1;
      },
    } as unknown as RTCRtpSender;

    const peerConnection = {
      getSenders: () => {
        return [senderWithoutTrack, videoSender1];
      },
      getReceivers: () => {
        return [] as RTCRtpReceiver[];
      },
    } as unknown as RTCPeerConnection;

    const result = await requestAllStatistics(peerConnection);

    expect(result.videoSenderFirstStats).toBe(VS1);
    expect(result.videoSenderSecondStats).toBeUndefined();
  });
});
