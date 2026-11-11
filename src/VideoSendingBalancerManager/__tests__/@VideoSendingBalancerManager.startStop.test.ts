import { createManagers } from '@/__fixtures__/createManagers';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import resolveDebug from '@/logger';
import {
  createBalancerOptions,
  NO_MAX_RESOLUTION_BALANCER_OPTIONS,
} from '@/VideoSendingBalancer/__fixtures__';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';
import {
  BALANCING_START_DELAY,
  confirmCall,
  createObservedSender,
  createVideoTrack,
  deferNextGetStats,
  ENCODING_4K_BY_TRACK,
  ENCODING_4K_LIMITED_TO_720P,
  HEADERS_MAX_720P,
  HEADERS_PAUSE,
  sendMainCamInfo,
  setConnection,
  settle,
  TRACK_SIZE_POLLING_WINDOW,
} from '../__fixtures__';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { IBalancerOptions } from '@/VideoSendingBalancer/types';
import type { TObservedSender } from '../__fixtures__';

jest.mock('@/logger');

const { mcuDebugLogger } = resolveDebug as jest.Mock & { mcuDebugLogger: jest.Mock };

describe('VideoSendingBalancerManager: остановка во время запуска и перезапуск', () => {
  let callManager: CallManager;
  let apiManager: ApiManager;
  let connection: RTCPeerConnectionMock;
  let manager: VideoSendingBalancerManager;
  let observed: TObservedSender;
  let track720: MediaStreamVideoTrack;
  let track4K: MediaStreamVideoTrack;

  const createManager = (options: IBalancerOptions = NO_MAX_RESOLUTION_BALANCER_OPTIONS) => {
    manager = new VideoSendingBalancerManager(callManager, apiManager, options);
  };

  const confirmCallAndWaitBalancingStart = async () => {
    confirmCall(callManager, connection);
    await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
    await settle();
  };

  beforeEach(() => {
    jest.useFakeTimers();

    ({ callManager, apiManager } = createManagers());

    track720 = createVideoTrack(1280, 720);
    track4K = createVideoTrack(3840, 2160);
    observed = createObservedSender(track720);
    connection = new RTCPeerConnectionMock(undefined, []);
    connection.senders = [observed.sender];

    setConnection(callManager, connection as RTCPeerConnection);
  });

  afterEach(() => {
    manager.stopBalancing();
    jest.useRealTimers();
  });

  describe('остановка во время запуска', () => {
    const changeTrackSizeAndReplaceTrack = async () => {
      jest.spyOn(track720, 'getSettings').mockReturnValue({ width: 640, height: 360 });
      await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);
      await observed.sender.replaceTrack(track4K);
      await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);
    };

    beforeEach(() => {
      createManager(createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }));
    });

    it('не следит за отправителем, если stopBalancing вызван синхронным обработчиком balancing-started', async () => {
      manager.on('balancing-started', () => {
        manager.stopBalancing();
      });
      await Promise.allSettled([manager.startBalancing()]);
      await settle();

      const logLengthAfterStop = observed.log.length;

      await changeTrackSizeAndReplaceTrack();

      expect(manager.isBalancingActive).toBe(false);
      expect(observed.log.slice(logLengthAfterStop)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 1 },
      ]);
    });

    it('отклоняет startBalancing ошибкой обработчика, оставляет балансировку остановленной и не следит за отправителем, если один обработчик balancing-started вызвал stopBalancing, а следующий бросил исключение', async () => {
      const handlerError = new Error('balancing-started handler failed');

      manager.on('balancing-started', () => {
        manager.stopBalancing();
      });
      manager.on('balancing-started', () => {
        throw handlerError;
      });

      const [startResult] = await Promise.allSettled([manager.startBalancing()]);

      await settle();

      const logLengthAfterStop = observed.log.length;

      await changeTrackSizeAndReplaceTrack();

      expect(startResult).toEqual({ status: 'rejected', reason: handlerError });
      expect(manager.isBalancingActive).toBe(false);
      expect(observed.log.slice(logLengthAfterStop)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 1 },
      ]);
    });

    it('не применяет запомненную PAUSE_MAIN_CAM и не следит за отправителем, если stopBalancing вызван, пока первая балансировка старта ждёт кодек', async () => {
      const releaseStats = deferNextGetStats(observed.sender);

      confirmCall(callManager, connection);
      sendMainCamInfo(callManager, HEADERS_PAUSE);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();
      manager.stopBalancing();
      await settle();
      releaseStats();
      await settle();

      const logLengthAfterStop = observed.log.length;

      await changeTrackSizeAndReplaceTrack();

      expect(manager.isBalancingActive).toBe(false);
      expect(observed.log.slice(logLengthAfterStop)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 1 },
      ]);
    });
  });

  describe('момент отправки balancing-started', () => {
    it('отправляет balancing-started после применения запомненной в прогреве MAX 1280x720 к 4K-треку', async () => {
      const encodingsOnBalancingStarted: RTCRtpEncodingParameters[] = [];

      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager();
      manager.on('balancing-started', () => {
        encodingsOnBalancingStarted.push(observed.getAppliedEncoding());
      });
      confirmCall(callManager, connection);
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();

      expect(encodingsOnBalancingStarted).toEqual([ENCODING_4K_LIMITED_TO_720P]);
    });

    it('не отправляет balancing-started, если stopBalancing вызван, пока первая балансировка ждёт кодек', async () => {
      const startedHandler = jest.fn();
      const releaseStats = deferNextGetStats(observed.sender);

      createManager();
      manager.on('balancing-started', startedHandler);

      const starting = manager.startBalancing();

      await settle();
      manager.stopBalancing();
      releaseStats();
      await starting;
      await settle();

      expect(startedHandler).not.toHaveBeenCalled();
      expect(manager.isBalancingActive).toBe(false);
    });
  });

  describe('исключение обработчика balancing-started', () => {
    const handlerError = new Error('balancing-started handler failed');

    const throwOnBalancingStarted = () => {
      manager.on('balancing-started', () => {
        throw handlerError;
      });
    };

    it('отклоняет startBalancing ошибкой обработчика, а балансировка работает: применяет следующую MAX 1280x720 и выставляет scaleResolutionDownBy 3 до оригинального replaceTrack при замене 720p на 4K', async () => {
      createManager();
      throwOnBalancingStarted();

      const [startResult] = await Promise.allSettled([manager.startBalancing()]);

      await settle();
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      await settle();

      const logLengthBeforeReplace = observed.log.length;

      await observed.sender.replaceTrack(track4K);
      await settle();

      expect(startResult).toEqual({ status: 'rejected', reason: handlerError });
      expect(manager.isBalancingActive).toBe(true);
      expect(
        observed.log.slice(logLengthBeforeReplace).filter((entry) => {
          return entry.type === 'replaceTrack';
        }),
      ).toEqual([{ type: 'replaceTrack', appliedScaleResolutionDownBy: 3 }]);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('применяет запомненную в прогреве MAX 1280x720 при старте по таймеру и пишет ошибку обработчика в лог', async () => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager();
      throwOnBalancingStarted();
      confirmCall(callManager, connection);
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      expect(mcuDebugLogger).toHaveBeenCalledWith('startBalancing: error', handlerError);
    });
  });

  describe('перезапуск во время незавершённой балансировки', () => {
    beforeEach(async () => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager();
      await confirmCallAndWaitBalancingStart();
    });

    it.each([
      ['до новой команды', 'releaseStaleStats', 'receiveCommand'],
      ['после новой команды', 'receiveCommand', 'releaseStaleStats'],
    ] as const)(
      'применяет MAX 1280x720, полученную после stopBalancing и startBalancing, если кодек прерванной балансировки получен %s',
      async (_name, firstStep, secondStep) => {
        const steps = {
          releaseStaleStats: deferNextGetStats(observed.sender),
          receiveCommand: () => {
            sendMainCamInfo(callManager, HEADERS_MAX_720P);
          },
        };

        sendMainCamInfo(callManager, HEADERS_PAUSE);
        await settle();
        manager.stopBalancing();

        const starting = manager.startBalancing();

        steps[firstStep]();
        await settle();
        steps[secondStep]();
        await starting;
        await settle();

        expect(manager.isBalancingActive).toBe(true);
        expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      },
    );

    it('не применяет в новом прогреве запомненную MAX 1280x720 и не следит за отправителем, если кодек прерванной балансировки получен после recv-session-started и recv-session-ended', async () => {
      const releaseStaleStats = deferNextGetStats(observed.sender);

      sendMainCamInfo(callManager, HEADERS_PAUSE);
      await settle();
      callManager.events.trigger('recv-session-started', undefined as never);
      callManager.events.trigger('recv-session-ended', undefined as never);

      const logLengthAfterStop = observed.log.length;

      await settle();
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      await settle();
      releaseStaleStats();
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
      expect(manager.isBalancingScheduled).toBe(true);
      expect(manager.isBalancingActive).toBe(false);
      expect(
        observed.log.slice(logLengthAfterStop).filter((entry) => {
          return entry.type === 'setParameters' && entry.scaleResolutionDownBy !== 1;
        }),
      ).toEqual([]);

      const logLengthBeforeReplace = observed.log.length;

      await observed.sender.replaceTrack(createVideoTrack(3840, 2160));
      await settle();

      expect(observed.log.slice(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 1 },
      ]);

      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });
  });
});
