import JsSIP from './jssip.mock';
import type { TJsSIP } from '../SipConnector';
import SIPconnector from '../SipConnector';

const doMock = () => {
  return new SIPconnector({
    JsSIP: JsSIP as unknown as TJsSIP,
  });
};

export default doMock;
