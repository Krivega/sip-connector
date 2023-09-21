import type SipConnector from '../../SipConnector';
import log from '../../logger';

const resolveOnStopMic = (sipConnector: SipConnector) => {
  const onStopMic = (
    handler: ({ isSyncForced }: { isSyncForced: boolean }) => void,
  ): (() => void) => {
    log('onStopMic');

    return sipConnector.onSession('admin-stop-mic', handler);
  };

  return onStopMic;
};

export default resolveOnStopMic;
