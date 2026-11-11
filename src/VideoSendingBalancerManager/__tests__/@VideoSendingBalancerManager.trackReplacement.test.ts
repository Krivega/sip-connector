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
  ENCODING_4K_LIMITED_TO_720P,
  ENCODING_720P_BY_TRACK,
  ENCODING_PAUSED,
  HEADERS_MAX_720P,
  HEADERS_PAUSE,
  sendMainCamInfo,
  setConnection,
  settle,
} from '../__fixtures__';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { IBalancerOptions } from '@/VideoSendingBalancer/types';
import type { TObservedSender } from '../__fixtures__';

// eslint-disable-next-line unicorn/no-null
const NO_TRACK = null;

describe('VideoSendingBalancerManager: замена трека при гонках и ошибках', () => {
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

  const sendMaxResolution720p = () => {
    sendMainCamInfo(callManager, HEADERS_MAX_720P);
  };

  const getReplaceTrackEntries = (logLengthBeforeReplace: number) => {
    return observed.log.slice(logLengthBeforeReplace).filter((entry) => {
      return entry.type === 'replaceTrack';
    });
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

  describe('ошибка setParameters при подготовке замены', () => {
    it('заменяет 720p на 4K и ограничивает новый трек после замены, если при ограничении 1280x720 setParameters перед заменой отклонён', async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();
      sendMaxResolution720p();
      await settle();
      observed.rejectNextSetParameters(new Error('setParameters failed'));

      const logLengthBeforeReplace = observed.log.length;
      const [result] = await Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();

      expect(result).toEqual({ status: 'fulfilled', value: undefined });
      expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 1 },
      ]);
      expect(observed.sender.track).toBe(track4K);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });
  });

  describe('ошибка подписчика parameters-updated при подготовке замены', () => {
    it('заменяет 720p на 4K и сохраняет ограничение 1280x720, если подписчик бросил исключение после применения параметров перед заменой', async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();
      sendMaxResolution720p();
      await settle();
      manager.once('parameters-updated', () => {
        throw new Error('parameters-updated subscriber failed');
      });

      const logLengthBeforeReplace = observed.log.length;
      const [result] = await Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();

      expect(result).toEqual({ status: 'fulfilled', value: undefined });
      expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
      ]);
      expect(observed.sender.track).toBe(track4K);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });
  });

  describe('замена во время незавершённой балансировки', () => {
    it('применяет PAUSE_MAIN_CAM до оригинального replaceTrack, если замена 720p на 4K вызвана, пока балансировка команды ждёт кодек', async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();

      const releaseStats = deferNextGetStats(observed.sender);

      sendMainCamInfo(callManager, HEADERS_PAUSE);
      await settle();

      const logLengthBeforeReplace = observed.log.length;
      const replacing = observed.sender.replaceTrack(track4K);

      await settle();
      releaseStats();
      await replacing;
      await settle();

      expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 200 },
      ]);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_PAUSED);
    });

    it.each([
      ['получена в прогреве', sendMaxResolution720p, () => {}],
      ['получена после истечения прогрева', () => {}, sendMaxResolution720p],
    ])(
      'выставляет scaleResolutionDownBy 3 до оригинального replaceTrack, если замена 720p на 4K вызвана, пока первая балансировка старта ждёт кодек, а MAX 1280x720 %s',
      async (_name, receiveCommandInWarmup, receiveCommandAfterStart) => {
        createManager();

        const releaseStats = deferNextGetStats(observed.sender);

        confirmCall(callManager, connection);
        receiveCommandInWarmup();
        await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
        await settle();
        receiveCommandAfterStart();

        const logLengthBeforeReplace = observed.log.length;
        const replacing = observed.sender.replaceTrack(track4K);

        await settle();
        releaseStats();
        await replacing;
        await settle();

        expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
          { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
        ]);
        expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      },
    );
  });

  describe('ошибка оригинального replaceTrack при ограничении 1280x720', () => {
    const replaceTrackError = new Error('replaceTrack failed');

    beforeEach(async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();
      sendMaxResolution720p();
      await settle();
      observed.rejectNextReplaceTrack(replaceTrackError);
    });

    it('отклоняет замену 720p на 4K той же ошибкой и восстанавливает параметры оставшегося трека 720p', async () => {
      await expect(observed.sender.replaceTrack(track4K)).rejects.toBe(replaceTrackError);
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_720P_BY_TRACK);
      expect(observed.sender.track).toBe(track720);
    });

    it('отклоняет замену 720p на 4K ошибкой оригинального replaceTrack и оставляет параметры трека 720p, если перед этим отклонён и setParameters подготовки', async () => {
      observed.rejectNextSetParameters(new Error('setParameters failed'));

      const [result] = await Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();

      expect(result).toEqual({ status: 'rejected', reason: replaceTrackError });
      expect(observed.sender.track).toBe(track720);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_720P_BY_TRACK);
    });

    it('выставляет scaleResolutionDownBy 3 до оригинального replaceTrack при следующей замене на 4K после неудачной', async () => {
      await Promise.allSettled([observed.sender.replaceTrack(track4K)]);
      await settle();

      const logLengthBeforeReplace = observed.log.length;

      await observed.sender.replaceTrack(track4K);
      await settle();

      expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
      ]);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      expect(observed.sender.track).toBe(track4K);
    });
  });

  describe('замена через пустой трек', () => {
    it('ограничивает 4K-трек до 1280x720 после замены, если перед этим трек 720p заменён на пустой через replaceTrack(null)', async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();
      sendMaxResolution720p();
      await settle();
      await observed.sender.replaceTrack(NO_TRACK);
      await settle();
      await observed.sender.replaceTrack(track4K);
      await settle();

      expect(observed.sender.track).toBe(track4K);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });
  });

  describe('остановка балансировки во время замены', () => {
    it('восстанавливает параметры оставшегося трека 720p, если stopBalancing вызван во время замены на 4K, а оригинальный replaceTrack затем отклонён', async () => {
      createManager(createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }));
      await confirmCallAndWaitBalancingStart();

      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();
      manager.stopBalancing();
      await settle();
      originalReplacement.reject(new Error('replaceTrack failed'));
      await replacing;
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_720P_BY_TRACK);
      expect(observed.sender.track).toBe(track720);
    });
  });
});
