import type { SipConnector } from '@/SipConnector';
import log from '@/logger';

const resolveOnStartMic = (sipConnector: SipConnector) => {
  const onStartMic = (
    handler: ({ isSyncForced }: { isSyncForced: boolean }) => void,
  ): (() => void) => {
    log('onStartMic');

    return sipConnector.on('api:admin-start-mic', handler);
  };

  return onStartMic;
};

export default resolveOnStartMic;
