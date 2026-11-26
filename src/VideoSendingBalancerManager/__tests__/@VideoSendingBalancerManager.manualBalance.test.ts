import { createManagers } from '@/__fixtures__/createManagers';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
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
  ENCODING_4K_LIMITED_TO_1080P,
  ENCODING_4K_LIMITED_TO_720P,
  getSettledResult,
  HEADERS_MAX_720P,
  sendMainCamInfo,
  setConnection,
  settle,
  TRACK_SIZE_POLLING_WINDOW,
} from '../__fixtures__';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { TResolutionSize } from '@/types';
import type { IBalancerOptions } from '@/VideoSendingBalancer/types';
import type { TObservedSender } from '../__fixtures__';

describe('VideoSendingBalancerManager: ручной balance()', () => {
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

  describe('при активной балансировке', () => {
    let maxResolution: TResolutionSize | undefined;

    beforeEach(async () => {
      maxResolution = undefined;
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager({
        getMaxResolution: () => {
          return maxResolution;
        },
      });
      await confirmCallAndWaitBalancingStart();
    });

    it('отклоняется ошибкой setParameters и оставляет балансировку активной', async () => {
      const setParametersError = new Error('setParameters failed');

      maxResolution = { width: 1920, height: 1080 };
      observed.rejectNextSetParameters(setParametersError);

      await expect(manager.balance()).rejects.toBe(setParametersError);
      expect(manager.isBalancingActive).toBe(true);
    });

    it('ограничивает 4K-трек до maxAvailableResolution 1920x1080, если перед этим получен recv-session-ended без recv-session-started', async () => {
      callManager.events.trigger('recv-session-ended', undefined as never);
      await settle();
      maxResolution = { width: 1920, height: 1080 };

      const result = await manager.balance();

      await settle();

      expect(result.isChanged).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_1080P);
      expect(manager.isBalancingActive).toBe(true);
    });
  });

  describe('во время прогрева', () => {
    const MAX_RESOLUTION_1080P = { width: 1920, height: 1080 };

    // способы оказаться в прогреве: ожидание старта по таймеру и прогрев, оставшийся после неудачного старта без connection
    const WARMUP_ENTRIES: [string, () => Promise<void>][] = [
      [
        'после peerconnection:confirmed',
        async () => {
          confirmCall(callManager, connection);
        },
      ],
      [
        'после recv-session-ended',
        async () => {
          callManager.events.trigger('recv-session-ended', undefined as never);
        },
      ],
      [
        'после неудачного старта по таймеру без connection',
        async () => {
          setConnection(callManager, undefined);
          confirmCall(callManager, connection);
          await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
          await settle();
          setConnection(callManager, connection as RTCPeerConnection);
        },
      ],
    ];

    it.each(WARMUP_ENTRIES)(
      'применяет параметры по треку и maxAvailableResolution без запомненной команды и возвращает isChanged true, если прогрев начат %s',
      async (_name, enterWarmup) => {
        observed = createObservedSender(track4K);
        connection.senders = [observed.sender];
        createManager(createBalancerOptions({ maxResolution: MAX_RESOLUTION_1080P }));
        await enterWarmup();
        sendMainCamInfo(callManager, HEADERS_MAX_720P);
        await settle();

        const result = await manager.balance();

        await settle();

        expect(result.isChanged).toBe(true);
        expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_1080P);
        expect(manager.isBalancingActive).toBe(false);
      },
    );

    it('отклоняется ошибкой без connection и не отменяет запланированный старт: после появления connection старт по таймеру применяет запомненную команду', async () => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager();
      setConnection(callManager, undefined);
      confirmCall(callManager, connection);
      sendMainCamInfo(callManager, HEADERS_MAX_720P);

      await expect(manager.balance()).rejects.toThrow('connection is not exist');
      expect(manager.isBalancingScheduled).toBe(true);
      expect(manager.isBalancingActive).toBe(false);

      setConnection(callManager, connection as RTCPeerConnection);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('ужесточает параметры 4K-трека до scaleResolutionDownBy 2 при maxAvailableResolution 1920x1080: правило «в прогреве только ослабление» на ручной balance() не распространяется', async () => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager(createBalancerOptions({ maxResolution: MAX_RESOLUTION_1080P }));
      confirmCall(callManager, connection);
      await manager.balance();
      await settle();

      expect(observed.log).toEqual([{ type: 'setParameters', scaleResolutionDownBy: 2 }]);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_1080P);
      expect(manager.isBalancingScheduled).toBe(true);
    });

    it('применяет параметры один раз и не включает сверку по тику: изменение размера трека до старта по таймеру не меняет параметры', async () => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager(createBalancerOptions({ maxResolution: MAX_RESOLUTION_1080P }));
      confirmCall(callManager, connection);
      await manager.balance();
      await settle();
      jest.spyOn(track4K, 'getSettings').mockReturnValue({ width: 1280, height: 720 });
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY - 1);

      expect(manager.isBalancingActive).toBe(false);
      expect(observed.log).toEqual([{ type: 'setParameters', scaleResolutionDownBy: 2 }]);
    });

    it('не включает слежение за отправителем и не отменяет запланированный старт: после старта по таймеру применяется запомненная команда', async () => {
      createManager();
      confirmCall(callManager, connection);
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      await manager.balance();
      await settle();
      await observed.sender.replaceTrack(track4K);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY / 2);

      expect(manager.isBalancingActive).toBe(false);
      expect(manager.isBalancingScheduled).toBe(true);
      expect(observed.log).toEqual([
        { type: 'setParameters', scaleResolutionDownBy: 1 },
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 1 },
      ]);

      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY / 2);
      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('не меняет параметры 4K-трека до конца прогрева при maxAvailableResolution 1920x1080, если balance() вызван до peerconnection:confirmed, а отложенный getStats отправителя ответил уже во время прогрева', async () => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager(createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }));

      const releaseStats = deferNextGetStats(observed.sender);

      manager.balance().catch(() => {});
      await settle();
      confirmCall(callManager, connection);
      await settle();
      releaseStats();
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY - 1);

      expect(observed.log).toEqual([]);
      expect(manager.isBalancingScheduled).toBe(true);
    });
  });

  describe('вне прогрева и активной балансировки', () => {
    it.each([
      ['балансировка не запускалась', async () => {}],
      [
        'балансировка остановлена через stopBalancing',
        async () => {
          await confirmCallAndWaitBalancingStart();
          manager.stopBalancing();
          await settle();
        },
      ],
    ])(
      'применяет параметры один раз и не включает слежение за отправителем, если %s',
      async (_name, prepareIdleManager) => {
        createManager(createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }));
        await prepareIdleManager();
        await observed.sender.replaceTrack(track4K);
        await settle();

        const logLengthBeforeBalance = observed.log.length;

        await manager.balance();
        await settle();
        jest.spyOn(track4K, 'getSettings').mockReturnValue({ width: 1280, height: 720 });
        await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);
        await observed.sender.replaceTrack(track720);
        await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

        expect(manager.isBalancingActive).toBe(false);
        expect(manager.isBalancingScheduled).toBe(false);
        expect(observed.log.slice(logLengthBeforeBalance)).toEqual([
          { type: 'setParameters', scaleResolutionDownBy: 2 },
          { type: 'replaceTrack', appliedScaleResolutionDownBy: 2 },
        ]);
        expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_1080P);
      },
    );

    // фиксирует текущее поведение: решение по нему ещё не принято
    it('не задерживает замену трека до завершения setParameters ручного balance(), если балансировка не запускалась (текущее поведение)', async () => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager(createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }));
      observed.hangNextSetParameters();

      const balancing = manager.balance();

      expect(await getSettledResult(balancing)).toEqual({ status: 'pending' });
      expect(await getSettledResult(observed.sender.replaceTrack(track720))).toEqual({
        status: 'fulfilled',
        value: undefined,
      });
      expect(observed.sender.track).toBe(track720);
    });
  });
});
