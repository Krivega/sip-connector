/// <reference types="jest" />
import type SipConnector from '../../../SipConnector';
import { doMockSipConnector } from '../../../doMock';
import resolveOnStartMic from '../../syncMediaState/resolveOnStartMic';

describe('media state: resolveOnStartMic', () => {
  let sipConnector: SipConnector;
  let handlerOnStartMic: jest.Mock<void>;
  let onStartMic: ReturnType<typeof resolveOnStartMic>;
  let offStartMic: () => void;

  const syncModeForced = { isSyncForced: true };
  const syncModeNotForced = { isSyncForced: false };

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    handlerOnStartMic = jest.fn() as jest.Mock<void>;

    onStartMic = resolveOnStartMic(sipConnector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('#1 should subscribe media event and call handler on event trigger', () => {
    expect.assertions(4);

    onStartMic(handlerOnStartMic);
    sipConnector.apiManager.events.trigger('admin-start-mic', syncModeForced);

    expect(handlerOnStartMic).toHaveBeenCalledTimes(1);
    expect(handlerOnStartMic).toHaveBeenCalledWith(syncModeForced);

    sipConnector.apiManager.events.trigger('admin-start-mic', syncModeNotForced);

    expect(handlerOnStartMic).toHaveBeenCalledTimes(2);
    expect(handlerOnStartMic).toHaveBeenCalledWith(syncModeNotForced);
  });

  it('#2 should unsubscribe media event', () => {
    expect.assertions(2);

    offStartMic = onStartMic(handlerOnStartMic);
    sipConnector.apiManager.events.trigger('admin-start-mic', syncModeForced);

    expect(handlerOnStartMic).toHaveBeenCalledTimes(1);

    offStartMic();

    sipConnector.apiManager.events.trigger('admin-start-mic', syncModeForced);

    expect(handlerOnStartMic).toHaveBeenCalledTimes(1);
  });
});
