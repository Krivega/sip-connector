/// <reference types="jest" />
import type SipConnector from '../../../SipConnector';
import { doMockSipConnector } from '../../../doMock';
import resolveOnStopMainCam from '../../syncMediaState/resolveOnStopMainCam';

describe('media state: resolveOnStopMainCam', () => {
  let sipConnector: SipConnector;
  let handlerOnStopMainCam: jest.Mock<void>;
  let onStopMainCam: ReturnType<typeof resolveOnStopMainCam>;
  let offStopMainCam: () => void;

  const syncModeForced = { isSyncForced: true };
  const syncModeNotForced = { isSyncForced: false };

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    handlerOnStopMainCam = jest.fn() as jest.Mock<void>;

    onStopMainCam = resolveOnStopMainCam(sipConnector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('#1 should subscribe media event and call handler on event trigger', async () => {
    expect.assertions(4);

    onStopMainCam(handlerOnStopMainCam);

    // @ts-expect-error
    sipConnector.apiManager.events.trigger('admin-stop-main-cam', syncModeForced);

    expect(handlerOnStopMainCam).toHaveBeenCalledTimes(1);
    expect(handlerOnStopMainCam).toHaveBeenCalledWith(syncModeForced);

    // @ts-expect-error
    sipConnector.apiManager.events.trigger('admin-stop-main-cam', syncModeNotForced);

    expect(handlerOnStopMainCam).toHaveBeenCalledTimes(2);
    expect(handlerOnStopMainCam).toHaveBeenCalledWith(syncModeNotForced);
  });

  it('#2 should unsubscribe media event', async () => {
    expect.assertions(2);

    offStopMainCam = onStopMainCam(handlerOnStopMainCam);

    // @ts-expect-error
    sipConnector.apiManager.events.trigger('admin-stop-main-cam', syncModeForced);

    expect(handlerOnStopMainCam).toHaveBeenCalledTimes(1);

    offStopMainCam();

    // @ts-expect-error
    sipConnector.apiManager.events.trigger('admin-stop-main-cam', syncModeForced);

    expect(handlerOnStopMainCam).toHaveBeenCalledTimes(1);
  });
});
