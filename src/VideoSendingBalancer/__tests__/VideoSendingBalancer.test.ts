import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { EContentMainCAM } from '@/ApiManager';
import resolveDebug from '@/logger';
import VideoSendingBalancer from '../@VideoSendingBalancer';
import {
  createBalancerOptions,
  createVideoTrack,
  deferNextGetStats,
  hangGetStats,
  hangNextGetStats,
  setSenderCodec,
  setSenderStatsWithoutCodec,
} from '../__fixtures__';
import {
  calcMaxBitrateByWidthAndCodec,
  getMaximumBitrate,
  getMinimumBitrate,
} from '../calcBitrate';
import { RESULT_NO_CHANGED } from '../SenderBalancer';

import type { IBalancerOptions, IMainCamHeaders } from '../types';

jest.mock('@/logger');

const { mcuDebugLogger } = resolveDebug as jest.Mock & { mcuDebugLogger: jest.Mock };

const NO_TRACK = null;

const POLL_INTERVAL_MS = 100;
const DEFAULT_SCALE_RESOLUTION_DOWN_BY = 1;

// дольше максимального интервала опроса размера трека (16 начальных интервалов)
const POLLING_WINDOW_MS = 2 * 16 * POLL_INTERVAL_MS;

// разумное время, за которое балансировка обходится без зависшего запроса статистики: без привязки к таймауту
const HUNG_STATS_WAIT_MS = 30_000;

// не дольше этого балансировка ждёт ответа на запрос статистики
const STATS_TIMEOUT_MS = 1000;

const MAX_RESOLUTION_360P = { width: 640, height: 360 };

const HEADERS_PAUSE: IMainCamHeaders = { mainCam: EContentMainCAM.PAUSE_MAIN_CAM };
const HEADERS_MAX_720P: IMainCamHeaders = {
  mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
  resolutionMainCam: '1280x720',
};
const HEADERS_MAX_4K: IMainCamHeaders = {
  mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
  resolutionMainCam: '3840x2160',
};

const ENCODING_720P_BY_TRACK = {
  scaleResolutionDownBy: 1,
  maxBitrate: calcMaxBitrateByWidthAndCodec(1280),
};
const ENCODING_360P_BY_TRACK = {
  scaleResolutionDownBy: 1,
  maxBitrate: calcMaxBitrateByWidthAndCodec(640),
};
const ENCODING_720P_LIMITED_TO_360P = {
  scaleResolutionDownBy: 2,
  maxBitrate: calcMaxBitrateByWidthAndCodec(640),
};
const ENCODING_1440P_LIMITED_TO_720P = {
  scaleResolutionDownBy: 2,
  maxBitrate: calcMaxBitrateByWidthAndCodec(1280),
};
const ENCODING_4K_LIMITED_TO_360P = {
  scaleResolutionDownBy: 6,
  maxBitrate: calcMaxBitrateByWidthAndCodec(640),
};
const ENCODING_4K_LIMITED_TO_720P = {
  scaleResolutionDownBy: 3,
  maxBitrate: calcMaxBitrateByWidthAndCodec(1280),
};
const ENCODING_PAUSED = { scaleResolutionDownBy: 200, maxBitrate: getMinimumBitrate() };

