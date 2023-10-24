import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveStopShareSipConnector = ({ sipConnector }: { sipConnector: SipConnector }) => {
  const stopShareSipConnector = async ({ isP2P = false }: { isP2P?: boolean } = {}) => {
    log('stopShareSipConnector');

    return sipConnector
      .stopPresentation({
        isP2P,
      })
      .catch(log);
  };

  return stopShareSipConnector;
};

export default resolveStopShareSipConnector;
