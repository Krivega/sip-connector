/// <reference types="jest" />
import type SipConnector from '../../../SipConnector';
import { doMockSipConnector } from '../../../doMock';
import createState from '../../syncMediaState';

describe('media state: create state', () => {
  let sipConnector: SipConnector;
  let onStartMainCamForced: jest.Mock<void>;
  let onStartMainCamNotForced: jest.Mock<void>;
  let onStopMainCamForced: jest.Mock<void>;
  let onStopMainCamNotForced: jest.Mock<void>;
  let onStartMicForced: jest.Mock<void>;
  let onStartMicNotForced: jest.Mock<void>;
  let onStopMicForced: jest.Mock<void>;
  let onStopMicNotForced: jest.Mock<void>;
  let state: ReturnType<typeof createState>;

  const mediaStateEventPayloadForced = { isSyncForced: true };
  const mediaStateEventPayloadNotForced = { isSyncForced: false };

  beforeEach(() => {
    sipConnector = doMockSipConnector();
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

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-start-main-cam', mediaStateEventPayloadForced);
    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-stop-main-cam', mediaStateEventPayloadForced);
    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-start-mic', mediaStateEventPayloadForced);
    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-stop-mic', mediaStateEventPayloadForced);

    expect(onStartMainCamForced).toHaveBeenCalledTimes(1);
    expect(onStartMainCamNotForced).toHaveBeenCalledTimes(0);
    expect(onStopMainCamForced).toHaveBeenCalledTimes(1);
    expect(onStopMainCamNotForced).toHaveBeenCalledTimes(0);
    expect(onStartMicForced).toHaveBeenCalledTimes(1);
    expect(onStartMicNotForced).toHaveBeenCalledTimes(0);
    expect(onStopMicForced).toHaveBeenCalledTimes(1);
    expect(onStopMicNotForced).toHaveBeenCalledTimes(0);

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-start-main-cam', mediaStateEventPayloadNotForced);
    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-stop-main-cam', mediaStateEventPayloadNotForced);
    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-start-mic', mediaStateEventPayloadNotForced);
    // @ts-expect-error
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

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-start-main-cam', mediaStateEventPayloadForced);
    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-stop-main-cam', mediaStateEventPayloadForced);
    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-start-mic', mediaStateEventPayloadForced);
    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-stop-mic', mediaStateEventPayloadForced);

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-start-main-cam', mediaStateEventPayloadNotForced);
    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-stop-main-cam', mediaStateEventPayloadNotForced);
    // @ts-expect-error
    sipConnector._sessionEvents.trigger('admin-start-mic', mediaStateEventPayloadNotForced);
    // @ts-expect-error
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
