import type SipConnector from '../SipConnector';
import log from '../logger';
import type { EUseLicense } from '../types';

const resolveOnUseLicense = (sipConnector: SipConnector) => {
  const onUseLicense = (handler: (license: EUseLicense) => void): (() => void) => {
    log('onUseLicense');

    return sipConnector.onSession('useLicense', handler);
  };

  return onUseLicense;
};

export default resolveOnUseLicense;
