import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';

import { createManagers } from '@/__fixtures__/createManagers';
import delayPromise from '@/__fixtures__/delayPromise';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import { ApiManager } from '@/ApiManager';
import { CallManager } from '@/CallManager';
import { ContentedStreamManager } from '@/ContentedStreamManager';
import logger from '@/logger';
import { StatsManager } from '@/StatsManager';
import { statisticsMockBase } from '@/StatsPeerConnection/__fixtures__/callStaticsState';

const audioTrack = createAudioMediaStreamTrackMock();
const videoTrack = createVideoMediaStreamTrackMock();

jest.mock('@/logger');

const { mcuDebugLogger } = logger as jest.Mock & { mcuDebugLogger: jest.Mock };

describe('StatsManager', () => {
  const tools = {
    sendOffer: jest.fn().mockResolvedValue({} as RTCSessionDescription),
  };

  it('подписывается на события CallManager при создании', () => {
    const { callManager, apiManager } = createManagers();
    const onSpy = jest.spyOn(callManager, 'on');

    // eslint-disable-next-line no-new
    new StatsManager({ callManager, apiManager });

    // assert
    expect(onSpy).toHaveBeenCalledWith('peerconnection:confirmed', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('recv-session-started', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('recv-session-ended', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('recv-quality-changed', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('failed', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('ended', expect.any(Function));
  });

  it('запускает сбор статистики при peerconnection:confirmed и останавливает при ended/failed', () => {
    const { callManager, apiManager } = createManagers();
    const manager = new StatsManager({ callManager, apiManager });

    const startSpy = jest.spyOn(manager.statsPeerConnection, 'start');
    const stopSpy = jest.spyOn(manager.statsPeerConnection, 'stop');

    const pc = new RTCPeerConnectionMock(undefined, [audioTrack, videoTrack]);
    const getActivePeerConnectionSpy = jest
      .spyOn(callManager, 'getActivePeerConnection')
      .mockReturnValue(pc);

    // start collecting after confirmed
    callManager.events.trigger('peerconnection:confirmed', pc);

    expect(startSpy).toHaveBeenCalledWith(callManager.getActivePeerConnection);
    expect(startSpy).toHaveBeenCalledTimes(1);

    const getPeerConnection = startSpy.mock.calls[0]?.[0];

    expect(getPeerConnection()).toBe(pc);
    expect(getActivePeerConnectionSpy).toHaveBeenCalledTimes(1);
    expect(stopSpy).toHaveBeenCalledTimes(0);

    // stop on ended
    callManager.events.trigger('ended', {
      originator: 'local',
      // @ts-expect-error
      message: {},
      cause: 'error',
    });
    expect(stopSpy).toHaveBeenCalledTimes(1);

    // stop on failed as well
    callManager.events.trigger('failed', {
      originator: 'local',
      // @ts-expect-error
      message: {},
      cause: 'error',
    });
    expect(stopSpy).toHaveBeenCalledTimes(2);
  });

  it('перезапускает сбор статистики при recv-session-started и recv-session-ended', () => {
    const { callManager, apiManager } = createManagers();
    const manager = new StatsManager({ callManager, apiManager });
    const startSpy = jest.spyOn(manager.statsPeerConnection, 'start');
    const pc = new RTCPeerConnectionMock(undefined, [audioTrack, videoTrack]);

    jest.spyOn(callManager, 'getActivePeerConnection').mockReturnValue(pc);

    callManager.events.trigger('peerconnection:confirmed', pc);
    expect(startSpy).toHaveBeenCalledTimes(1);

    callManager.events.trigger('recv-session-started');
    expect(startSpy).toHaveBeenCalledTimes(2);
    expect(startSpy).toHaveBeenCalledWith(callManager.getActivePeerConnection);

    callManager.events.trigger('recv-session-ended');
    expect(startSpy).toHaveBeenCalledTimes(3);
    expect(startSpy).toHaveBeenCalledWith(callManager.getActivePeerConnection);

    callManager.events.trigger('recv-quality-changed', {
      effectiveQuality: 'low',
      previousQuality: 'auto',
      quality: 'low',
    });
    expect(startSpy).toHaveBeenCalledTimes(4);
    expect(startSpy).toHaveBeenCalledWith(callManager.getActivePeerConnection);
  });

  it('проксирует методы событий к StatsPeerConnection', async () => {
    const { callManager, apiManager } = createManagers();
    const manager = new StatsManager({ callManager, apiManager });

    const handler = jest.fn();
    const eventName = 'collected' as const;

    const onSpy = jest.spyOn(manager.statsPeerConnection.events, 'on');

    manager.on(eventName, handler);
    expect(onSpy).toHaveBeenCalledWith(eventName, handler);

    const onceSpy = jest.spyOn(manager.statsPeerConnection.events, 'once');

    manager.once(eventName, handler);
    expect(onceSpy).toHaveBeenCalledWith(eventName, handler);

    const onceRaceSpy = jest.spyOn(manager.statsPeerConnection.events, 'onceRace');

    manager.onceRace([eventName], (data, eventName_) => {
      handler(data, eventName_);
    });
    expect(onceRaceSpy).toHaveBeenCalled();

    const fakeEventData = { outbound: {}, inbound: {} };
    const waitSpy = jest
      .spyOn(manager.statsPeerConnection.events, 'wait')
      // @ts-expect-error
      .mockResolvedValue(fakeEventData);

    await expect(manager.wait(eventName)).resolves.toBe(fakeEventData);
    expect(waitSpy).toHaveBeenCalledWith(eventName);

    const offSpy = jest.spyOn(manager.statsPeerConnection.events, 'off');

    manager.off(eventName, handler);
    expect(offSpy).toHaveBeenCalled();
  });

  it('обновляет availableIncomingBitrate при событии collected', () => {
    const contentedStreamManager = new ContentedStreamManager();
    const callManager = new CallManager({ contentedStreamManager }, tools);
    const apiManager = new ApiManager();
    const manager = new StatsManager({ callManager, apiManager });

    expect(manager.availableIncomingBitrate).toBeUndefined();

    // триггерим событие сбора статистики с mock-данными
    manager.statsPeerConnection.events.trigger('collected', statisticsMockBase);

    expect(manager.availableIncomingBitrate).toBe(
      statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate,
    );
  });

  it('сбрасывает availableIncomingBitrate при ended и failed', () => {
    const contentedStreamManager = new ContentedStreamManager();
    const callManager = new CallManager({ contentedStreamManager }, tools);
    const apiManager = new ApiManager();
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

  describe('isInvalidInboundFrames', () => {
    const createStatsWithInboundRtp = (
      inboundRtp: Partial<typeof statisticsMockBase.inbound.video.inboundRtp>,
    ): typeof statisticsMockBase => {
      return {
        ...statisticsMockBase,
        inbound: {
          ...statisticsMockBase.inbound,
          video: {
            ...statisticsMockBase.inbound.video,
            inboundRtp: {
              ...statisticsMockBase.inbound.video.inboundRtp,
              ...inboundRtp,
            },
          },
        },
      } as typeof statisticsMockBase;
    };

    let manager: StatsManager;

    beforeEach(() => {
      const { callManager, apiManager } = createManagers();

      manager = new StatsManager({ callManager, apiManager });
    });

    it('должен возвращать true когда inbound не получает и не декодирует кадры и количество входящих пакетов РАВНО 500', () => {
      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 0, framesDecoded: 0, packetsReceived: 500 }),
      );

      expect(manager.isInvalidInboundFrames).toBe(true);
    });

    it('должен возвращать true когда inbound не получает и не декодирует кадры и количество входящих пакетов более 500', () => {
      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 0, framesDecoded: 0, packetsReceived: 501 }),
      );

      expect(manager.isInvalidInboundFrames).toBe(true);
    });

    it('должен возвращать true когда inbound не декодирует кадры', () => {
      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 1, framesDecoded: 0, packetsReceived: 500 }),
      );

      expect(manager.isInvalidInboundFrames).toBe(true);
    });

    it('должен возвращать false когда inbound получил меньше 500 пакетов', () => {
      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 0, framesDecoded: 0, packetsReceived: 0 }),
      );

      expect(manager.isInvalidInboundFrames).toBe(false);

      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 0, framesDecoded: 0, packetsReceived: 499 }),
      );

      expect(manager.isInvalidInboundFrames).toBe(false);
    });

    it('должен возвращать false когда inbound получает и декодирует кадры', () => {
      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 1, framesDecoded: 1, packetsReceived: 500 }),
      );

      expect(manager.isInvalidInboundFrames).toBe(false);
    });

    it('должен возвращать true когда inbound перестал получать кадры', () => {
      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 1, framesDecoded: 1, packetsReceived: 500 }),
      );
      expect(manager.isInvalidInboundFrames).toBe(false);

      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 2, framesDecoded: 2, packetsReceived: 501 }),
      );
      expect(manager.isInvalidInboundFrames).toBe(false);

      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 2, framesDecoded: 2, packetsReceived: 502 }),
      );

      expect(manager.isInvalidInboundFrames).toBe(true);
    });

    it('должен возвращать true когда inbound перестал декодировать кадры', () => {
      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 1, framesDecoded: 1, packetsReceived: 500 }),
      );
      expect(manager.isInvalidInboundFrames).toBe(false);

      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 2, framesDecoded: 2, packetsReceived: 501 }),
      );
      expect(manager.isInvalidInboundFrames).toBe(false);

      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 3, framesDecoded: 2, packetsReceived: 502 }),
      );

      expect(manager.isInvalidInboundFrames).toBe(true);
    });

    it('должен возвращать false когда inbound продолжает получать и декодировать кадры', () => {
      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 1, framesDecoded: 1, packetsReceived: 500 }),
      );
      expect(manager.isInvalidInboundFrames).toBe(false);

      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 2, framesDecoded: 2, packetsReceived: 501 }),
      );
      expect(manager.isInvalidInboundFrames).toBe(false);

      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 3, framesDecoded: 3, packetsReceived: 502 }),
      );

      expect(manager.isInvalidInboundFrames).toBe(false);
    });

    it('должен возвращать false когда inbound перестал получать пакеты', () => {
      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 1, framesDecoded: 1, packetsReceived: 500 }),
      );
      expect(manager.isInvalidInboundFrames).toBe(false);

      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 2, framesDecoded: 2, packetsReceived: 501 }),
      );
      expect(manager.isInvalidInboundFrames).toBe(false);

      manager.statsPeerConnection.events.trigger(
        'collected',
        createStatsWithInboundRtp({ framesReceived: 2, framesDecoded: 2, packetsReceived: 501 }),
      );

      expect(manager.isInvalidInboundFrames).toBe(false);
    });

    describe('isInboundVideoStalled', () => {
      it('должен возвращать false когда входящий трафик еще не начинался', () => {
        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 0,
            framesDecoded: 0,
            packetsReceived: 0,
            bytesReceived: 0,
          }),
        );

        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 0,
            framesDecoded: 0,
            packetsReceived: 0,
            bytesReceived: 0,
          }),
        );

        expect(manager.isInboundVideoStalled).toBe(false);
      });

      it('должен возвращать true когда inbound video перестает получать пакеты и байты', () => {
        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 1,
            framesDecoded: 1,
            packetsReceived: 1,
            bytesReceived: 1000,
          }),
        );

        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 2,
            framesDecoded: 2,
            packetsReceived: 2,
            bytesReceived: 1200,
          }),
        );

        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 2,
            framesDecoded: 2,
            packetsReceived: 2,
            bytesReceived: 1200,
          }),
        );

        expect(manager.isInboundVideoStalled).toBe(true);
      });

      it('должен возвращать false когда inbound video продолжает получать пакеты и байты', () => {
        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 1,
            framesDecoded: 1,
            packetsReceived: 1,
            bytesReceived: 1000,
          }),
        );

        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 2,
            framesDecoded: 2,
            packetsReceived: 2,
            bytesReceived: 1200,
          }),
        );

        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 3,
            framesDecoded: 3,
            packetsReceived: 3,
            bytesReceived: 1400,
          }),
        );

        expect(manager.isInboundVideoStalled).toBe(false);
      });

      it('должен возвращать false когда перестают приходить только пакеты', () => {
        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 1,
            framesDecoded: 1,
            packetsReceived: 1,
            bytesReceived: 1000,
          }),
        );

        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 2,
            framesDecoded: 2,
            packetsReceived: 2,
            bytesReceived: 1200,
          }),
        );

        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 2,
            framesDecoded: 2,
            packetsReceived: 2,
            bytesReceived: 1300,
          }),
        );

        expect(manager.isInboundVideoStalled).toBe(false);
      });

      it('должен возвращать false когда перестают приходить только байты', () => {
        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 1,
            framesDecoded: 1,
            packetsReceived: 1,
            bytesReceived: 1000,
          }),
        );

        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 2,
            framesDecoded: 2,
            packetsReceived: 2,
            bytesReceived: 1200,
          }),
        );

        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 3,
            framesDecoded: 3,
            packetsReceived: 3,
            bytesReceived: 1200,
          }),
        );

        expect(manager.isInboundVideoStalled).toBe(false);
      });
    });

    describe('isNoInboundVideoTraffic', () => {
      it('должен возвращать true когда inbound video не получает пакеты и байты', () => {
        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 0,
            framesDecoded: 0,
            packetsReceived: 0,
            bytesReceived: 0,
          }),
        );

        expect(manager.isNoInboundVideoTraffic).toBe(true);
      });

      it('должен возвращать false когда inbound video получает пакеты или байты', () => {
        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 0,
            framesDecoded: 0,
            packetsReceived: 1,
            bytesReceived: 0,
          }),
        );

        expect(manager.isNoInboundVideoTraffic).toBe(false);

        manager.statsPeerConnection.events.trigger(
          'collected',
          createStatsWithInboundRtp({
            framesReceived: 0,
            framesDecoded: 0,
            packetsReceived: 0,
            bytesReceived: 1,
          }),
        );

        expect(manager.isNoInboundVideoTraffic).toBe(false);
      });
    });
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
      const contentedStreamManager = new ContentedStreamManager();
      const callManager = new CallManager({ contentedStreamManager }, tools);
      const apiManager = new ApiManager();
      const manager = new StatsManager({ callManager, apiManager });

      expect(manager.hasAvailableIncomingBitrateChangedQuarter()).toBe(false);

      // после одного collected предыдущее еще undefined
      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));
      expect(manager.hasAvailableIncomingBitrateChangedQuarter()).toBe(false);
    });

    it('возвращает false, если изменение меньше 25%', () => {
      const contentedStreamManager = new ContentedStreamManager();
      const callManager = new CallManager({ contentedStreamManager }, tools);
      const apiManager = new ApiManager();
      const manager = new StatsManager({ callManager, apiManager });

      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));
      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base * 1.24));

      expect(manager.hasAvailableIncomingBitrateChangedQuarter()).toBe(false);
    });

    it('возвращает true, если изменение равно или больше 25% (рост)', () => {
      const contentedStreamManager = new ContentedStreamManager();
      const callManager = new CallManager({ contentedStreamManager }, tools);
      const apiManager = new ApiManager();
      const manager = new StatsManager({ callManager, apiManager });

      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));
      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base * 1.25));

      expect(manager.hasAvailableIncomingBitrateChangedQuarter()).toBe(true);
    });

    it('возвращает true, если изменение равно или больше 25% (падение)', () => {
      const contentedStreamManager = new ContentedStreamManager();
      const callManager = new CallManager({ contentedStreamManager }, tools);
      const apiManager = new ApiManager();
      const manager = new StatsManager({ callManager, apiManager });

      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));
      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base * 0.74));

      expect(manager.hasAvailableIncomingBitrateChangedQuarter()).toBe(true);
    });

    it('если предыдущее 0 и текущее > 0 — возвращает true', () => {
      const contentedStreamManager = new ContentedStreamManager();
      const callManager = new CallManager({ contentedStreamManager }, tools);
      const apiManager = new ApiManager();
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
      mcuDebugLogger.mockClear();
    });

    it('не отправляет stats на первом collected (нет previous)', () => {
      const contentedStreamManager = new ContentedStreamManager();
      const callManager = new CallManager({ contentedStreamManager }, tools);
      const apiManager = {
        sendStats: jest.fn().mockResolvedValue(undefined),
      } as unknown as ApiManager;
      const manager = new StatsManager({ callManager, apiManager });

      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));

      expect(apiManager.sendStats as jest.Mock).not.toHaveBeenCalled();
    });

    it('не отправляет stats если изменение < 25%', () => {
      const contentedStreamManager = new ContentedStreamManager();
      const callManager = new CallManager({ contentedStreamManager }, tools);
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
      const contentedStreamManager = new ContentedStreamManager();
      const callManager = new CallManager({ contentedStreamManager }, tools);
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
      const contentedStreamManager = new ContentedStreamManager();
      const callManager = new CallManager({ contentedStreamManager }, tools);
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
      const contentedStreamManager = new ContentedStreamManager();
      const callManager = new CallManager({ contentedStreamManager }, tools);
      const error = new Error('boom');
      const apiManager = { sendStats: jest.fn().mockRejectedValue(error) } as unknown as ApiManager;
      const manager = new StatsManager({ callManager, apiManager });

      const base = statisticsMockBase.inbound.additional.candidatePair.availableIncomingBitrate;

      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base));
      manager.statsPeerConnection.events.trigger('collected', cloneStatsWithBitrate(base * 1.25));

      await delayPromise(0);

      expect(mcuDebugLogger).toHaveBeenCalledWith('Failed to send stats', error);
    });
  });
});
