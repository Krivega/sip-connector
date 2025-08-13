import log from '@/logger';

import type { SipConnector } from '@/SipConnector';

const resolveOnStartMic = (sipConnector: SipConnector) => {
  const onStartMic = (
    handler: ({ isSyncForced }: { isSyncForced: boolean }) => void,
  ): (() => void) => {
    log('onStartMic');

    return sipConnector.on('api:admin-start-mic', handler);
  };

  return onStartMic;
};

export default resolveOnStartMic;
