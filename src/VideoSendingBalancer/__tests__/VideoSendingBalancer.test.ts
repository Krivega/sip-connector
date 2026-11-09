/// <reference types="jest" />
import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import delayPromise from '@/__fixtures__/delayPromise';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { EContentMainCAM } from '@/ApiManager';
import logger from '@/logger';
import VideoSendingBalancer, { resolveVideoSendingBalancer } from '../@VideoSendingBalancer';
import { createMockTrack, NO_MAX_RESOLUTION_BALANCER_OPTIONS } from '../__fixtures__';

import type { IBalancerOptions, IMainCamHeaders } from '../types';

jest.mock('@/logger');

const { mcuDebugLogger } = logger as jest.Mock & { mcuDebugLogger: jest.Mock };

const HEADERS_PAUSE: IMainCamHeaders = { mainCam: EContentMainCAM.PAUSE_MAIN_CAM };

const createVideoTrack = (width: number, height: number): MediaStreamVideoTrack => {
  return createVideoMediaStreamTrackMock({
    constraints: { width, height },
  }) as MediaStreamVideoTrack;
};

const findSetParametersCallByScale = (
  setParametersSpy: jest.SpyInstance<Promise<void>, Parameters<RTCRtpSender['setParameters']>>,
  scaleResolutionDownBy: number,
) => {
  return setParametersSpy.mock.calls.find((call) => {
    const encoding = call[0].encodings[0];

    return encoding.scaleResolutionDownBy === scaleResolutionDownBy;
  });
};

