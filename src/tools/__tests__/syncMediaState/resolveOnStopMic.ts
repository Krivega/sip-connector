import type SipConnector from '../../../SipConnector';
import doMockSIPconnector from '../../../doMock';
import resolveOnStopMic from '../../syncMediaState/resolveOnStopMic';

describe('media state: resolveOnStopMic', () => {
  let sipConnector: SipConnector;
  let handlerOnStopMic: jest.Mock<void>;
  let onStopMic: ReturnType<typeof resolveOnStopMic>;
  let offStopMic: () => void;

  const syncModeForced = { isSyncForced: true };
  const syncModeNotForced = { isSyncForced: false };

  beforeEach(() => {
    sipConnector = doMockSIPconnector();
    handlerOnStopMic = jest.fn();

    onStopMic = resolveOnStopMic(sipConnector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('#1 should subscribe media event and call handler on event trigger', () => {
    expect.assertions(4);

    onStopMic(handlerOnStopMic);

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-stop-mic', syncModeForced);

    expect(handlerOnStopMic).toHaveBeenCalledTimes(1);
    expect(handlerOnStopMic).toHaveBeenCalledWith(syncModeForced);

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-stop-mic', syncModeNotForced);

    expect(handlerOnStopMic).toHaveBeenCalledTimes(2);
    expect(handlerOnStopMic).toHaveBeenCalledWith(syncModeNotForced);
  });

  it('#2 should unsubscribe media event', () => {
    expect.assertions(2);

    offStopMic = onStopMic(handlerOnStopMic);

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-stop-mic', syncModeForced);

    expect(handlerOnStopMic).toHaveBeenCalledTimes(1);

    offStopMic();

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-stop-mic', syncModeForced);

    expect(handlerOnStopMic).toHaveBeenCalledTimes(1);
  });
});
