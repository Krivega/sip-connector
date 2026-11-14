import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { EContentMainCAM } from '@/ApiManager';
import resolveDebug from '@/logger';
import VideoSendingBalancer, { resolveVideoSendingBalancer } from '../@VideoSendingBalancer';
import {
  createBalancerOptions,
  createVideoTrack,
  deferNextGetStats,
  hangGetStats,
  hangNextGetStats,
  setSenderCodec,
} from '../__fixtures__';
import { calcMaxBitrateByWidthAndCodec, getMinimumBitrate } from '../calcBitrate';
import { RESULT_NO_CHANGED } from '../SenderBalancer';

import type { IBalancerOptions, IMainCamHeaders } from '../types';

jest.mock('@/logger');

const { mcuDebugLogger } = resolveDebug as jest.Mock & { mcuDebugLogger: jest.Mock };

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

    it('не должен учитывать команду сервера до start()', async () => {
      balancer.setServerHeaders(HEADERS_PAUSE);
      await balancer.balance();

      expect(getEncoding()).toEqual(ENCODING_720P_BY_TRACK);
    });
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
      balancer.setServerHeaders(HEADERS_PAUSE);
      balancer.balance().catch(() => {});
      await flushQueue();

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
    });

    it('должен заменить трек при scaleResolutionDownBy нового трека, если запросы кодека не отвечают', async () => {
      const onReplaced = jest.fn();

      balancer.setServerHeaders(HEADERS_MAX_720P);
      await balancer.start();
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

    it('должен применить команду сервера, сохранённую за время запроса кодека', async () => {
      await balancer.start();

      const releaseStats = deferNextGetStats(sender);
      const balancing = balancer.balance();

      balancer.setServerHeaders(HEADERS_PAUSE);
      releaseStats();
      await balancing;

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
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
    it('должен применить сохранённую команду сервера и вернуть результат установки', async () => {
      balancer.setServerHeaders(HEADERS_PAUSE);

      const result = await balancer.start();

      expect(result.isChanged).toBe(true);
      expect(result.parameters.encodings).toEqual([ENCODING_PAUSED]);
    });

    it('должен только сохранить команду сервера, полученную после start(), и применить её при следующей балансировке', async () => {
      await balancer.start();
      balancer.setServerHeaders(HEADERS_PAUSE);
      await flushQueue();

      expect(getEncoding()).toEqual(ENCODING_720P_BY_TRACK);

      await balancer.balance();

      expect(getEncoding()).toEqual(ENCODING_PAUSED);
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

  describe('изменение размера трека', () => {
    it('должен пересчитать параметры отправителя при изменении размера трека', async () => {
      balancer.setServerHeaders(HEADERS_MAX_720P);
      await balancer.start();
      resizeTrack(track720, 2560, 1440);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(getEncoding()).toEqual(ENCODING_1440P_LIMITED_TO_720P);
    });

    it('должен залогировать ошибку балансировки по изменению размера трека', async () => {
      await balancer.start();
      currentConnection = undefined;
      resizeTrack(track720, 640, 360);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(mcuDebugLogger).toHaveBeenCalledWith(
        'balance on track change: error',
        new Error('connection is not exist'),
      );
    });
  });

  describe('замена трека', () => {
    it('должен выполнить балансировку, запрошенную во время замены трека, только после завершения замены', async () => {
      const originalReplacement = Promise.withResolvers<undefined>();
      const replaceTrack = sender.replaceTrack.bind(sender);

      jest.spyOn(sender, 'replaceTrack').mockImplementation(async (track) => {
        await originalReplacement.promise;
        await replaceTrack(track);
      });
      balancer.setServerHeaders(HEADERS_MAX_720P);
      await balancer.start();

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

    it('должен следить за размером трека нового отправителя, если смена отправителя обнаружена балансировкой по изменению размера', async () => {
      resizeTrack(track720, 640, 360);
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);
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

    it('должен снять перехват замены трека и слежение за размером трека при балансировке без видео-отправителя', async () => {
      await balancer.balance();
      connection.senders = [sender];
      setParameters.mockClear();
      resizeTrack(track720, 640, 360);
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);
      await sender.replaceTrack(track4K);
      await flushQueue();

      expect(setParameters).not.toHaveBeenCalled();
    });

    it('должен прекратить опрос размера трека, если пропажа отправителя обнаружена балансировкой по изменению размера', async () => {
      const getSettings = resizeTrack(track720, 640, 360);

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      getSettings.mockClear();
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(getSettings).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('должен восстановить параметры отправителя по разрешению трека', async () => {
      balancer.setServerHeaders(HEADERS_PAUSE);
      await balancer.start();
      balancer.stop();
      await flushQueue();

      expect(getEncoding()).toEqual(ENCODING_720P_BY_TRACK);
    });

    it('должен восстановить параметры отправителя по разрешению трека, если замена трека не завершилась', async () => {
      jest.spyOn(sender, 'replaceTrack').mockReturnValue(new Promise<undefined>(() => {}));
      balancer.setServerHeaders(HEADERS_PAUSE);
      await balancer.start();
      sender.replaceTrack(track4K).catch(() => {});
      await flushQueue();
      balancer.stop();
      await flushQueue();

      expect(getEncoding()).toEqual(ENCODING_720P_BY_TRACK);
    });

    it('не должен восстанавливать параметры отправителя, если нет connection', async () => {
      await balancer.start();
      currentConnection = undefined;
      balancer.stop();
      await flushQueue();

      expect(mcuDebugLogger).not.toHaveBeenCalled();
    });

    it('должен залогировать ошибку восстановления параметров отправителя', async () => {
      const error = new Error('getStats failed');

      await balancer.start();
      jest.spyOn(sender, 'getStats').mockRejectedValueOnce(error);
      balancer.stop();
      await flushQueue();

      expect(mcuDebugLogger).toHaveBeenCalledWith('reset sender encodings: error', error);
    });
  });
});

describe('resolveVideoSendingBalancer', () => {
  it('должен создать VideoSendingBalancer для переданных connection и опций', async () => {
    const sender = new RTCRtpSenderMock({ track: createVideoTrack(1280, 720) });
    const connection = new RTCPeerConnectionMock(undefined, []);

    connection.senders = [sender];

    const balancer = resolveVideoSendingBalancer(
      () => {
        return connection as RTCPeerConnection;
      },
      createBalancerOptions({ maxResolution: MAX_RESOLUTION_360P }),
    );

    await balancer.balance();

    expect(balancer).toBeInstanceOf(VideoSendingBalancer);
    expect(sender.getParameters().encodings[0]).toEqual(ENCODING_720P_LIMITED_TO_360P);
  });
});
