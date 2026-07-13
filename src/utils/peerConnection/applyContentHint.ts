import type { TContentHint } from './types';

export const applyContentHint = (
  videoTrack: MediaStreamVideoTrack,
  contentHint: TContentHint,
): void => {
  if (contentHint === 'none') {
    return;
  }

  if ('contentHint' in videoTrack && videoTrack.contentHint !== contentHint) {
    // eslint-disable-next-line no-param-reassign
    videoTrack.contentHint = contentHint;
  }
};
