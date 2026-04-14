import resolveDebug from '@/logger';

import type { SipConnector } from '@/SipConnector';

const debug = resolveDebug('resolveOnStopMainCam');

const resolveOnStopMainCam = (sipConnector: SipConnector) => {
  const onStopMainCam = (
    handler: ({ isSyncForced }: { isSyncForced: boolean }) => void,
  ): (() => void) => {
    debug('onStopMainCam');

    return sipConnector.on('api:admin:stop-main-cam', handler);
  };

  return onStopMainCam;
};

export default resolveOnStopMainCam;
