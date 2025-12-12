/// <reference types="jest" />
import { EUseLicense } from '@/ApiManager';
import { doMockSipConnector } from '@/doMock';
import SipConnectorFacade from '../@SipConnectorFacade';

import type { SipConnector } from '@/SipConnector';

describe('media state: resolveOnUseLicense', () => {
  let sipConnector: SipConnector;
  let sipConnectorFacade: SipConnectorFacade;
  let handlerOnUseLicense: jest.Mock<void>;
  let offUseLicense: () => void;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    sipConnectorFacade = new SipConnectorFacade(sipConnector);
    handlerOnUseLicense = jest.fn() as jest.Mock<void>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('#1 should subscribe media event and call handler on event trigger', async () => {
    expect.assertions(4);

    sipConnectorFacade.onUseLicense(handlerOnUseLicense);

    sipConnector.apiManager.events.trigger('useLicense', EUseLicense.AUDIO);

    expect(handlerOnUseLicense).toHaveBeenCalledTimes(1);
    expect(handlerOnUseLicense).toHaveBeenCalledWith(EUseLicense.AUDIO);

    sipConnector.apiManager.events.trigger('useLicense', EUseLicense.AUDIO);

    expect(handlerOnUseLicense).toHaveBeenCalledTimes(2);
    expect(handlerOnUseLicense).toHaveBeenCalledWith(EUseLicense.AUDIO);
  });

  it('#2 should unsubscribe media event', async () => {
    expect.assertions(2);

    offUseLicense = sipConnectorFacade.onUseLicense(handlerOnUseLicense);

    sipConnector.apiManager.events.trigger('useLicense', EUseLicense.AUDIO);

    expect(handlerOnUseLicense).toHaveBeenCalledTimes(1);

    offUseLicense();

    sipConnector.apiManager.events.trigger('useLicense', EUseLicense.AUDIO);

    expect(handlerOnUseLicense).toHaveBeenCalledTimes(1);
  });
});
