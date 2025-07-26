/// <reference types="jest" />
import type { SipConnector } from '../../../SipConnector';
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
    onStartMainCamForced = jest.fn() as jest.Mock<void>;
    onStartMainCamNotForced = jest.fn() as jest.Mock<void>;
    onStopMainCamForced = jest.fn() as jest.Mock<void>;
    onStopMainCamNotForced = jest.fn() as jest.Mock<void>;
    onStartMicForced = jest.fn() as jest.Mock<void>;
    onStartMicNotForced = jest.fn() as jest.Mock<void>;
    onStopMicForced = jest.fn() as jest.Mock<void>;
    onStopMicNotForced = jest.fn() as jest.Mock<void>;

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

    sipConnector.apiManager.events.trigger('admin-start-main-cam', mediaStateEventPayloadForced);
    sipConnector.apiManager.events.trigger('admin-stop-main-cam', mediaStateEventPayloadForced);
    sipConnector.apiManager.events.trigger('admin-start-mic', mediaStateEventPayloadForced);
    sipConnector.apiManager.events.trigger('admin-stop-mic', mediaStateEventPayloadForced);

    expect(onStartMainCamForced).toHaveBeenCalledTimes(1);
    expect(onStartMainCamNotForced).toHaveBeenCalledTimes(0);
    expect(onStopMainCamForced).toHaveBeenCalledTimes(1);
    expect(onStopMainCamNotForced).toHaveBeenCalledTimes(0);
    expect(onStartMicForced).toHaveBeenCalledTimes(1);
    expect(onStartMicNotForced).toHaveBeenCalledTimes(0);
    expect(onStopMicForced).toHaveBeenCalledTimes(1);
    expect(onStopMicNotForced).toHaveBeenCalledTimes(0);

    sipConnector.apiManager.events.trigger('admin-start-main-cam', mediaStateEventPayloadNotForced);
    sipConnector.apiManager.events.trigger('admin-stop-main-cam', mediaStateEventPayloadNotForced);
    sipConnector.apiManager.events.trigger('admin-start-mic', mediaStateEventPayloadNotForced);
    sipConnector.apiManager.events.trigger('admin-stop-mic', mediaStateEventPayloadNotForced);

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

    sipConnector.apiManager.events.trigger('admin-start-main-cam', mediaStateEventPayloadForced);
    sipConnector.apiManager.events.trigger('admin-stop-main-cam', mediaStateEventPayloadForced);
    sipConnector.apiManager.events.trigger('admin-start-mic', mediaStateEventPayloadForced);
    sipConnector.apiManager.events.trigger('admin-stop-mic', mediaStateEventPayloadForced);

    sipConnector.apiManager.events.trigger('admin-start-main-cam', mediaStateEventPayloadNotForced);
    sipConnector.apiManager.events.trigger('admin-stop-main-cam', mediaStateEventPayloadNotForced);
    sipConnector.apiManager.events.trigger('admin-start-mic', mediaStateEventPayloadNotForced);
    sipConnector.apiManager.events.trigger('admin-stop-mic', mediaStateEventPayloadNotForced);

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
