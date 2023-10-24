import SIPconnector from '../SipConnector';
import type { TJsSIP } from '../types';
import JsSIP from './jssip.mock';

const doMock = () => {
  return new SIPconnector({
    JsSIP: JsSIP as unknown as TJsSIP,
  });
};

export default doMock;
