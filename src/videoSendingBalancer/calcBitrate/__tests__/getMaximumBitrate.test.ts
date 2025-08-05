/// <reference types="jest" />
import { MAXIMUM_BITRATE } from '../calcMaxBitrateByWidth';
import { getMaximumBitrate } from '../calcMaxBitrateByWidthAndCodec';

describe('getMaximumBitrate', () => {
  it('должен возвращать MAXIMUM_BITRATE без кодека', () => {
    expect(getMaximumBitrate()).toBe(MAXIMUM_BITRATE);
    expect(getMaximumBitrate(undefined)).toBe(MAXIMUM_BITRATE);
    expect(getMaximumBitrate('')).toBe(MAXIMUM_BITRATE);
  });

  it('должен возвращать MAXIMUM_BITRATE для vp8/vp9/h264', () => {
    expect(getMaximumBitrate('vp8')).toBe(MAXIMUM_BITRATE);
    expect(getMaximumBitrate('vp9')).toBe(MAXIMUM_BITRATE);
    expect(getMaximumBitrate('h264')).toBe(MAXIMUM_BITRATE);
    expect(getMaximumBitrate('VP8')).toBe(MAXIMUM_BITRATE);
    expect(getMaximumBitrate('H264')).toBe(MAXIMUM_BITRATE);
  });

  it('должен возвращать 0.6 * MAXIMUM_BITRATE для av1 (без учета регистра)', () => {
    expect(getMaximumBitrate('av1')).toBeCloseTo(MAXIMUM_BITRATE * 0.6);
    expect(getMaximumBitrate('av1x')).toBeCloseTo(MAXIMUM_BITRATE * 0.6);
    expect(getMaximumBitrate('AV1')).toBeCloseTo(MAXIMUM_BITRATE * 0.6);
    expect(getMaximumBitrate('some-av1-codec')).toBeCloseTo(MAXIMUM_BITRATE * 0.6);
    expect(getMaximumBitrate('codec_av1')).toBeCloseTo(MAXIMUM_BITRATE * 0.6);
  });

  it('должен возвращать MAXIMUM_BITRATE если av1 не подстрока', () => {
    expect(getMaximumBitrate('avi')).toBe(MAXIMUM_BITRATE);
    expect(getMaximumBitrate('a_v1')).toBe(MAXIMUM_BITRATE);
    expect(getMaximumBitrate('av1x')).toBeCloseTo(MAXIMUM_BITRATE * 0.6); // av1x содержит av1
  });

  it('работает с пробелами и сложными строками', () => {
    expect(getMaximumBitrate('  av1  ')).toBeCloseTo(MAXIMUM_BITRATE * 0.6);
    expect(getMaximumBitrate('codec:av1;profile=main')).toBeCloseTo(MAXIMUM_BITRATE * 0.6);
    expect(getMaximumBitrate('codec:vp8;profile=main')).toBe(MAXIMUM_BITRATE);
  });
});
