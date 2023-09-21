import type SipConnector from '../../../SipConnector';
import doMockSIPconnector from '../../../__fixtures__/doMock';
import createState from '../../syncMediaState';

describe('media state: create state', () => {
  let sipConnector: SipConnector;
  let onStartMainCamForced: jest.Mock<void, any>;
  let onStartMainCamNotForced: jest.Mock<void, any>;
  let onStopMainCamForced: jest.Mock<void, any>;
  let onStopMainCamNotForced: jest.Mock<void, any>;
  let onStartMicForced: jest.Mock<void, any>;
  let onStartMicNotForced: jest.Mock<void, any>;
  let onStopMicForced: jest.Mock<void, any>;
  let onStopMicNotForced: jest.Mock<void, any>;
  let state: ReturnType<typeof createState>;

  const mediaStateEventPayloadForced = { isSyncForced: true };
  const mediaStateEventPayloadNotForced = { isSyncForced: false };

  beforeEach(() => {
    sipConnector = doMockSIPconnector();
    onStartMainCamForced = jest.fn();
    onStartMainCamNotForced = jest.fn();
    onStopMainCamForced = jest.fn();
    onStopMainCamNotForced = jest.fn();
    onStartMicForced = jest.fn();
    onStartMicNotForced = jest.fn();
    onStopMicForced = jest.fn();
    onStopMicNotForced = jest.fn();

    state = createState({ sipConnector });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('#1 start with successful wait sync media state', () => {
    expect.assertions(16);

    state.start({
      onStartMainCamForced,
      onStartMainCamNotForced,
      onStopMainCamForced,
      onStopMainCamNotForced,
      onStartMicForced,
      onStartMicNotForced,
      onStopMicForced,
      onStopMicNotForced,
    });

    // #1.2 should subscribe to media state commands

    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-start-main-cam', mediaStateEventPayloadForced);
    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-stop-main-cam', mediaStateEventPayloadForced);
    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-start-mic', mediaStateEventPayloadForced);
    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-stop-mic', mediaStateEventPayloadForced);

    expect(onStartMainCamForced).toHaveBeenCalledTimes(1);
    expect(onStartMainCamNotForced).toHaveBeenCalledTimes(0);
    expect(onStopMainCamForced).toHaveBeenCalledTimes(1);
    expect(onStopMainCamNotForced).toHaveBeenCalledTimes(0);
    expect(onStartMicForced).toHaveBeenCalledTimes(1);
    expect(onStartMicNotForced).toHaveBeenCalledTimes(0);
    expect(onStopMicForced).toHaveBeenCalledTimes(1);
    expect(onStopMicNotForced).toHaveBeenCalledTimes(0);

    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-start-main-cam', mediaStateEventPayloadNotForced);
    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-stop-main-cam', mediaStateEventPayloadNotForced);
    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-start-mic', mediaStateEventPayloadNotForced);
    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-stop-mic', mediaStateEventPayloadNotForced);

    expect(onStartMainCamForced).toHaveBeenCalledTimes(1);
    expect(onStartMainCamNotForced).toHaveBeenCalledTimes(1);
    expect(onStopMainCamForced).toHaveBeenCalledTimes(1);
    expect(onStopMainCamNotForced).toHaveBeenCalledTimes(1);
    expect(onStartMicForced).toHaveBeenCalledTimes(1);
    expect(onStartMicNotForced).toHaveBeenCalledTimes(1);
    expect(onStopMicForced).toHaveBeenCalledTimes(1);
    expect(onStopMicNotForced).toHaveBeenCalledTimes(1);
  });

  it('#2 stop should unsubscribe from media state events', () => {
    expect.assertions(8);

    state.start({
      onStartMainCamForced,
      onStartMainCamNotForced,
      onStopMainCamForced,
      onStopMainCamNotForced,
      onStartMicForced,
      onStartMicNotForced,
      onStopMicForced,
      onStopMicNotForced,
    });

    state.stop();

    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-start-main-cam', mediaStateEventPayloadForced);
    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-stop-main-cam', mediaStateEventPayloadForced);
    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-start-mic', mediaStateEventPayloadForced);
    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-stop-mic', mediaStateEventPayloadForced);

    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-start-main-cam', mediaStateEventPayloadNotForced);
    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-stop-main-cam', mediaStateEventPayloadNotForced);
    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-start-mic', mediaStateEventPayloadNotForced);
    // @ts-ignore
    sipConnector._sessionEvents.trigger('admin-stop-mic', mediaStateEventPayloadNotForced);

    expect(onStartMainCamForced).toHaveBeenCalledTimes(0);
    expect(onStartMainCamNotForced).toHaveBeenCalledTimes(0);
    expect(onStopMainCamForced).toHaveBeenCalledTimes(0);
    expect(onStopMainCamNotForced).toHaveBeenCalledTimes(0);
    expect(onStartMicForced).toHaveBeenCalledTimes(0);
    expect(onStartMicNotForced).toHaveBeenCalledTimes(0);
    expect(onStopMicForced).toHaveBeenCalledTimes(0);
    expect(onStopMicNotForced).toHaveBeenCalledTimes(0);
  });
});
