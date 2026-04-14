import JsSIP, { debug as JsSIPDebug } from '@krivega/jssip';

import { SipConnector, SipConnectorFacade, enableDebug } from '@/index';
import resolveDebug, { enableDebug as enableDebugDemo } from '../logger';

enableDebug();
enableDebugDemo();
JsSIPDebug.enable('*');

const debug = resolveDebug('sipConnector event');

const sipConnector = new SipConnector({
  JsSIP,
});

sipConnector.events.eachTriggers((_trigger, eventName) => {
  sipConnector.on(eventName, (...args) => {
    debug(eventName, args);
  });
});

const sipConnectorFacade = new SipConnectorFacade(sipConnector);

export default sipConnectorFacade;
