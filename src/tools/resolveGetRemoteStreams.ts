import type SipConnector from '../SipConnector';
import log from '../logger';

const resolveGetRemoteStreams = (sipConnector: SipConnector) => {
  const getRemoteStreams = (): MediaStream[] | undefined => {
    log('getRemoteStreams');

    return sipConnector.getRemoteStreams();
  };

  return getRemoteStreams;
};

export default resolveGetRemoteStreams;
