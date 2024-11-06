import type SipConnector from '../SipConnector';
import log from '../logger';
import { PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS } from '../constants';

const resolveOnMoveToSpectators = (sipConnector: SipConnector) => {
  const onMoveToSpectators = (handler: () => void): (() => void) => {
    log('onMoveToSpectators');

    return sipConnector.onSession(PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS, handler);
  };

  return onMoveToSpectators;
};

export default resolveOnMoveToSpectators;
