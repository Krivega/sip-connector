import { createManagers } from '@/__fixtures__/createManagers';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import {
  createBalancerOptions,
  NO_MAX_RESOLUTION_BALANCER_OPTIONS,
} from '@/VideoSendingBalancer/__fixtures__';
import { calcMaxBitrateByWidthAndCodec } from '@/VideoSendingBalancer/calcBitrate';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';
import {
  BALANCING_START_DELAY,
  confirmCall,
  createObservedSender,
  createVideoTrack,
  ENCODING_4K_BY_TRACK,
  ENCODING_4K_LIMITED_TO_720P,
  getSettledResult,
  hangGetStats,
  hangNextGetStats,
  HEADERS_MAX_720P,
  HEADERS_PAUSE,
  rejectGetStats,
  sendMainCamInfo,
  setConnection,
  POLL_INTERVAL,
  setSenderCodec,
  settle,
  STATS_TIMEOUT,
  TRACK_SIZE_POLLING_WINDOW,
} from '../__fixtures__';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { IBalancerOptions } from '@/VideoSendingBalancer/types';
import type { TObservedSender } from '../__fixtures__';

const CODEC_VP8 = 'video/VP8';
const CODEC_AV1 = 'video/AV1';
const CODEC_H264 = 'video/H264';

const BALANCER_OPTIONS_IGNORING_H264 = createBalancerOptions({ ignoreForCodec: 'h264' });

