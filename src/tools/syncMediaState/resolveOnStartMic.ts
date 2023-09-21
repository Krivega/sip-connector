import type SipConnector from '../../SipConnector';
import log from '../../logger';

const resolveOnStartMic = (sipConnector: SipConnector) => {
  const onStartMic = (
    handler: ({ isSyncForced }: { isSyncForced: boolean }) => void,
  ): (() => void) => {
    log('onStartMic');

    return sipConnector.onSession('admin-start-mic', handler);
  };

  return onStartMic;
};

export default resolveOnStartMic;
