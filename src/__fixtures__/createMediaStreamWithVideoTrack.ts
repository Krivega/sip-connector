export const createMediaStreamWithVideoTrack = (settings: MediaTrackSettings): MediaStream => {
  const videoTrack = {
    getSettings: () => {
      return settings;
    },
  } as MediaStreamVideoTrack;

  return {
    getVideoTracks: () => {
      return [videoTrack];
    },
  } as unknown as MediaStream;
};

export const createMediaStreamWithoutVideoTrack = (): MediaStream => {
  return {
    getVideoTracks: () => {
      return [];
    },
  } as unknown as MediaStream;
};
