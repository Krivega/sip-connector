import resolveDebug from '@/logger';

import type { SipConnector } from '@/SipConnector';

const debug = resolveDebug('resolveOnStopMic');

const resolveOnStopMic = (sipConnector: SipConnector) => {
  const onStopMic = (
    handler: ({ isSyncForced }: { isSyncForced: boolean }) => void,
  ): (() => void) => {
    debug('onStopMic');

    return sipConnector.on('api:admin:stop-mic', handler);
  };

  return onStopMic;
};

export default resolveOnStopMic;
