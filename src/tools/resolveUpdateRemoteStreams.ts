import debounce from 'lodash/debounce';
import log from '../logger';

const resolveUpdateRemoteStreams = ({
  getRemoteStreams,
  setRemoteStreams,
}: {
  getRemoteStreams: () => MediaStream[] | undefined;
  setRemoteStreams: (streams: MediaStream[]) => void;
}) => {
  return debounce(() => {
    const remoteStreams = getRemoteStreams();

    log('remoteStreams', remoteStreams);

    if (remoteStreams) {
      setRemoteStreams(remoteStreams);
    }
  }, 200);
};

export default resolveUpdateRemoteStreams;