describe('VideoSendingBalancerManager: запрос кодека при балансировке и замене трека', () => {
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

  const observeSenderWith = (track: MediaStreamVideoTrack) => {
    observed = createObservedSender(track);
    connection.senders = [observed.sender];
  };

  const confirmCallAndWaitBalancingStart = async () => {
    confirmCall(callManager, connection);
    await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
    await settle();
  };

  const startBalancingWithLimit720p = async () => {
    await confirmCallAndWaitBalancingStart();
    sendMainCamInfo(callManager, HEADERS_MAX_720P);
    await settle();
  };

  const endCall = () => {
    callManager.events.trigger('ended', {
      originator: 'remote',
      cause: 'Terminated',
    } as never);
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
    connection = new RTCPeerConnectionMock(undefined, []);
    observeSenderWith(track720);

    setConnection(callManager, connection as RTCPeerConnection);
  });

  afterEach(() => {
    manager.stopBalancing();
    jest.useRealTimers();
  });

  describe('getStats не отвечает', () => {
    it('заменяет 720p на 4K при scaleResolutionDownBy 3, если getStats первой балансировки старта не отвечает, а MAX 1280x720 получена в прогреве', async () => {
      createManager();
      hangNextGetStats(observed.sender);
      confirmCall(callManager, connection);
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();

      const logLengthBeforeReplace = observed.log.length;
      const result = await getSettledResult(observed.sender.replaceTrack(track4K));

      await settle();

      expect(result).toEqual({ status: 'fulfilled', value: undefined });
      expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
      ]);
      expect(observed.sender.track).toBe(track4K);

      // после таймаута ожидания зависшего запроса ближайший тик сверки запрашивает статистику заново и выставляет битрейт
      await jest.advanceTimersByTimeAsync(STATS_TIMEOUT + POLL_INTERVAL);

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('применяет MAX 1280x720, если getStats балансировки предыдущей команды PAUSE_MAIN_CAM не отвечает', async () => {
      observeSenderWith(track4K);
      createManager();
      await confirmCallAndWaitBalancingStart();
      hangNextGetStats(observed.sender);
      sendMainCamInfo(callManager, HEADERS_PAUSE);
      await settle();
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      // балансировка команды ждёт идущий запрос предыдущей, но не дольше таймаута
      await jest.advanceTimersByTimeAsync(STATS_TIMEOUT);

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('применяет запомненную в прогреве MAX 1280x720 в следующем звонке, если getStats старта в предыдущем звонке не ответил', async () => {
      observeSenderWith(track4K);
      createManager();
      hangNextGetStats(observed.sender);
      await confirmCallAndWaitBalancingStart();
      endCall();
      await settle();
      confirmCall(callManager, connection);
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    describe('после применённой MAX 1280x720', () => {
      beforeEach(async () => {
        createManager();
        await startBalancingWithLimit720p();
        hangGetStats(observed.sender);
      });

      it('заменяет 720p на 4K при scaleResolutionDownBy 3', async () => {
        const logLengthBeforeReplace = observed.log.length;
        const result = await getSettledResult(observed.sender.replaceTrack(track4K));

        await settle();

        expect(result).toEqual({ status: 'fulfilled', value: undefined });
        expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
          { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
        ]);
        expect(observed.sender.track).toBe(track4K);
        expect(observed.getAppliedEncoding().scaleResolutionDownBy).toBe(3);
      });

      it('отклоняет замену 720p на 4K ошибкой оригинального replaceTrack и возвращает scaleResolutionDownBy 1 оставшемуся треку', async () => {
        const replaceTrackError = new Error('replaceTrack failed');

        observed.rejectNextReplaceTrack(replaceTrackError);

        const result = await getSettledResult(observed.sender.replaceTrack(track4K));

        await settle();

        expect(result).toEqual({ status: 'rejected', reason: replaceTrackError });
        expect(observed.sender.track).toBe(track720);
        expect(observed.getAppliedEncoding().scaleResolutionDownBy).toBe(1);
      });
    });
  });

  describe('остановка балансировки, когда getStats не отвечает или отклонён', () => {
    const GET_STATS_FAILURES: [string, (sender: RTCRtpSender) => void][] = [
      ['не отвечает', hangGetStats],
      ['отклонён', rejectGetStats],
    ];

    beforeEach(async () => {
      observeSenderWith(track4K);
      createManager();
      await confirmCallAndWaitBalancingStart();
      sendMainCamInfo(callManager, HEADERS_PAUSE);
      await settle();
    });

    it.each(GET_STATS_FAILURES)(
      'возвращает 4K-треку параметры по треку вместо PAUSE_MAIN_CAM после recv-session-started, если getStats %s',
      async (_name, breakGetStats) => {
        breakGetStats(observed.sender);
        callManager.events.trigger('recv-session-started', undefined as never);
        await settle();

        expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
      },
    );

    it.each(GET_STATS_FAILURES)(
      'возвращает 4K-треку параметры по треку вместо PAUSE_MAIN_CAM во время нового прогрева, если getStats %s, а сразу за recv-session-started получен recv-session-ended',
      async (_name, breakGetStats) => {
        breakGetStats(observed.sender);
        callManager.events.trigger('recv-session-started', undefined as never);
        callManager.events.trigger('recv-session-ended', undefined as never);
        await settle();

        expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
        expect(manager.isBalancingScheduled).toBe(true);
        expect(manager.isBalancingActive).toBe(false);
      },
    );
  });

  describe('исключение по кодеку: ignoreForCodec h264', () => {
    beforeEach(() => {
      createManager(BALANCER_OPTIONS_IGNORING_H264);
    });

    it('при кодеке VP8 выставляет scaleResolutionDownBy 3 до оригинального replaceTrack при замене 720p на 4K', async () => {
      setSenderCodec(observed.sender, CODEC_VP8);
      await startBalancingWithLimit720p();

      const logLengthBeforeReplace = observed.log.length;
      const result = await getSettledResult(observed.sender.replaceTrack(track4K));

      await settle();

      expect(result).toEqual({ status: 'fulfilled', value: undefined });
      expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
      ]);
      expect(observed.getAppliedEncoding()).toEqual({
        scaleResolutionDownBy: 3,
        maxBitrate: calcMaxBitrateByWidthAndCodec(1280, CODEC_VP8),
      });
    });

    it('заменяет 720p на 4K без изменения параметров, если кодек ещё не получен: getStats не отвечает с первой балансировки старта', async () => {
      hangGetStats(observed.sender);
      await startBalancingWithLimit720p();

      const logLengthBeforeReplace = observed.log.length;
      const result = await getSettledResult(observed.sender.replaceTrack(track4K));

      await settle();

      expect(result).toEqual({ status: 'fulfilled', value: undefined });
      expect(observed.sender.track).toBe(track4K);
      expect(observed.log.slice(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 1 },
      ]);
    });

    it('при кодеке H264 не меняет параметры ни до, ни после замены 720p на 4K', async () => {
      setSenderCodec(observed.sender, CODEC_H264);
      await startBalancingWithLimit720p();
      await observed.sender.replaceTrack(track4K);
      await settle();

      expect(observed.sender.track).toBe(track4K);
      expect(observed.log).toEqual([{ type: 'replaceTrack', appliedScaleResolutionDownBy: 1 }]);
    });
  });

  describe('кодек AV1', () => {
    it('после ошибки оригинального replaceTrack оставляет треку 720p scaleResolutionDownBy 1 и битрейт AV1', async () => {
      const replaceTrackError = new Error('replaceTrack failed');

      setSenderCodec(observed.sender, CODEC_AV1);
      createManager();
      await startBalancingWithLimit720p();
      observed.rejectNextReplaceTrack(replaceTrackError);

      const result = await getSettledResult(observed.sender.replaceTrack(track4K));

      await settle();

      expect(result).toEqual({ status: 'rejected', reason: replaceTrackError });
      expect(observed.sender.track).toBe(track720);
      expect(observed.getAppliedEncoding()).toEqual({
        scaleResolutionDownBy: 1,
        maxBitrate: calcMaxBitrateByWidthAndCodec(1280, CODEC_AV1),
      });
    });
  });

  describe('ошибка getStats', () => {
    it('отклоняет ручной balance() ошибкой getStats при активной балансировке', async () => {
      const getStatsError = new Error('getStats failed');

      createManager();
      await confirmCallAndWaitBalancingStart();
      jest.spyOn(observed.sender, 'getStats').mockRejectedValueOnce(getStatsError);

      await expect(manager.balance()).rejects.toBe(getStatsError);
    });

    it('применяет MAX 1280x720 к 4K-треку без повторной команды, если getStats её балансировки отклонён', async () => {
      observeSenderWith(track4K);
      createManager();
      await confirmCallAndWaitBalancingStart();
      jest.spyOn(observed.sender, 'getStats').mockRejectedValueOnce(new Error('getStats failed'));
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      await settle();
      await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });
  });
});
