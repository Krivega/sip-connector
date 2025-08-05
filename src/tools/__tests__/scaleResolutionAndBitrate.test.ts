/// <reference types="jest" />
import { calcMaxBitrateByWidthAndCodec, calcScaleResolutionDownBy } from '@/videoSendingBalancer';
import scaleResolutionAndBitrate from '../scaleResolutionAndBitrate';

// Mock dependencies
jest.mock('@/videoSendingBalancer');

describe('scaleResolutionAndBitrate', () => {
  let mockVideoTrack: MediaStreamVideoTrack;
  let mockTargetSize: { width: number; height: number };

  beforeEach(() => {
    mockVideoTrack = { kind: 'video' } as MediaStreamVideoTrack;
    mockTargetSize = { width: 1280, height: 720 };

    // Mock the imported functions
    (calcScaleResolutionDownBy as jest.Mock) = jest.fn().mockReturnValue(0.5);
    (calcMaxBitrateByWidthAndCodec as jest.Mock) = jest.fn().mockReturnValue(1_000_000);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return scaleResolutionDownBy and maxBitrate', () => {
    const result = scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize: mockTargetSize,
    });

    expect(result).toEqual({
      scaleResolutionDownBy: 0.5,
      maxBitrate: 1_000_000,
    });
  });

  it('should call calcScaleResolutionDownBy with correct parameters', () => {
    scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize: mockTargetSize,
    });

    expect(calcScaleResolutionDownBy).toHaveBeenCalledWith({
      videoTrack: mockVideoTrack,
      targetSize: mockTargetSize,
    });
  });

  it('should call calcMaxBitrateByWidthAndCodec with correct parameters', () => {
    scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize: mockTargetSize,
    });

    expect(calcMaxBitrateByWidthAndCodec).toHaveBeenCalledWith(1280, undefined);
  });

  it('should call calcMaxBitrateByWidthAndCodec with codec parameter', () => {
    const codec = 'video/VP8';

    scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize: mockTargetSize,
      codec,
    });

    expect(calcMaxBitrateByWidthAndCodec).toHaveBeenCalledWith(1280, codec);
  });

  it('should handle different target sizes', () => {
    const differentSize = { width: 1920, height: 1080 };

    scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize: differentSize,
    });

    expect(calcMaxBitrateByWidthAndCodec).toHaveBeenCalledWith(1920, undefined);
  });

  it('should handle different video tracks', () => {
    const differentVideoTrack = { kind: 'video', id: 'track2' } as MediaStreamVideoTrack;

    scaleResolutionAndBitrate({
      videoTrack: differentVideoTrack,
      targetSize: mockTargetSize,
    });

    expect(calcScaleResolutionDownBy).toHaveBeenCalledWith({
      videoTrack: differentVideoTrack,
      targetSize: mockTargetSize,
    });
  });

  it('should return different values when mocks return different values', () => {
    (calcScaleResolutionDownBy as jest.Mock) = jest.fn().mockReturnValue(0.25);
    (calcMaxBitrateByWidthAndCodec as jest.Mock) = jest.fn().mockReturnValue(2_000_000);

    const result = scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize: mockTargetSize,
    });

    expect(result).toEqual({
      scaleResolutionDownBy: 0.25,
      maxBitrate: 2_000_000,
    });
  });

  it('should handle zero values from mocks', () => {
    (calcScaleResolutionDownBy as jest.Mock) = jest.fn().mockReturnValue(0);
    (calcMaxBitrateByWidthAndCodec as jest.Mock) = jest.fn().mockReturnValue(0);

    const result = scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize: mockTargetSize,
    });

    expect(result).toEqual({
      scaleResolutionDownBy: 0,
      maxBitrate: 0,
    });
  });
});
