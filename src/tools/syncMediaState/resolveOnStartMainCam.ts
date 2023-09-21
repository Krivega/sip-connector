import type SipConnector from '../../SipConnector';
import log from '../../logger';

const resolveOnStartMainCam = (sipConnector: SipConnector) => {
  const onStartMainCam = (
    handler: ({ isSyncForced }: { isSyncForced: boolean }) => void,
  ): (() => void) => {
    log('onStartMainCam');

    return sipConnector.onSession('admin-start-main-cam', handler);
  };

  return onStartMainCam;
};

export default resolveOnStartMainCam;
