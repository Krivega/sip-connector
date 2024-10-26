/// <reference types="jest" />
import type { TSize } from '../../types';
import scaleResolutionAndBitrate from '../scaleResolutionAndBitrate';

describe('scaleResolutionAndBitrate', () => {
  const mockVideoTrack = {
    getSettings: () => {
      return { width: 1920, height: 1080 };
    }, // Пример значений
  } as MediaStreamVideoTrack;

  it('should scale resolution down and calculate max bitrate correctly', () => {
    const targetSize: TSize = { width: 1280, height: 720 };
    const codec = 'vp8';

    const result = scaleResolutionAndBitrate({
      videoTrack: mockVideoTrack,
      targetSize,
      codec,
    });

    expect(result).toEqual({
      scaleResolutionDownBy: 1.5,
      maxBitrate: 1_000_000,
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

    expect(result).toEqual({
      scaleResolutionDownBy: 1,
      maxBitrate: 1_000_000,
    });
  });
});
