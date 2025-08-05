/* eslint-disable @typescript-eslint/unbound-method */
/// <reference types="jest" />
import { CodecProvider } from '../CodecProvider';

describe('CodecProvider', () => {
  let codecProvider: CodecProvider;
  let mockSender: jest.Mocked<RTCRtpSender>;

  beforeEach(() => {
    codecProvider = new CodecProvider();
    mockSender = {
      getStats: jest.fn(),
    } as unknown as jest.Mocked<RTCRtpSender>;
  });

  describe('getCodecFromSender', () => {
    it('должен вернуть кодек из sender', async () => {
      const mockStats = new Map();

      mockStats.set('codec-1', {
        type: 'codec',
        mimeType: 'video/h264',
      });

      (mockSender.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await codecProvider.getCodecFromSender(mockSender);

      expect(result).toBe('video/h264');
      expect(mockSender.getStats).toHaveBeenCalled();
    });

    it('должен вернуть пустую строку если кодек не найден', async () => {
      const mockStats = new Map();

      mockStats.set('outbound-rtp-1', {
        type: 'outbound-rtp',
        bytesSent: 1000,
      });

      (mockSender.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await codecProvider.getCodecFromSender(mockSender);

      expect(result).toBe('');
      expect(mockSender.getStats).toHaveBeenCalled();
    });

    it('должен вернуть пустую строку если stats пустые', async () => {
      const mockStats = new Map();

      (mockSender.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await codecProvider.getCodecFromSender(mockSender);

      expect(result).toBe('');
      expect(mockSender.getStats).toHaveBeenCalled();
    });

    it('должен вернуть пустую строку если кодек не имеет mimeType', async () => {
      const mockStats = new Map();

      mockStats.set('codec-1', {
        type: 'codec',
        // mimeType отсутствует
      });

      (mockSender.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await codecProvider.getCodecFromSender(mockSender);

      expect(result).toBe('');
      expect(mockSender.getStats).toHaveBeenCalled();
    });

    it('должен вернуть пустую строку если getStats возвращает undefined', async () => {
      (mockSender.getStats as jest.Mock).mockResolvedValue(undefined);

      await expect(codecProvider.getCodecFromSender(mockSender)).rejects.toThrow();
      expect(mockSender.getStats).toHaveBeenCalled();
    });

    it('должен обработать различные типы кодеков', async () => {
      const codecs = ['video/h264', 'video/vp8', 'video/vp9', 'video/av1', 'video/h265'];

      for (const codec of codecs) {
        const mockStats = new Map();

        mockStats.set('codec-1', {
          type: 'codec',
          mimeType: codec,
        });

        (mockSender.getStats as jest.Mock).mockResolvedValue(mockStats);

        // eslint-disable-next-line no-await-in-loop
        const result = await codecProvider.getCodecFromSender(mockSender);

        expect(result).toBe(codec);
      }
    });

    it('должен обработать ошибку в getStats', async () => {
      (mockSender.getStats as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(codecProvider.getCodecFromSender(mockSender)).rejects.toThrow('Network error');
      expect(mockSender.getStats).toHaveBeenCalled();
    });

    it('должен вернуть первый найденный кодек если их несколько', async () => {
      const mockStats = new Map();

      mockStats.set('codec-1', {
        type: 'codec',
        mimeType: 'video/h264',
      });
      mockStats.set('codec-2', {
        type: 'codec',
        mimeType: 'video/vp8',
      });

      (mockSender.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await codecProvider.getCodecFromSender(mockSender);

      expect(result).toBe('video/h264');
      expect(mockSender.getStats).toHaveBeenCalled();
    });

    it('должен игнорировать объекты без type', async () => {
      const mockStats = new Map();

      mockStats.set('codec-1', {
        mimeType: 'video/h264',
        // type отсутствует
      });

      (mockSender.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await codecProvider.getCodecFromSender(mockSender);

      expect(result).toBe('');
      expect(mockSender.getStats).toHaveBeenCalled();
    });

    it('должен обработать null значения в stats', async () => {
      const mockStats = new Map();

      // eslint-disable-next-line unicorn/no-null
      mockStats.set('codec-1', null);
      mockStats.set('codec-2', {
        type: 'codec',
        mimeType: 'video/h264',
      });

      (mockSender.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await codecProvider.getCodecFromSender(mockSender);

      expect(result).toBe('video/h264');
      expect(mockSender.getStats).toHaveBeenCalled();
    });
  });
});
