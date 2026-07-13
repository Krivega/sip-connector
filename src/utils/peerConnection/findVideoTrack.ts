const findVideoTrack = (stream: MediaStream): MediaStreamVideoTrack | undefined => {
  return stream.getVideoTracks()[0];
};

export default findVideoTrack;
