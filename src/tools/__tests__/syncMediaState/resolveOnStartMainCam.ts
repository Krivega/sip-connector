/// <reference types="jest" />
import type SipConnector from '../../../SipConnector';
import { doMockSipConnector } from '../../../doMock';
import resolveOnStartMainCam from '../../syncMediaState/resolveOnStartMainCam';

describe('media state: resolveOnStartMainCam', () => {
  let sipConnector: SipConnector;
  let handlerOnStartMainCam: jest.Mock<void>;
  let onStartMainCam: ReturnType<typeof resolveOnStartMainCam>;
  let offStartMainCam: () => void;

  const syncModeForced = { isSyncForced: true };
  const syncModeNotForced = { isSyncForced: false };

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    handlerOnStartMainCam = jest.fn() as jest.Mock<void>;

    onStartMainCam = resolveOnStartMainCam(sipConnector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('#1 should subscribe media event and call handler on event trigger', async () => {
    expect.assertions(4);

    onStartMainCam(handlerOnStartMainCam);
    sipConnector.apiManager.events.trigger('admin-start-main-cam', syncModeForced);

    expect(handlerOnStartMainCam).toHaveBeenCalledTimes(1);
    expect(handlerOnStartMainCam).toHaveBeenCalledWith(syncModeForced);

    sipConnector.apiManager.events.trigger('admin-start-main-cam', syncModeNotForced);

    expect(handlerOnStartMainCam).toHaveBeenCalledTimes(2);
    expect(handlerOnStartMainCam).toHaveBeenCalledWith(syncModeNotForced);
  });

  it('#2 should unsubscribe media event', async () => {
    expect.assertions(2);

    offStartMainCam = onStartMainCam(handlerOnStartMainCam);
    sipConnector.apiManager.events.trigger('admin-start-main-cam', syncModeForced);

    expect(handlerOnStartMainCam).toHaveBeenCalledTimes(1);

    offStartMainCam();

    sipConnector.apiManager.events.trigger('admin-start-main-cam', syncModeForced);

    expect(handlerOnStartMainCam).toHaveBeenCalledTimes(1);
  });
});
