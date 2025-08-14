import { EStatsTypes } from './constants';
import { statsReportToObject } from './utils';

import type {
  TAdditional,
  TAudioStatistics,
  TInbound,
  TInboundAudio,
  TInboundVideo,
  TMedia,
  TOutbound,
  TOutboundAudio,
  TOutboundVideo,
  TParsedStatistics,
  TSynchronizationSources,
  TVideoStatistics,
} from './typings';

const getOutboundAudioStatisticsReport = (audioSenderStats?: RTCStatsReport): TOutboundAudio => {
  if (!audioSenderStats) {
    return {
      outboundRtp: undefined,
      codec: undefined,
      mediaSource: undefined,
      remoteInboundRtp: undefined,
    };
  }

  const audioStatistics: TAudioStatistics = statsReportToObject(audioSenderStats);

  return {
    outboundRtp: audioStatistics[EStatsTypes.OUTBOUND_RTP],
    codec: audioStatistics[EStatsTypes.CODEC],
    mediaSource: audioStatistics[EStatsTypes.MEDIA_SOURCE],
    remoteInboundRtp: audioStatistics[EStatsTypes.REMOTE_INBOUND_RTP],
  };
};

const getOutboundVideoStatisticsReport = (videoSenderStats?: RTCStatsReport): TOutboundVideo => {
  if (!videoSenderStats) {
    return {
      outboundRtp: undefined,
      codec: undefined,
      mediaSource: undefined,
      remoteInboundRtp: undefined,
    };
  }

  const videoStatistics: TVideoStatistics = statsReportToObject(videoSenderStats);

  return {
    outboundRtp: videoStatistics[EStatsTypes.OUTBOUND_RTP],
    codec: videoStatistics[EStatsTypes.CODEC],
    mediaSource: videoStatistics[EStatsTypes.MEDIA_SOURCE],
    remoteInboundRtp: videoStatistics[EStatsTypes.REMOTE_INBOUND_RTP],
  };
};

const getInboundVideoStatisticsReport = ({
  videoReceiversStats,
  synchronizationSourcesVideo,
}: {
  videoReceiversStats?: RTCStatsReport;
  synchronizationSourcesVideo: TMedia;
}): TInboundVideo => {
  if (!videoReceiversStats) {
    return {
      inboundRtp: undefined,
      codec: undefined,
      synchronizationSources: synchronizationSourcesVideo,
    };
  }

  const videoStatistics: TVideoStatistics = statsReportToObject(videoReceiversStats);

  return {
    inboundRtp: videoStatistics[EStatsTypes.INBOUND_RTP],
    codec: videoStatistics[EStatsTypes.CODEC],
    synchronizationSources: synchronizationSourcesVideo,
  };
};

const getInboundAudioStatisticsReport = ({
  audioReceiverStats,
  synchronizationSourcesAudio,
}: {
  audioReceiverStats?: RTCStatsReport;
  synchronizationSourcesAudio: TMedia;
}): TInboundAudio => {
  if (!audioReceiverStats) {
    return {
      inboundRtp: undefined,
      codec: undefined,
      remoteOutboundRtp: undefined,
      synchronizationSources: synchronizationSourcesAudio,
    };
  }

  const audioStatistics: TAudioStatistics = statsReportToObject(audioReceiverStats);

  return {
    inboundRtp: audioStatistics[EStatsTypes.INBOUND_RTP],
    codec: audioStatistics[EStatsTypes.CODEC],
    remoteOutboundRtp: audioStatistics[EStatsTypes.REMOTE_OUTBOUND_RTP],
    synchronizationSources: synchronizationSourcesAudio,
  };
};

const getAdditionalStatisticsReport = (statsReport?: RTCStatsReport): TAdditional => {
  if (!statsReport) {
    return {
      candidatePair: undefined,
      certificate: undefined,
      localCandidate: undefined,
      remoteCandidate: undefined,
      transport: undefined,
    };
  }

  const parsedStatistics: TParsedStatistics = statsReportToObject(statsReport);

  return {
    candidatePair: parsedStatistics[EStatsTypes.CANDIDATE_PAIR],
    certificate: parsedStatistics[EStatsTypes.CERTIFICATE],
    localCandidate: parsedStatistics[EStatsTypes.LOCAL_CANDIDATE],
    remoteCandidate: parsedStatistics[EStatsTypes.REMOTE_CANDIDATE],
    transport: parsedStatistics[EStatsTypes.TRANSPORT],
  };
};

const getOutboundStatisticsReport = ({
  audioSenderStats,
  videoSenderFirstStats,
  videoSenderSecondStats,
}: {
  audioSenderStats?: RTCStatsReport;
  videoSenderFirstStats?: RTCStatsReport;
  videoSenderSecondStats?: RTCStatsReport;
}): TOutbound => {
  return {
    video: getOutboundVideoStatisticsReport(videoSenderFirstStats),
    secondVideo: getOutboundVideoStatisticsReport(videoSenderSecondStats),
    audio: getOutboundAudioStatisticsReport(audioSenderStats),
    additional: getAdditionalStatisticsReport(
      audioSenderStats ?? videoSenderFirstStats ?? videoSenderSecondStats,
    ),
  };
};

const getInboundStatisticsReport = ({
  audioReceiverStats,
  videoReceiverFirstStats,
  videoReceiverSecondStats,
  synchronizationSources,
}: {
  audioReceiverStats?: RTCStatsReport;
  videoReceiverFirstStats?: RTCStatsReport;
  videoReceiverSecondStats?: RTCStatsReport;
  synchronizationSources: TSynchronizationSources;
}): TInbound => {
  return {
    video: getInboundVideoStatisticsReport({
      videoReceiversStats: videoReceiverFirstStats,
      synchronizationSourcesVideo: synchronizationSources.video,
    }),
    secondVideo: getInboundVideoStatisticsReport({
      videoReceiversStats: videoReceiverSecondStats,
      synchronizationSourcesVideo: synchronizationSources.video,
    }),
    audio: getInboundAudioStatisticsReport({
      audioReceiverStats,
      synchronizationSourcesAudio: synchronizationSources.audio,
    }),
    additional: getAdditionalStatisticsReport(
      audioReceiverStats ?? videoReceiverFirstStats ?? videoReceiverSecondStats,
    ),
  };
};

const parseStatsReports = ({
  audioSenderStats,
  videoSenderFirstStats,
  videoSenderSecondStats,
  audioReceiverStats,
  videoReceiverFirstStats,
  videoReceiverSecondStats,
  synchronizationSources,
}: {
  audioSenderStats?: RTCStatsReport;
  videoSenderFirstStats?: RTCStatsReport;
  videoSenderSecondStats?: RTCStatsReport;
  audioReceiverStats?: RTCStatsReport;
  videoReceiverFirstStats?: RTCStatsReport;
  videoReceiverSecondStats?: RTCStatsReport;
  synchronizationSources: TSynchronizationSources;
}): {
  inbound: TInbound;
  outbound: TOutbound;
} => {
  const outbound = getOutboundStatisticsReport({
    audioSenderStats,
    videoSenderFirstStats,
    videoSenderSecondStats,
  });

  const inbound = getInboundStatisticsReport({
    audioReceiverStats,
    videoReceiverFirstStats,
    videoReceiverSecondStats,
    synchronizationSources,
  });

  return {
    outbound,
    inbound,
  };
};

export default parseStatsReports;
