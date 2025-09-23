import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';

import delayPromise from '@/__fixtures__/delayPromise';
import jssip from '@/__fixtures__/jssip.mock';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import { ApiManager } from '@/ApiManager';
import { CallManager } from '@/CallManager';
import { ConnectionManager } from '@/ConnectionManager';
import logger from '@/logger';
import { StatsManager } from '@/StatsManager';
import { statisticsMockBase } from '@/StatsPeerConnection/__fixtures__/callStaticsState';

import type { TJsSIP } from '@/types';

const audioTrack = createAudioMediaStreamTrackMock();
const videoTrack = createVideoMediaStreamTrackMock();

// Мокаем logger
jest.mock('../../logger', () => {
  return jest.fn();
});

describe('StatsManager', () => {
  it('подписывается на события CallManager при создании', () => {
    const callManager = new CallManager();
    const apiManager = new ApiManager({
      connectionManager: new ConnectionManager({ JsSIP: jssip as unknown as TJsSIP }),
      callManager,
    });
    const onSpy = jest.spyOn(callManager, 'on');

    // eslint-disable-next-line no-new
    new StatsManager({ callManager, apiManager });

    // assert
    expect(onSpy).toHaveBeenCalledWith('peerconnection:confirmed', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('failed', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('ended', expect.any(Function));
  });

  it('запускает сбор статистики при peerconnection:confirmed и останавливает при ended/failed', () => {
    const callManager = new CallManager();
    const apiManager = new ApiManager({
      connectionManager: new ConnectionManager({ JsSIP: jssip as unknown as TJsSIP }),
      callManager,
    });
    const manager = new StatsManager({ callManager, apiManager });

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
      // @ts-expect-error
      message: {},
      cause: 'error',
    });
    expect(stopSpy).toHaveBeenCalledTimes(2);

    // stop on failed as well
    callManager.events.trigger('failed', {
      originator: 'local',
      // @ts-expect-error
      message: {},
      cause: 'error',
    });
    expect(stopSpy).toHaveBeenCalledTimes(3);
  });

  it('проксирует методы событий к StatsPeerConnection', async () => {
    const callManager = new CallManager();
    const apiManager = new ApiManager({
      connectionManager: new ConnectionManager({ JsSIP: jssip as unknown as TJsSIP }),
      callManager,
    });
    const manager = new StatsManager({ callManager, apiManager });

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

  it('обновляет availableIncomingBitrate при событии collected', () => {
    const callManager = new CallManager();
    const apiManager = new ApiManager({
      connectionManager: new ConnectionManager({ JsSIP: jssip as unknown as TJsSIP }),
      callManager,
    });
    const manager = new StatsManager({ callManager, apiManager });

    expect(manager.availableIncomingBitrate).toBeUndefined();

    // триггерим событие сбора статистики с mock-данными
    manager.statsPeerConnection.events.trigger('collected', statisticsMockBase);

    expect(manager.availableIncomingBitrate).toBe(
      statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate,
    );
  });

  it('сбрасывает availableIncomingBitrate при ended и failed', () => {
    const callManager = new CallManager();
    const apiManager = new ApiManager({
      connectionManager: new ConnectionManager({ JsSIP: jssip as unknown as TJsSIP }),
      callManager,
    });
    const manager = new StatsManager({ callManager, apiManager });

    // установим значение через collected
    manager.statsPeerConnection.events.trigger('collected', statisticsMockBase);
    expect(manager.availableIncomingBitrate).toBe(
      statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate,
    );

    // сброс при ended
    callManager.events.trigger('ended', {
      originator: 'local',
      // @ts-expect-error
      message: {},
      cause: 'error',
    });
    expect(manager.availableIncomingBitrate).toBeUndefined();

    // восстановим и проверим сброс при failed
    manager.statsPeerConnection.events.trigger('collected', statisticsMockBase);
    expect(manager.availableIncomingBitrate).toBe(
      statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate,
    );

    callManager.events.trigger('failed', {
      originator: 'local',
      // @ts-expect-error
      message: {},
      cause: 'error',
    });
    expect(manager.availableIncomingBitrate).toBeUndefined();
  });

  describe('hasAvailableIncomingBitrateChangedQuarter', () => {
    const cloneStatsWithBitrate = (value: number): typeof statisticsMockBase => {
      return {
        ...statisticsMockBase,
        inbound: {
          ...statisticsMockBase.inbound,
          additional: {
            ...statisticsMockBase.inbound.additional,
            candidatePair: {
              ...statisticsMockBase.inbound.additional.candidatePair,
              availableIncomingBitrate: value,
            },
          },
        },
      };
    };

    it('возвращает false, если нет предыдущего или текущего значения', () => {
      const callManager = new CallManager();
      const apiManager = new ApiManager({
        connectionManager: new ConnectionManager({ JsSIP: jssip as unknown as TJsSIP }),
        callManager,
      });
      const manager = new StatsManager({ callManager, apiManager });

      expect(manager.hasAvailableIncomingBitrateChangedQuarter()).toBe(false);

      // после одного collected предыдущее еще undefined
      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));
      expect(manager.hasAvailableIncomingBitrateChangedQuarter()).toBe(false);
    });

    it('возвращает false, если изменение меньше 25%', () => {
      const callManager = new CallManager();
      const apiManager = new ApiManager({
        connectionManager: new ConnectionManager({ JsSIP: jssip as unknown as TJsSIP }),
        callManager,
      });
      const manager = new StatsManager({ callManager, apiManager });

      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));
      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base * 1.24));

      expect(manager.hasAvailableIncomingBitrateChangedQuarter()).toBe(false);
    });

    it('возвращает true, если изменение равно или больше 25% (рост)', () => {
      const callManager = new CallManager();
      const apiManager = new ApiManager({
        connectionManager: new ConnectionManager({ JsSIP: jssip as unknown as TJsSIP }),
        callManager,
      });
      const manager = new StatsManager({ callManager, apiManager });

      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));
      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base * 1.25));

      expect(manager.hasAvailableIncomingBitrateChangedQuarter()).toBe(true);
    });

    it('возвращает true, если изменение равно или больше 25% (падение)', () => {
      const callManager = new CallManager();
      const apiManager = new ApiManager({
        connectionManager: new ConnectionManager({ JsSIP: jssip as unknown as TJsSIP }),
        callManager,
      });
      const manager = new StatsManager({ callManager, apiManager });

      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));
      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base * 0.74));

      expect(manager.hasAvailableIncomingBitrateChangedQuarter()).toBe(true);
    });

    it('если предыдущее 0 и текущее > 0 — возвращает true', () => {
      const callManager = new CallManager();
      const apiManager = new ApiManager({
        connectionManager: new ConnectionManager({ JsSIP: jssip as unknown as TJsSIP }),
        callManager,
      });
      const manager = new StatsManager({ callManager, apiManager });

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(0));
      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(1));

      expect(manager.hasAvailableIncomingBitrateChangedQuarter()).toBe(true);
    });
  });

  describe('maybeSendStats', () => {
    const cloneStatsWithBitrate = (value: number): typeof statisticsMockBase => {
      return {
        ...statisticsMockBase,
        inbound: {
          ...statisticsMockBase.inbound,
          additional: {
            ...statisticsMockBase.inbound.additional,
            candidatePair: {
              ...statisticsMockBase.inbound.additional.candidatePair,
              availableIncomingBitrate: value,
            },
          },
        },
      };
    };

    beforeEach(() => {
      (logger as jest.MockedFunction<typeof logger>).mockClear();
    });

    it('не отправляет stats на первом collected (нет previous)', () => {
      const callManager = new CallManager();
      const apiManager = {
        sendStats: jest.fn().mockResolvedValue(undefined),
      } as unknown as ApiManager;
      const manager = new StatsManager({ callManager, apiManager });

      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));

      expect(apiManager.sendStats as jest.Mock).not.toHaveBeenCalled();
    });

    it('не отправляет stats если изменение < 25%', () => {
      const callManager = new CallManager();
      const apiManager = {
        sendStats: jest.fn().mockResolvedValue(undefined),
      } as unknown as ApiManager;
      const manager = new StatsManager({ callManager, apiManager });

      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));
      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base * 1.24));

      expect(apiManager.sendStats as jest.Mock).not.toHaveBeenCalled();
    });

    it('отправляет stats если изменение >= 25%', () => {
      const callManager = new CallManager();
      const apiManager = {
        sendStats: jest.fn().mockResolvedValue(undefined),
      } as unknown as ApiManager;
      const manager = new StatsManager({ callManager, apiManager });

      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));
      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base * 1.25));

      expect(apiManager.sendStats as jest.Mock).toHaveBeenCalledWith({
        availableIncomingBitrate: base * 1.25,
      });
    });

    it('отправляет stats если prev=0 и current>0', () => {
      const callManager = new CallManager();
      const apiManager = {
        sendStats: jest.fn().mockResolvedValue(undefined),
      } as unknown as ApiManager;
      const manager = new StatsManager({ callManager, apiManager });

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(0));
      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(1));

      expect(apiManager.sendStats as jest.Mock).toHaveBeenCalledWith({
        availableIncomingBitrate: 1,
      });
    });

    it('логирует ошибку если sendStats отклоняется', async () => {
      const callManager = new CallManager();
      const error = new Error('boom');
      const apiManager = { sendStats: jest.fn().mockRejectedValue(error) } as unknown as ApiManager;
      const manager = new StatsManager({ callManager, apiManager });

      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));
      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base * 1.25));

      await delayPromise(0);

      expect(logger as jest.MockedFunction<typeof logger>).toHaveBeenCalledWith(
        'Failed to send stats',
        error,
      );
    });
  });
});
