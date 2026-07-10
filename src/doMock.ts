import JsSIP from './__fixtures__/jssip.mock';
import PresentationUAMock from './__fixtures__/PresentationUAMock';
import { SipConnector } from './SipConnector';

import type { TJsSIP } from './types';

export { FAILED_CONFERENCE_NUMBER } from './__fixtures__/RTCSessionMock';
export { NAME_INCORRECT, PASSWORD_CORRECT, PASSWORD_CORRECT_2 } from './__fixtures__/UA.mock';
export * from './__fixtures__/index';

export const doMockSipConnector = () => {
  return new SipConnector({
    JsSIP: JsSIP as unknown as TJsSIP,
  });
};

export const doMockSipConnectorWithPresentationSession = () => {
  return new SipConnector({
    JsSIP: {
      ...JsSIP,
      UA: PresentationUAMock,
    } as unknown as TJsSIP,
  });
};

export { default as JsSIP } from './__fixtures__/jssip.mock';
