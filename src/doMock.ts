import SIPconnector from './SipConnector';
import JsSIP from './__fixtures__/jssip.mock';
import type { TJsSIP } from './types';

const doMock = () => {
  return new SIPconnector({
    JsSIP: JsSIP as unknown as TJsSIP,
  });
};

export default doMock;
