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
  ENCODING_PAUSED,
  getSettledResult,
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

  describe('запуск без соединения', () => {
    const startBalancingWithoutConnection = async () => {
      setConnection(callManager, undefined);
      await Promise.allSettled([manager.startBalancing()]);
      setConnection(callManager, connection as RTCPeerConnection);
    };

    it('оставляет балансировку неактивной и не отправляет balancing-started, если startBalancing вызван без соединения', async () => {
      const startedHandler = jest.fn();

      createManager();
      manager.on('balancing-started', startedHandler);
      await startBalancingWithoutConnection();

      expect(manager.isBalancingActive).toBe(false);
      expect(startedHandler).not.toHaveBeenCalled();
    });

    // фиксирует текущее поведение: решение по нему ещё не принято
    it('не снимает запланированный старт по таймеру, если startBalancing вызван без соединения во время прогрева (текущее поведение)', async () => {
      const startedHandler = jest.fn();

      createManager();
      manager.on('balancing-started', startedHandler);
      confirmCall(callManager, connection);
      await startBalancingWithoutConnection();

      expect(manager.isBalancingScheduled).toBe(true);
      expect(manager.isBalancingActive).toBe(false);

      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(startedHandler).toHaveBeenCalledTimes(1);
    });

    it('не балансирует по тику отправителя соединения, появившегося после startBalancing без соединения', async () => {
      createManager(createBalancerOptions({ maxResolution: { width: 640, height: 360 } }));
      await startBalancingWithoutConnection();
      await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

      expect(observed.log).toEqual([]);
    });

    it('не ужесточает параметры 1920x1080 по MAX 1280x720 до конца прогрева после peerconnection:confirmed, если перед ним startBalancing вызван без соединения, и применяет её после прогрева', async () => {
      observed = createObservedSender(createVideoTrack(1920, 1080));
      connection.senders = [observed.sender];
      createManager();
      await startBalancingWithoutConnection();
      confirmCall(callManager, connection);
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY - 1);

      expect(
        observed.log.filter((entry) => {
          return entry.type === 'setParameters' && entry.scaleResolutionDownBy !== 1;
        }),
      ).toEqual([]);

      await jest.advanceTimersByTimeAsync(1);
      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding().scaleResolutionDownBy).toBe(1.5);
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

    it('отправляет balancing-started один раз, если кодек первой балансировки прерванного запуска получен после stopBalancing и нового startBalancing', async () => {
      const startedHandler = jest.fn();
      const releaseStats = deferNextGetStats(observed.sender);

      createManager();
      manager.on('balancing-started', startedHandler);

      const interruptedStarting = manager.startBalancing();

      await settle();
      manager.stopBalancing();

      // новый запуск ждёт тот же запрос статистики, что и прерванный
      const restarting = manager.startBalancing();

      releaseStats();
      await Promise.all([interruptedStarting, restarting]);
      await settle();

      expect(startedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('повторный startBalancing во время запуска', () => {
    // фиксирует текущее поведение: решение по нему ещё не принято
    it('завершает второй startBalancing сразу, не запуская балансировку повторно, и отправляет balancing-started один раз, если второй вызов пришёл, пока первая балансировка старта ждёт кодек (текущее поведение)', async () => {
      const startedHandler = jest.fn();
      const releaseStats = deferNextGetStats(observed.sender);

      createManager();
      manager.on('balancing-started', startedHandler);

      const starting = manager.startBalancing();

      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(await getSettledResult(manager.startBalancing())).toEqual({
        status: 'fulfilled',
        value: undefined,
      });
      expect(startedHandler).not.toHaveBeenCalled();

      releaseStats();
      await starting;
      await settle();

      expect(startedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopBalancing сразу после первой балансировки старта', () => {
    const MICROTASK_SHIFTS = Array.from({ length: 20 }, (_, shift) => {
      return shift;
    });
    const LAST_MICROTASK_SHIFT = MICROTASK_SHIFTS.length - 1;

    let events: string[];

    const waitMicrotasks = async (count: number) => {
      for (let step = 0; step < count; step += 1) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
      }
    };

    beforeEach(() => {
      events = [];
      createManager();
      manager.on('balancing-started', () => {
        events.push('balancing-started');
      });
      manager.on('balancing-stopped', () => {
        events.push('balancing-stopped');
      });
    });

    it.each(MICROTASK_SHIFTS)(
      'не отправляет balancing-started после balancing-stopped, если stopBalancing вызван со сдвигом %i (в микрозадачах) после parameters-updated первой балансировки старта',
      async (shift) => {
        const firstParametersUpdated = manager.wait('parameters-updated');
        const starting = manager.startBalancing();

        await firstParametersUpdated;
        await waitMicrotasks(shift);
        manager.stopBalancing();
        await starting;
        await settle();

        expect(events.slice(events.indexOf('balancing-stopped'))).toEqual(['balancing-stopped']);
      },
    );

    it.each(MICROTASK_SHIFTS)(
      'отправляет после balancing-stopped ровно один balancing-started, если stopBalancing и сразу за ним startBalancing вызваны со сдвигом %i (в микрозадачах) после parameters-updated первой балансировки старта',
      async (shift) => {
        const firstParametersUpdated = manager.wait('parameters-updated');
        const starting = manager.startBalancing();

        await firstParametersUpdated;
        await waitMicrotasks(shift);
        manager.stopBalancing();

        const restarting = manager.startBalancing();

        await Promise.all([starting, restarting]);
        await settle();

        expect(events.slice(events.indexOf('balancing-stopped'))).toEqual([
          'balancing-stopped',
          'balancing-started',
        ]);
      },
    );

    it.each([
      [0, ['balancing-stopped']],
      [LAST_MICROTASK_SHIFT, ['balancing-started', 'balancing-stopped']],
    ])(
      'перебор сдвигов охватывает обе стороны отправки balancing-started: при stopBalancing со сдвигом %i (в микрозадачах) после parameters-updated события — %j',
      async (shift, expectedEvents) => {
        const firstParametersUpdated = manager.wait('parameters-updated');
        const starting = manager.startBalancing();

        await firstParametersUpdated;
        await waitMicrotasks(shift);
        manager.stopBalancing();
        await starting;
        await settle();

        expect(events).toEqual(expectedEvents);
      },
    );
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

  describe('исключение подписчика parameters-updated', () => {
    it('применяет запомненную в прогреве MAX 1280x720 и отправляет balancing-started при старте по таймеру, если подписчик parameters-updated бросает исключение', async () => {
      const startedHandler = jest.fn();

      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager();
      manager.on('parameters-updated', () => {
        throw new Error('parameters-updated subscriber failed');
      });
      manager.on('balancing-started', startedHandler);
      confirmCall(callManager, connection);
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      expect(startedHandler).toHaveBeenCalledTimes(1);
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

  describe('setParameters балансировки прежнего запуска завершён при новом запуске', () => {
    beforeEach(async () => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager();
      await confirmCallAndWaitBalancingStart();
    });

    it('применяет запомненную в новом прогреве MAX 1280x720 повтором без новой команды, если setParameters балансировки PAUSE_MAIN_CAM прежнего запуска завершён после старта нового, getStats первой балансировки которого отклонён, а setParameters сброса остановки отклонён', async () => {
      const staleSetParameters = observed.deferNextSetParameters();

      observed.rejectNextSetParameters(new Error('setParameters failed'));
      sendMainCamInfo(callManager, HEADERS_PAUSE);
      await settle();
      callManager.events.trigger('recv-session-started', undefined as never);
      callManager.events.trigger('recv-session-ended', undefined as never);
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      jest.spyOn(observed.sender, 'getStats').mockRejectedValueOnce(new Error('getStats failed'));
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();
      staleSetParameters.resolve(undefined);
      await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('возвращает 4K-треку параметры по треку повтором без новой команды, если setParameters балансировки PAUSE_MAIN_CAM прежнего запуска завершён после stopBalancing без connection и startBalancing, getStats первой балансировки которого отклонён', async () => {
      const staleSetParameters = observed.deferNextSetParameters();

      sendMainCamInfo(callManager, HEADERS_PAUSE);
      await settle();
      setConnection(callManager, undefined);
      manager.stopBalancing();
      setConnection(callManager, connection as RTCPeerConnection);
      jest.spyOn(observed.sender, 'getStats').mockRejectedValueOnce(new Error('getStats failed'));

      const starting = Promise.allSettled([manager.startBalancing()]);

      await settle();
      staleSetParameters.resolve(undefined);
      await starting;
      await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
    });
  });

  describe('новый прогрев во время незавершённых операций', () => {
    beforeEach(async () => {
      createManager(createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }));
      await confirmCallAndWaitBalancingStart();
    });

    it('не меняет параметры в новом прогреве при maxAvailableResolution 1920x1080, если кодек прерванной балансировки получен после recv-session-started, recv-session-ended и замены 720p на 4K', async () => {
      const releaseStaleStats = deferNextGetStats(observed.sender);

      sendMainCamInfo(callManager, HEADERS_PAUSE);
      await settle();
      callManager.events.trigger('recv-session-started', undefined as never);
      callManager.events.trigger('recv-session-ended', undefined as never);
      await settle();
      await observed.sender.replaceTrack(track4K);
      await settle();

      const logLengthAfterReplace = observed.log.length;

      releaseStaleStats();
      await settle();

      expect(observed.log.slice(logLengthAfterReplace)).toEqual([]);
      expect(manager.isBalancingScheduled).toBe(true);
    });

    it('не ужесточает параметры до конца нового прогрева при maxAvailableResolution 1920x1080, если отложенный getStats отправителя ответил после recv-session-started, recv-session-ended и замены 720p на 4K', async () => {
      const releaseStats = deferNextGetStats(observed.sender);

      callManager.events.trigger('recv-session-started', undefined as never);
      callManager.events.trigger('recv-session-ended', undefined as never);
      await settle();
      await observed.sender.replaceTrack(track4K);
      await settle();

      const logLengthAfterReplace = observed.log.length;

      releaseStats();
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY - 1);

      expect(
        observed.log.slice(logLengthAfterReplace).filter((entry) => {
          return entry.type === 'setParameters' && entry.scaleResolutionDownBy !== 1;
        }),
      ).toEqual([]);
      expect(manager.isBalancingScheduled).toBe(true);
      expect(manager.isBalancingActive).toBe(false);
    });

    it('применяет PAUSE_MAIN_CAM и оставляет балансировку активной, если recv-session-ended получен без recv-session-started при активной балансировке, пока балансировка команды ждёт кодек', async () => {
      const releaseStats = deferNextGetStats(observed.sender);

      sendMainCamInfo(callManager, HEADERS_PAUSE);
      await settle();
      callManager.events.trigger('recv-session-ended', undefined as never);
      await settle();
      releaseStats();
      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_PAUSED);
    });
  });
});
