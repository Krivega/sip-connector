/// <reference types="jest" />
import getCodecFromSender from '../getCodecFromSender';

describe('getCodecFromSender', () => {
  let mockSender: RTCRtpSender;
  let mockGetStats: jest.Mock;

  beforeEach(() => {
    mockGetStats = jest.fn();
    mockSender = {
      getStats: mockGetStats,
    } as unknown as RTCRtpSender;
  });

  it('should return mimeType when codec stats exist', async () => {
    const mockStats = new Map([
      ['codec-1', { type: 'codec', mimeType: 'video/VP8' }],
      ['inbound-rtp-1', { type: 'inbound-rtp' }],
    ]);

    mockGetStats.mockResolvedValue(mockStats);

    const result = await getCodecFromSender(mockSender);

    expect(result).toBe('video/VP8');
    expect(mockGetStats).toHaveBeenCalledTimes(1);
  });

  it('should return undefined when no codec stats exist', async () => {
    const mockStats = new Map([
      ['inbound-rtp-1', { type: 'inbound-rtp' }],
      ['outbound-rtp-1', { type: 'outbound-rtp' }],
    ]);

    mockGetStats.mockResolvedValue(mockStats);

    const result = await getCodecFromSender(mockSender);

    expect(result).toBeUndefined();
    expect(mockGetStats).toHaveBeenCalledTimes(1);
  });

  it('should return undefined when stats report is empty', async () => {
    const mockStats = new Map();

    mockGetStats.mockResolvedValue(mockStats);

    const result = await getCodecFromSender(mockSender);

    expect(result).toBeUndefined();
    expect(mockGetStats).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple codec entries and return first one', async () => {
    const mockStats = new Map([
      ['codec-1', { type: 'codec', mimeType: 'video/VP8' }],
      ['codec-2', { type: 'codec', mimeType: 'video/H264' }],
      ['inbound-rtp-1', { type: 'inbound-rtp' }],
    ]);

    mockGetStats.mockResolvedValue(mockStats);

    const result = await getCodecFromSender(mockSender);

    expect(result).toBe('video/VP8');
    expect(mockGetStats).toHaveBeenCalledTimes(1);
  });

  it('should handle stats with undefined values', async () => {
    const mockStats = new Map([
      ['codec-1', undefined],
      ['codec-2', { type: 'codec', mimeType: 'video/VP8' }],
    ]);

    mockGetStats.mockResolvedValue(mockStats);

    const result = await getCodecFromSender(mockSender);

    expect(result).toBe('video/VP8');
    expect(mockGetStats).toHaveBeenCalledTimes(1);
  });

  it('should handle error from getStats', async () => {
    mockGetStats.mockRejectedValue(new Error('Stats error'));

    await expect(getCodecFromSender(mockSender)).rejects.toThrow('Stats error');
    expect(mockGetStats).toHaveBeenCalledTimes(1);
  });
});
