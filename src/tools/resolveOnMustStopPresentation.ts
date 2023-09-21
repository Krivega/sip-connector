import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveOnMustStopPresentation = (sipConnector: SipConnector) => {
  const onMustStopPresentation = (handler: () => void): (() => void) => {
    log('onMustStopPresentation');

    return sipConnector.onSession('mustStopPresentation', handler);
  };

  return onMustStopPresentation;
};

export default resolveOnMustStopPresentation;
