import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveAskPermissionToEnableCam = (sipConnector: SipConnector): (() => Promise<void>) => {
  const askPermissionToEnableCam = (): Promise<void> => {
    if (!sipConnector.isCallActive) {
      return Promise.resolve();
    }

    log('askPermissionToEnableCam');

    return sipConnector.askPermissionToEnableCam();
  };

  return askPermissionToEnableCam;
};

export default resolveAskPermissionToEnableCam;
