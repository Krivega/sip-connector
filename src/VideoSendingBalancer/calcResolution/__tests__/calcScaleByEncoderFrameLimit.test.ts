/// <reference types="jest" />
import calcScaleByEncoderFrameLimit from '../calcScaleByEncoderFrameLimit';

import type { TResolutionSize } from '@/types';

// OpenH264 не инициализирует энкодер, если в кадре больше 36 864 макроблоков 16×16
const ENCODER_MAX_MACROBLOCKS = 36_864;
const MACROBLOCK_SIZE = 16;
// Допуск к минимально достаточному уменьшению: кадр не должен ужиматься сильнее нужного
const SCALE_TOLERANCE = 1.01;

const createVideoTrack = (settings: MediaTrackSettings): MediaStreamVideoTrack => {
  return {
    getSettings: () => {
      return settings;
    },
  } as unknown as MediaStreamVideoTrack;
};

const countEncodedMacroblocks = ({ width, height }: TResolutionSize, scale: number): number => {
  return (
    Math.ceil(Math.ceil(width / scale) / MACROBLOCK_SIZE) *
    Math.ceil(Math.ceil(height / scale) / MACROBLOCK_SIZE)
  );
};

const getMaxNeededScale = ({ width, height }: TResolutionSize): number => {
  return (
    SCALE_TOLERANCE * Math.sqrt((width * height) / (ENCODER_MAX_MACROBLOCKS * MACROBLOCK_SIZE ** 2))
  );
};

describe('calcScaleByEncoderFrameLimit', () => {
  it.each([
    [3840, 2486],
    [4097, 2304],
    [6016, 3384],
  ])('уменьшает кадр %ix%i ровно до предела энкодера', (width, height) => {
    const size = { width, height };

    const scale = calcScaleByEncoderFrameLimit({ videoTrack: createVideoTrack(size) });

    expect(scale).toBeGreaterThan(1);
    expect(countEncodedMacroblocks(size, scale)).toBeLessThanOrEqual(ENCODER_MAX_MACROBLOCKS);
    expect(scale).toBeLessThanOrEqual(getMaxNeededScale(size));
  });

  it.each([
    [1920, 1080],
    [4096, 2304],
    [2160, 3840],
    [5120, 1440],
  ])('не уменьшает кадр %ix%i в пределе энкодера', (width, height) => {
    expect(calcScaleByEncoderFrameLimit({ videoTrack: createVideoTrack({ width, height }) })).toBe(
      1,
    );
  });

  it.each([
    ['ширины', { height: 2486 }],
    ['высоты', { width: 3840 }],
    ['размера', {}],
  ])('не уменьшает кадр без %s в настройках трека', (_name, settings) => {
    expect(calcScaleByEncoderFrameLimit({ videoTrack: createVideoTrack(settings) })).toBe(1);
  });
});