describe('VideoSendingBalancer', () => {
  let connection: RTCPeerConnectionMock;
  let currentConnection: RTCPeerConnectionMock | undefined;
  let track720: MediaStreamVideoTrack;
  let track4K: MediaStreamVideoTrack;
  let sender: RTCRtpSender;
  let setParameters: jest.SpyInstance;
  let balancer: VideoSendingBalancer;

  const getConnection = () => {
    return currentConnection as RTCPeerConnection | undefined;
  };

  const createBalancer = (options: IBalancerOptions = createBalancerOptions()) => {
    return new VideoSendingBalancer(getConnection, {
      ...options,
      pollIntervalMs: POLL_INTERVAL_MS,
    });
  };

  const getEncoding = (target: RTCRtpSender = sender) => {
    const [{ scaleResolutionDownBy = DEFAULT_SCALE_RESOLUTION_DOWN_BY, maxBitrate }] =
      target.getParameters().encodings;

    return { scaleResolutionDownBy, maxBitrate };
  };

  const resizeTrack = (track: MediaStreamVideoTrack, width: number, height: number) => {
    return jest.spyOn(track, 'getSettings').mockReturnValue({ width, height });
  };

  const flushQueue = async () => {
    await jest.advanceTimersByTimeAsync(0);
  };

  // команда принимается только с начала прогрева: до него она была бы отброшена
  const startWithServerHeaders = async (headers: IMainCamHeaders) => {
    balancer.warmUp();
    balancer.handleServerHeaders(headers);

    return balancer.start();
  };

  const deferOriginalReplaceTrack = () => {
    const originalReplacement = Promise.withResolvers<undefined>();
    const replaceTrack = sender.replaceTrack.bind(sender);

    jest.spyOn(sender, 'replaceTrack').mockImplementation(async (track) => {
      await originalReplacement.promise;
      await replaceTrack(track);
    });

    return originalReplacement;
  };

  beforeEach(() => {
    jest.useFakeTimers();

    track720 = createVideoTrack(1280, 720);
    track4K = createVideoTrack(3840, 2160);
    sender = new RTCRtpSenderMock({ track: track720 });
    setParameters = jest.spyOn(sender, 'setParameters');
    connection = new RTCPeerConnectionMock(undefined, []);
    connection.senders = [sender];
    currentConnection = connection;
    balancer = createBalancer();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('balance', () => {
    it('должен отклониться ошибкой, если нет connection', async () => {
      currentConnection = undefined;

      await expect(balancer.balance()).rejects.toThrow('connection is not exist');
    });

    it('должен вернуть RESULT_NO_CHANGED, если нет видео-отправителя', async () => {
      connection.senders = [];

      const result = await balancer.balance();

      expect(result).toBe(RESULT_NO_CHANGED);
    });

    it('должен установить параметры по треку отправителя и вернуть результат установки', async () => {
      balancer = createBalancer(createBalancerOptions({ maxResolution: MAX_RESOLUTION_360P }));

      const result = await balancer.balance();

      expect(result.isChanged).toBe(true);
      expect(result.parameters.encodings).toEqual([ENCODING_720P_LIMITED_TO_360P]);
      expect(getEncoding()).toEqual(ENCODING_720P_LIMITED_TO_360P);
    });

    it('должен вернуть RESULT_NO_CHANGED и не менять параметры, если кодек отправителя игнорируется', async () => {
      setSenderCodec(sender, 'video/VP8');
      balancer = createBalancer(
        createBalancerOptions({ ignoreForCodec: 'vp8', maxResolution: MAX_RESOLUTION_360P }),
      );

      const result = await balancer.balance();

      expect(result).toBe(RESULT_NO_CHANGED);
      expect(setParameters).not.toHaveBeenCalled();
    });

    it('должен вызвать onSetParameters с установленными параметрами', async () => {
      const onSetParameters = jest.fn();

      balancer = createBalancer(
        createBalancerOptions({ onSetParameters, maxResolution: MAX_RESOLUTION_360P }),
      );

      const { parameters } = await balancer.balance();

      expect(onSetParameters).toHaveBeenCalledTimes(1);
      expect(onSetParameters).toHaveBeenCalledWith(parameters);
    });

    // фиксирует текущее поведение: решение по нему ещё не принято
    it('должен вернуть результат установки и залогировать ошибку, если onSetParameters бросает исключение (текущее поведение)', async () => {
      const error = new Error('onSetParameters failed');

      balancer = createBalancer(
        createBalancerOptions({
          onSetParameters: () => {
            throw error;
          },
          maxResolution: MAX_RESOLUTION_360P,
        }),
      );

      const result = await balancer.balance();

      expect(result.isChanged).toBe(true);
      expect(getEncoding()).toEqual(ENCODING_720P_LIMITED_TO_360P);
      expect(mcuDebugLogger).toHaveBeenCalledWith('onSetParameters: error', error);
    });

    it('должен вернуть RESULT_NO_CHANGED во время прогрева, не запрашивая кодек и не требуя connection', async () => {
      const getStats = jest.spyOn(sender, 'getStats');

      balancer.warmUp();
      currentConnection = undefined;

      await expect(balancer.balance()).resolves.toBe(RESULT_NO_CHANGED);
      expect(getStats).not.toHaveBeenCalled();
    });

    it('должен вернуть RESULT_NO_CHANGED и не менять параметры, если за время запроса кодека начат прогрев', async () => {
      balancer = createBalancer(createBalancerOptions({ maxResolution: MAX_RESOLUTION_360P }));

      const releaseStats = deferNextGetStats(sender);
      const balancing = balancer.balance();

      balancer.warmUp();
      releaseStats();

      await expect(balancing).resolves.toBe(RESULT_NO_CHANGED);
      expect(setParameters).not.toHaveBeenCalled();
    });

    it.each([
      [
        'stop()',
        () => {
          balancer.stop();
        },
      ],
      [
        'stop() и новый start()',
        () => {
          balancer.stop();
          balancer.start().catch(() => {});
        },
      ],
    ])(
      'должен вернуть RESULT_NO_CHANGED, если за время запроса кодека вызван %s',
      async (_name, interrupt) => {
        await balancer.start();

        const releaseStats = deferNextGetStats(sender);
        const balancing = balancer.balance();

        interrupt();
        releaseStats();

        await expect(balancing).resolves.toBe(RESULT_NO_CHANGED);
      },
    );
  });

  describe('запрос кодека', () => {
    it('должен отклониться ошибкой запроса кодека', async () => {
      const error = new Error('getStats failed');

      jest.spyOn(sender, 'getStats').mockRejectedValueOnce(error);

      await expect(balancer.balance()).rejects.toBe(error);
    });

    it('должен выполнить следующую балансировку, если запрос кодека предыдущей не отвечает', async () => {
      await balancer.start();
      hangNextGetStats(sender);
      balancer.balance().catch(() => {});
      balancer.handleServerHeaders(HEADERS_PAUSE);
      // следующая балансировка ждёт идущий запрос, но не дольше таймаута
      await jest.advanceTimersByTimeAsync(STATS_TIMEOUT_MS);

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
    });

    it('должен заменить трек при scaleResolutionDownBy нового трека, если запросы кодека не отвечают', async () => {
      const onReplaced = jest.fn();

      await startWithServerHeaders(HEADERS_MAX_720P);
      hangGetStats(sender);
      balancer.balance().catch(() => {});
      sender
        .replaceTrack(track4K)
        .then(onReplaced)
        .catch(() => {});
      await flushQueue();

      expect(onReplaced).toHaveBeenCalledTimes(1);
      expect(sender.track).toBe(track4K);
      expect(getEncoding().scaleResolutionDownBy).toBe(3);
    });

    it('должен применить команду сервера, полученную за время запроса кодека', async () => {
      await balancer.start();

      const releaseStats = deferNextGetStats(sender);
      const balancing = balancer.balance();

      hangGetStats(sender);
      balancer.handleServerHeaders(HEADERS_PAUSE);
      releaseStats();
      await balancing;

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
    });

    it('должен оставить отправителю параметры без ограничения, если за время запроса кодека трек отправителя заменён на пустой', async () => {
      await startWithServerHeaders(HEADERS_PAUSE);

      const releaseStats = deferNextGetStats(sender);
      const balancing = balancer.balance();

      await sender.replaceTrack(NO_TRACK);
      releaseStats();

      await expect(balancing).resolves.toMatchObject({ isChanged: false });
      expect(getEncoding()).toEqual({ scaleResolutionDownBy: 1, maxBitrate: getMaximumBitrate() });
    });

    it('должен менять только масштаб, пока в статистике нет кодека, и выставить битрейт по тику, когда кодек появится', async () => {
      setSenderStatsWithoutCodec(sender);
      await startWithServerHeaders(HEADERS_PAUSE);

      expect(getEncoding()).toEqual({ scaleResolutionDownBy: 200, maxBitrate: undefined });

      setSenderCodec(sender, 'video/VP8');
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
    });

    it('не должен менять параметры при ignoreForCodec, пока в статистике нет кодека, и должен применить их по тику, когда появится не исключённый кодек', async () => {
      balancer = createBalancer(createBalancerOptions({ ignoreForCodec: 'h264' }));
      setSenderStatsWithoutCodec(sender);
      await startWithServerHeaders(HEADERS_PAUSE);

      expect(setParameters).not.toHaveBeenCalled();

      setSenderCodec(sender, 'video/VP8');
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
    });

    it('должен балансировать по последнему известному кодеку, если в следующей статистике кодека нет', async () => {
      balancer = createBalancer(createBalancerOptions({ ignoreForCodec: 'h264' }));
      setSenderCodec(sender, 'video/H264');
      await balancer.balance();
      setSenderStatsWithoutCodec(sender);
      await startWithServerHeaders(HEADERS_PAUSE);

      expect(setParameters).not.toHaveBeenCalled();
    });

    it('должен перепроверять кодек по тику после статистики без кодека и выставить битрейт по кодеку, появившемуся при неизменном треке', async () => {
      setSenderCodec(sender, 'video/VP8');
      await balancer.start();
      setSenderStatsWithoutCodec(sender);
      await balancer.balance();
      setSenderCodec(sender, 'video/AV1');
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(getEncoding()).toEqual({
        scaleResolutionDownBy: 1,
        maxBitrate: calcMaxBitrateByWidthAndCodec(1280, 'video/AV1'),
      });
    });

    it('должен применить по тику команду, полученную при статистике без кодека, когда статистика покажет не исключённый ignoreForCodec кодек', async () => {
      sender = new RTCRtpSenderMock({ track: track4K });
      connection.senders = [sender];
      balancer = createBalancer(createBalancerOptions({ ignoreForCodec: 'h264' }));
      setSenderCodec(sender, 'video/H264');
      await balancer.start();
      setSenderStatsWithoutCodec(sender);
      balancer.handleServerHeaders(HEADERS_MAX_720P);
      await flushQueue();
      setSenderCodec(sender, 'video/VP8');
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(getEncoding()).toEqual({
        scaleResolutionDownBy: 3,
        maxBitrate: calcMaxBitrateByWidthAndCodec(1280, 'video/VP8'),
      });
    });

    it('должен завершить балансировку и применить параметры по последнему известному кодеку, если запрос статистики не отвечает', async () => {
      const onBalanced = jest.fn();

      balancer = createBalancer(createBalancerOptions({ ignoreForCodec: 'h264' }));
      setSenderCodec(sender, 'video/VP8');
      await startWithServerHeaders(HEADERS_MAX_720P);
      hangGetStats(sender);
      resizeTrack(track720, 3840, 2160);
      balancer.balance().then(onBalanced, () => {});
      await jest.advanceTimersByTimeAsync(HUNG_STATS_WAIT_MS);

      expect(onBalanced).toHaveBeenCalledTimes(1);
      expect(getEncoding()).toEqual({
        scaleResolutionDownBy: 3,
        maxBitrate: calcMaxBitrateByWidthAndCodec(1280, 'video/VP8'),
      });
    });

    it('не должен запрашивать статистику отправителя снова до таймаута ожидания зависшего запроса и должен запросить её после таймаута', async () => {
      await balancer.start();
      hangGetStats(sender);

      const getStats = jest.spyOn(sender, 'getStats');

      balancer.handleServerHeaders(HEADERS_PAUSE);
      await jest.advanceTimersByTimeAsync(STATS_TIMEOUT_MS / 2);
      balancer.handleServerHeaders(HEADERS_MAX_720P);
      await jest.advanceTimersByTimeAsync(STATS_TIMEOUT_MS / 2 - 1);

      expect(getStats).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      balancer.handleServerHeaders(HEADERS_PAUSE);
      await flushQueue();

      expect(getStats).toHaveBeenCalledTimes(2);
    });

    it('должен балансировать по ответу идущего запроса статистики, если балансировка начата до его ответа, и запросить статистику снова после ответа', async () => {
      await balancer.start();
      setSenderCodec(sender, 'video/AV1');

      const getStats = jest.spyOn(sender, 'getStats');
      const releaseStats = deferNextGetStats(sender, 'video/VP8');
      const balancings = [balancer.balance(), balancer.balance()];

      releaseStats();
      await Promise.all(balancings);

      expect(getStats).toHaveBeenCalledTimes(1);
      expect(getEncoding()).toEqual({
        scaleResolutionDownBy: 1,
        maxBitrate: calcMaxBitrateByWidthAndCodec(1280, 'video/VP8'),
      });

      await balancer.balance();

      expect(getStats).toHaveBeenCalledTimes(2);
      expect(getEncoding()).toEqual({
        scaleResolutionDownBy: 1,
        maxBitrate: calcMaxBitrateByWidthAndCodec(1280, 'video/AV1'),
      });
    });

    it('должен рассчитать параметры по треку, установленному отправителю за время запроса кодека', async () => {
      balancer = createBalancer(createBalancerOptions({ maxResolution: MAX_RESOLUTION_360P }));

      const releaseStats = deferNextGetStats(sender);
      const balancing = balancer.balance();

      await sender.replaceTrack(track4K);
      releaseStats();
      await balancing;

      expect(getEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);
    });
  });

  describe('start', () => {
    it('должен применить команду сервера, запомненную в прогреве, и вернуть результат установки', async () => {
      const result = await startWithServerHeaders(HEADERS_PAUSE);

      expect(result.isChanged).toBe(true);
      expect(result.parameters.encodings).toEqual([ENCODING_PAUSED]);
    });

    it('должен вернуть RESULT_NO_CHANGED и не применять запомненную команду, если за время первой балансировки вызван stop()', async () => {
      const releaseStats = deferNextGetStats(sender);
      const starting = startWithServerHeaders(HEADERS_PAUSE);

      balancer.stop();
      releaseStats();

      await expect(starting).resolves.toBe(RESULT_NO_CHANGED);
      expect(setParameters).not.toHaveBeenCalled();
    });

    it('должен включить перехват замены трека при балансировке после start(), если при старте не было connection', async () => {
      balancer = createBalancer(createBalancerOptions({ maxResolution: MAX_RESOLUTION_360P }));
      currentConnection = undefined;
      await Promise.allSettled([balancer.start()]);
      currentConnection = connection;
      await balancer.balance();
      await sender.replaceTrack(track4K);

      expect(getEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);
    });
  });

  describe('handleServerHeaders', () => {
    it('не должен принимать команду вне прогрева и запущенной балансировки', async () => {
      balancer.handleServerHeaders(HEADERS_PAUSE);
      await balancer.start();

      expect(getEncoding()).toEqual(ENCODING_720P_BY_TRACK);
    });

    it('должен только запомнить команду во время прогрева', async () => {
      balancer.warmUp();
      balancer.handleServerHeaders(HEADERS_PAUSE);
      await flushQueue();

      expect(setParameters).not.toHaveBeenCalled();

      await balancer.start();

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
    });

    it('должен применить команду, полученную при запущенной балансировке', async () => {
      await balancer.start();
      balancer.handleServerHeaders(HEADERS_PAUSE);
      await flushQueue();

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
    });

    it('не должен принимать MAX_MAIN_CAM_RESOLUTION с некорректным разрешением: в силе остаётся прежняя команда', async () => {
      await startWithServerHeaders(HEADERS_PAUSE);
      setParameters.mockClear();
      balancer.handleServerHeaders({
        mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: 'axb',
      });
      await balancer.balance();

      expect(mcuDebugLogger).toHaveBeenCalledWith(
        'handleServerHeaders: invalid resolutionMainCam',
        'axb',
      );
      expect(setParameters).not.toHaveBeenCalled();
      expect(getEncoding()).toEqual(ENCODING_PAUSED);
    });

    it('должен залогировать ошибку балансировки по команде', async () => {
      await balancer.start();
      currentConnection = undefined;
      balancer.handleServerHeaders(HEADERS_PAUSE);
      await flushQueue();

      expect(mcuDebugLogger).toHaveBeenCalledWith(
        'balance on main-cam-control: error',
        new Error('connection is not exist'),
      );
    });
  });

  describe('warmUp', () => {
    it('должен включить перехват замены трека без изменения параметров: замена, начатая в прогреве и завершённая после start(), получает параметры нового трека по запомненной команде', async () => {
      const originalReplacement = deferOriginalReplaceTrack();

      balancer.warmUp();
      balancer.handleServerHeaders(HEADERS_MAX_720P);

      const replacing = sender.replaceTrack(track4K);

      await flushQueue();

      expect(setParameters).not.toHaveBeenCalled();

      const starting = balancer.start();

      await flushQueue();
      originalReplacement.resolve(undefined);
      await Promise.all([replacing, starting]);

      expect(sender.track).toBe(track4K);
      expect(getEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('не должен менять параметры при замене трека во время прогрева', async () => {
      balancer = createBalancer(createBalancerOptions({ maxResolution: MAX_RESOLUTION_360P }));
      balancer.warmUp();
      await sender.replaceTrack(track4K);
      await flushQueue();

      expect(sender.track).toBe(track4K);
      expect(setParameters).not.toHaveBeenCalled();
    });

    it('не должен требовать connection', () => {
      currentConnection = undefined;

      expect(() => {
        balancer.warmUp();
      }).not.toThrow();
    });

    it('не должен затрагивать запущенную балансировку', async () => {
      await balancer.start();

      const { runToken } = balancer;

      balancer.warmUp();
      balancer.handleServerHeaders(HEADERS_PAUSE);
      await flushQueue();

      expect(balancer.runToken).toBe(runToken);
      expect(getEncoding()).toEqual(ENCODING_PAUSED);
    });

    it('должен ослабить параметры сбросом, выполненным уже во время прогрева', async () => {
      await startWithServerHeaders(HEADERS_PAUSE);
      balancer.stop();
      balancer.warmUp();
      await flushQueue();

      expect(getEncoding()).toEqual(ENCODING_720P_BY_TRACK);
    });

    it('не должен ужесточать параметры сбросом, выполненным уже во время прогрева', async () => {
      sender = new RTCRtpSenderMock({ track: track4K });
      connection.senders = [sender];
      balancer = createBalancer(createBalancerOptions({ maxResolution: MAX_RESOLUTION_360P }));
      await startWithServerHeaders(HEADERS_MAX_4K);
      balancer.stop();
      balancer.warmUp();
      await flushQueue();

      expect(getEncoding()).toEqual({
        scaleResolutionDownBy: 1,
        maxBitrate: calcMaxBitrateByWidthAndCodec(3840),
      });
    });
  });

  describe('runToken', () => {
    it('должен меняться при начале прогрева, запуске и остановке', async () => {
      const idleToken = balancer.runToken;

      balancer.warmUp();

      const warmupToken = balancer.runToken;

      await balancer.start();

      const startedToken = balancer.runToken;

      balancer.stop();

      expect(new Set([idleToken, warmupToken, startedToken, balancer.runToken]).size).toBe(4);
    });
  });

  describe('сверка по тику', () => {
    it('должен пересчитать параметры отправителя при изменении размера трека', async () => {
      await startWithServerHeaders(HEADERS_MAX_720P);
      resizeTrack(track720, 2560, 1440);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(getEncoding()).toEqual(ENCODING_1440P_LIMITED_TO_720P);
    });

    it('должен пересчитать параметры, если размер трека изменился между балансировкой по команде и опросом, а затем вернулся к прежнему', async () => {
      balancer = createBalancer(createBalancerOptions({ maxResolution: MAX_RESOLUTION_360P }));
      await balancer.start();

      const getSettings = resizeTrack(track720, 640, 360);

      await balancer.balance();
      getSettings.mockReturnValue({ width: 1280, height: 720 });
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(getEncoding()).toEqual(ENCODING_720P_LIMITED_TO_360P);
    });

    it('должен применить параметры трека, которым трек отправителя заменён мимо перехвата', async () => {
      await startWithServerHeaders(HEADERS_MAX_720P);
      Object.assign(sender, { track: track4K });
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(getEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('должен применить команду новому видео-отправителю, если запрос статистики прежнего отправителя при сверке не отвечает', async () => {
      const otherSender = new RTCRtpSenderMock({ track: track4K });

      await startWithServerHeaders(HEADERS_MAX_720P);
      hangGetStats(sender);
      resizeTrack(track720, 1920, 1080);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      connection.senders = [otherSender];
      await jest.advanceTimersByTimeAsync(HUNG_STATS_WAIT_MS);

      expect(getEncoding(otherSender).scaleResolutionDownBy).toBe(3);
    });

    it('не должен запрашивать кодек и менять параметры, пока отправитель, его трек и размер трека не менялись', async () => {
      await balancer.start();

      const getStats = jest.spyOn(sender, 'getStats');

      setParameters.mockClear();
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(getStats).not.toHaveBeenCalled();
      expect(setParameters).not.toHaveBeenCalled();
    });

    it('должен увеличивать интервал сверки, пока балансировка по тику повторяется из-за статистики без кодека и не меняет параметры', async () => {
      setSenderStatsWithoutCodec(sender);
      await balancer.start();

      const getStats = jest.spyOn(sender, 'getStats');

      getStats.mockClear();
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      // тики через 1, 2, 4, 8 и 16 начальных интервалов, а не каждый начальный интервал
      expect(getStats).toHaveBeenCalledTimes(5);
    });

    it('должен повторить балансировку, если запрос кодека завершился ошибкой', async () => {
      await balancer.start();
      jest.spyOn(sender, 'getStats').mockRejectedValueOnce(new Error('getStats failed'));
      balancer.handleServerHeaders(HEADERS_PAUSE);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
    });

    it('должен повторить балансировку, если применение параметров завершилось ошибкой', async () => {
      await balancer.start();
      setParameters.mockRejectedValueOnce(new Error('setParameters failed'));
      balancer.handleServerHeaders(HEADERS_PAUSE);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
    });

    it('должен повторить балансировку, если размер трека изменился, пока применялись параметры', async () => {
      const originalSetParameters = sender.setParameters.bind(sender);
      const applying = Promise.withResolvers<undefined>();

      balancer = createBalancer(createBalancerOptions({ maxResolution: MAX_RESOLUTION_360P }));
      setParameters.mockImplementationOnce(async (parameters: RTCRtpSendParameters) => {
        await applying.promise;

        return originalSetParameters(parameters);
      });

      const starting = balancer.start();

      await flushQueue();
      resizeTrack(track720, 2560, 1440);
      applying.resolve(undefined);
      await starting;

      expect(getEncoding()).toEqual(ENCODING_720P_LIMITED_TO_360P);

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(getEncoding().scaleResolutionDownBy).toBe(4);
    });

    it('должен применить запомненную команду, когда connection появился после неудачного запуска', async () => {
      balancer.warmUp();
      balancer.handleServerHeaders(HEADERS_PAUSE);
      currentConnection = undefined;
      await Promise.allSettled([balancer.start()]);
      currentConnection = connection;
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
    });

    it('должен залогировать ошибку балансировки при сверке', async () => {
      await balancer.start();
      currentConnection = undefined;
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(mcuDebugLogger).toHaveBeenCalledWith(
        'balance on reconcile: error',
        new Error('connection is not exist'),
      );
    });

    it('должен вернуть сверку к начальному интервалу после замены трека', async () => {
      await balancer.start();
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);
      await sender.replaceTrack(track4K);
      await flushQueue();
      resizeTrack(track4K, 1280, 720);
      setParameters.mockClear();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(setParameters).toHaveBeenCalledTimes(1);
    });

    it.each([
      [
        'после stop()',
        async () => {
          await balancer.start();
          balancer.stop();
          await flushQueue();
        },
      ],
      [
        'во время прогрева',
        async () => {
          balancer.warmUp();
        },
      ],
    ])('не должен менять параметры при изменении размера трека %s', async (_name, prepare) => {
      balancer = createBalancer(createBalancerOptions({ maxResolution: MAX_RESOLUTION_360P }));
      await prepare();
      setParameters.mockClear();
      resizeTrack(track720, 2560, 1440);
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(setParameters).not.toHaveBeenCalled();
    });
  });

  describe('замена трека', () => {
    it('должен выполнить балансировку, запрошенную во время замены трека, только после завершения замены', async () => {
      const originalReplacement = deferOriginalReplaceTrack();

      await startWithServerHeaders(HEADERS_MAX_720P);

      const replacing = sender.replaceTrack(track4K);

      await flushQueue();

      const balancing = balancer.balance();

      await flushQueue();

      expect(getEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);

      originalReplacement.resolve(undefined);
      await Promise.all([replacing, balancing]);

      expect(sender.track).toBe(track4K);
      expect(getEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('должен применить параметры нового трека до замены по кодеку последней балансировки, если кодек не исключён ignoreForCodec', async () => {
      setSenderCodec(sender, 'video/VP8');
      balancer = createBalancer(createBalancerOptions({ ignoreForCodec: 'h264' }));
      await startWithServerHeaders(HEADERS_MAX_720P);
      hangGetStats(sender);
      await sender.replaceTrack(track4K);

      expect(getEncoding()).toEqual({
        scaleResolutionDownBy: 3,
        maxBitrate: calcMaxBitrateByWidthAndCodec(1280, 'video/VP8'),
      });
    });

    it('должен залогировать ошибку балансировки после замены трека', async () => {
      const error = new Error('getStats failed');

      await balancer.start();
      jest.spyOn(sender, 'getStats').mockRejectedValueOnce(error);
      await sender.replaceTrack(track4K);
      await flushQueue();

      expect(mcuDebugLogger).toHaveBeenCalledWith('balance on track change: error', error);
    });

    it('должен применить параметры нового трека до замены пустого трека, если между заменами выполнена балансировка', async () => {
      await startWithServerHeaders(HEADERS_MAX_720P);
      await sender.replaceTrack(NO_TRACK);

      const result = await balancer.balance();

      hangGetStats(sender);
      await sender.replaceTrack(track4K);

      expect(result).toBe(RESULT_NO_CHANGED);
      expect(getEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });
  });

  describe('смена видео-отправителя', () => {
    let otherTrack: MediaStreamVideoTrack;
    let otherSender: RTCRtpSender;

    beforeEach(async () => {
      otherTrack = createVideoTrack(1280, 720);
      otherSender = new RTCRtpSenderMock({ track: otherTrack });
      balancer = createBalancer(createBalancerOptions({ maxResolution: MAX_RESOLUTION_360P }));
      await balancer.start();
      connection.senders = [otherSender];
    });

    it('должен перехватывать замену трека у нового отправителя после балансировки', async () => {
      await balancer.balance();
      await otherSender.replaceTrack(track4K);

      expect(getEncoding(otherSender)).toEqual(ENCODING_4K_LIMITED_TO_360P);
    });

    it('должен снять перехват замены трека с прежнего отправителя после балансировки', async () => {
      await balancer.balance();
      setParameters.mockClear();

      const replacing = sender.replaceTrack(track4K);

      // перехват вызывает оригинальный replaceTrack только из очереди отправителя, асинхронно
      expect(sender.track).toBe(track4K);

      await replacing;
      await flushQueue();

      expect(setParameters).not.toHaveBeenCalled();
    });

    it('должен применить параметры новому отправителю по тику и следить за размером его трека', async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(getEncoding(otherSender)).toEqual(ENCODING_720P_LIMITED_TO_360P);

      resizeTrack(otherTrack, 640, 360);
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(getEncoding(otherSender)).toEqual(ENCODING_360P_BY_TRACK);
    });

    it('должен применить параметры по тику новому отправителю с тем же треком того же размера', async () => {
      const sameTrackSender = new RTCRtpSenderMock({ track: track720 });

      connection.senders = [sameTrackSender];
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(getEncoding(sameTrackSender)).toEqual(ENCODING_720P_LIMITED_TO_360P);
    });
  });

  describe('пропажа видео-отправителя', () => {
    beforeEach(async () => {
      balancer = createBalancer(createBalancerOptions({ maxResolution: MAX_RESOLUTION_360P }));
      await balancer.start();
      connection.senders = [];
    });

    it('должен снять перехват замены трека при балансировке без видео-отправителя', async () => {
      await balancer.balance();
      setParameters.mockClear();

      const replacing = sender.replaceTrack(track4K);

      // перехват вызывает оригинальный replaceTrack только из очереди отправителя, асинхронно
      expect(sender.track).toBe(track4K);

      await replacing;
      await flushQueue();

      expect(setParameters).not.toHaveBeenCalled();
    });

    it('должен продолжать сверку и применить параметры отправителю, снова появившемуся в соединении', async () => {
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);
      resizeTrack(track720, 2560, 1440);
      connection.senders = [sender];
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(getEncoding().scaleResolutionDownBy).toBe(4);
    });

    it('должен применить параметры отправителю, появившемуся после долгого отсутствия видео-отправителя, за начальный интервал сверки', async () => {
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);
      resizeTrack(track720, 2560, 1440);
      connection.senders = [sender];
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(getEncoding().scaleResolutionDownBy).toBe(4);
    });
  });

  describe('поздний сбой отката прежнего отправителя', () => {
    it('не перезаписывает параметры нового отправителя, выставленные другим модулем, если после перезапуска с ним отклонены замена трека прежнего отправителя и её откат', async () => {
      const otherSender = new RTCRtpSenderMock({ track: createVideoTrack(1280, 720) });
      const originalReplacement = deferOriginalReplaceTrack();

      await startWithServerHeaders(HEADERS_MAX_720P);

      const replacing = Promise.allSettled([sender.replaceTrack(track4K)]);

      await flushQueue();
      balancer.stop();
      connection.senders = [otherSender];
      balancer.warmUp();
      await balancer.start();
      // опрос без изменений дорастает до максимального интервала
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      const foreignParameters = otherSender.getParameters();

      foreignParameters.encodings = [
        { ...foreignParameters.encodings[0], scaleResolutionDownBy: 5 },
      ];
      await otherSender.setParameters(foreignParameters);
      setParameters.mockRejectedValue(new Error('setParameters failed'));
      originalReplacement.reject(new Error('replaceTrack failed'));
      await replacing;
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(getEncoding(otherSender).scaleResolutionDownBy).toBe(5);
    });
  });

  describe('исключённый отправитель', () => {
    let excludedSender: RTCRtpSender;
    let excludedSetParameters: jest.SpyInstance;

    beforeEach(() => {
      excludedSender = new RTCRtpSenderMock({ track: createVideoTrack(3840, 2160) });
      excludedSetParameters = jest.spyOn(excludedSender, 'setParameters');
      balancer = createBalancer(
        createBalancerOptions({
          isExcludedSender: (target) => {
            return target === excludedSender;
          },
        }),
      );
    });

    it('должен балансировать следующий видео-отправитель, даже если исключённый идёт первым', async () => {
      connection.senders = [excludedSender, sender];

      await balancer.balance();

      expect(getEncoding()).toEqual(ENCODING_720P_BY_TRACK);
      expect(excludedSetParameters).not.toHaveBeenCalled();
    });

    it('не должен применять команду сервера к исключённому отправителю и перехватывать замену его трека', async () => {
      connection.senders = [excludedSender, sender];

      await startWithServerHeaders(HEADERS_PAUSE);
      await excludedSender.replaceTrack(createVideoTrack(1920, 1080));
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
      expect(excludedSetParameters).not.toHaveBeenCalled();
    });

    it('ничего не должен писать при балансировке, сверке и сбросе, если остался только исключённый отправитель', async () => {
      connection.senders = [excludedSender];

      await expect(balancer.balance()).resolves.toEqual(RESULT_NO_CHANGED);

      await startWithServerHeaders(HEADERS_PAUSE);
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);
      balancer.stop();
      await flushQueue();

      expect(excludedSetParameters).not.toHaveBeenCalled();
    });

    it('должен балансировать отправителя, переставшего быть исключённым', async () => {
      let isExcluded = true;

      balancer = createBalancer(
        createBalancerOptions({
          isExcludedSender: (target) => {
            return isExcluded && target === sender;
          },
        }),
      );

      await startWithServerHeaders(HEADERS_PAUSE);

      expect(setParameters).not.toHaveBeenCalled();

      isExcluded = false;
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
    });

    describe('подключённый отправитель становится исключённым', () => {
      let isExcluded: boolean;

      const isExcludedSender = (target: RTCRtpSender) => {
        return isExcluded && target === sender;
      };

      beforeEach(() => {
        isExcluded = false;
        balancer = createBalancer(createBalancerOptions({ isExcludedSender }));
      });

      it('не должен записывать параметры при его следующей замене трека', async () => {
        await startWithServerHeaders(HEADERS_MAX_720P);
        isExcluded = true;
        setParameters.mockClear();
        await sender.replaceTrack(track4K);
        await flushQueue();

        expect(sender.track).toBe(track4K);
        expect(setParameters).not.toHaveBeenCalled();
      });

      it('не должен записывать в него команду, полученную во время замены его трека', async () => {
        const originalReplacement = deferOriginalReplaceTrack();

        await balancer.start();
        isExcluded = true;
        setParameters.mockClear();

        const replacing = sender.replaceTrack(createVideoTrack(1280, 720));

        await flushQueue();
        balancer.handleServerHeaders(HEADERS_PAUSE);
        await flushQueue();
        originalReplacement.resolve(undefined);
        await replacing;
        await flushQueue();

        expect(setParameters).not.toHaveBeenCalled();
      });

      it('не должен сбрасывать его параметры при stop()', async () => {
        await startWithServerHeaders(HEADERS_PAUSE);
        isExcluded = true;
        setParameters.mockClear();
        balancer.stop();
        await flushQueue();

        expect(setParameters).not.toHaveBeenCalled();
        expect(getEncoding()).toEqual(ENCODING_PAUSED);
      });

      it('не должен сбрасывать его параметры сбросом stop(), поставленным в очередь до его исключения', async () => {
        const originalReplacement = deferOriginalReplaceTrack();

        balancer = createBalancer(
          createBalancerOptions({ isExcludedSender, maxResolution: MAX_RESOLUTION_360P }),
        );
        await startWithServerHeaders(HEADERS_PAUSE);

        const replacing = sender.replaceTrack(track4K);

        await flushQueue();
        balancer.stop();
        isExcluded = true;
        setParameters.mockClear();
        originalReplacement.resolve(undefined);
        await replacing;
        await flushQueue();

        expect(sender.track).toBe(track4K);
        expect(setParameters).not.toHaveBeenCalled();
        expect(getEncoding()).toEqual(ENCODING_PAUSED);
      });

      it('должен сбросить при stop() параметры другого, не исключённого видео-отправителя вместо него', async () => {
        const otherSender = new RTCRtpSenderMock({ track: createVideoTrack(1280, 720) });

        balancer = createBalancer(
          createBalancerOptions({ isExcludedSender, maxResolution: MAX_RESOLUTION_360P }),
        );
        await startWithServerHeaders(HEADERS_PAUSE);
        connection.senders = [sender, otherSender];
        isExcluded = true;
        setParameters.mockClear();
        balancer.stop();
        await flushQueue();

        expect(setParameters).not.toHaveBeenCalled();
        // кодек другого отправителя не запрашивался: без него сброс меняет только масштаб
        expect(getEncoding(otherSender).scaleResolutionDownBy).toBe(2);
      });

      it('должен вернуть ему оригинальный replaceTrack при балансировке без других видео-отправителей', async () => {
        const originalReplaceTrack = jest.spyOn(sender, 'replaceTrack');

        await startWithServerHeaders(HEADERS_MAX_720P);
        isExcluded = true;
        await balancer.balance();
        originalReplaceTrack.mockClear();
        // перехват вызывает оригинал только из очереди, асинхронно; оригинал вызывается сразу
        sender.replaceTrack(track4K).catch(() => {});

        expect(originalReplaceTrack).toHaveBeenCalledWith(track4K);
      });

      it('должен вернуть ему оригинальный replaceTrack сразу после завершения его замены трека при запущенной балансировке', async () => {
        const originalReplaceTrack = jest.spyOn(sender, 'replaceTrack');

        await startWithServerHeaders(HEADERS_MAX_720P);
        isExcluded = true;
        await sender.replaceTrack(track4K);
        originalReplaceTrack.mockClear();
        // без balance() и тиков сверки; через перехват следующая замена ждала бы в очереди отправителя конца зависшей
        originalReplaceTrack.mockImplementationOnce(async () => {
          return new Promise<void>(() => {});
        });
        sender.replaceTrack(track720).catch(() => {});
        sender.replaceTrack(track4K).catch(() => {});
        await flushQueue();

        expect(originalReplaceTrack.mock.calls).toEqual([[track720], [track4K]]);
      });

      it('должен вернуть ему оригинальный replaceTrack сразу после завершения его замены трека во время прогрева', async () => {
        const originalReplaceTrack = jest.spyOn(sender, 'replaceTrack');

        balancer.warmUp();
        isExcluded = true;
        await sender.replaceTrack(track4K);
        originalReplaceTrack.mockClear();
        // без balance() и тиков сверки; через перехват следующая замена ждала бы в очереди отправителя конца зависшей
        originalReplaceTrack.mockImplementationOnce(async () => {
          return new Promise<void>(() => {});
        });
        sender.replaceTrack(track720).catch(() => {});
        sender.replaceTrack(track4K).catch(() => {});
        await flushQueue();

        expect(originalReplaceTrack.mock.calls).toEqual([[track720], [track4K]]);
      });

      it('должен снова применить команду и перехватывать замену трека, когда исключение снято, даже если отправитель, трек и размер трека не менялись, а за время исключения владелец записал свои параметры', async () => {
        // так параметры пишет владелец исключённого отправителя, например демонстрация
        const writeOwnerEncoding = async () => {
          const parameters = sender.getParameters();

          parameters.encodings = [
            {
              ...parameters.encodings[0],
              scaleResolutionDownBy: 1,
              maxBitrate: getMaximumBitrate(),
            },
          ];
          await sender.setParameters(parameters);
        };

        await startWithServerHeaders(HEADERS_PAUSE);
        isExcluded = true;
        // других видео-отправителей нет: сверка снимает перехват с исключённого
        await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);
        await writeOwnerEncoding();
        isExcluded = false;
        await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

        expect(getEncoding()).toEqual(ENCODING_PAUSED);

        // перехват применяет команду при замене трека сам, без тиков сверки
        await writeOwnerEncoding();
        await sender.replaceTrack(track4K);

        expect(getEncoding()).toEqual(ENCODING_PAUSED);
      });

      it('должен сохранить перехват замены трека у другого видео-отправителя, подключённого, пока у исключённого шла замена трека', async () => {
        const otherSender = new RTCRtpSenderMock({ track: createVideoTrack(1280, 720) });
        const originalReplacement = deferOriginalReplaceTrack();

        await startWithServerHeaders(HEADERS_MAX_720P);

        const replacing = sender.replaceTrack(createVideoTrack(1920, 1080));

        await flushQueue();
        isExcluded = true;
        connection.senders = [sender, otherSender];
        // подключает другой отправитель; перехват исключённого держится до конца его замены
        await balancer.balance();
        originalReplacement.resolve(undefined);
        await replacing;
        // без тиков сверки параметры нового трека при замене применяет только перехват
        await otherSender.replaceTrack(track4K);

        expect(getEncoding(otherSender)).toEqual(ENCODING_4K_LIMITED_TO_720P);
      });
    });
  });

  describe('stop', () => {
    it('должен восстановить параметры отправителя по разрешению трека', async () => {
      await startWithServerHeaders(HEADERS_PAUSE);
      balancer.stop();
      await flushQueue();

      expect(getEncoding()).toEqual(ENCODING_720P_BY_TRACK);
    });

    it('должен восстановить параметры отправителя, не запрашивая кодек', async () => {
      await startWithServerHeaders(HEADERS_PAUSE);
      hangGetStats(sender);
      balancer.stop();
      await flushQueue();

      expect(getEncoding()).toEqual(ENCODING_720P_BY_TRACK);
    });

    // фиксирует текущее поведение: решение по нему ещё не принято
    it('должен снять ограничение с подключённого отправителя, оставшегося без трека, даже если запись параметров после замены на пустой трек отклонена (текущее поведение)', async () => {
      await startWithServerHeaders(HEADERS_PAUSE);
      setParameters.mockRejectedValueOnce(new Error('setParameters failed'));
      await sender.replaceTrack(NO_TRACK);

      // ограничение снимает только сброс остановки
      expect(getEncoding()).toEqual(ENCODING_PAUSED);

      balancer.stop();
      await flushQueue();

      expect(getEncoding()).toEqual({ scaleResolutionDownBy: 1, maxBitrate: getMaximumBitrate() });
    });

    it('должен вернуть отправителю оригинальный replaceTrack', async () => {
      const originalReplaceTrack = jest.spyOn(sender, 'replaceTrack');

      await startWithServerHeaders(HEADERS_MAX_720P);
      balancer.stop();
      originalReplaceTrack.mockClear();
      // перехват вызывает оригинал только из очереди, асинхронно; оригинал вызывается сразу
      sender.replaceTrack(track4K).catch(() => {});

      expect(originalReplaceTrack).toHaveBeenCalledWith(track4K);
    });

    it('должен стереть команду сервера', async () => {
      await startWithServerHeaders(HEADERS_PAUSE);
      balancer.stop();
      await balancer.start();

      expect(getEncoding()).toEqual(ENCODING_720P_BY_TRACK);
    });

    it('должен восстановить параметры отправителя по разрешению нового трека только после завершения замены, начатой до stop()', async () => {
      const originalReplacement = deferOriginalReplaceTrack();

      balancer = createBalancer(createBalancerOptions({ maxResolution: MAX_RESOLUTION_360P }));
      await startWithServerHeaders(HEADERS_PAUSE);

      const replacing = sender.replaceTrack(track4K);

      await flushQueue();
      balancer.stop();
      await flushQueue();

      expect(getEncoding()).toEqual(ENCODING_PAUSED);

      originalReplacement.resolve(undefined);
      await replacing;
      await flushQueue();

      expect(sender.track).toBe(track4K);
      expect(getEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);
    });

    it('не должен восстанавливать параметры отправителя, если нет connection', async () => {
      await startWithServerHeaders(HEADERS_PAUSE);
      currentConnection = undefined;
      setParameters.mockClear();
      balancer.stop();
      await flushQueue();

      expect(setParameters).not.toHaveBeenCalled();
      expect(getEncoding()).toEqual(ENCODING_PAUSED);
      expect(mcuDebugLogger).not.toHaveBeenCalled();
    });

    it('должен залогировать ошибку восстановления параметров отправителя', async () => {
      const error = new Error('setParameters failed');

      await startWithServerHeaders(HEADERS_PAUSE);
      setParameters.mockRejectedValueOnce(error);
      balancer.stop();
      await flushQueue();

      expect(mcuDebugLogger).toHaveBeenCalledWith('reset sender encodings: error', error);
    });
  });
});
