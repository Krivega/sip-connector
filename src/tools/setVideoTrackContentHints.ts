/* eslint-disable no-param-reassign */
import type { TContentHint } from '../types';

const setVideoTrackContentHints = (stream: MediaStream, contentHint: TContentHint) => {
  const tracks = stream.getVideoTracks();

  tracks.forEach((track) => {
    if ('contentHint' in track && track.contentHint !== contentHint) {
      track.contentHint = contentHint;
    }
  });
};

export default setVideoTrackContentHints;
