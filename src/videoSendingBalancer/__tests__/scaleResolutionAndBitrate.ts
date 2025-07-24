/// <reference types="jest" />
import type { TSize } from '../../types';
import scaleResolutionAndBitrate from '../scaleResolutionAndBitrate';

describe('scaleResolutionAndBitrate', () => {
  const mockVideoTrack = {} as MediaStreamVideoTrack;

  it('should scale resolution down and calculate max bitrate correctly', () => {
    const settings = { width: 1920, height: 1080 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TSize = { width: 1280, height: 720 };
    const codec = 'vp8';

    const result = scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize,
      codec,
    });
    const resultResolutions = {
      width: settings.width / result.scaleResolutionDownBy,
      height: settings.height / result.scaleResolutionDownBy,
    };

    expect(result).toEqual({
      scaleResolutionDownBy: 1.5,
      maxBitrate: 1_000_000,
    });

    expect(resultResolutions).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it('should use SCALE_MIN when scaling factor is less than 1', () => {
    const settings = { width: 640, height: 480 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TSize = { width: 1280, height: 720 };
    const codec = 'vp9';

    const result = scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize,
      codec,
    });
    const resultResolutions = {
      width: settings.width / result.scaleResolutionDownBy,
      height: settings.height / result.scaleResolutionDownBy,
    };

    expect(result).toEqual({
      scaleResolutionDownBy: 1,
      maxBitrate: 1_000_000,
    });

    expect(resultResolutions).toEqual(settings);
  });

  it('should handle odd target width correctly', () => {
    const settings = { width: 1920, height: 1080 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TSize = { width: 640, height: 720 };
    const codec = 'vp8';

    const result = scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize,
      codec,
    });
    const resultResolutions = {
      width: settings.width / result.scaleResolutionDownBy,
      height: settings.height / result.scaleResolutionDownBy,
    };

    expect(result).toEqual({
      scaleResolutionDownBy: 3,
      maxBitrate: 500_000,
    });

    expect(resultResolutions).toEqual({
      width: 640,
      height: 360,
    });
  });

  it('should handle odd target height correctly', () => {
    const settings = { width: 1920, height: 1080 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TSize = { width: 1280, height: 360 };
    const codec = 'vp8';

    const result = scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize,
      codec,
    });
    const resultResolutions = {
      width: settings.width / result.scaleResolutionDownBy,
      height: settings.height / result.scaleResolutionDownBy,
    };

    expect(result).toEqual({
      scaleResolutionDownBy: 3,
      maxBitrate: 1_000_000,
    });

    expect(resultResolutions).toEqual({
      width: 640,
      height: 360,
    });
  });

  it('should handle both odd target width and height correctly', () => {
    const settings = { width: 1920, height: 1080 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TSize = { width: 640, height: 360 };
    const codec = 'vp8';

    const result = scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize,
      codec,
    });
    const resultResolutions = {
      width: settings.width / result.scaleResolutionDownBy,
      height: settings.height / result.scaleResolutionDownBy,
    };

    expect(result).toEqual({
      scaleResolutionDownBy: 3,
      maxBitrate: 500_000,
    });

    expect(resultResolutions).toEqual(targetSize);
  });

  it('should handle small odd target values correctly', () => {
    const settings = { width: 640, height: 480 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TSize = { width: 320, height: 240 };
    const codec = 'vp8';

    const result = scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize,
      codec,
    });
    const resultResolutions = {
      width: settings.width / result.scaleResolutionDownBy,
      height: settings.height / result.scaleResolutionDownBy,
    };

    expect(result).toEqual({
      scaleResolutionDownBy: 2,
      maxBitrate: 320_000,
    });

    expect(resultResolutions).toEqual({
      width: 320,
      height: 240,
    });
  });
});
