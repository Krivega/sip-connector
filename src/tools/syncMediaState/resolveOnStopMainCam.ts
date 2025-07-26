import type SipConnector from '../../SipConnector';
import log from '../../logger';

const resolveOnStopMainCam = (sipConnector: SipConnector) => {
  const onStopMainCam = (
    handler: ({ isSyncForced }: { isSyncForced: boolean }) => void,
  ): (() => void) => {
    log('onStopMainCam');

    return sipConnector.onApi('admin-stop-main-cam', handler);
  };

  return onStopMainCam;
};

export default resolveOnStopMainCam;
