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
      await flushQueue();

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

    it('не должен запрашивать кодек и менять параметры, пока отправитель, его трек и размер трека не менялись', async () => {
      await balancer.start();

      const getStats = jest.spyOn(sender, 'getStats');

      setParameters.mockClear();
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(getStats).not.toHaveBeenCalled();
      expect(setParameters).not.toHaveBeenCalled();
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
      await sender.replaceTrack(track4K);
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
      await sender.replaceTrack(track4K);
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

    it('должен снять ограничение с подключённого отправителя, оставшегося без трека', async () => {
      await startWithServerHeaders(HEADERS_PAUSE);
      await sender.replaceTrack(NO_TRACK);
      balancer.stop();
      await flushQueue();

      expect(getEncoding()).toEqual({ scaleResolutionDownBy: 1, maxBitrate: getMaximumBitrate() });
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
      await balancer.start();
      currentConnection = undefined;
      balancer.stop();
      await flushQueue();

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
