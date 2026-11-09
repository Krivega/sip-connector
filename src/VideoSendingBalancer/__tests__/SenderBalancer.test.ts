/// <reference types="jest" />
import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { EContentMainCAM } from '@/ApiManager';
import { createSenderBalancerOptions } from '../__fixtures__';
import { calcMaxBitrateByWidthAndCodec } from '../calcBitrate';
import { SenderBalancer } from '../SenderBalancer';

import type { ICodecProvider, IMainCamHeaders, IParametersSetter, ISenderFinder } from '../types';

const CODEC = 'h264';

const HEADERS_MAX_720P: IMainCamHeaders = {
  mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
  resolutionMainCam: '1280x720',
};

const PARAMETERS_4K_LIMITED_TO_720P = {
  scaleResolutionDownBy: 3,
  maxBitrate: calcMaxBitrateByWidthAndCodec(1280, CODEC),
};

const createVideoTrack = (width: number, height: number): MediaStreamVideoTrack => {
  return createVideoMediaStreamTrackMock({
    constraints: { width, height },
  }) as MediaStreamVideoTrack;
};

describe('SenderBalancer', () => {
  let senderBalancer: SenderBalancer;
  let mockSenderFinder: jest.Mocked<ISenderFinder>;
  let mockCodecProvider: jest.Mocked<ICodecProvider>;
  let mockParametersSetter: jest.Mocked<IParametersSetter>;
  let mockSender: RTCRtpSender;
  let mockVideoTrack: MediaStreamVideoTrack;
  let mockConnection: RTCPeerConnection;
  let serverHeaders: IMainCamHeaders | undefined;

  const getServerHeaders = () => {
    return serverHeaders;
  };

  beforeEach(() => {
    serverHeaders = undefined;

    // Создаем моки
    mockSenderFinder = {
      findVideoSender: jest.fn(),
    };

    mockCodecProvider = {
      getCodecFromSender: jest.fn(),
    };

    mockParametersSetter = {
      setEncodingsToSender: jest.fn(),
    };

    // Создаем мок sender с video track
    mockVideoTrack = {
      getSettings: jest.fn().mockReturnValue({ width: 1920, height: 1080 }),
    } as unknown as MediaStreamVideoTrack;

    mockSender = new RTCRtpSenderMock({ track: mockVideoTrack });

    // Создаем мок connection
    mockConnection = {
      getSenders: jest.fn().mockReturnValue([mockSender]),
    } as unknown as RTCPeerConnection;

    // Создаем экземпляр SenderBalancer
    senderBalancer = new SenderBalancer(
      {
        senderFinder: mockSenderFinder,
        codecProvider: mockCodecProvider,
        parametersSetter: mockParametersSetter,
      },
      createSenderBalancerOptions({ getServerHeaders }),
    );
  });

  describe('constructor', () => {
    it('должен создать экземпляр с опциями', () => {
      const balancer = new SenderBalancer(
        {
          senderFinder: mockSenderFinder,
          codecProvider: mockCodecProvider,
          parametersSetter: mockParametersSetter,
        },
        createSenderBalancerOptions({ getServerHeaders, ignoreForCodec: 'vp8' }),
      );

      expect(balancer).toBeInstanceOf(SenderBalancer);
    });
  });

  describe('balance', () => {
    it('должен вернуть resultNoChanged если sender не найден', async () => {
      mockSenderFinder.findVideoSender.mockReturnValue(undefined);

      const result = await senderBalancer.balance(mockConnection);

      expect(result.isChanged).toBe(false);
      expect(mockParametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
    });

    it('должен вернуть resultNoChanged если sender не имеет track', async () => {
      const senderWithoutTrack = new RTCRtpSenderMock({ track: undefined });

      mockSenderFinder.findVideoSender.mockReturnValue(senderWithoutTrack);

      const result = await senderBalancer.balance(mockConnection);

      expect(result.isChanged).toBe(false);
      expect(mockParametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
    });

    it('должен вернуть resultNoChanged если codec игнорируется', async () => {
      mockSenderFinder.findVideoSender.mockReturnValue(mockSender);
      mockCodecProvider.getCodecFromSender.mockResolvedValue('vp8');

      const balancerWithIgnore = new SenderBalancer(
        {
          senderFinder: mockSenderFinder,
          codecProvider: mockCodecProvider,
          parametersSetter: mockParametersSetter,
        },
        createSenderBalancerOptions({ getServerHeaders, ignoreForCodec: 'vp8' }),
      );

      const result = await balancerWithIgnore.balance(mockConnection);

      expect(result.isChanged).toBe(false);
      expect(mockParametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
    });

    it('должен обработать sender с валидными параметрами', async () => {
      mockSenderFinder.findVideoSender.mockReturnValue(mockSender);
      mockCodecProvider.getCodecFromSender.mockResolvedValue('h264');
      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ maxBitrate: 1_000_000 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      const result = await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalled();
      expect(result.isChanged).toBe(true);
      expect(result.sender).toBe(mockSender);
    });

    it('должен ограничивать разрешение sender по maxResolution без команды mainCam', async () => {
      mockSenderFinder.findVideoSender.mockReturnValue(mockSender);
      mockCodecProvider.getCodecFromSender.mockResolvedValue('h264');
      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: 2 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      const balancerWithMaxResolution = new SenderBalancer(
        {
          senderFinder: mockSenderFinder,
          codecProvider: mockCodecProvider,
          parametersSetter: mockParametersSetter,
        },
        createSenderBalancerOptions({
          getServerHeaders,
          maxResolution: { width: 960, height: 540 },
        }),
      );

      await balancerWithMaxResolution.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 2,
        }),
      );
    });
  });

  describe('обработка команд', () => {
    beforeEach(() => {
      mockSenderFinder.findVideoSender.mockReturnValue(mockSender);
      mockCodecProvider.getCodecFromSender.mockResolvedValue('h264');
    });

    it('должен обработать PAUSE_MAIN_CAM', async () => {
      const headers: IMainCamHeaders = {
        mainCam: EContentMainCAM.PAUSE_MAIN_CAM,
      };

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: 200 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      serverHeaders = headers;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 200,
        }),
      );
    });

    it('должен обработать RESUME_MAIN_CAM', async () => {
      const headers: IMainCamHeaders = {
        mainCam: EContentMainCAM.RESUME_MAIN_CAM,
      };

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: 1 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      serverHeaders = headers;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 1,
        }),
      );
    });

    it('должен обработать MAX_MAIN_CAM_RESOLUTION с resolutionMainCam', async () => {
      const headers: IMainCamHeaders = {
        mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: '1280x720',
      };

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: 1.5 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      serverHeaders = headers;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 1.5,
        }),
      );
    });

    it('должен применять maxResolution из конструктора при RESUME_MAIN_CAM', async () => {
      const headers: IMainCamHeaders = {
        mainCam: EContentMainCAM.RESUME_MAIN_CAM,
      };

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: 3 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      const balancerWithMaxResolution = new SenderBalancer(
        {
          senderFinder: mockSenderFinder,
          codecProvider: mockCodecProvider,
          parametersSetter: mockParametersSetter,
        },
        createSenderBalancerOptions({
          getServerHeaders,
          maxResolution: { width: 640, height: 360 },
        }),
      );

      serverHeaders = headers;

      await balancerWithMaxResolution.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 3,
        }),
      );
    });

    it('должен обработать MAX_MAIN_CAM_RESOLUTION без resolutionMainCam', async () => {
      const headers: IMainCamHeaders = {
        mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
      };

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: 1 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      serverHeaders = headers;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 1,
        }),
      );
    });

    it('должен обработать ADMIN_STOP_MAIN_CAM', async () => {
      const headers: IMainCamHeaders = {
        mainCam: EContentMainCAM.ADMIN_STOP_MAIN_CAM,
      };

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: 1 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      serverHeaders = headers;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 1,
        }),
      );
    });

    it('должен обработать ADMIN_START_MAIN_CAM', async () => {
      const headers: IMainCamHeaders = {
        mainCam: EContentMainCAM.ADMIN_START_MAIN_CAM,
      };

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: 1 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      serverHeaders = headers;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 1,
        }),
      );
    });

    it('должен обработать undefined mainCam', async () => {
      const headers: IMainCamHeaders = {};

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: 1 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      serverHeaders = headers;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 1,
        }),
      );
    });

    it('должен обработать неизвестный mainCam', async () => {
      const headers: IMainCamHeaders = {
        mainCam: 'UNKNOWN_COMMAND' as EContentMainCAM,
      };

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: 1 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      serverHeaders = headers;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 1,
        }),
      );
    });
  });

  describe('reset', () => {
    it('должен вернуть resultNoChanged если sender не найден', async () => {
      mockSenderFinder.findVideoSender.mockReturnValue(undefined);

      const result = await senderBalancer.reset(mockConnection);

      expect(result.isChanged).toBe(false);
      expect(mockParametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
    });

    it('должен вернуть resultNoChanged если sender не имеет track', async () => {
      const senderWithoutTrack = new RTCRtpSenderMock({ track: undefined });

      mockSenderFinder.findVideoSender.mockReturnValue(senderWithoutTrack);

      const result = await senderBalancer.reset(mockConnection);

      expect(result.isChanged).toBe(false);
      expect(mockParametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
    });

    it('должен вернуть resultNoChanged если codec игнорируется', async () => {
      mockSenderFinder.findVideoSender.mockReturnValue(mockSender);
      mockCodecProvider.getCodecFromSender.mockResolvedValue('vp8');

      const balancerWithIgnore = new SenderBalancer(
        {
          senderFinder: mockSenderFinder,
          codecProvider: mockCodecProvider,
          parametersSetter: mockParametersSetter,
        },
        createSenderBalancerOptions({ getServerHeaders, ignoreForCodec: 'vp8' }),
      );

      const result = await balancerWithIgnore.reset(mockConnection);

      expect(result.isChanged).toBe(false);
      expect(mockParametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
    });

    it('должен восстановить параметры на основе разрешения трека', async () => {
      mockSenderFinder.findVideoSender.mockReturnValue(mockSender);
      mockCodecProvider.getCodecFromSender.mockResolvedValue('h264');
      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: 1, maxBitrate: 2_000_000 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      const result = await senderBalancer.reset(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 1,
        }),
      );
      expect(result.sender).toBe(mockSender);
    });

    it('должен сохранять maxResolution при сбросе балансировки', async () => {
      mockSenderFinder.findVideoSender.mockReturnValue(mockSender);
      mockCodecProvider.getCodecFromSender.mockResolvedValue('h264');
      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: 2 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      const balancerWithMaxResolution = new SenderBalancer(
        {
          senderFinder: mockSenderFinder,
          codecProvider: mockCodecProvider,
          parametersSetter: mockParametersSetter,
        },
        createSenderBalancerOptions({
          getServerHeaders,
          maxResolution: { width: 960, height: 540 },
        }),
      );

      await balancerWithMaxResolution.reset(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 2,
        }),
      );
    });

    it('должен обработать undefined width в getSettings', async () => {
      mockSenderFinder.findVideoSender.mockReturnValue(mockSender);
      mockCodecProvider.getCodecFromSender.mockResolvedValue('h264');
      (mockVideoTrack.getSettings as jest.Mock).mockReturnValue({ width: undefined, height: 1080 });
      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: 1, maxBitrate: 4_000_000 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      await senderBalancer.reset(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 1,
          maxBitrate: 4_000_000,
        }),
      );
    });

    it('должен отменить эффекты balance с PAUSE_MAIN_CAM', async () => {
      mockSenderFinder.findVideoSender.mockReturnValue(mockSender);
      mockCodecProvider.getCodecFromSender.mockResolvedValue('h264');
      mockParametersSetter.setEncodingsToSender
        .mockResolvedValueOnce({
          isChanged: true,
          parameters: {
            encodings: [{ scaleResolutionDownBy: 200, maxBitrate: 125_000 }],
            transactionId: '',
            codecs: [],
            headerExtensions: [],
          },
        })
        .mockResolvedValueOnce({
          isChanged: true,
          parameters: {
            encodings: [{ scaleResolutionDownBy: 1, maxBitrate: 2_000_000 }],
            transactionId: '',
            codecs: [],
            headerExtensions: [],
          },
        });

      serverHeaders = { mainCam: EContentMainCAM.PAUSE_MAIN_CAM };

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenNthCalledWith(
        1,
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 200,
        }),
      );

      await senderBalancer.reset(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenNthCalledWith(
        2,
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 1,
        }),
      );
    });
  });

  describe('граничные случаи', () => {
    beforeEach(() => {
      mockSenderFinder.findVideoSender.mockReturnValue(mockSender);
      mockCodecProvider.getCodecFromSender.mockResolvedValue('h264');
    });

    it('должен обработать undefined width в getSettings', async () => {
      (mockVideoTrack.getSettings as jest.Mock).mockReturnValue({ width: undefined, height: 1080 });

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ maxBitrate: 4_000_000 }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          maxBitrate: 4_000_000, // getMaximumBitrate для h264
        }),
      );
    });

    it('должен обработать пустую строку resolutionMainCam', async () => {
      const headers: IMainCamHeaders = {
        mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: '',
      };

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: Number.NaN }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      serverHeaders = headers;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: Number.NaN,
        }),
      );
    });

    it('должен обработать некорректный формат resolutionMainCam', async () => {
      const headers: IMainCamHeaders = {
        mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: 'invalid-format',
      };

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: Number.NaN }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      serverHeaders = headers;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: Number.NaN,
        }),
      );
    });

    it('должен обработать resolutionMainCam с нечисловыми значениями', async () => {
      const headers: IMainCamHeaders = {
        mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: 'abcxdef',
      };

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: Number.NaN }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      serverHeaders = headers;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: Number.NaN,
        }),
      );
    });

    it('должен обработать resolutionMainCam с одним числом', async () => {
      const headers: IMainCamHeaders = {
        mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: '1280',
      };

      mockParametersSetter.setEncodingsToSender.mockResolvedValue({
        isChanged: true,
        parameters: {
          encodings: [{ scaleResolutionDownBy: Number.NaN }],
          transactionId: '',
          codecs: [],
          headerExtensions: [],
        },
      });

      serverHeaders = headers;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: Number.NaN,
        }),
      );
    });
  });

  describe('чтение состояния после getCodecFromSender', () => {
    let sender4K: RTCRtpSender;

    beforeEach(() => {
      sender4K = new RTCRtpSenderMock({ track: createVideoTrack(3840, 2160) });
      mockSenderFinder.findVideoSender.mockReturnValue(sender4K);
    });

    it('должен применить команду сервера, пришедшую во время получения кодека', async () => {
      const codecDeferred = Promise.withResolvers<string>();

      mockCodecProvider.getCodecFromSender.mockReturnValue(codecDeferred.promise);

      const balancing = senderBalancer.balance(mockConnection);

      serverHeaders = HEADERS_MAX_720P;
      codecDeferred.resolve(CODEC);
      await balancing;

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledTimes(1);
      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        sender4K,
        PARAMETERS_4K_LIMITED_TO_720P,
      );
    });
  });

  describe('prepareTrackReplacement', () => {
    let track720: MediaStreamVideoTrack;
    let track4K: MediaStreamVideoTrack;
    let sender720: RTCRtpSender;

    beforeEach(() => {
      track720 = createVideoTrack(1280, 720);
      track4K = createVideoTrack(3840, 2160);
      sender720 = new RTCRtpSenderMock({ track: track720 });
      mockSenderFinder.findVideoSender.mockReturnValue(sender720);
      mockCodecProvider.getCodecFromSender.mockResolvedValue(CODEC);
    });

    it('должен ужесточить параметры до замены трека, если новый трек требует большего scaleResolutionDownBy', async () => {
      serverHeaders = HEADERS_MAX_720P;

      await senderBalancer.prepareTrackReplacement(sender720, track4K);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledTimes(1);
      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        sender720,
        PARAMETERS_4K_LIMITED_TO_720P,
      );
    });

    it('должен применить команду сервера, пришедшую во время получения кодека при подготовке замены', async () => {
      const codecDeferred = Promise.withResolvers<string>();

      mockCodecProvider.getCodecFromSender.mockReturnValue(codecDeferred.promise);

      const preparing = senderBalancer.prepareTrackReplacement(sender720, track4K);

      serverHeaders = HEADERS_MAX_720P;
      codecDeferred.resolve(CODEC);
      await preparing;

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        sender720,
        PARAMETERS_4K_LIMITED_TO_720P,
      );
    });

    it('должен ужесточить параметры по maxResolution без команды сервера', async () => {
      const balancerWithMaxResolution = new SenderBalancer(
        {
          senderFinder: mockSenderFinder,
          codecProvider: mockCodecProvider,
          parametersSetter: mockParametersSetter,
        },
        createSenderBalancerOptions({
          getServerHeaders,
          maxResolution: { width: 1920, height: 1080 },
        }),
      );

      await balancerWithMaxResolution.prepareTrackReplacement(sender720, track4K);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        sender720,
        expect.objectContaining({ scaleResolutionDownBy: 2 }),
      );
    });

    it('не должен менять параметры, если новый трек не требует большего scaleResolutionDownBy', async () => {
      await senderBalancer.prepareTrackReplacement(sender720, track4K);

      expect(mockParametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
    });

    it('не должен менять параметры при замене 4K на 720p', async () => {
      const sender4K = new RTCRtpSenderMock({ track: track4K });

      serverHeaders = HEADERS_MAX_720P;

      await senderBalancer.prepareTrackReplacement(sender4K, track720);

      expect(mockParametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
    });

    it('не должен менять параметры при PAUSE_MAIN_CAM, который уже строже нового трека', async () => {
      serverHeaders = { mainCam: EContentMainCAM.PAUSE_MAIN_CAM };

      await senderBalancer.prepareTrackReplacement(sender720, track4K);

      expect(mockParametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
    });

    it('не должен менять параметры, если codec игнорируется', async () => {
      const balancerWithIgnore = new SenderBalancer(
        {
          senderFinder: mockSenderFinder,
          codecProvider: mockCodecProvider,
          parametersSetter: mockParametersSetter,
        },
        createSenderBalancerOptions({ getServerHeaders, ignoreForCodec: CODEC }),
      );

      serverHeaders = HEADERS_MAX_720P;

      await balancerWithIgnore.prepareTrackReplacement(sender720, track4K);

      expect(mockParametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
    });

    it('не должен запрашивать кодек и менять параметры, если у отправителя нет трека', async () => {
      const senderWithoutTrack = new RTCRtpSenderMock({ track: undefined });

      serverHeaders = HEADERS_MAX_720P;

      await senderBalancer.prepareTrackReplacement(senderWithoutTrack, track4K);

      expect(mockCodecProvider.getCodecFromSender).not.toHaveBeenCalled();
      expect(mockParametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
    });

    it('должен отклонить промис, если получение кодека завершилось ошибкой', async () => {
      const error = new Error('getStats failed');

      mockCodecProvider.getCodecFromSender.mockRejectedValue(error);

      await expect(senderBalancer.prepareTrackReplacement(sender720, track4K)).rejects.toBe(error);
    });
  });

  describe('балансировка во время замены трека', () => {
    let track720: MediaStreamVideoTrack;
    let track4K: MediaStreamVideoTrack;
    let sender720: RTCRtpSender;

    beforeEach(async () => {
      track720 = createVideoTrack(1280, 720);
      track4K = createVideoTrack(3840, 2160);
      sender720 = new RTCRtpSenderMock({ track: track720 });
      mockSenderFinder.findVideoSender.mockReturnValue(sender720);
      mockCodecProvider.getCodecFromSender.mockResolvedValue(CODEC);

      await senderBalancer.prepareTrackReplacement(sender720, track4K);
      mockParametersSetter.setEncodingsToSender.mockClear();
    });

    it('balance должен применить более строгие параметры ожидаемого трека', async () => {
      serverHeaders = HEADERS_MAX_720P;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        sender720,
        PARAMETERS_4K_LIMITED_TO_720P,
      );
    });

    it('balance должен применить параметры текущего трека, если они строже ожидаемого', async () => {
      const sender4K = new RTCRtpSenderMock({ track: track4K });

      mockSenderFinder.findVideoSender.mockReturnValue(sender4K);
      await senderBalancer.prepareTrackReplacement(sender4K, track720);
      serverHeaders = HEADERS_MAX_720P;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenLastCalledWith(
        sender4K,
        PARAMETERS_4K_LIMITED_TO_720P,
      );
    });

    it('balance должен учитывать только текущий трек, если заменяется трек другого отправителя', async () => {
      const otherSender = new RTCRtpSenderMock({ track: createVideoTrack(1280, 720) });

      mockSenderFinder.findVideoSender.mockReturnValue(otherSender);
      serverHeaders = HEADERS_MAX_720P;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        otherSender,
        expect.objectContaining({ scaleResolutionDownBy: 1 }),
      );
    });

    it('reset должен применить более строгие параметры ожидаемого трека по maxResolution', async () => {
      const balancerWithMaxResolution = new SenderBalancer(
        {
          senderFinder: mockSenderFinder,
          codecProvider: mockCodecProvider,
          parametersSetter: mockParametersSetter,
        },
        createSenderBalancerOptions({
          getServerHeaders,
          maxResolution: { width: 1920, height: 1080 },
        }),
      );

      await balancerWithMaxResolution.prepareTrackReplacement(sender720, track4K);
      mockParametersSetter.setEncodingsToSender.mockClear();
      serverHeaders = HEADERS_MAX_720P;

      await balancerWithMaxResolution.reset(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        sender720,
        expect.objectContaining({ scaleResolutionDownBy: 2 }),
      );
    });

    it('balance должен учитывать только текущий трек после completeTrackReplacement', async () => {
      senderBalancer.completeTrackReplacement(sender720, track4K);
      serverHeaders = HEADERS_MAX_720P;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        sender720,
        expect.objectContaining({ scaleResolutionDownBy: 1 }),
      );
    });

    it('completeTrackReplacement с другим отправителем не должен завершать замену', async () => {
      const otherSender = new RTCRtpSenderMock({ track: track720 });

      senderBalancer.completeTrackReplacement(otherSender, track4K);
      serverHeaders = HEADERS_MAX_720P;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        sender720,
        PARAMETERS_4K_LIMITED_TO_720P,
      );
    });

    it('completeTrackReplacement с другим треком не должен завершать замену', async () => {
      senderBalancer.completeTrackReplacement(sender720, createVideoTrack(3840, 2160));
      serverHeaders = HEADERS_MAX_720P;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        sender720,
        PARAMETERS_4K_LIMITED_TO_720P,
      );
    });

    it('повторная подготовка замены должна заменить ожидаемый трек', async () => {
      await senderBalancer.prepareTrackReplacement(sender720, createVideoTrack(1280, 720));
      serverHeaders = HEADERS_MAX_720P;

      await senderBalancer.balance(mockConnection);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenLastCalledWith(
        sender720,
        expect.objectContaining({ scaleResolutionDownBy: 1 }),
      );
    });
  });

  describe('completeTrackReplacement', () => {
    it('не должен падать без подготовленной замены', () => {
      expect(() => {
        senderBalancer.completeTrackReplacement(mockSender, mockVideoTrack);
      }).not.toThrow();
    });
  });
});