describe('VideoSendingBalancer', () => {
  let balancer: VideoSendingBalancer;
  let connection: RTCPeerConnection | undefined;
  let mockConnection: RTCPeerConnection;
  let mockSender: RTCRtpSender;

  const getConnection = () => {
    return connection;
  };

  beforeEach(() => {
    mockSender = new RTCRtpSenderMock({ track: createVideoTrack(1920, 1080) });
    Object.defineProperty(mockSender, 'getParameters', {
      value: jest.fn().mockReturnValue({
        encodings: [{ scaleResolutionDownBy: 1, maxBitrate: 1_000_000 }],
      }),
    });
    Object.defineProperty(mockSender, 'setParameters', {
      value: jest.fn().mockResolvedValue(undefined),
    });

    mockConnection = {
      getSenders: jest.fn().mockReturnValue([mockSender]),
    } as unknown as RTCPeerConnection;
    connection = mockConnection;

    balancer = new VideoSendingBalancer(getConnection, NO_MAX_RESOLUTION_BALANCER_OPTIONS);
  });

  afterEach(() => {
    balancer.reset();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('должен создать экземпляр VideoSendingBalancer', () => {
      expect(balancer).toBeInstanceOf(VideoSendingBalancer);
    });

    it('должен создать экземпляр с опциями', () => {
      const options: IBalancerOptions = {
        ...NO_MAX_RESOLUTION_BALANCER_OPTIONS,
        ignoreForCodec: 'VP8',
        onSetParameters: jest.fn(),
      };

      expect(new VideoSendingBalancer(getConnection, options)).toBeInstanceOf(VideoSendingBalancer);
    });
  });

  describe('setServerHeaders', () => {
    it('должен только сохранить команду, не балансируя', async () => {
      balancer.setServerHeaders(HEADERS_PAUSE);
      await delayPromise(10);

      expect(mockSender.setParameters).not.toHaveBeenCalled();
    });

    it('должен применить сохранённую команду при следующей балансировке', async () => {
      const setParametersSpy = jest.spyOn(mockSender, 'setParameters');

      balancer.setServerHeaders(HEADERS_PAUSE);
      await balancer.balance();

      expect(findSetParametersCallByScale(setParametersSpy, 200)).toBeDefined();
    });

    it('должен применить последнюю сохранённую команду', async () => {
      const setParametersSpy = jest.spyOn(mockSender, 'setParameters');

      balancer.setServerHeaders(HEADERS_PAUSE);
      balancer.setServerHeaders({ mainCam: EContentMainCAM.RESUME_MAIN_CAM });
      await balancer.balance();

      expect(findSetParametersCallByScale(setParametersSpy, 200)).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('должен стереть команду: следующая балансировка считается по треку', async () => {
      const setParametersSpy = jest.spyOn(mockSender, 'setParameters');

      balancer.setServerHeaders(HEADERS_PAUSE);
      balancer.reset();
      await delayPromise(10);
      setParametersSpy.mockClear();

      await balancer.balance();

      expect(findSetParametersCallByScale(setParametersSpy, 200)).toBeUndefined();
    });

    it('должен восстановить параметры отправителя после balance с PAUSE_MAIN_CAM', async () => {
      const setParametersSpy = jest.spyOn(mockSender, 'setParameters');

      balancer.setServerHeaders(HEADERS_PAUSE);
      await balancer.balance();

      expect(findSetParametersCallByScale(setParametersSpy, 200)).toBeDefined();

      balancer.reset();
      await delayPromise(100);

      expect(findSetParametersCallByScale(setParametersSpy, 1)).toBeDefined();
    });

    it('должен залогировать ошибку senderBalancer.reset без падения', async () => {
      const statsOk = new Map([['codec', { type: 'codec', mimeType: 'video/h264' }]]);

      jest
        .spyOn(mockSender, 'getStats')
        .mockResolvedValueOnce(statsOk)
        .mockRejectedValueOnce(new Error('reset error'));

      balancer.setServerHeaders(HEADERS_PAUSE);
      await balancer.balance();

      expect(() => {
        balancer.reset();
      }).not.toThrow();

      await delayPromise(100);

      expect(mcuDebugLogger).toHaveBeenCalledWith(
        'reset sender encodings: error',
        expect.any(Error),
      );
    });

    it('не должен падать без connection', () => {
      connection = undefined;

      expect(() => {
        balancer.reset();
      }).not.toThrow();
    });

    it('должен прекратить слежение за треком', async () => {
      await balancer.balance();
      balancer.reset();
      await delayPromise(10);

      const balanceSpy = jest.spyOn(balancer, 'balance');
      const getStatsSpy = jest.spyOn(mockSender, 'getStats');

      await mockSender.replaceTrack(createVideoTrack(3840, 2160));
      await delayPromise(10);

      expect(balanceSpy).not.toHaveBeenCalled();
      expect(getStatsSpy).not.toHaveBeenCalled();
    });
  });

  describe('balance', () => {
    it('должен выполнить балансировку при наличии соединения', async () => {
      const result = await balancer.balance();

      expect(result).toHaveProperty('isChanged');
      expect(result).toHaveProperty('parameters');
      expect(mockConnection.getSenders).toHaveBeenCalled();
    });

    it('должен выбросить ошибку, если нет соединения', async () => {
      connection = undefined;

      await expect(balancer.balance()).rejects.toThrow('connection is not exist');
    });

    it('должен подключить слежение за треком и балансировать после замены трека', async () => {
      await balancer.balance();

      const balanceSpy = jest.spyOn(balancer, 'balance');

      await mockSender.replaceTrack(createVideoTrack(3840, 2160));
      await delayPromise(10);

      expect(balanceSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('слежение за треком', () => {
    const createBalancerWithTrack = () => {
      const { track, setWidth } = createMockTrack(640);
      const sender = new RTCRtpSenderMock({ track });
      const connectionWithTrack = new RTCPeerConnectionMock(undefined, [track]);

      Object.defineProperty(connectionWithTrack, 'getSenders', {
        value: () => {
          return [sender];
        },
      });

      connection = connectionWithTrack;

      return {
        setWidth,
        testBalancer: new VideoSendingBalancer(getConnection, {
          ...NO_MAX_RESOLUTION_BALANCER_OPTIONS,
          pollIntervalMs: 100,
        }),
      };
    };

    it('должен повторно балансировать при изменении размера трека', async () => {
      const { setWidth, testBalancer } = createBalancerWithTrack();

      try {
        await testBalancer.balance();

        const balanceSpy = jest.spyOn(testBalancer, 'balance');

        setWidth(320);
        await delayPromise(150);

        expect(balanceSpy).toHaveBeenCalled();
      } finally {
        testBalancer.reset();
      }
    });

    it('должен залогировать ошибку балансировки по изменению трека', async () => {
      const { setWidth, testBalancer } = createBalancerWithTrack();

      try {
        await testBalancer.balance();

        connection = undefined;
        setWidth(320);
        await delayPromise(150);

        expect(mcuDebugLogger).toHaveBeenCalledWith(
          'balance on track change: error',
          expect.any(Error),
        );
      } finally {
        testBalancer.reset();
      }
    });

    it('должен залогировать ошибку подготовки замены трека и заменить трек', async () => {
      const newTrack = createVideoTrack(3840, 2160);
      const error = new Error('getStats failed');

      await balancer.balance();
      jest.spyOn(mockSender, 'getStats').mockRejectedValueOnce(error);

      await mockSender.replaceTrack(newTrack);

      expect(mockSender.track).toBe(newTrack);
      expect(mcuDebugLogger).toHaveBeenCalledWith('beforeReplaceTrack: error', error);
    });
  });
});

describe('resolveVideoSendingBalancer', () => {
  const getConnection = () => {
    return undefined;
  };

  it('должен создать экземпляр VideoSendingBalancer', () => {
    const balancer = resolveVideoSendingBalancer(getConnection, NO_MAX_RESOLUTION_BALANCER_OPTIONS);

    expect(balancer).toBeInstanceOf(VideoSendingBalancer);

    balancer.reset();
  });

  it('должен создать экземпляр с опциями', () => {
    const balancer = resolveVideoSendingBalancer(getConnection, {
      ...NO_MAX_RESOLUTION_BALANCER_OPTIONS,
      ignoreForCodec: 'VP9',
      onSetParameters: jest.fn(),
    });

    expect(balancer).toBeInstanceOf(VideoSendingBalancer);

    balancer.reset();
  });
});
