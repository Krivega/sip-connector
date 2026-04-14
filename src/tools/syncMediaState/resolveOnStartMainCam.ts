import resolveDebug from '@/logger';

import type { SipConnector } from '@/SipConnector';

const debug = resolveDebug('resolveOnStartMainCam');

const resolveOnStartMainCam = (sipConnector: SipConnector) => {
  const onStartMainCam = (
    handler: ({ isSyncForced }: { isSyncForced: boolean }) => void,
  ): (() => void) => {
    debug('onStartMainCam');

    return sipConnector.on('api:admin:start-main-cam', handler);
  };

  return onStartMainCam;
};

export default resolveOnStartMainCam;
