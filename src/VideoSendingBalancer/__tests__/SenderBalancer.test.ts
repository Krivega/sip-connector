/// <reference types="jest" />
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { EContentMainCAM } from '@/ApiManager';
import { SenderBalancer } from '../SenderBalancer';

import type { ICodecProvider, IMainCamHeaders, IParametersSetter, ISenderFinder } from '../types';

describe('SenderBalancer', () => {
  let senderBalancer: SenderBalancer;
  let mockSenderFinder: jest.Mocked<ISenderFinder>;
  let mockCodecProvider: jest.Mocked<ICodecProvider>;
  let mockParametersSetter: jest.Mocked<IParametersSetter>;
  let mockSender: RTCRtpSender;
  let mockVideoTrack: MediaStreamVideoTrack;
  let mockConnection: RTCPeerConnection;

  beforeEach(() => {
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
      {},
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
        { ignoreForCodec: 'vp8' },
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
        { ignoreForCodec: 'vp8' },
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

      await senderBalancer.balance(mockConnection, headers);

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

      await senderBalancer.balance(mockConnection, headers);

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

      await senderBalancer.balance(mockConnection, headers);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: 1.5,
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

      await senderBalancer.balance(mockConnection, headers);

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

      await senderBalancer.balance(mockConnection, headers);

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

      await senderBalancer.balance(mockConnection, headers);

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

      await senderBalancer.balance(mockConnection, headers);

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

      await senderBalancer.balance(mockConnection, headers);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
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

      await senderBalancer.balance(mockConnection, headers);

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

      await senderBalancer.balance(mockConnection, headers);

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

      await senderBalancer.balance(mockConnection, headers);

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

      await senderBalancer.balance(mockConnection, headers);

      expect(mockParametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        mockSender,
        expect.objectContaining({
          scaleResolutionDownBy: Number.NaN,
        }),
      );
    });
  });
});
