import type SipConnector from '../../SipConnector';
import doMockSIPconnector from '../../__fixtures__/doMock';
import resolveOnUseLicense from '../resolveOnUseLicense';

const AUDIO_LICENSE = 'AUDIO';

describe('media state: resolveOnUseLicense', () => {
  let sipConnector: SipConnector;
  let handlerOnUseLicense: jest.Mock<void, any>;
  let onUseLicense: ReturnType<typeof resolveOnUseLicense>;
  let offUseLicense: () => void;

  beforeEach(() => {
    sipConnector = doMockSIPconnector();
    handlerOnUseLicense = jest.fn();

    onUseLicense = resolveOnUseLicense(sipConnector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('#1 should subscribe media event and call handler on event trigger', async () => {
    expect.assertions(4);

    onUseLicense(handlerOnUseLicense);

    // @ts-ignore
    sipConnector._sessionEvents.trigger('useLicense', AUDIO_LICENSE);

    expect(handlerOnUseLicense).toHaveBeenCalledTimes(1);
    expect(handlerOnUseLicense).toHaveBeenCalledWith(AUDIO_LICENSE);

    // @ts-ignore
    sipConnector._sessionEvents.trigger('useLicense', AUDIO_LICENSE);

    expect(handlerOnUseLicense).toHaveBeenCalledTimes(2);
    expect(handlerOnUseLicense).toHaveBeenCalledWith(AUDIO_LICENSE);
  });

  it('#2 should unsubscribe media event', async () => {
    expect.assertions(2);

    offUseLicense = onUseLicense(handlerOnUseLicense);

    // @ts-ignore
    sipConnector._sessionEvents.trigger('useLicense', AUDIO_LICENSE);

    expect(handlerOnUseLicense).toHaveBeenCalledTimes(1);

    offUseLicense();

    // @ts-ignore
    sipConnector._sessionEvents.trigger('useLicense', AUDIO_LICENSE);

    expect(handlerOnUseLicense).toHaveBeenCalledTimes(1);
  });
});
