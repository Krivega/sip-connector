import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveOnMoveToSpectators = (sipConnector: SipConnector) => {
  const onMoveToSpectators = (handler: () => void): (() => void) => {
    log('onMoveToSpectators');

    return sipConnector.onSession('participant:move-request-to-spectators', handler);
  };

  return onMoveToSpectators;
};

export default resolveOnMoveToSpectators;
