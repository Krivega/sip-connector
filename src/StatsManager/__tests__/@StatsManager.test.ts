import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';

import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import { CallManager } from '@/CallManager';
import { StatsManager } from '@/StatsManager';

const audioTrack = createAudioMediaStreamTrackMock();
const videoTrack = createVideoMediaStreamTrackMock();

describe('StatsManager', () => {
  it('подписывается на события CallManager при создании', () => {
    const callManager = new CallManager();

    const onSpy = jest.spyOn(callManager, 'on');

    // eslint-disable-next-line no-new
    new StatsManager({ callManager });

    // assert
    expect(onSpy).toHaveBeenCalledWith('peerconnection:confirmed', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('failed', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('ended', expect.any(Function));
  });

  it('запускает сбор статистики при peerconnection:confirmed и останавливает при ended/failed', () => {
    const callManager = new CallManager();
    const manager = new StatsManager({ callManager });

    const startSpy = jest.spyOn(manager.statsPeerConnection, 'start');
    const stopSpy = jest.spyOn(manager.statsPeerConnection, 'stop');

    const pc = new RTCPeerConnectionMock(undefined, [audioTrack, videoTrack]);

    // start collecting after confirmed
    callManager.events.trigger('peerconnection:confirmed', pc);

    expect(startSpy).toHaveBeenCalledWith(pc);
    // stopped before start
    expect(stopSpy).toHaveBeenCalledTimes(1);

    // stop on ended
    callManager.events.trigger('ended', {
      originator: 'local',
    });
    expect(stopSpy).toHaveBeenCalledTimes(2);

    // stop on failed as well
    callManager.events.trigger('failed', {
      originator: 'local',
    });
    expect(stopSpy).toHaveBeenCalledTimes(3);
  });

  it('проксирует методы событий к StatsPeerConnection', async () => {
    const callManager = new CallManager();
    const manager = new StatsManager({ callManager });

    const handler = jest.fn();
    const eventName = 'collected' as const;

    const onSpy = jest.spyOn(manager.statsPeerConnection, 'on');

    manager.on(eventName, handler);
    expect(onSpy).toHaveBeenCalledWith(eventName, handler);

    const onceSpy = jest.spyOn(manager.statsPeerConnection, 'once');

    manager.once(eventName, handler);
    expect(onceSpy).toHaveBeenCalledWith(eventName, handler);

    const onceRaceSpy = jest.spyOn(manager.statsPeerConnection, 'onceRace');

    manager.onceRace([eventName], (data, eventName_) => {
      handler(data, eventName_);
    });
    expect(onceRaceSpy).toHaveBeenCalled();

    const fakeEventData = { outbound: {}, inbound: {} };
    const waitSpy = jest
      .spyOn(manager.statsPeerConnection, 'wait')
      // @ts-expect-error
      .mockResolvedValue(fakeEventData);

    await expect(manager.wait(eventName)).resolves.toBe(fakeEventData);
    expect(waitSpy).toHaveBeenCalledWith(eventName);

    const offSpy = jest.spyOn(manager.statsPeerConnection, 'off');

    manager.off(eventName, handler);
    expect(offSpy).toHaveBeenCalled();
  });
});
