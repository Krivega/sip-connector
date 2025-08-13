import log from '@/logger';

import type { SipConnector } from '@/SipConnector';

const resolveOnStopMic = (sipConnector: SipConnector) => {
  const onStopMic = (
    handler: ({ isSyncForced }: { isSyncForced: boolean }) => void,
  ): (() => void) => {
    log('onStopMic');

    return sipConnector.on('api:admin-stop-mic', handler);
  };

  return onStopMic;
};

export default resolveOnStopMic;
