const hasVideoTrackReady = ({ kind, readyState }: MediaStreamTrack) => {
  return kind === 'video' && readyState === 'live';
};

const resolveHandleChangeTracks = (updateRemoteStreams: () => void) => {
  return ({ track }: { track: MediaStreamTrack }) => {
    if (hasVideoTrackReady(track)) {
      updateRemoteStreams();
    }
  };
};

export default resolveHandleChangeTracks;
