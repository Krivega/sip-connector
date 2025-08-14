import type { TSynchronizationSources } from './types';

const requestAllStatistics = async (peerConnection: RTCPeerConnection) => {
  const AUDIO = 'audio';
  const VIDEO = 'video';

  const senders = peerConnection.getSenders();
  const audioSender = senders.find((sender) => {
    return sender.track?.kind === AUDIO;
  });
  const videoSenders = senders.filter((sender) => {
    return sender.track?.kind === VIDEO;
  });

  const receivers = peerConnection.getReceivers();
  const audioReceiver = receivers.find((receiver) => {
    return receiver.track.kind === AUDIO;
  });

  const videoReceivers = receivers.filter((receiver) => {
    return receiver.track.kind === VIDEO;
  });

  const synchronizationSourceAudio = {
    trackIdentifier: audioReceiver?.track.id,
    item: audioReceiver?.getSynchronizationSources()[0],
  };

  const synchronizationSourceFirstVideo = {
    trackIdentifier: videoReceivers[0]?.track.id,
    item: videoReceivers[0]?.getSynchronizationSources()[0],
  };

  const synchronizationSources: TSynchronizationSources = {
    audio: synchronizationSourceAudio,
    video: synchronizationSourceFirstVideo,
  };

  return Promise.all<RTCStatsReport | undefined>([
    audioSender?.getStats(),
    videoSenders[0]?.getStats(),
    videoSenders[1]?.getStats(),
    audioReceiver?.getStats(),
    videoReceivers[0]?.getStats(),
    videoReceivers[1]?.getStats(),
  ]).then((reports) => {
    const [
      audioSenderStats,
      videoSenderFirstStats,
      videoSenderSecondStats,
      audioReceiverStats,
      videoReceiverFirstStats,
      videoReceiverSecondStats,
    ] = reports;

    return {
      synchronizationSources,
      audioSenderStats,
      videoSenderFirstStats,
      videoSenderSecondStats,
      audioReceiverStats,
      videoReceiverFirstStats,
      videoReceiverSecondStats,
    };
  });
};

export default requestAllStatistics;
