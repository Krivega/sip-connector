/// <reference types="jest" />
import calcScaleResolutionDownBy from '../calcScaleResolutionDownBy';

import type { TResolutionSize } from '@/types';

describe('calcScaleResolutionDownBy', () => {
  const mockVideoTrack = {} as MediaStreamVideoTrack;

  it('должен рассчитывать scaleResolutionDownBy при уменьшении разрешения до 1280x720', () => {
    const settings = { width: 1920, height: 1080 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TResolutionSize = { width: 1280, height: 720 };

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

  it('должен использовать SCALE_MIN, когда коэффициент масштабирования меньше 1', () => {
    const settings = { width: 640, height: 480 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TResolutionSize = { width: 1280, height: 720 };

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

  it('должен корректно обрабатывать нечётную целевую ширину', () => {
    const settings = { width: 1920, height: 1080 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TResolutionSize = { width: 640, height: 720 };

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

  it('должен корректно обрабатывать нечётную целевую высоту', () => {
    const settings = { width: 1920, height: 1080 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TResolutionSize = { width: 1280, height: 360 };

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

  it('должен корректно обрабатывать нечётные целевые ширину и высоту', () => {
    const settings = { width: 1920, height: 1080 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TResolutionSize = { width: 640, height: 360 };

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

  it('должен корректно обрабатывать маленькие нечётные целевые значения', () => {
    const settings = { width: 640, height: 480 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TResolutionSize = { width: 320, height: 240 };

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

  it('должен рассчитывать scaleResolutionDownBy по высоте, когда widthCurrent не задан', () => {
    const settings = { width: undefined, height: 1080 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TResolutionSize = { width: 1280, height: 720 };

    const result = calcScaleResolutionDownBy({
      videoTrack: mockVideoTrack,
      targetSize,
    });

    // scaleByWidth = SCALE_MIN (1), scaleByHeight = 1080/720 = 1.5
    // Math.max(1, 1.5, 1) = 1.5
    expect(result).toEqual(1.5);
  });

  it('должен рассчитывать scaleResolutionDownBy по ширине, когда heightCurrent не задан', () => {
    const settings = { width: 1920, height: undefined };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TResolutionSize = { width: 1280, height: 720 };

    const result = calcScaleResolutionDownBy({
      videoTrack: mockVideoTrack,
      targetSize,
    });

    // scaleByWidth = 1920/1280 = 1.5, scaleByHeight = SCALE_MIN (1)
    // Math.max(1.5, 1, 1) = 1.5
    expect(result).toEqual(1.5);
  });

  it('должен возвращать SCALE_MIN, когда widthCurrent и heightCurrent не заданы', () => {
    const settings = { width: undefined, height: undefined };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TResolutionSize = { width: 1280, height: 720 };

    const result = calcScaleResolutionDownBy({
      videoTrack: mockVideoTrack,
      targetSize,
    });

    expect(result).toEqual(1);
  });

  it('должен рассчитывать scaleResolutionDownBy по высоте, если widthCurrent не задан, а heightCurrent задан', () => {
    const settings = { width: undefined, height: 1080 };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TResolutionSize = { width: 1280, height: 720 };

    const result = calcScaleResolutionDownBy({
      videoTrack: mockVideoTrack,
      targetSize,
    });

    // scaleByWidth = SCALE_MIN (1), scaleByHeight = 1080/720 = 1.5
    // Math.max(1, 1.5, 1) = 1.5
    expect(result).toEqual(1.5);
  });

  it('должен рассчитывать scaleResolutionDownBy по ширине, если heightCurrent не задан, а widthCurrent задан', () => {
    const settings = { width: 1920, height: undefined };

    mockVideoTrack.getSettings = () => {
      return settings;
    };

    const targetSize: TResolutionSize = { width: 1280, height: 720 };

    const result = calcScaleResolutionDownBy({
      videoTrack: mockVideoTrack,
      targetSize,
    });

    // scaleByWidth = 1920/1280 = 1.5, scaleByHeight = SCALE_MIN (1)
    // Math.max(1.5, 1, 1) = 1.5
    expect(result).toEqual(1.5);
  });
});
