import type SipConnector from '../../../SipConnector';
import doMockSIPconnector from '../../../__fixtures__/doMock';
import resolveOnStartMainCam from '../../syncMediaState/resolveOnStartMainCam';

describe('media state: resolveOnStartMainCam', () => {
  let sipConnector: SipConnector;
  let handlerOnStartMainCam: jest.Mock<void, any>;
  let onStartMainCam: ReturnType<typeof resolveOnStartMainCam>;
  let offStartMainCam: () => void;

  const syncModeForced = { isSyncForced: true };
  const syncModeNotForced = { isSyncForced: false };

  beforeEach(() => {
    sipConnector = doMockSIPconnector();
    handlerOnStartMainCam = jest.fn();

    onStartMainCam = resolveOnStartMainCam(sipConnector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('#1 should subscribe media event and call handler on event trigger', async () => {
    expect.assertions(4);

    onStartMainCam(handlerOnStartMainCam);

    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-start-main-cam', syncModeForced);

    expect(handlerOnStartMainCam).toHaveBeenCalledTimes(1);
    expect(handlerOnStartMainCam).toHaveBeenCalledWith(syncModeForced);

    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-start-main-cam', syncModeNotForced);

    expect(handlerOnStartMainCam).toHaveBeenCalledTimes(2);
    expect(handlerOnStartMainCam).toHaveBeenCalledWith(syncModeNotForced);
  });

  it('#2 should unsubscribe media event', async () => {
    expect.assertions(2);

    offStartMainCam = onStartMainCam(handlerOnStartMainCam);

    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-start-main-cam', syncModeForced);

    expect(handlerOnStartMainCam).toHaveBeenCalledTimes(1);

    offStartMainCam();

    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-start-main-cam', syncModeForced);

    expect(handlerOnStartMainCam).toHaveBeenCalledTimes(1);
  });
});
