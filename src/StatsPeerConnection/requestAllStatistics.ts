import type { TSynchronizationSources } from './types';

const requestAllStatistics = async (
  peerConnection: RTCPeerConnection,
  remoteStreams?: { mainStream?: MediaStream; contentedStream?: MediaStream },
) => {
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
  const findVideoReceiver = (stream?: MediaStream, excluded?: RTCRtpReceiver) => {
    return videoReceivers.find((receiver) => {
      return (
        receiver !== excluded &&
        (stream?.getVideoTracks().some((track) => {
          return track.id === receiver.track.id;
        }) ??
          false)
      );
    });
  };
  const firstVideoReceiver = remoteStreams
    ? findVideoReceiver(remoteStreams.mainStream)
    : videoReceivers[0];
  const secondVideoReceiver = remoteStreams
    ? findVideoReceiver(remoteStreams.contentedStream, firstVideoReceiver)
    : videoReceivers[1];

  const synchronizationSourceAudio = {
    trackIdentifier: audioReceiver?.track.id,
    item: audioReceiver?.getSynchronizationSources()[0],
  };

  const synchronizationSourceFirstVideo = {
    trackIdentifier: firstVideoReceiver?.track.id,
    item: firstVideoReceiver?.getSynchronizationSources()[0],
  };

  const synchronizationSourceSecondVideo = {
    trackIdentifier: secondVideoReceiver?.track.id,
    item: secondVideoReceiver?.getSynchronizationSources()[0],
  };

  const synchronizationSources: TSynchronizationSources = {
    audio: synchronizationSourceAudio,
    video: synchronizationSourceFirstVideo,
    secondVideo: synchronizationSourceSecondVideo,
  };

  return Promise.all<RTCStatsReport | undefined>([
    audioSender?.getStats() ?? Promise.resolve(undefined),
    videoSenders[0]?.getStats() ?? Promise.resolve(undefined),
    videoSenders[1]?.getStats() ?? Promise.resolve(undefined),
    audioReceiver?.getStats() ?? Promise.resolve(undefined),
    firstVideoReceiver?.getStats() ?? Promise.resolve(undefined),
    secondVideoReceiver?.getStats() ?? Promise.resolve(undefined),
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
