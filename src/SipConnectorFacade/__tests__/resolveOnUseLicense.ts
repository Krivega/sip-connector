/// <reference types="jest" />
import type SipConnector from '../../SipConnector';
import { doMockSipConnector } from '../../doMock';
import SipConnectorFacade from '../SipConnectorFacade';

const AUDIO_LICENSE = 'AUDIO';

describe('media state: resolveOnUseLicense', () => {
  let sipConnector: SipConnector;
  let sipConnectorFacade: SipConnectorFacade;
  let handlerOnUseLicense: jest.Mock<void>;
  let offUseLicense: () => void;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    sipConnectorFacade = new SipConnectorFacade(sipConnector);
    handlerOnUseLicense = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('#1 should subscribe media event and call handler on event trigger', async () => {
    expect.assertions(4);

    sipConnectorFacade.onUseLicense(handlerOnUseLicense);

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('useLicense', AUDIO_LICENSE);

    expect(handlerOnUseLicense).toHaveBeenCalledTimes(1);
    expect(handlerOnUseLicense).toHaveBeenCalledWith(AUDIO_LICENSE);

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('useLicense', AUDIO_LICENSE);

    expect(handlerOnUseLicense).toHaveBeenCalledTimes(2);
    expect(handlerOnUseLicense).toHaveBeenCalledWith(AUDIO_LICENSE);
  });

  it('#2 should unsubscribe media event', async () => {
    expect.assertions(2);

    offUseLicense = sipConnectorFacade.onUseLicense(handlerOnUseLicense);

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('useLicense', AUDIO_LICENSE);

    expect(handlerOnUseLicense).toHaveBeenCalledTimes(1);

    offUseLicense();

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('useLicense', AUDIO_LICENSE);

    expect(handlerOnUseLicense).toHaveBeenCalledTimes(1);
  });
});
