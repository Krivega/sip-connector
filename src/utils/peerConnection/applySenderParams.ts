import { setParametersToSender } from '@/tools/setParametersToSender';

import type { TSenderOptions } from './types';

export const applySenderParams = async (
  sender: RTCRtpSender,
  { sendEncodings, degradationPreference }: TSenderOptions,
): Promise<void> => {
  if (sendEncodings === undefined && degradationPreference === undefined) {
    return;
  }

  await setParametersToSender(sender, {
    encodings: sendEncodings,
    degradationPreference,
  });
};
