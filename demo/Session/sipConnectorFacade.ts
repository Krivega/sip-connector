import JsSIP from '@krivega/jssip';

import { SipConnector, SipConnectorFacade } from '../../src/index';

const sipConnector = new SipConnector({
  JsSIP,
});
const sipConnectorFacade = new SipConnectorFacade(sipConnector);

export default sipConnectorFacade;
