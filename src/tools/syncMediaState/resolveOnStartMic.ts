import resolveDebug from '@/logger';

import type { SipConnector } from '@/SipConnector';

const debug = resolveDebug('resolveOnStartMic');

const resolveOnStartMic = (sipConnector: SipConnector) => {
  const onStartMic = (
    handler: ({ isSyncForced }: { isSyncForced: boolean }) => void,
  ): (() => void) => {
    debug('onStartMic');

    return sipConnector.on('api:admin:start-mic', handler);
  };

  return onStartMic;
};

export default resolveOnStartMic;
