import JsSIP from '@krivega/jssip';

import { SipConnector, SipConnectorFacade } from '../../src';

const sipConnector = new SipConnector({
  JsSIP,
});
const sipConnectorFacade = new SipConnectorFacade(sipConnector);

export default sipConnectorFacade;
