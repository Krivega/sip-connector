import { applySenderParams } from './applySenderParams';

import type { TSenderOptions } from './types';

export const replaceTrack = async (
  sender: RTCRtpSender,
  videoTrack: MediaStreamVideoTrack,
  { sendEncodings, degradationPreference }: TSenderOptions,
): Promise<void> => {
  await sender.replaceTrack(videoTrack);
  await applySenderParams(sender, {
    sendEncodings,
    degradationPreference,
  });
};
