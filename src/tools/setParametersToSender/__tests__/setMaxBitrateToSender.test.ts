/// <reference types="jest" />
import findSenderByStream from '@/utils/findSenderByStream';
import setEncodingsToSender from '../setEncodingsToSender';
import setMaxBitrateToSender from '../setMaxBitrateToSender';

// Mock dependencies
jest.mock('@/utils/findSenderByStream');
jest.mock('../setEncodingsToSender');

describe('setMaxBitrateToSender', () => {
  let mockSenders: RTCRtpSender[];
  let mockMediaStream: MediaStream;
  let mockSender: RTCRtpSender;

  beforeEach(() => {
    mockSender = { track: { kind: 'video' } } as RTCRtpSender;
    mockSenders = [mockSender];
    mockMediaStream = {
      getTracks: jest.fn().mockReturnValue([{ kind: 'video' }]),
    } as unknown as MediaStream;

    // Mock the imported functions
    (findSenderByStream as jest.Mock) = jest.fn();
    (setEncodingsToSender as jest.Mock) = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call setEncodingsToSender when sender is found', async () => {
    const maxBitrate = 1_000_000;

    (findSenderByStream as jest.Mock).mockReturnValue(mockSender);
    (setEncodingsToSender as jest.Mock).mockResolvedValue(undefined);

    const result = await setMaxBitrateToSender(mockSenders, mockMediaStream, maxBitrate);

    expect(findSenderByStream).toHaveBeenCalledWith(mockSenders, mockMediaStream);
    expect(setEncodingsToSender).toHaveBeenCalledWith(mockSender, { maxBitrate });
    expect(result).toBeUndefined();
  });

  it('should return undefined when sender is not found', async () => {
    const maxBitrate = 1_000_000;

    (findSenderByStream as jest.Mock).mockReturnValue(undefined);

    const result = await setMaxBitrateToSender(mockSenders, mockMediaStream, maxBitrate);

    expect(findSenderByStream).toHaveBeenCalledWith(mockSenders, mockMediaStream);
    expect(setEncodingsToSender).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('should handle different maxBitrate values', async () => {
    const maxBitrate = 2_000_000;

    (findSenderByStream as jest.Mock).mockReturnValue(mockSender);
    (setEncodingsToSender as jest.Mock).mockResolvedValue(undefined);

    await setMaxBitrateToSender(mockSenders, mockMediaStream, maxBitrate);

    expect(setEncodingsToSender).toHaveBeenCalledWith(mockSender, { maxBitrate: 2_000_000 });
  });

  it('should handle zero maxBitrate', async () => {
    const maxBitrate = 0;

    (findSenderByStream as jest.Mock).mockReturnValue(mockSender);
    (setEncodingsToSender as jest.Mock).mockResolvedValue(undefined);

    await setMaxBitrateToSender(mockSenders, mockMediaStream, maxBitrate);

    expect(setEncodingsToSender).toHaveBeenCalledWith(mockSender, { maxBitrate: 0 });
  });

  it('should handle negative maxBitrate', async () => {
    const maxBitrate = -1000;

    (findSenderByStream as jest.Mock).mockReturnValue(mockSender);
    (setEncodingsToSender as jest.Mock).mockResolvedValue(undefined);

    await setMaxBitrateToSender(mockSenders, mockMediaStream, maxBitrate);

    expect(setEncodingsToSender).toHaveBeenCalledWith(mockSender, { maxBitrate: -1000 });
  });

  it('should handle empty senders array', async () => {
    const maxBitrate = 1_000_000;
    const emptySenders: RTCRtpSender[] = [];

    (findSenderByStream as jest.Mock).mockReturnValue(undefined);

    const result = await setMaxBitrateToSender(emptySenders, mockMediaStream, maxBitrate);

    expect(findSenderByStream).toHaveBeenCalledWith(emptySenders, mockMediaStream);
    expect(setEncodingsToSender).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('should handle setEncodingsToSender returning a value', async () => {
    const maxBitrate = 1_000_000;
    const mockReturnValue = { success: true };

    (findSenderByStream as jest.Mock).mockReturnValue(mockSender);
    (setEncodingsToSender as jest.Mock).mockResolvedValue(mockReturnValue);

    const result = await setMaxBitrateToSender(mockSenders, mockMediaStream, maxBitrate);

    expect(result).toBe(mockReturnValue);
  });

  it('should handle setEncodingsToSender throwing an error', async () => {
    const maxBitrate = 1_000_000;
    const mockError = new Error('Test error');

    (findSenderByStream as jest.Mock).mockReturnValue(mockSender);
    (setEncodingsToSender as jest.Mock).mockRejectedValue(mockError);

    await expect(setMaxBitrateToSender(mockSenders, mockMediaStream, maxBitrate)).rejects.toThrow(
      'Test error',
    );
  });
});
