import type SipConnector from '../SipConnector';
import log from '../logger';
import { PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS } from '../constants';

const resolveOnMoveToParticipants = (sipConnector: SipConnector) => {
  const onMoveToParticipants = (handler: () => void): (() => void) => {
    log('onMoveToParticipants');

    return sipConnector.onSession(PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS, handler);
  };

  return onMoveToParticipants;
};

export default resolveOnMoveToParticipants;
