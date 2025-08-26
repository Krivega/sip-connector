import {
  audioReceiverStats,
  audioSenderStats,
  synchronizationSources,
  videoReceiverFirstStats,
  videoReceiverSecondStats,
  videoSenderFirstStats,
  videoSenderSecondStats,
} from '../__fixtures__/callStaticsState';
import { EStatsTypes } from '../constants';
import parseStatsReports from '../parseStatsReports';

const addObjectToMap = (object: Record<string, unknown>) => {
  return new Map(Object.entries(object));
};

describe('parseStatsReports', () => {
  it('#1 with synchronizationSources only', () => {
    const { inbound, outbound } = parseStatsReports({
      synchronizationSources,
    });

    expect(inbound.audio.synchronizationSources).toEqual(synchronizationSources.audio);
    expect(inbound.video.synchronizationSources).toEqual(synchronizationSources.video);
    expect(inbound.secondVideo.synchronizationSources).toEqual(synchronizationSources.video);

    expect(inbound.audio.codec).toBe(undefined);
    expect(inbound.audio.inboundRtp).toBe(undefined);
    expect(inbound.audio.remoteOutboundRtp).toBe(undefined);

    expect(inbound.video.codec).toBe(undefined);
    expect(inbound.video.inboundRtp).toBe(undefined);

    expect(inbound.secondVideo.codec).toBe(undefined);
    expect(inbound.secondVideo.inboundRtp).toBe(undefined);

    expect(inbound.additional.candidatePair).toBe(undefined);
    expect(inbound.additional.certificate).toBe(undefined);
    expect(inbound.additional.localCandidate).toBe(undefined);
    expect(inbound.additional.remoteCandidate).toBe(undefined);
    expect(inbound.additional.transport).toBe(undefined);

    expect(outbound.audio.outboundRtp).toBe(undefined);
    expect(outbound.audio.codec).toBe(undefined);
    expect(outbound.audio.mediaSource).toBe(undefined);
    expect(outbound.audio.remoteInboundRtp).toBe(undefined);

    expect(outbound.additional.candidatePair).toBe(undefined);
    expect(outbound.additional.certificate).toBe(undefined);
    expect(outbound.additional.localCandidate).toBe(undefined);
    expect(outbound.additional.remoteCandidate).toBe(undefined);
    expect(outbound.additional.transport).toBe(undefined);

    expect(outbound.video.outboundRtp).toBe(undefined);
    expect(outbound.video.codec).toBe(undefined);
    expect(outbound.video.mediaSource).toBe(undefined);
    expect(outbound.video.remoteInboundRtp).toBe(undefined);

    expect(outbound.secondVideo.outboundRtp).toBe(undefined);
    expect(outbound.secondVideo.codec).toBe(undefined);
    expect(outbound.secondVideo.mediaSource).toBe(undefined);
    expect(outbound.secondVideo.remoteInboundRtp).toBe(undefined);
  });

  it('#2 with audioSenderStats', () => {
    const { inbound, outbound } = parseStatsReports({
      synchronizationSources,
      audioSenderStats: addObjectToMap(audioSenderStats),
    });

    expect(outbound.audio.outboundRtp).toBe(audioSenderStats[EStatsTypes.OUTBOUND_RTP]);
    expect(outbound.audio.codec).toBe(audioSenderStats.codec);
    expect(outbound.audio.mediaSource).toBe(audioSenderStats[EStatsTypes.MEDIA_SOURCE]);
    expect(outbound.audio.remoteInboundRtp).toBe(audioSenderStats[EStatsTypes.REMOTE_INBOUND_RTP]);

    expect(outbound.additional.certificate).toBe(audioSenderStats.certificate);
    expect(outbound.additional.transport).toBe(audioSenderStats.transport);
    expect(outbound.additional.candidatePair).toBe(audioSenderStats[EStatsTypes.CANDIDATE_PAIR]);
    expect(outbound.additional.localCandidate).toBe(audioSenderStats[EStatsTypes.LOCAL_CANDIDATE]);
    expect(outbound.additional.remoteCandidate).toBe(
      audioSenderStats[EStatsTypes.REMOTE_CANDIDATE],
    );

    expect(inbound.audio.codec).toBe(undefined);
    expect(inbound.audio.inboundRtp).toBe(undefined);
    expect(inbound.audio.remoteOutboundRtp).toBe(undefined);

    expect(inbound.video.codec).toBe(undefined);
    expect(inbound.video.inboundRtp).toBe(undefined);

    expect(inbound.secondVideo.codec).toBe(undefined);
    expect(inbound.secondVideo.inboundRtp).toBe(undefined);

    expect(outbound.video.outboundRtp).toBe(undefined);
    expect(outbound.video.codec).toBe(undefined);
    expect(outbound.video.mediaSource).toBe(undefined);
    expect(outbound.video.remoteInboundRtp).toBe(undefined);

    expect(outbound.secondVideo.outboundRtp).toBe(undefined);
    expect(outbound.secondVideo.codec).toBe(undefined);
    expect(outbound.secondVideo.mediaSource).toBe(undefined);
    expect(outbound.secondVideo.remoteInboundRtp).toBe(undefined);
  });

  it('#3 with videoSenderFirstStats', () => {
    const { inbound, outbound } = parseStatsReports({
      synchronizationSources,
      videoSenderFirstStats: addObjectToMap(videoSenderFirstStats),
    });

    expect(outbound.video.outboundRtp).toBe(videoSenderFirstStats[EStatsTypes.OUTBOUND_RTP]);
    expect(outbound.video.codec).toBe(videoSenderFirstStats.codec);
    expect(outbound.video.mediaSource).toBe(videoSenderFirstStats[EStatsTypes.MEDIA_SOURCE]);
    expect(outbound.video.remoteInboundRtp).toBe(
      videoSenderFirstStats[EStatsTypes.REMOTE_INBOUND_RTP],
    );

    expect(outbound.additional.certificate).toBe(videoSenderFirstStats.certificate);
    expect(outbound.additional.transport).toBe(videoSenderFirstStats.transport);
    expect(outbound.additional.candidatePair).toBe(
      videoSenderFirstStats[EStatsTypes.CANDIDATE_PAIR],
    );
    expect(outbound.additional.localCandidate).toBe(
      videoSenderFirstStats[EStatsTypes.LOCAL_CANDIDATE],
    );
    expect(outbound.additional.remoteCandidate).toBe(
      videoSenderFirstStats[EStatsTypes.REMOTE_CANDIDATE],
    );

    expect(inbound.audio.codec).toBe(undefined);
    expect(inbound.audio.inboundRtp).toBe(undefined);
    expect(inbound.audio.remoteOutboundRtp).toBe(undefined);

    expect(inbound.video.codec).toBe(undefined);
    expect(inbound.video.inboundRtp).toBe(undefined);

    expect(inbound.secondVideo.codec).toBe(undefined);
    expect(inbound.secondVideo.inboundRtp).toBe(undefined);

    expect(outbound.audio.outboundRtp).toBe(undefined);
    expect(outbound.audio.codec).toBe(undefined);
    expect(outbound.audio.mediaSource).toBe(undefined);
    expect(outbound.audio.remoteInboundRtp).toBe(undefined);

    expect(outbound.secondVideo.outboundRtp).toBe(undefined);
    expect(outbound.secondVideo.codec).toBe(undefined);
    expect(outbound.secondVideo.mediaSource).toBe(undefined);
    expect(outbound.secondVideo.remoteInboundRtp).toBe(undefined);
  });

  it('#4 with videoSenderSecondStats', () => {
    const { inbound, outbound } = parseStatsReports({
      synchronizationSources,
      videoSenderSecondStats: addObjectToMap(videoSenderSecondStats),
    });

    expect(outbound.secondVideo.outboundRtp).toBe(videoSenderSecondStats[EStatsTypes.OUTBOUND_RTP]);
    expect(outbound.secondVideo.codec).toBe(videoSenderSecondStats.codec);
    expect(outbound.secondVideo.mediaSource).toBe(videoSenderSecondStats[EStatsTypes.MEDIA_SOURCE]);
    expect(outbound.secondVideo.remoteInboundRtp).toBe(
      videoSenderSecondStats[EStatsTypes.REMOTE_INBOUND_RTP],
    );

    expect(outbound.additional.certificate).toBe(videoSenderSecondStats.certificate);
    expect(outbound.additional.transport).toBe(videoSenderSecondStats.transport);
    expect(outbound.additional.candidatePair).toBe(
      videoSenderSecondStats[EStatsTypes.CANDIDATE_PAIR],
    );
    expect(outbound.additional.localCandidate).toBe(
      videoSenderSecondStats[EStatsTypes.LOCAL_CANDIDATE],
    );
    expect(outbound.additional.remoteCandidate).toBe(
      videoSenderSecondStats[EStatsTypes.REMOTE_CANDIDATE],
    );

    expect(outbound.audio.outboundRtp).toBe(undefined);
    expect(outbound.audio.codec).toBe(undefined);
    expect(outbound.audio.mediaSource).toBe(undefined);
    expect(outbound.audio.remoteInboundRtp).toBe(undefined);

    expect(outbound.video.outboundRtp).toBe(undefined);
    expect(outbound.video.codec).toBe(undefined);
    expect(outbound.video.mediaSource).toBe(undefined);
    expect(outbound.video.remoteInboundRtp).toBe(undefined);

    expect(inbound.audio.codec).toBe(undefined);
    expect(inbound.audio.inboundRtp).toBe(undefined);
    expect(inbound.audio.remoteOutboundRtp).toBe(undefined);

    expect(inbound.video.codec).toBe(undefined);
    expect(inbound.video.inboundRtp).toBe(undefined);

    expect(inbound.secondVideo.codec).toBe(undefined);
    expect(inbound.secondVideo.inboundRtp).toBe(undefined);
  });

  it('#5 with audioReceiverStats', () => {
    const { inbound, outbound } = parseStatsReports({
      synchronizationSources,
      audioReceiverStats: addObjectToMap(audioReceiverStats),
    });

    expect(inbound.audio.codec).toBe(audioReceiverStats.codec);
    expect(inbound.audio.inboundRtp).toBe(audioReceiverStats[EStatsTypes.INBOUND_RTP]);
    expect(inbound.audio.remoteOutboundRtp).toBe(
      audioReceiverStats[EStatsTypes.REMOTE_OUTBOUND_RTP],
    );

    expect(inbound.additional.certificate).toBe(audioReceiverStats.certificate);
    expect(inbound.additional.transport).toBe(audioReceiverStats.transport);
    expect(inbound.additional.candidatePair).toBe(audioReceiverStats[EStatsTypes.CANDIDATE_PAIR]);
    expect(inbound.additional.localCandidate).toBe(audioReceiverStats[EStatsTypes.LOCAL_CANDIDATE]);
    expect(inbound.additional.remoteCandidate).toBe(
      audioReceiverStats[EStatsTypes.REMOTE_CANDIDATE],
    );

    expect(inbound.video.codec).toBe(undefined);
    expect(inbound.video.inboundRtp).toBe(undefined);

    expect(inbound.secondVideo.codec).toBe(undefined);
    expect(inbound.secondVideo.inboundRtp).toBe(undefined);

    expect(outbound.audio.outboundRtp).toBe(undefined);
    expect(outbound.audio.codec).toBe(undefined);
    expect(outbound.audio.mediaSource).toBe(undefined);
    expect(outbound.audio.remoteInboundRtp).toBe(undefined);

    expect(outbound.secondVideo.outboundRtp).toBe(undefined);
    expect(outbound.secondVideo.codec).toBe(undefined);
    expect(outbound.secondVideo.mediaSource).toBe(undefined);
    expect(outbound.secondVideo.remoteInboundRtp).toBe(undefined);

    expect(outbound.additional.candidatePair).toBe(undefined);
    expect(outbound.additional.certificate).toBe(undefined);
    expect(outbound.additional.localCandidate).toBe(undefined);
    expect(outbound.additional.remoteCandidate).toBe(undefined);
    expect(outbound.additional.transport).toBe(undefined);

    expect(outbound.video.outboundRtp).toBe(undefined);
    expect(outbound.video.codec).toBe(undefined);
    expect(outbound.video.mediaSource).toBe(undefined);
    expect(outbound.video.remoteInboundRtp).toBe(undefined);
  });

  it('#6 with videoReceiverFirstStats', () => {
    const { inbound, outbound } = parseStatsReports({
      synchronizationSources,
      videoReceiverFirstStats: addObjectToMap(videoReceiverFirstStats),
    });

    expect(inbound.video.codec).toBe(videoReceiverFirstStats.codec);
    expect(inbound.video.inboundRtp).toBe(videoReceiverFirstStats[EStatsTypes.INBOUND_RTP]);

    expect(inbound.additional.certificate).toBe(videoReceiverFirstStats.certificate);
    expect(inbound.additional.transport).toBe(videoReceiverFirstStats.transport);
    expect(inbound.additional.candidatePair).toBe(
      videoReceiverFirstStats[EStatsTypes.CANDIDATE_PAIR],
    );
    expect(inbound.additional.localCandidate).toBe(
      videoReceiverFirstStats[EStatsTypes.LOCAL_CANDIDATE],
    );
    expect(inbound.additional.remoteCandidate).toBe(
      videoReceiverFirstStats[EStatsTypes.REMOTE_CANDIDATE],
    );

    expect(inbound.audio.codec).toBe(undefined);
    expect(inbound.audio.inboundRtp).toBe(undefined);
    expect(inbound.audio.remoteOutboundRtp).toBe(undefined);

    expect(inbound.secondVideo.codec).toBe(undefined);
    expect(inbound.secondVideo.inboundRtp).toBe(undefined);

    expect(outbound.audio.outboundRtp).toBe(undefined);
    expect(outbound.audio.codec).toBe(undefined);
    expect(outbound.audio.mediaSource).toBe(undefined);
    expect(outbound.audio.remoteInboundRtp).toBe(undefined);

    expect(outbound.secondVideo.outboundRtp).toBe(undefined);
    expect(outbound.secondVideo.codec).toBe(undefined);
    expect(outbound.secondVideo.mediaSource).toBe(undefined);
    expect(outbound.secondVideo.remoteInboundRtp).toBe(undefined);

    expect(outbound.additional.candidatePair).toBe(undefined);
    expect(outbound.additional.certificate).toBe(undefined);
    expect(outbound.additional.localCandidate).toBe(undefined);
    expect(outbound.additional.remoteCandidate).toBe(undefined);
    expect(outbound.additional.transport).toBe(undefined);

    expect(outbound.video.outboundRtp).toBe(undefined);
    expect(outbound.video.codec).toBe(undefined);
    expect(outbound.video.mediaSource).toBe(undefined);
    expect(outbound.video.remoteInboundRtp).toBe(undefined);
  });

  it('#7 with videoReceiverSecondStats', () => {
    const { inbound, outbound } = parseStatsReports({
      synchronizationSources,
      videoReceiverSecondStats: addObjectToMap(videoReceiverSecondStats),
    });

    expect(inbound.secondVideo.codec).toBe(videoReceiverSecondStats.codec);
    expect(inbound.secondVideo.inboundRtp).toBe(videoReceiverSecondStats[EStatsTypes.INBOUND_RTP]);

    expect(inbound.additional.certificate).toBe(videoReceiverSecondStats.certificate);
    expect(inbound.additional.transport).toBe(videoReceiverSecondStats.transport);
    expect(inbound.additional.candidatePair).toBe(
      videoReceiverSecondStats[EStatsTypes.CANDIDATE_PAIR],
    );
    expect(inbound.additional.localCandidate).toBe(
      videoReceiverSecondStats[EStatsTypes.LOCAL_CANDIDATE],
    );
    expect(inbound.additional.remoteCandidate).toBe(
      videoReceiverSecondStats[EStatsTypes.REMOTE_CANDIDATE],
    );

    expect(inbound.audio.codec).toBe(undefined);
    expect(inbound.audio.inboundRtp).toBe(undefined);
    expect(inbound.audio.remoteOutboundRtp).toBe(undefined);

    expect(inbound.video.codec).toBe(undefined);
    expect(inbound.video.inboundRtp).toBe(undefined);

    expect(outbound.audio.outboundRtp).toBe(undefined);
    expect(outbound.audio.codec).toBe(undefined);
    expect(outbound.audio.mediaSource).toBe(undefined);
    expect(outbound.audio.remoteInboundRtp).toBe(undefined);

    expect(outbound.secondVideo.outboundRtp).toBe(undefined);
    expect(outbound.secondVideo.codec).toBe(undefined);
    expect(outbound.secondVideo.mediaSource).toBe(undefined);
    expect(outbound.secondVideo.remoteInboundRtp).toBe(undefined);

    expect(outbound.additional.candidatePair).toBe(undefined);
    expect(outbound.additional.certificate).toBe(undefined);
    expect(outbound.additional.localCandidate).toBe(undefined);
    expect(outbound.additional.remoteCandidate).toBe(undefined);
    expect(outbound.additional.transport).toBe(undefined);

    expect(outbound.video.outboundRtp).toBe(undefined);
    expect(outbound.video.codec).toBe(undefined);
    expect(outbound.video.mediaSource).toBe(undefined);
    expect(outbound.video.remoteInboundRtp).toBe(undefined);
  });

  it('#8 with all stats', () => {
    const { inbound, outbound } = parseStatsReports({
      synchronizationSources,
      audioSenderStats: addObjectToMap(audioSenderStats),
      videoSenderFirstStats: addObjectToMap(videoSenderFirstStats),
      videoSenderSecondStats: addObjectToMap(videoSenderSecondStats),
      audioReceiverStats: addObjectToMap(audioReceiverStats),
      videoReceiverFirstStats: addObjectToMap(videoReceiverFirstStats),
      videoReceiverSecondStats: addObjectToMap(videoReceiverSecondStats),
    });

    expect(inbound.video.codec).toBe(videoReceiverFirstStats.codec);
    expect(inbound.video.inboundRtp).toBe(videoReceiverFirstStats[EStatsTypes.INBOUND_RTP]);

    expect(inbound.secondVideo.codec).toBe(videoReceiverSecondStats.codec);
    expect(inbound.secondVideo.inboundRtp).toBe(videoReceiverSecondStats[EStatsTypes.INBOUND_RTP]);

    expect(inbound.audio.codec).toBe(audioReceiverStats.codec);
    expect(inbound.audio.inboundRtp).toBe(audioReceiverStats[EStatsTypes.INBOUND_RTP]);
    expect(inbound.audio.remoteOutboundRtp).toBe(
      audioReceiverStats[EStatsTypes.REMOTE_OUTBOUND_RTP],
    );

    expect(inbound.additional.candidatePair).toBe(audioReceiverStats[EStatsTypes.CANDIDATE_PAIR]);
    expect(inbound.additional.certificate).toBe(audioReceiverStats.certificate);
    expect(inbound.additional.localCandidate).toBe(audioReceiverStats[EStatsTypes.LOCAL_CANDIDATE]);
    expect(inbound.additional.remoteCandidate).toBe(
      audioReceiverStats[EStatsTypes.REMOTE_CANDIDATE],
    );
    expect(inbound.additional.transport).toBe(audioReceiverStats.transport);

    expect(outbound.audio.outboundRtp).toBe(audioSenderStats[EStatsTypes.OUTBOUND_RTP]);
    expect(outbound.audio.codec).toBe(audioSenderStats.codec);
    expect(outbound.audio.mediaSource).toBe(audioSenderStats[EStatsTypes.MEDIA_SOURCE]);
    expect(outbound.audio.remoteInboundRtp).toBe(audioSenderStats[EStatsTypes.REMOTE_INBOUND_RTP]);

    expect(outbound.video.outboundRtp).toBe(videoSenderFirstStats[EStatsTypes.OUTBOUND_RTP]);
    expect(outbound.video.codec).toBe(videoSenderFirstStats.codec);
    expect(outbound.video.mediaSource).toBe(videoSenderFirstStats[EStatsTypes.MEDIA_SOURCE]);
    expect(outbound.video.remoteInboundRtp).toBe(
      videoSenderFirstStats[EStatsTypes.REMOTE_INBOUND_RTP],
    );

    expect(outbound.secondVideo.outboundRtp).toBe(videoSenderSecondStats[EStatsTypes.OUTBOUND_RTP]);
    expect(outbound.secondVideo.codec).toBe(videoSenderSecondStats.codec);
    expect(outbound.secondVideo.mediaSource).toBe(videoSenderSecondStats[EStatsTypes.MEDIA_SOURCE]);
    expect(outbound.secondVideo.remoteInboundRtp).toBe(
      videoSenderSecondStats[EStatsTypes.REMOTE_INBOUND_RTP],
    );

    expect(outbound.additional.candidatePair).toBe(audioSenderStats[EStatsTypes.CANDIDATE_PAIR]);
    expect(outbound.additional.certificate).toBe(audioSenderStats.certificate);
    expect(outbound.additional.localCandidate).toBe(audioSenderStats[EStatsTypes.LOCAL_CANDIDATE]);
    expect(outbound.additional.remoteCandidate).toBe(
      audioSenderStats[EStatsTypes.REMOTE_CANDIDATE],
    );
    expect(outbound.additional.transport).toBe(audioSenderStats.transport);
  });
});
