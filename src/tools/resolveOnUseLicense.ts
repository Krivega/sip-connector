import type SipConnector from '../SipConnector';
import type { EUseLicense } from '../SipConnector';
import log from '../logger';

const resolveOnUseLicense = (sipConnector: SipConnector) => {
  const onUseLicense = (handler: (license: EUseLicense) => void): (() => void) => {
    log('onUseLicense');

    return sipConnector.onSession('useLicense', handler);
  };

  return onUseLicense;
};

export default resolveOnUseLicense;
