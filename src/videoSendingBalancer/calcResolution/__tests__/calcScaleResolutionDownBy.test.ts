/// <reference types="jest" />
import type { TSize } from '@/types';
import calcScaleResolutionDownBy from '../calcScaleResolutionDownBy';

describe('calcScaleResolutionDownBy', () => {
  const mockVideoTrack = {} as MediaStreamVideoTrack;

  it('should scale resolution down and calculate max bitrate correctly', () => {
    const settings = { width: 1920, height: 1080 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TSize = { width: 1280, height: 720 };

    const result = calcScaleResolutionDownBy({
      videoTrack: mockVideoTrack,
      targetSize,
    });
    const resultResolutions = {
      width: settings.width / result,
      height: settings.height / result,
    };

    expect(result).toEqual(1.5);

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

    const result = calcScaleResolutionDownBy({
      videoTrack: mockVideoTrack,
      targetSize,
    });
    const resultResolutions = {
      width: settings.width / result,
      height: settings.height / result,
    };

    expect(result).toEqual(1);

    expect(resultResolutions).toEqual(settings);
  });

  it('should handle odd target width correctly', () => {
    const settings = { width: 1920, height: 1080 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TSize = { width: 640, height: 720 };

    const result = calcScaleResolutionDownBy({
      videoTrack: mockVideoTrack,
      targetSize,
    });
    const resultResolutions = {
      width: settings.width / result,
      height: settings.height / result,
    };

    expect(result).toEqual(3);

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

    const result = calcScaleResolutionDownBy({
      videoTrack: mockVideoTrack,
      targetSize,
    });
    const resultResolutions = {
      width: settings.width / result,
      height: settings.height / result,
    };

    expect(result).toEqual(3);

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

    const result = calcScaleResolutionDownBy({
      videoTrack: mockVideoTrack,
      targetSize,
    });
    const resultResolutions = {
      width: settings.width / result,
      height: settings.height / result,
    };

    expect(result).toEqual(3);

    expect(resultResolutions).toEqual(targetSize);
  });

  it('should handle small odd target values correctly', () => {
    const settings = { width: 640, height: 480 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TSize = { width: 320, height: 240 };

    const result = calcScaleResolutionDownBy({
      videoTrack: mockVideoTrack,
      targetSize,
    });
    const resultResolutions = {
      width: settings.width / result,
      height: settings.height / result,
    };

    expect(result).toEqual(2);

    expect(resultResolutions).toEqual({
      width: 320,
      height: 240,
    });
  });
});
