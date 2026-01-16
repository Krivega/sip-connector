import log from '@/logger';

import type { SipConnector } from '@/SipConnector';

const resolveOnStopMainCam = (sipConnector: SipConnector) => {
  const onStopMainCam = (
    handler: ({ isSyncForced }: { isSyncForced: boolean }) => void,
  ): (() => void) => {
    log('onStopMainCam');

    return sipConnector.on('api:admin:stop-main-cam', handler);
  };

  return onStopMainCam;
};

export default resolveOnStopMainCam;
