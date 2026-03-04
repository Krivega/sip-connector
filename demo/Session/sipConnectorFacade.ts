import JsSIP from '@krivega/jssip';

import { SipConnector, SipConnectorFacade, enableDebug } from '@/index';
import logger, { enableDebug as enableDebugDemo } from '../logger';

enableDebug();
enableDebugDemo();

const debug = logger.extend('sipConnector event');

const sipConnector = new SipConnector(
  {
    JsSIP,
  },
  {
    videoBalancerOptions: { ignoreForCodec: 'h264' },
  },
);

sipConnector.events.eachTriggers((_trigger, eventName) => {
  sipConnector.on(eventName, (...args) => {
    debug(eventName, args);
  });
});

const sipConnectorFacade = new SipConnectorFacade(sipConnector);

export default sipConnectorFacade;
